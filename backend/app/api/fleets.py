from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.schemas.vehicle import FleetHealthRow

router = APIRouter(prefix="/fleets", tags=["fleets"])

_EXISTS_FLEET = text("SELECT 1 FROM fleets WHERE id = :fid LIMIT 1")

_HEALTH_SQL = text("""
    SELECT
        vfh.vehicle_id,
        vfh.plate,
        vfh.model,
        vfh.fleet_name,
        vfh.overall_health,
        vfh.divergence_score,
        vfh.failure_probability,
        vfh.last_updated,
        COALESCE(vfh.open_critical_anomalies, 0)::int AS open_critical_anomalies,
        COALESCE(vfh.open_tickets, 0)::int AS open_tickets
    FROM v_fleet_health vfh
    INNER JOIN vehicles v ON v.id = vfh.vehicle_id
    WHERE v.fleet_id = :fleet_id
    ORDER BY vfh.plate
""")


@router.get("/{fleet_id}/health", response_model=list[FleetHealthRow])
async def fleet_health(
    fleet_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> list[FleetHealthRow]:
    exists = await session.execute(_EXISTS_FLEET, {"fid": str(fleet_id)})
    if exists.one_or_none() is None:
        raise HTTPException(status_code=404, detail="Flota no encontrada")
    result = await session.execute(_HEALTH_SQL, {"fleet_id": str(fleet_id)})
    return [FleetHealthRow.model_validate(r._mapping) for r in result.all()]
