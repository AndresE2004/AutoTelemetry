"""
Generador de telemetría sintética para N vehículos.
Publica en Kafka (raw.telemetry) cuando se configuran brokers; sirve también para datasets ML.
"""

from __future__ import annotations

import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from simulator.kafka_publisher import TelemetryPublisher
from simulator.physics_model import MotorcyclePhysics
from simulator.scenarios import ScenarioId

logger = logging.getLogger(__name__)


def _payload(
    vehicle_uuid: str,
    physics: MotorcyclePhysics,
    scenario: ScenarioId,
    tick: int,
) -> dict[str, Any]:
    """Construye un mensaje compatible con el pipeline SCADA / Pydantic."""
    dt = 0.5
    if scenario == ScenarioId.NORMAL:
        target = 40 + 12 * (abs((tick % 40) - 20) / 20)
        physics.motion_step(target, dt)
        physics.thermal_step(load=0.35 + physics.state.speed_kmh / 400, dt=dt)
        physics.electrical_step(power_draw_kw=4.0 + physics.state.speed_kmh / 30, dt=dt)
    elif scenario == ScenarioId.OVERHEATING:
        physics.motion_step(48, dt)
        physics.thermal_step(load=0.82 + tick * 0.002, dt=dt)
        physics.electrical_step(6.5, dt)
    else:
        physics.motion_step(36, dt)
        physics.thermal_step(0.4, dt)
        physics.electrical_step(9.0 + tick * 0.05, dt)
        if tick % 8 == 0:
            physics.tire_leak_step(corner_index=2, rate_psi_per_s=0.02, dt=1.0)

    s = physics.state
    now = datetime.now(timezone.utc)
    return {
        "device_time": now.isoformat(),
        "vehicle_id": vehicle_uuid,
        "speed": round(s.speed_kmh, 2),
        "engine_temp": round(s.engine_temp_c, 2),
        "battery_voltage": round(s.battery_voltage, 3),
        "rpm": int(s.rpm),
        "tire_pressure_fl": round(s.tire_psi[0], 2),
        "tire_pressure_fr": round(s.tire_psi[1], 2),
        "tire_pressure_rl": round(s.tire_psi[2], 2),
        "tire_pressure_rr": round(s.tire_psi[3], 2),
        "lat": 6.25 + (tick % 10) * 0.0001,
        "lon": -75.56 + (tick % 8) * 0.0001,
        "alt": 1480.0,
        "odometer": round(s.odometer_km, 3),
        "scenario": str(scenario),
        "simulator_tick": tick,
        "simulator_instance_id": str(uuid.uuid4()),
    }


async def run_simulation_loop(
    *,
    vehicle_ids: list[str],
    scenario: ScenarioId,
    interval_s: float = 0.5,
    kafka_bootstrap: str | None = None,
) -> None:
    physics_map = {vid: MotorcyclePhysics() for vid in vehicle_ids}
    publisher: TelemetryPublisher | None = None
    if kafka_bootstrap or os.environ.get("KAFKA_BOOTSTRAP_SERVERS"):
        servers = kafka_bootstrap or os.environ["KAFKA_BOOTSTRAP_SERVERS"]
        publisher = TelemetryPublisher(servers)
        await publisher.start()

    tick = 0
    try:
        while True:
            for vid in vehicle_ids:
                body = _payload(vid, physics_map[vid], scenario, tick)
                if publisher:
                    await publisher.publish(vid, body)
                else:
                    logger.debug("tick=%s %s", tick, body)
            tick += 1
            await asyncio.sleep(interval_s)
    finally:
        if publisher:
            await publisher.stop()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    vids = os.environ.get("SIM_VEHICLE_IDS", str(uuid.uuid4())).split(",")
    scen = ScenarioId(os.environ.get("SIM_SCENARIO", "normal"))
    try:
        asyncio.run(
            run_simulation_loop(vehicle_ids=[v.strip() for v in vids if v.strip()], scenario=scen)
        )
    except KeyboardInterrupt:
        logging.info("Simulador detenido (Ctrl+C).")
