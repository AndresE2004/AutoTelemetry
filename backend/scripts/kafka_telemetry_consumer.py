"""
Consumidor Kafka → TimescaleDB (hypertable telemetry_readings).

  cd backend
  set KAFKA_BOOTSTRAP_SERVERS=127.0.0.1:9092
  python scripts/kafka_telemetry_consumer.py

Requiere: docker compose con Kafka arriba, migraciones y DATABASE_URL_ASYNC en backend/.env.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import asyncpg
from aiokafka import AIOKafkaConsumer
from dotenv import load_dotenv

_backend = Path(__file__).resolve().parent.parent
load_dotenv(_backend / ".env", encoding="utf-8", override=True)

logger = logging.getLogger(__name__)

INSERT_SQL = """
INSERT INTO telemetry_readings (
    time, device_time, vehicle_id, speed, engine_temp, battery_voltage, rpm,
    tire_pressure_fl, tire_pressure_fr, tire_pressure_rl, tire_pressure_rr,
    latitude, longitude, altitude, odometer, kafka_offset, raw_payload
) VALUES (
    $1, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb
)
"""


def _asyncpg_dsn(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return "postgresql://" + url[len("postgresql+asyncpg://") :]
    return url


def _parse_device_time(s: str) -> datetime:
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s)


def _row_from_message(offset: int, payload: dict[str, Any]) -> tuple[Any, ...]:
    now = datetime.now(timezone.utc)
    device_time = _parse_device_time(payload["device_time"])
    vid = str(payload["vehicle_id"])
    return (
        now,
        device_time,
        vid,
        float(payload["speed"]) if payload.get("speed") is not None else None,
        float(payload["engine_temp"]) if payload.get("engine_temp") is not None else None,
        float(payload["battery_voltage"]) if payload.get("battery_voltage") is not None else None,
        int(payload["rpm"]) if payload.get("rpm") is not None else None,
        float(payload["tire_pressure_fl"]) if payload.get("tire_pressure_fl") is not None else None,
        float(payload["tire_pressure_fr"]) if payload.get("tire_pressure_fr") is not None else None,
        float(payload["tire_pressure_rl"]) if payload.get("tire_pressure_rl") is not None else None,
        float(payload["tire_pressure_rr"]) if payload.get("tire_pressure_rr") is not None else None,
        float(payload["lat"]) if payload.get("lat") is not None else None,
        float(payload["lon"]) if payload.get("lon") is not None else None,
        float(payload["alt"]) if payload.get("alt") is not None else None,
        float(payload["odometer"]) if payload.get("odometer") is not None else None,
        offset,
        json.dumps(payload),
    )


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")

    db_url = os.environ.get("DATABASE_URL_ASYNC")
    if not db_url:
        raise SystemExit("DATABASE_URL_ASYNC no está definido (backend/.env)")

    bootstrap = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "127.0.0.1:9092").strip()
    topic = os.environ.get("KAFKA_TOPIC_RAW_TELEMETRY", "raw.telemetry").strip()
    group = os.environ.get("KAFKA_CONSUMER_GROUP", "telema-telemetry-writer").strip()

    pool = await asyncpg.create_pool(_asyncpg_dsn(db_url), min_size=1, max_size=4)
    consumer = AIOKafkaConsumer(
        topic,
        bootstrap_servers=bootstrap,
        group_id=group,
        auto_offset_reset="earliest",
        enable_auto_commit=True,
    )
    await consumer.start()
    logger.info("Kafka consumer · topic=%s · bootstrap=%s · group=%s", topic, bootstrap, group)

    try:
        while True:
            batch = await consumer.getmany(timeout_ms=1000, max_records=200)
            if not batch:
                continue
            for _tp, messages in batch.items():
                for msg in messages:
                    try:
                        data = json.loads(msg.value.decode("utf-8"))
                        row = _row_from_message(msg.offset, data)
                    except (json.JSONDecodeError, UnicodeDecodeError, KeyError, ValueError) as e:
                        logger.warning("mensaje omitido: %s", e)
                        continue
                    try:
                        async with pool.acquire() as conn:
                            await conn.execute(INSERT_SQL, *row)
                        logger.debug("offset=%s vehicle=%s", msg.offset, data.get("vehicle_id"))
                    except Exception:
                        logger.exception("fallo INSERT (¿vehicle_id existe en vehicles?) offset=%s", msg.offset)
    finally:
        await consumer.stop()
        await pool.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("detenido")
