from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class VehicleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    plate: str
    vin: str | None
    model: str | None
    brand: str | None
    year: int | None
    fleet_id: UUID
    fleet_name: str
    firmware_version: str | None
    created_at: datetime
    updated_at: datetime


class FleetHealthRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    vehicle_id: UUID
    plate: str
    model: str | None
    fleet_name: str
    overall_health: float | None
    divergence_score: float | None
    failure_probability: float | None
    last_updated: datetime | None
    open_critical_anomalies: int
    open_tickets: int
