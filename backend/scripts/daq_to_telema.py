"""
Puente laboratorio: lee muestras (CSV/JSON) o genera RMS desde el acelerómetro y envía a Telema.

Modos:
  1) HTTP directo → POST /ingest/telemetry (recomendado mañana con tarjeta DAQ)
  2) Kafka → topic raw.telemetry (mismo formato que el simulador)

Ejemplos (HTTP):

  set TELEMA_API_URL=http://127.0.0.1:8000
  set TELEMA_INGEST_API_KEY=tu_clave_del_env
  set TELEMA_VEHICLE_ID=00000000-0000-4000-8000-000000000011
  python scripts/daq_to_telema.py --mode http --vibration-rms 0.42

CSV (columnas: vibration_rms o accel_rms; opcional speed, engine_temp…):

  python scripts/daq_to_telema.py --mode http --csv C:\\ruta\\muestras.csv --interval 0.5

Kafka (consumidor debe estar corriendo):

  python scripts/daq_to_telema.py --mode kafka --vibration-rms 0.5 --interval 0.5
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv

_backend = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_backend))
load_dotenv(_backend / ".env", encoding="utf-8", override=True)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_payload(
    vehicle_id: str,
    *,
    vibration_rms: float | None = None,
    speed: float | None = None,
    engine_temp: float | None = None,
    battery_voltage: float | None = None,
    rpm: int | None = None,
    extra: dict | None = None,
) -> dict:
    p: dict = {
        "vehicle_id": vehicle_id,
        "device_time": _now_iso(),
    }
    if vibration_rms is not None:
        p["vibration_rms"] = vibration_rms
    if speed is not None:
        p["speed"] = speed
    if engine_temp is not None:
        p["engine_temp"] = engine_temp
    if battery_voltage is not None:
        p["battery_voltage"] = battery_voltage
    if rpm is not None:
        p["rpm"] = rpm
    if extra:
        p.update(extra)
    return p


def post_http(api_url: str, api_key: str, payload: dict) -> None:
    url = f"{api_url.rstrip('/')}/ingest/telemetry"
    r = httpx.post(
        url,
        json=payload,
        headers={"X-Telema-Ingest-Key": api_key},
        timeout=30.0,
    )
    r.raise_for_status()


async def publish_kafka(payload: dict) -> None:
    from aiokafka import AIOKafkaProducer

    bootstrap = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "127.0.0.1:9092")
    topic = os.environ.get("KAFKA_TOPIC_RAW_TELEMETRY", "raw.telemetry")
    producer = AIOKafkaProducer(bootstrap_servers=bootstrap)
    await producer.start()
    try:
        await producer.send_and_wait(topic, json.dumps(payload).encode("utf-8"))
    finally:
        await producer.stop()


def iter_csv(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append({k.strip(): v for k, v in row.items() if k})
    return rows


def main() -> None:
    ap = argparse.ArgumentParser(description="DAQ / acelerómetro → Telema")
    ap.add_argument("--mode", choices=("http", "kafka"), default="http")
    ap.add_argument("--csv", type=Path, help="Archivo CSV exportado por software DAQ")
    ap.add_argument("--interval", type=float, default=0.5, help="Segundos entre envíos")
    ap.add_argument("--vibration-rms", type=float, help="RMS manual (una muestra o loop)")
    ap.add_argument("--vehicle-id", default=os.environ.get("TELEMA_VEHICLE_ID", ""))
    ap.add_argument("--loops", type=int, default=0, help="0 = infinito en modo single-value")
    args = ap.parse_args()

    vehicle_id = (args.vehicle_id or "").strip()
    if not vehicle_id:
        raise SystemExit("Define TELEMA_VEHICLE_ID o --vehicle-id (UUID del seed)")

    try:
        uuid.UUID(vehicle_id)
    except ValueError:
        raise SystemExit("vehicle_id debe ser UUID válido registrado en vehicles") from None

    if args.csv:
        rows = iter_csv(args.csv)
        api_url = os.environ.get("TELEMA_API_URL", "http://127.0.0.1:8000")
        api_key = os.environ.get("TELEMA_INGEST_API_KEY", "").strip()
        if args.mode == "http" and not api_key:
            raise SystemExit("TELEMA_INGEST_API_KEY requerido para modo http")
        for i, row in enumerate(rows):
            vib = row.get("vibration_rms") or row.get("accel_rms") or row.get("rms_accel")
            payload = build_payload(
                vehicle_id,
                vibration_rms=float(vib) if vib not in (None, "") else None,
                speed=float(row["speed"]) if row.get("speed") else None,
                engine_temp=float(row["engine_temp"]) if row.get("engine_temp") else None,
            )
            if args.mode == "http":
                post_http(api_url, api_key, payload)
            else:
                asyncio.run(publish_kafka(payload))
            print(f"[{i + 1}/{len(rows)}] enviado vib={payload.get('vibration_rms')}")
            time.sleep(args.interval)
        return

    api_url = os.environ.get("TELEMA_API_URL", "http://127.0.0.1:8000")
    api_key = os.environ.get("TELEMA_INGEST_API_KEY", "").strip()
    n = 0
    while True:
        n += 1
        payload = build_payload(
            vehicle_id,
            vibration_rms=args.vibration_rms,
            speed=40.0,
            engine_temp=78.0,
            battery_voltage=48.5,
            rpm=2200,
        )
        if args.mode == "http":
            if not api_key:
                raise SystemExit("TELEMA_INGEST_API_KEY requerido")
            post_http(api_url, api_key, payload)
        else:
            asyncio.run(publish_kafka(payload))
        print(f"#{n} OK · vibration_rms={payload.get('vibration_rms')}")
        if args.loops and n >= args.loops:
            break
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
