from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TelemetryPointRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    time: datetime
    device_time: datetime
    speed: float | None = None
    engine_temp: float | None = None
    battery_voltage: float | None = None
    rpm: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    odometer: float | None = None
