"""Listado y ejecución de detección de anomalías (Isolation Forest → `anomaly_events`)."""

from __future__ import annotations

import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import require_auth, require_roles
from app.core.config import get_settings
from app.core.database import get_session
from app.schemas.anomaly import AnomalyRead, AnomalyRunRequest, AnomalyRunResponse
from ml.isolation_detector import run_isolation_detection

router = APIRouter(prefix="/anomalies", tags=["anomalies"], dependencies=[Depends(require_auth)])

_LIST_SQL = text("""
    SELECT
        ae.id,
        ae.time,
        ae.vehicle_id,
        v.plate,
        ae.anomaly_score,
        ae.severity,
        ae.sensor_affected,
        ae.model_version,
        ae.description,
        ae.ticket_id,
        ae.resolved_at
    FROM anomaly_events ae
    INNER JOIN vehicles v ON v.id = ae.vehicle_id
    ORDER BY ae.time DESC
    LIMIT :lim
""")


@router.get("/", response_model=list[AnomalyRead])
async def list_anomalies(
    session: AsyncSession = Depends(get_session),
    limit: int = Query(200, ge=1, le=2000),
) -> list[AnomalyRead]:
    result = await session.execute(_LIST_SQL, {"lim": limit})
    return [AnomalyRead.model_validate(row._mapping) for row in result.all()]


def _run_sync(body: AnomalyRunRequest) -> AnomalyRunResponse:
    settings = get_settings()
    dsn = getattr(settings, "database_url", None)
    vids = [str(x) for x in body.vehicle_ids] if body.vehicle_ids else None
    r = run_isolation_detection(
        dsn=dsn,
        vehicle_ids=vids,
        window=body.window,
        contamination=body.contamination,
    )
    return AnomalyRunResponse(vehicles_scanned=r.vehicles_scanned, rows_inserted=r.rows_inserted)


@router.post("/run", response_model=AnomalyRunResponse)
async def run_detection(body: AnomalyRunRequest, _=Depends(require_roles("admin", "technician", "fleet_manager"))) -> AnomalyRunResponse:
    """
    Ejecuta Isolation Forest por vehículo e inserta outliers en `anomaly_events`.
    Requiere telemetría suficiente por vehículo (≥40 puntos en la ventana).
    """
    try:
        return await asyncio.to_thread(_run_sync, body)
    except SystemExit as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"fallo detección: {e}") from e


@router.get("/vehicles/{vehicle_id}", response_model=list[AnomalyRead])
async def list_vehicle_anomalies(
    vehicle_id: UUID,
    session: AsyncSession = Depends(get_session),
    limit: int = Query(100, ge=1, le=1000),
) -> list[AnomalyRead]:
    exists = await session.execute(
        text("SELECT 1 FROM vehicles WHERE id = :vid LIMIT 1"),
        {"vid": str(vehicle_id)},
    )
    if exists.first() is None:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    q = text("""
        SELECT
            ae.id,
            ae.time,
            ae.vehicle_id,
            v.plate,
            ae.anomaly_score,
            ae.severity,
            ae.sensor_affected,
            ae.model_version,
            ae.description,
            ae.ticket_id,
            ae.resolved_at
        FROM anomaly_events ae
        INNER JOIN vehicles v ON v.id = ae.vehicle_id
        WHERE ae.vehicle_id = :vid
        ORDER BY ae.time DESC
        LIMIT :lim
    """)
    result = await session.execute(q, {"vid": str(vehicle_id), "lim": limit})
    return [AnomalyRead.model_validate(row._mapping) for row in result.all()]
