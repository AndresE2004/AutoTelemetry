from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class TicketFromAnomalyRequest(BaseModel):
    """Índices de hypertable anomaly_events (PK compuesta): time + id."""

    anomaly_id: UUID
    anomaly_time: datetime
    title: str | None = Field(default=None, max_length=200)
    description: str | None = None


class MaintenanceTicketCreated(BaseModel):
    id: UUID
    vehicle_id: UUID
    status: str
    priority: str
    title: str
    description: str | None
    anomaly_event_id: UUID | None
    created_at: datetime | None


class MaintenanceTicketRead(BaseModel):
    id: UUID
    vehicle_id: UUID
    plate: str
    fleet_id: UUID
    fleet_name: str | None
    status: str
    priority: str
    title: str
    description: str | None
    anomaly_event_id: UUID | None
    assigned_to: UUID | None
    created_at: datetime | None
    updated_at: datetime | None
    resolved_date: datetime | None
    estimated_cost: float | None
    actual_cost: float | None


class TicketPatch(BaseModel):
    status: Literal["open", "in_progress", "resolved", "cancelled"] | None = None
    priority: Literal["low", "medium", "high", "critical"] | None = None

    @model_validator(mode="after")
    def at_least_one(self) -> TicketPatch:
        if self.status is None and self.priority is None:
            raise ValueError("Debe enviarse status y/o priority")
        return self
