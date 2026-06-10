"""Exportaciones CSV/JSON para demo operativa (Telema)."""

from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_auth, require_roles
from app.core.database import get_session
from app.schemas.user import UserRead

router = APIRouter(prefix="/reports", tags=["reports"], dependencies=[Depends(require_auth)])

_EXISTS_FLEET = text("SELECT 1 FROM fleets WHERE id = :fid LIMIT 1")

_ANOMALIES_EXPORT = text("""
    SELECT
        ae.id::text AS id,
        ae.time::text AS time,
        ae.vehicle_id::text AS vehicle_id,
        v.plate AS plate,
        ae.anomaly_score::text AS anomaly_score,
        ae.severity AS severity,
        COALESCE(ae.sensor_affected, '') AS sensor_affected,
        COALESCE(ae.model_version, '') AS model_version,
        COALESCE(ae.description, '') AS description,
        COALESCE(ae.ticket_id::text, '') AS ticket_id,
        COALESCE(ae.resolved_at::text, '') AS resolved_at
    FROM anomaly_events ae
    INNER JOIN vehicles v ON v.id = ae.vehicle_id
    ORDER BY ae.time DESC
    LIMIT :lim
""")

_FLEET_HEALTH_EXPORT = text("""
    SELECT
        vfh.vehicle_id::text AS vehicle_id,
        vfh.plate AS plate,
        COALESCE(vfh.model, '') AS model,
        COALESCE(vfh.fleet_name, '') AS fleet_name,
        COALESCE(vfh.overall_health::text, '') AS overall_health,
        COALESCE(vfh.divergence_score::text, '') AS divergence_score,
        COALESCE(vfh.failure_probability::text, '') AS failure_probability,
        COALESCE(vfh.last_updated::text, '') AS last_updated,
        COALESCE(vfh.open_critical_anomalies, 0)::text AS open_critical_anomalies,
        COALESCE(vfh.open_tickets, 0)::text AS open_tickets
    FROM v_fleet_health vfh
    INNER JOIN vehicles v ON v.id = vfh.vehicle_id
    WHERE v.fleet_id = :fleet_id
    ORDER BY vfh.plate
""")


