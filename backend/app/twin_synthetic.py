"""Ticks de gemelo sintético (mirror ligero del generador TS `lib/synthetic-twin-tick.ts`)."""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


TwinScenario = Literal["normal", "overheating", "battery_failure"]


@dataclass
class _Prev:
    speed_kmh: float
    engine_temp_c: float
    battery_voltage: float
    rpm: float
    tire_psi: dict[str, float]


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def next_twin_frame(
    prev: dict[str, Any] | None,
    scenario: str,
    vehicle_id: str,
    tick: int,
) -> dict[str, Any]:
    sc: TwinScenario = scenario if scenario in ("normal", "overheating", "battery_failure") else "normal"

    if prev is None:
        base = _Prev(42.0, 78.0, 49.2, 2200.0, {"fl": 32.0, "fr": 32.0, "rl": 31.0, "rr": 31.0})
    else:
        tp = prev["tirePsi"]
        base = _Prev(
            float(prev["speedKmh"]),
            float(prev["engineTempC"]),
            float(prev["batteryVoltage"]),
            float(prev["rpm"]),
            {"fl": float(tp["fl"]), "fr": float(tp["fr"]), "rl": float(tp["rl"]), "rr": float(tp["rr"])},
        )

    speed = base.speed_kmh
    temp_c = base.engine_temp_c
    volt = base.battery_voltage
    rpm = base.rpm
    tire = dict(base.tire_psi)

    if sc == "normal":
        speed = 38 + abs(math.sin(tick / 14)) * 22
        temp_c = 77 + math.sin(tick / 20) * 2.5
        volt = 48.8 + math.sin(tick / 31) * 0.35
        rpm = 1600 + speed * 28 + math.sin(tick / 11) * 120
        tire = {
            "fl": 31.5 + math.sin(tick / 25) * 0.4,
            "fr": 31.6 + math.cos(tick / 27) * 0.35,
            "rl": 30.8 + math.sin(tick / 29) * 0.3,
            "rr": 30.9 + math.cos(tick / 23) * 0.3,
        }

    elif sc == "overheating":
        speed = 35 + math.sin(tick / 18) * 12
        temp_c = min(97.0, base.engine_temp_c + 0.22 + math.sin(tick / 40) * 0.08)
        volt = 48.9 + math.sin(tick / 35) * 0.15
        rpm = 2100 + speed * 22
        tire = {"fl": 32.0, "fr": 32.0, "rl": 31.2, "rr": 31.1}

    else:  # battery_failure
        speed = 32 + math.sin(tick / 16) * 8
        temp_c = 79 + math.sin(tick / 30) * 1.2
        volt = max(43.8, base.battery_voltage - 0.045)
        rpm = 1900 + speed * 18
        tire = {"fl": 31.8, "fr": 31.7, "rl": 30.5 - tick * 0.004, "rr": 30.6}

    temp_risk = max(0.0, (temp_c - 84) / 14)
    volt_risk = max(0.0, (46.8 - volt) / 4)
    min_t = min(tire["fl"], tire["fr"], tire["rl"], tire["rr"])
    tire_risk = max(0.0, (28 - min_t) / 4) if min_t < 28 else 0.0

    anomaly_score = _clamp(0.08 + temp_risk * 0.55 + volt_risk * 0.5 + tire_risk * 0.25, 0, 0.99)
    anomaly_active = temp_c >= 90 or volt <= 46.2 or tire_risk > 0.35

    note = "SCADA · umbral ML / reglas" if anomaly_active else "SCADA · within range"

    return {
        "vehicleId": vehicle_id,
        "deviceTime": _iso_now(),
        "speedKmh": speed,
        "engineTempC": temp_c,
        "batteryVoltage": volt,
        "rpm": rpm,
        "tirePsi": tire,
        "anomalyScore": anomaly_score,
        "anomalyActive": anomaly_active,
        "scenario": sc,
        "pipelineNote": note,
    }
