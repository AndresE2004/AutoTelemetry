"""Inserción de lecturas de telemetría (Kafka consumer + API ingest)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

INSERT_SQL = text(
    """
    INSERT INTO telemetry_readings (
        time, device_time, vehicle_id, speed, engine_temp, battery_voltage, rpm, vibration_rms,
        tire_pressure_fl, tire_pressure_fr, tire_pressure_rl, tire_pressure_rr,
        latitude, longitude, altitude, odometer, kafka_offset, raw_payload
    ) VALUES (
        :time, :device_time, :vehicle_id, :speed, :engine_temp, :battery_voltage, :rpm, :vibration_rms,
        :tire_pressure_fl, :tire_pressure_fr, :tire_pressure_rl, :tire_pressure_rr,
        :latitude, :longitude, :altitude, :odometer, :kafka_offset, CAST(:raw_payload AS jsonb)
    )
    """
)

_EXISTS_VEHICLE = text("SELECT 1 FROM vehicles WHERE id = :vid LIMIT 1")


def vibration_rms_from_payload(payload: dict[str, Any]) -> float | None:
    for key in ("vibration_rms", "vib_rms", "accel_rms", "rms_accel"):
        v = payload.get(key)
        if v is None or v == "":
            continue
        try:
            return float(v)
        except (TypeError, ValueError):
            continue
    return None


def _parse_device_time(value: datetime | str) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    s = str(value)
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    dt = datetime.fromisoformat(s)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def row_params_from_payload(payload: dict[str, Any], *, kafka_offset: int | None = None) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    device_time = _parse_device_time(payload["device_time"])
    lat = payload.get("latitude", payload.get("lat"))
    lon = payload.get("longitude", payload.get("lon"))
    return {
        "time": now,
        "device_time": device_time,
        "vehicle_id": str(payload["vehicle_id"]),
        "speed": float(payload["speed"]) if payload.get("speed") is not None else None,
        "engine_temp": float(payload["engine_temp"]) if payload.get("engine_temp") is not None else None,
        "battery_voltage": float(payload["battery_voltage"]) if payload.get("battery_voltage") is not None else None,
        "rpm": int(payload["rpm"]) if payload.get("rpm") is not None else None,
        "vibration_rms": vibration_rms_from_payload(payload),
        "tire_pressure_fl": float(payload["tire_pressure_fl"]) if payload.get("tire_pressure_fl") is not None else None,
        "tire_pressure_fr": float(payload["tire_pressure_fr"]) if payload.get("tire_pressure_fr") is not None else None,
        "tire_pressure_rl": float(payload["tire_pressure_rl"]) if payload.get("tire_pressure_rl") is not None else None,
        "tire_pressure_rr": float(payload["tire_pressure_rr"]) if payload.get("tire_pressure_rr") is not None else None,
        "latitude": float(lat) if lat is not None else None,
        "longitude": float(lon) if lon is not None else None,
        "altitude": float(payload["altitude"]) if payload.get("altitude") is not None else float(payload["alt"]) if payload.get("alt") is not None else None,
        "odometer": float(payload["odometer"]) if payload.get("odometer") is not None else None,
        "kafka_offset": kafka_offset,
        "raw_payload": json.dumps(payload),
    }


async def insert_telemetry_payload(
    session: AsyncSession,
    payload: dict[str, Any],
    *,
    kafka_offset: int | None = None,
) -> None:
    vid = str(payload["vehicle_id"])
    exists = await session.execute(_EXISTS_VEHICLE, {"vid": vid})
    if exists.scalar() is None:
        raise ValueError(f"vehicle_id no registrado: {vid}")
    params = row_params_from_payload(payload, kafka_offset=kafka_offset)
    await session.execute(INSERT_SQL, params)
