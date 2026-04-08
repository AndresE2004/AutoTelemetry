from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.schemas.telemetry import TelemetryPointRead
from app.schemas.vehicle import VehicleRead

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


_LIST_SQL = text("""
    SELECT
        v.id,
        v.plate,
        v.vin,
        v.model,
        v.brand,
        v.year,
        v.fleet_id,
        f.name AS fleet_name,
        v.firmware_version,
        v.created_at,
        v.updated_at,
        vfh.overall_health,
        COALESCE(vfh.open_critical_anomalies, 0)::int AS open_critical_anomalies,
        COALESCE(vfh.open_tickets, 0)::int AS open_tickets
    FROM vehicles v
    INNER JOIN fleets f ON v.fleet_id = f.id
    LEFT JOIN v_fleet_health vfh ON vfh.vehicle_id = v.id
    ORDER BY v.plate
""")

_ONE_SQL = text("""
    SELECT
        v.id,
        v.plate,
        v.vin,
        v.model,
        v.brand,
        v.year,
        v.fleet_id,
        f.name AS fleet_name,
        v.firmware_version,
        v.created_at,
        v.updated_at,
        vfh.overall_health,
        COALESCE(vfh.open_critical_anomalies, 0)::int AS open_critical_anomalies,
        COALESCE(vfh.open_tickets, 0)::int AS open_tickets
    FROM vehicles v
    INNER JOIN fleets f ON v.fleet_id = f.id
    LEFT JOIN v_fleet_health vfh ON vfh.vehicle_id = v.id
    WHERE v.id = :vid
""")

_TELEMETRY_LAST_SQL = text("""
    SELECT time, device_time, speed, engine_temp, battery_voltage, rpm,
           latitude, longitude, odometer
    FROM (
        SELECT time, device_time, speed, engine_temp, battery_voltage, rpm,
               latitude, longitude, odometer
        FROM telemetry_readings
        WHERE vehicle_id = :vid
        ORDER BY time DESC
        LIMIT :lim
    ) sub
    ORDER BY time ASC
""")


class VehicleListItem(VehicleRead):
    overall_health: float | None = None
    open_critical_anomalies: int = 0
    open_tickets: int = 0


@router.get("", response_model=list[VehicleListItem])
async def list_vehicles(session: AsyncSession = Depends(get_session)) -> list[VehicleListItem]:
    result = await session.execute(_LIST_SQL)
    return [VehicleListItem.model_validate(row._mapping) for row in result.all()]


@router.get("/{vehicle_id}/telemetry", response_model=list[TelemetryPointRead])
async def get_vehicle_telemetry(
    vehicle_id: UUID,
    session: AsyncSession = Depends(get_session),
    limit: int = Query(500, ge=1, le=5000, description="Últimos N puntos (orden cronológico en la respuesta)"),
) -> list[TelemetryPointRead]:
    exists = await session.execute(
        text("SELECT 1 FROM vehicles WHERE id = :vid LIMIT 1"),
        {"vid": str(vehicle_id)},
    )
    if exists.first() is None:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    result = await session.execute(_TELEMETRY_LAST_SQL, {"vid": str(vehicle_id), "lim": limit})
    return [TelemetryPointRead.model_validate(row._mapping) for row in result.all()]


@router.get("/{vehicle_id}", response_model=VehicleListItem)
async def get_vehicle(vehicle_id: UUID, session: AsyncSession = Depends(get_session)) -> VehicleListItem:
    result = await session.execute(_ONE_SQL, {"vid": str(vehicle_id)})
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    return VehicleListItem.model_validate(row._mapping)