def _csv_response(filename: str, header: list[str], rows: list[list[str]]) -> Response:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(header)
    w.writerows(rows)
    return Response(
        content=buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/anomalies", response_model=None)
async def report_anomalies(
    session: AsyncSession = Depends(get_session),
    limit: int = Query(500, ge=1, le=5000),
    fmt: str = Query("json", alias="format", pattern=r"^(json|csv)$"),
    _: UserRead = Depends(require_roles("admin", "technician")),
) -> Response:
    result = await session.execute(_ANOMALIES_EXPORT, {"lim": limit})
    keys = (
        "id",
        "time",
        "vehicle_id",
        "plate",
        "anomaly_score",
        "severity",
        "sensor_affected",
        "model_version",
        "description",
        "ticket_id",
        "resolved_at",
    )
    raw = []
    for row in result.all():
        m = row._mapping
        raw.append({k: str(m[k]) if m[k] is not None else "" for k in keys})

    if fmt == "csv":
        header = list(keys)
        rows = [[r[k] for k in keys] for r in raw]
        return _csv_response("telema_anomalies.csv", header, rows)

    return Response(
        content=json.dumps(raw, ensure_ascii=False, indent=2),
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="telema_anomalies.json"'},
    )


@router.get("/fleet-health/{fleet_id}", response_model=None)
async def report_fleet_health(
    fleet_id: UUID,
    session: AsyncSession = Depends(get_session),
    fmt: str = Query("json", alias="format", pattern=r"^(json|csv)$"),
    _: UserRead = Depends(require_roles("admin", "fleet_manager", "viewer")),
) -> Response:
    exists = await session.execute(_EXISTS_FLEET, {"fid": str(fleet_id)})
    if exists.one_or_none() is None:
        raise HTTPException(status_code=404, detail="Flota no encontrada")

    result = await session.execute(_FLEET_HEALTH_EXPORT, {"fleet_id": str(fleet_id)})
    keys = (
        "vehicle_id",
        "plate",
        "model",
        "fleet_name",
        "overall_health",
        "divergence_score",
        "failure_probability",
        "last_updated",
        "open_critical_anomalies",
        "open_tickets",
    )
    raw = []
    for row in result.all():
        m = row._mapping
        raw.append({k: str(m[k]) if m[k] is not None else "" for k in keys})

    if fmt == "csv":
        rows = [[r[k] for k in keys] for r in raw]
        return _csv_response("telema_fleet_health.csv", list(keys), rows)

    return Response(
        content=json.dumps(raw, ensure_ascii=False, indent=2),
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="telema_fleet_health.json"'},
    )


_KPI_SQL_ALL = text("""
    SELECT
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE mt.status = 'open')::bigint AS open_n,
        COUNT(*) FILTER (WHERE mt.status = 'in_progress')::bigint AS in_progress_n,
        COUNT(*) FILTER (WHERE mt.status = 'resolved')::bigint AS resolved_n,
        COUNT(*) FILTER (WHERE mt.status = 'cancelled')::bigint AS cancelled_n,
        COUNT(*) FILTER (WHERE mt.priority = 'low')::bigint AS pri_low,
        COUNT(*) FILTER (WHERE mt.priority = 'medium')::bigint AS pri_med,
        COUNT(*) FILTER (WHERE mt.priority = 'high')::bigint AS pri_high,
        COUNT(*) FILTER (WHERE mt.priority = 'critical')::bigint AS pri_critical
    FROM maintenance_tickets mt
    INNER JOIN vehicles v ON v.id = mt.vehicle_id
""")
_KPI_SQL_FLEET = text("""
    SELECT
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE mt.status = 'open')::bigint AS open_n,
        COUNT(*) FILTER (WHERE mt.status = 'in_progress')::bigint AS in_progress_n,
        COUNT(*) FILTER (WHERE mt.status = 'resolved')::bigint AS resolved_n,
        COUNT(*) FILTER (WHERE mt.status = 'cancelled')::bigint AS cancelled_n,
        COUNT(*) FILTER (WHERE mt.priority = 'low')::bigint AS pri_low,
        COUNT(*) FILTER (WHERE mt.priority = 'medium')::bigint AS pri_med,
        COUNT(*) FILTER (WHERE mt.priority = 'high')::bigint AS pri_high,
        COUNT(*) FILTER (WHERE mt.priority = 'critical')::bigint AS pri_critical
    FROM maintenance_tickets mt
    INNER JOIN vehicles v ON v.id = mt.vehicle_id
    WHERE v.fleet_id = :fid
""")


@router.get("/maintenance-kpi", response_model=None)
async def report_maintenance_kpi(
    session: AsyncSession = Depends(get_session),
    fleet_id: UUID | None = Query(None),
    fmt: str = Query("json", alias="format", pattern=r"^(json|csv)$"),
    _: UserRead = Depends(require_roles("admin", "fleet_manager", "viewer")),
) -> Response:
    if fleet_id is not None:
        exists = await session.execute(_EXISTS_FLEET, {"fid": str(fleet_id)})
        if exists.one_or_none() is None:
            raise HTTPException(status_code=404, detail="Flota no encontrada")

    fid = str(fleet_id) if fleet_id else None
    sq = _KPI_SQL_ALL if fleet_id is None else _KPI_SQL_FLEET
    params = {} if fleet_id is None else {"fid": fid}
    row = (await session.execute(sq, params)).mappings().one()
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "scope_fleet_id": fid,
        "total_tickets": int(row["total"]),
        "by_status": {
            "open": int(row["open_n"]),
            "in_progress": int(row["in_progress_n"]),
            "resolved": int(row["resolved_n"]),
            "cancelled": int(row["cancelled_n"]),
        },
        "by_priority": {
            "low": int(row["pri_low"]),
            "medium": int(row["pri_med"]),
            "high": int(row["pri_high"]),
            "critical": int(row["pri_critical"]),
        },
    }

    if fmt == "csv":
        flat = [
            payload["generated_at"],
            payload["scope_fleet_id"] or "",
            str(payload["total_tickets"]),
            *[str(v) for v in payload["by_status"].values()],
            *[str(v) for v in payload["by_priority"].values()],
        ]
        header = [
            "generated_at",
            "scope_fleet_id",
            "total_tickets",
            "status_open",
            "status_in_progress",
            "status_resolved",
            "status_cancelled",
            "priority_low",
            "priority_medium",
            "priority_high",
            "priority_critical",
        ]
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(header)
        w.writerow(flat)
        return Response(
            content=buf.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="telema_maintenance_kpi.csv"'},
        )

    return Response(
        content=json.dumps(payload, ensure_ascii=False, indent=2),
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="telema_maintenance_kpi.json"'},
    )
