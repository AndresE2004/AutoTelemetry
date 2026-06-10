from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.services.telemetry_write import vibration_rms_from_payload


class TelemetryIngestBody(BaseModel):
    """Payload compatible con Kafka `raw.telemetry` y el consumidor SCADA."""

    vehicle_id: UUID
    device_time: datetime
    speed: float | None = None
    engine_temp: float | None = None
    battery_voltage: float | None = None
    rpm: int | None = None
    vibration_rms: float | None = Field(None, description="RMS acelerómetro (m/s² o g según calibración)")
    vib_rms: float | None = None
    accel_rms: float | None = None
    rms_accel: float | None = None
    tire_pressure_fl: float | None = None
    tire_pressure_fr: float | None = None
    tire_pressure_rl: float | None = None
    tire_pressure_rr: float | None = None
    latitude: float | None = None
    longitude: float | None = None
    lat: float | None = None
    lon: float | None = None
    altitude: float | None = None
    alt: float | None = None
    odometer: float | None = None

    @field_validator("device_time", mode="before")
    @classmethod
    def _device_time_str(cls, v: object) -> object:
        if isinstance(v, str) and v.endswith("Z"):
            return v[:-1] + "+00:00"
        return v

    def to_payload_dict(self) -> dict:
        d = self.model_dump(mode="json", exclude_none=True)
        if d.get("vibration_rms") is None:
            vib = vibration_rms_from_payload(d)
            if vib is not None:
                d["vibration_rms"] = vib
        return d


class TelemetryIngestResponse(BaseModel):
    status: str = "ok"
    vehicle_id: UUID
