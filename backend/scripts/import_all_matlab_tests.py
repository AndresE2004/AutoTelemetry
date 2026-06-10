"""
Importa todos los .mat de una carpeta → 13 vehículos Suzuki Grand Vitara (prueba 01..13).

Orden: archivos *.mat ordenados por nombre. El 1.º → GV-PRB-01, el 2.º → GV-PRB-02, etc.
Si hay más de 13 archivos, se usan los primeros 13. Si hay menos, se importan los disponibles.

Uso (directo a Postgres, no requiere API):

  cd backend
  .\\.venv\\Scripts\\Activate.ps1
  python scripts\\seed_demo.py
  python scripts\\import_all_matlab_tests.py --dir "C:\\Users\\ASUS\\Desktop\\Datos"

Solo listar emparejamiento sin insertar:

  python scripts\\import_all_matlab_tests.py --dir "C:\\Users\\ASUS\\Desktop\\Datos" --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg
from dotenv import load_dotenv

_backend = Path(__file__).resolve().parent.parent
_scripts = Path(__file__).resolve().parent
sys.path.insert(0, str(_backend))
sys.path.insert(0, str(_scripts))
load_dotenv(_backend / ".env", encoding="utf-8", override=True)

from import_matlab_mat import mat_to_telema_df  # noqa: E402
from lab_vehicles import ALL_LAB_VEHICLE_IDS, lab_vehicle_plate, lab_vehicle_uuid  # noqa: E402

INSERT_SQL = """
INSERT INTO telemetry_readings (
    time, device_time, vehicle_id, speed, engine_temp, battery_voltage, rpm, vibration_rms,
    tire_pressure_fl, tire_pressure_fr, tire_pressure_rl, tire_pressure_rr,
    latitude, longitude, altitude, odometer, kafka_offset, raw_payload
) VALUES (
    %s, %s, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb
)
"""


def _dsn() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise SystemExit("DATABASE_URL no definido en backend/.env")
    for prefix in ("postgresql+psycopg2://", "postgresql+psycopg://", "postgresql+asyncpg://"):
        if url.startswith(prefix):
            return "postgresql://" + url[len(prefix) :]
    return url


def _sorted_mats(directory: Path) -> list[Path]:
    files = sorted(directory.glob("*.mat"), key=lambda p: p.name.lower())
    return files


def main() -> None:
    ap = argparse.ArgumentParser(description="Importar carpeta .mat → 13 pruebas Grand Vitara")
    ap.add_argument("--dir", type=Path, required=True, help="Carpeta con archivos .mat del profesor")
    ap.add_argument("--fs", type=float, default=2048)
    ap.add_argument("--window-sec", type=float, default=0.5)
    ap.add_argument("--max", type=int, default=13, help="Máximo de archivos a importar")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not args.dir.is_dir():
        raise SystemExit(f"No es una carpeta: {args.dir}")

    mats = _sorted_mats(args.dir)
    if not mats:
        raise SystemExit(f"No hay .mat en {args.dir}")

    n = min(len(mats), args.max, len(ALL_LAB_VEHICLE_IDS))
    base_time = datetime(2026, 5, 19, 10, 0, 0, tzinfo=timezone.utc)

    print(f"Carpeta: {args.dir}")
    print(f"Archivos .mat encontrados: {len(mats)} · importando: {n}\n")

    for i in range(n):
        mat_path = mats[i]
        vid = lab_vehicle_uuid(i)
        plate = lab_vehicle_plate(i)
        print(f"  [{i + 1:02d}/13] {mat_path.name}")
        print(f"       -> {plate}  vehicle_id={vid}")
        if args.dry_run:
            continue

        df = mat_to_telema_df(mat_path, args.fs, args.window_sec)
        rows = []
        for j, row in df.iterrows():
            t0 = base_time + timedelta(hours=i)
            device_time = t0 + timedelta(seconds=float(j) * args.window_sec)
            meta = {
                "source": "matlab_import",
                "mat_file": mat_path.name,
                "prueba": i + 1,
                "plate": plate,
                "vehicle": "Suzuki Grand Vitara LS 2009",
            }
            rows.append(
                (
                    datetime.now(timezone.utc),
                    device_time,
                    vid,
                    None,
                    None,
                    None,
                    None,
                    float(row["vibration_rms"]),
                    None,
                    None,
                    None,
                    None,
                    None,
                    None,
                    None,
                    None,
                    None,
                    json.dumps(meta),
                )
            )

        with psycopg.connect(_dsn()) as conn:
            with conn.cursor() as cur:
                cur.executemany(INSERT_SQL, rows)
            conn.commit()
        print(f"       OK {len(rows)} lecturas en telemetry_readings")

    if len(mats) > n:
        print(f"\nAviso: quedaron {len(mats) - n} .mat sin importar (límite {n}). Renombra o ejecuta de nuevo con --max.")

    print("\nListo. En la app: /flota (13 unidades GV-PRB-*) y /telemetria por vehículo.")


if __name__ == "__main__":
    main()
