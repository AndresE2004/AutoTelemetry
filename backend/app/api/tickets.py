"""Tickets de mantenimiento ligados a anomalías."""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_auth, require_roles
from app.core.config import get_settings
from app.core.database import get_session
from app.core.email_notify import send_ticket_created_email
from app.schemas.ticket import (
    MaintenanceTicketCreated,
    MaintenanceTicketRead,
    TicketFromAnomalyRequest,
    TicketPatch,
)

router = APIRouter(prefix="/tickets", tags=["tickets"], dependencies=[Depends(require_auth)])

_TICKET_SELECT = """
    SELECT
        mt.id,
        mt.vehicle_id,
        v.plate AS plate,
        v.fleet_id,
        f.name AS fleet_name,
        mt.status,
        mt.priority,
        mt.title,
        mt.description,
        mt.anomaly_event_id,
        mt.assigned_to,
        mt.created_at,
        mt.updated_at,
        mt.resolved_date,
        mt.estimated_cost,
        mt.actual_cost
    FROM maintenance_tickets mt
    INNER JOIN vehicles v ON v.id = mt.vehicle_id
    LEFT JOIN fleets f ON f.id = v.fleet_id
    WHERE mt.id = :tid
    LIMIT 1
"""

_SEVERITY_TO_PRIORITY = {"critical": "critical", "high": "high", "medium": "medium", "low": "low"}

_TICKET_STATUSES = frozenset({"open", "in_progress", "resolved", "cancelled"})


def _map_priority(severity: str) -> str:
    return _SEVERITY_TO_PRIORITY.get(severity.strip().lower(), "medium")


def _to_float(v: object | None) -> float | None:
    if v is None:
        return None
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _row_to_read(row: dict) -> MaintenanceTicketRead:
    return MaintenanceTicketRead(
        id=UUID(str(row["id"])),
        vehicle_id=UUID(str(row["vehicle_id"])),
        plate=str(row["plate"] or ""),
        fleet_id=UUID(str(row["fleet_id"])),
        fleet_name=row["fleet_name"],
        status=str(row["status"]),
        priority=str(row["priority"]),
        title=str(row["title"]),
        description=row["description"],
        anomaly_event_id=UUID(str(row["anomaly_event_id"])) if row.get("anomaly_event_id") else None,
        assigned_to=UUID(str(row["assigned_to"])) if row.get("assigned_to") else None,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        resolved_date=row["resolved_date"],
        estimated_cost=_to_float(row.get("estimated_cost")),
        actual_cost=_to_float(row.get("actual_cost")),
    )


async def _fetch_ticket(session: AsyncSession, ticket_id: UUID) -> MaintenanceTicketRead | None:
    r = await session.execute(text(_TICKET_SELECT), {"tid": str(ticket_id)})
    row = r.mappings().one_or_none()
    return _row_to_read(dict(row)) if row else None


@router.get("", response_model=list[MaintenanceTicketRead])
async def list_tickets(
    session: AsyncSession = Depends(get_session),
    _user=Depends(require_roles("admin", "technician", "fleet_manager", "viewer")),
    status_filter: str | None = Query(None, alias="status", description="open|in_progress|resolved|cancelled"),
    vehicle_id: UUID | None = Query(None),
    limit: int = Query(200, ge=1, le=500),
) -> list[MaintenanceTicketRead]:
    if status_filter is not None and status_filter not in _TICKET_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="status debe ser open, in_progress, resolved o cancelled",
        )
    clauses = ["1=1"]
    params: dict[str, object] = {"lim": limit}
    if status_filter:
        clauses.append("mt.status = :st")
        params["st"] = status_filter
    if vehicle_id is not None:
        clauses.append("mt.vehicle_id = :vid")
        params["vid"] = str(vehicle_id)

    q = text(
        f"""
        SELECT
            mt.id,
            mt.vehicle_id,
            v.plate AS plate,
            v.fleet_id,
            f.name AS fleet_name,
            mt.status,
            mt.priority,
            mt.title,
            mt.description,
            mt.anomaly_event_id,
            mt.assigned_to,
            mt.created_at,
            mt.updated_at,
            mt.resolved_date,
            mt.estimated_cost,
            mt.actual_cost
        FROM maintenance_tickets mt
        INNER JOIN vehicles v ON v.id = mt.vehicle_id
        LEFT JOIN fleets f ON f.id = v.fleet_id
        WHERE {" AND ".join(clauses)}
        ORDER BY mt.created_at DESC NULLS LAST
        LIMIT :lim
        """
    )
    r = await session.execute(q, params)
    return [_row_to_read(dict(row)) for row in r.mappings().all()]


