from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AnomalyRead(BaseModel):
    id: UUID
    time: datetime
    vehicle_id: UUID
    plate: str
    anomaly_score: float
    severity: str
    sensor_affected: str | None
    model_version: str | None
    description: str | None
    ticket_id: UUID | None
    resolved_at: datetime | None


class AnomalyRunRequest(BaseModel):
    vehicle_ids: list[UUID] | None = Field(default=None, description="Si null, todos los vehículos")
    window: int = Field(default=400, ge=50, le=5000)
    contamination: float = Field(default=0.06, ge=0.01, le=0.5)


class AnomalyRunResponse(BaseModel):
    vehicles_scanned: int
    rows_inserted: int
