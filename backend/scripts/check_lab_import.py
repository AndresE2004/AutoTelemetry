"""Comprueba si las pruebas .mat están en telemetry_readings."""
from __future__ import annotations

import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

load_dotenv(Path(__file__).resolve().parent.parent / ".env", encoding="utf-8")

LAB_FLEET = "00000000-0000-4000-8000-000000000002"


def _dsn() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise SystemExit("DATABASE_URL no definido")
    for prefix in ("postgresql+psycopg2://", "postgresql+psycopg://", "postgresql+asyncpg://"):
        if url.startswith(prefix):
            return "postgresql://" + url[len(prefix) :]
    return url


def main() -> None:
    with psycopg.connect(_dsn(), row_factory=dict_row) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT v.plate,
                       COUNT(t.*) AS lecturas,
                       MAX(t.raw_payload->>'mat_file') AS mat_file
                FROM vehicles v
                LEFT JOIN telemetry_readings t ON t.vehicle_id = v.id
                WHERE v.fleet_id = %s::uuid
                GROUP BY v.plate, v.id
                ORDER BY v.plate
                """,
                (LAB_FLEET,),
            )
            rows = cur.fetchall()
            with_data = [r for r in rows if r["lecturas"]]
            print(f"Placas flota lab: {len(rows)} | Con telemetria: {len(with_data)}")
            for r in rows:
                n = r["lecturas"]
                mf = r["mat_file"] or "-"
                print(f"  {r['plate']}: {n} lecturas  ({mf})")
            cur.execute(
                """
                SELECT raw_payload->>'mat_file' AS f, COUNT(*) AS n
                FROM telemetry_readings t
                JOIN vehicles v ON v.id = t.vehicle_id
                WHERE v.fleet_id = %s::uuid
                  AND t.raw_payload->>'source' = 'matlab_import'
                GROUP BY 1 ORDER BY 1
                """,
                (LAB_FLEET,),
            )
            mats = cur.fetchall()
            print(f"\nArchivos matlab_import distintos: {len(mats)}")
            for r in mats:
                print(f"  {r['f']}: {r['n']} filas")


if __name__ == "__main__":
    main()