@router.post("/from-anomaly", response_model=MaintenanceTicketCreated, status_code=201)
async def create_ticket_from_anomaly(
    body: TicketFromAnomalyRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    _user=Depends(require_roles("admin", "technician", "fleet_manager")),
) -> MaintenanceTicketCreated:
    sel = text(
        """
        SELECT
            ae.vehicle_id AS vehicle_id,
            ae.severity AS severity,
            ae.description AS description,
            ae.sensor_affected AS sensor_affected,
            ae.ticket_id AS ticket_id,
            ae.resolved_at AS resolved_at,
            ae.id AS anomaly_id,
            v.plate AS plate
        FROM anomaly_events ae
        INNER JOIN vehicles v ON v.id = ae.vehicle_id
        WHERE ae.id = :aid AND ae.time = :atime
        LIMIT 1
        """
    )
    r = await session.execute(sel, {"aid": str(body.anomaly_id), "atime": body.anomaly_time})
    row = r.mappings().one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anomalía no encontrada")
    if row["resolved_at"] is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="La anomalía ya está resuelta")
    if row["ticket_id"] is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La anomalía ya tiene ticket asociado",
        )

    prio = _map_priority(str(row["severity"]))
    plate = row["plate"] or "vehículo"
    default_title = f"Mantenimiento · anomalía {plate}"
    title = (body.title or "").strip() or default_title
    extra = []
    if row["sensor_affected"]:
        extra.append(f"sensor: {row['sensor_affected']}")
    extra.append(f"score detectado ({row['severity']})")
    default_desc_parts = ["Derivado de Isolation Forest.", *extra]
    if row["description"]:
        default_desc_parts.insert(0, str(row["description"]))
    desc = body.description if body.description is not None else "\n".join(default_desc_parts)

    ins = text(
        """
        INSERT INTO maintenance_tickets (
            vehicle_id, status, priority, title, description, anomaly_event_id
        )
        VALUES (
            :vehicle_id, 'open', :priority, :title, :description, :anomaly_event_id
        )
        RETURNING id, vehicle_id, status, priority, title, description, anomaly_event_id, created_at
        """
    )
    upd = text(
        """
        UPDATE anomaly_events
        SET ticket_id = CAST(:tid AS uuid)
        WHERE id = :aid AND time = :atime
        """
    )
    try:
        ins_r = await session.execute(
            ins,
            {
                "vehicle_id": str(row["vehicle_id"]),
                "priority": prio,
                "title": title[:200],
                "description": desc,
                "anomaly_event_id": str(body.anomaly_id),
            },
        )
        created = ins_r.mappings().one()
        tid = str(created["id"])
        await session.execute(
            upd,
            {"tid": tid, "aid": str(body.anomaly_id), "atime": body.anomaly_time},
        )
        await session.commit()
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No se pudo crear el ticket: {e}",
        ) from e

    created_out = MaintenanceTicketCreated(
        id=UUID(str(created["id"])),
        vehicle_id=UUID(str(created["vehicle_id"])),
        status=str(created["status"]),
        priority=str(created["priority"]),
        title=str(created["title"]),
        description=created["description"],
        anomaly_event_id=UUID(str(created["anomaly_event_id"])) if created["anomaly_event_id"] else None,
        created_at=created["created_at"],
    )

    if get_settings().smtp_enabled:
        background_tasks.add_task(
            send_ticket_created_email,
            ticket_id=str(created_out.id),
            plate=str(plate),
            title=created_out.title,
            priority=created_out.priority,
            description=created_out.description,
            anomaly_id=str(body.anomaly_id),
        )

    return created_out


@router.get("/{ticket_id}", response_model=MaintenanceTicketRead)
async def get_ticket(
    ticket_id: UUID,
    session: AsyncSession = Depends(get_session),
    _user=Depends(require_roles("admin", "technician", "fleet_manager", "viewer")),
) -> MaintenanceTicketRead:
    row = await _fetch_ticket(session, ticket_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket no encontrado")
    return row


@router.patch("/{ticket_id}", response_model=MaintenanceTicketRead)
async def patch_ticket(
    ticket_id: UUID,
    body: TicketPatch,
    session: AsyncSession = Depends(get_session),
    _user=Depends(require_roles("admin", "technician", "fleet_manager")),
) -> MaintenanceTicketRead:
    existing = await _fetch_ticket(session, ticket_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket no encontrado")

    new_status = body.status if body.status is not None else existing.status
    new_priority = body.priority if body.priority is not None else existing.priority

    resolved_sql = "resolved_date = resolved_date"
    params: dict[str, object] = {
        "id": str(ticket_id),
        "st": new_status,
        "pr": new_priority,
    }
    if body.status is not None:
        if body.status == "resolved":
            resolved_sql = "resolved_date = NOW()"
        else:
            resolved_sql = "resolved_date = NULL"

    upd = text(
        f"""
        UPDATE maintenance_tickets
        SET
            status = :st,
            priority = :pr,
            {resolved_sql},
            updated_at = NOW()
        WHERE id = :id
        """
    )
    await session.execute(upd, params)
    await session.commit()

    updated = await _fetch_ticket(session, ticket_id)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Ticket inconsistente tras actualizar")
    return updated
