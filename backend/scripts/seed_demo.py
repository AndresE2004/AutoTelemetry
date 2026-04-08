"""
Carga datos mínimos para el corte vertical API + TimescaleDB.
Uso (con Docker Postgres levantado y migraciones aplicadas):

  cd backend
  pip install -r requirements.txt
  copy .env.example .env
  python scripts/seed_demo.py

Idempotente: borra e inserta de nuevo la flota demo por UUID fijos.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

# Raíz backend en sys.path
_backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_backend_root))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(_backend_root / ".env", encoding="utf-8", override=True)

import psycopg  # noqa: E402
from psycopg.rows import dict_row  # noqa: E402

# UUIDs estables (demo)
DEMO_CLIENT = "00000000-0000-4000-8000-000000000001"
DEMO_FLEET = "00000000-0000-4000-8000-000000000002"
DEMO_VEHICLES = [
    ("00000000-0000-4000-8000-000000000011", "MED-1001", "Auteco", "Urban", 2024),
    ("00000000-0000-4000-8000-000000000012", "MED-1002", "Auteco", "Cargo", 2023),
    ("00000000-0000-4000-8000-000000000013", "MED-1003", "Auteco", "Urban", 2024),
]


def get_dsn() -> str:
    url = os.environ.get(
        "DATABASE_URL",
        "postgresql://telema:telema_dev@127.0.0.1:5433/telema",
    )
    for prefix in ("postgresql+psycopg2://", "postgresql+psycopg://", "postgresql+asyncpg://"):
        if url.startswith(prefix):
            url = "postgresql://" + url[len(prefix) :]
            break
    return url


def _require_schema(cur, dsn: str) -> None:
    cur.execute("SELECT current_database()")
    dbname = cur.fetchone()[0]
    cur.execute("SELECT to_regclass('public.digital_twins')")
    if cur.fetchone()[0] is None:
        u = urlparse(dsn)
        port = u.port or 5432
        host = u.hostname or "?"
        raise SystemExit(
            f"No hay tablas del proyecto en «{host}:{port}/{dbname}» (donde se conectó este script).\n"
            "Alembic y el seed deben usar la misma DATABASE_URL en backend/.env.\n"
            "Si Alembic usó el valor por defecto viejo (puerto 5432) y Docker está en 5433, "
            "ya está corregido en env.py: vuelve a ejecutar en backend/:\n"
            "  alembic upgrade head\n"
            "  python scripts/seed_demo.py\n"
            "O revisa que backend/.env cargue bien (UTF-8, sin errores en la línea DATABASE_URL)."
        )


def main() -> None:
    dsn = get_dsn()
    conn = psycopg.connect(dsn, autocommit=False)
    try:
        with conn.cursor() as cur:
            _require_schema(cur, dsn)
            # Limpieza demo previa (psycopg3: un execute = un solo comando)
            cur.execute(
                """
                DELETE FROM digital_twins WHERE vehicle_id IN (
                  SELECT id FROM vehicles WHERE fleet_id = %s::uuid
                )
                """,
                (DEMO_FLEET,),
            )
            cur.execute("DELETE FROM vehicles WHERE fleet_id = %s::uuid", (DEMO_FLEET,))
            cur.execute("DELETE FROM fleets WHERE id = %s::uuid", (DEMO_FLEET,))
            cur.execute("DELETE FROM clients WHERE id = %s::uuid", (DEMO_CLIENT,))

            cur.execute(
                """
                INSERT INTO clients (id, name, nit, contact_email)
                VALUES (%s::uuid, 'Auteco Mobility (demo)', '900.123.456-1', 'demo@auteco.example')
                """,
                (DEMO_CLIENT,),
            )
            cur.execute(
                """
                INSERT INTO fleets (id, name, client_id)
                VALUES (%s::uuid, 'Flota Medellín — demo vertical', %s::uuid)
                """,
                (DEMO_FLEET, DEMO_CLIENT),
            )

            now = datetime.now(timezone.utc)
            for vid, plate, brand, model, year in DEMO_VEHICLES:
                cur.execute(
                    """
                    INSERT INTO vehicles (
                      id, plate, vin, model, brand, year, fleet_id, firmware_version, created_at, updated_at
                    )
                    VALUES (
                      %s::uuid, %s, %s, %s, %s, %s, %s::uuid, '1.0.0-demo', %s, %s
                    )
                    """,
                    (
                        vid,
                        plate,
                        f"VIN-{plate}",
                        model,
                        brand,
                        year,
                        DEMO_FLEET,
                        now,
                        now,
                    ),
                )

            health_rows = [
                ("00000000-0000-4000-8000-000000000011", 0.92, 0.88, 0.90, 0.91, 0.903, 0.12, 0.08),
                ("00000000-0000-4000-8000-000000000012", 0.78, 0.72, 0.75, 0.74, 0.748, 0.22, 0.18),
                ("00000000-0000-4000-8000-000000000013", 0.88, 0.85, 0.87, 0.86, 0.865, 0.09, 0.05),
            ]
            for vid, eng, bat, tire, trans, overall, div, failp in health_rows:
                cur.execute(
                    """
                    INSERT INTO digital_twins (
                      vehicle_id, engine_health, battery_health, tire_health_avg,
                      transmission_health, overall_health, divergence_score, failure_probability,
                      last_updated, twin_state
                    )
                    VALUES (
                      %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, '{"demo": true}'::jsonb
                    )
                    """,
                    (vid, eng, bat, tire, trans, overall, div, failp, now),
                )

        conn.commit()
        print("Seed demo OK. Flota:", DEMO_FLEET)
        print("GET http://localhost:8000/vehicles")
        print("GET http://localhost:8000/fleets/%s/health" % DEMO_FLEET)

        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT COUNT(*) AS n FROM vehicles WHERE fleet_id = %s::uuid", (DEMO_FLEET,))
            print("Vehículos:", cur.fetchone()["n"])
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
