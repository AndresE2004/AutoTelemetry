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
_scripts = Path(__file__).resolve().parent
sys.path.insert(0, str(_backend_root))
sys.path.insert(0, str(_scripts))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(_backend_root / ".env", encoding="utf-8", override=True)

import psycopg  # noqa: E402
from psycopg.rows import dict_row  # noqa: E402
from passlib.context import CryptContext  # noqa: E402

from lab_vehicles import (  # noqa: E402
    LAB_CLIENT_ID,
    LAB_CLIENT_NAME,
    LAB_FLEET_ID,
    LAB_FLEET_NAME,
    LAB_VEHICLES,
)

DEMO_CLIENT = LAB_CLIENT_ID
DEMO_FLEET = LAB_FLEET_ID
# (uuid, plate, brand, model, year) — 13 pruebas Suzuki Grand Vitara LS 2009
DEMO_VEHICLES = [(v[0], v[1], v[2], v[3], v[4]) for v in LAB_VEHICLES]

_pwd = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
# Cuatro roles demo (RBAC en frontend `lib/rbac.ts`).
DEMO_USERS: list[dict[str, str]] = [
    {"email": "admin@telema.example", "full_name": "Admin Demo", "role": "admin", "password": "Admin12345!"},
    {"email": "viewer@telema.example", "full_name": "Viewer Demo", "role": "viewer", "password": "Viewer12345!"},
    {"email": "technician@telema.example", "full_name": "Technician Demo", "role": "technician", "password": "Technician12345!"},
    {"email": "fleet@telema.example", "full_name": "Fleet Manager Demo", "role": "fleet_manager", "password": "FleetMgr12345!"},
]


def get_dsn() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit(
            "DATABASE_URL no está definido. Copia backend/.env.example a backend/.env."
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
                DELETE FROM telemetry_readings
                WHERE vehicle_id IN (
                  SELECT id FROM vehicles WHERE fleet_id = %s::uuid
                )
                """,
                (DEMO_FLEET,),
            )
            cur.execute(
                """
                DELETE FROM digital_twins WHERE vehicle_id IN (
                  SELECT id FROM vehicles WHERE fleet_id = %s::uuid
                )
                """,
                (DEMO_FLEET,),
            )
            # Dependencias hacia vehicles (orden FK): snapshots → anomalías → tickets → schedules → vehicles
            cur.execute(
                """
                DELETE FROM digital_twin_snapshots
                WHERE vehicle_id IN (
                  SELECT id FROM vehicles WHERE fleet_id = %s::uuid
                )
                """,
                (DEMO_FLEET,),
            )
            cur.execute(
                """
                DELETE FROM anomaly_events
                WHERE vehicle_id IN (
                  SELECT id FROM vehicles WHERE fleet_id = %s::uuid
                )
                """,
                (DEMO_FLEET,),
            )
            cur.execute(
                """
                DELETE FROM maintenance_tickets
                WHERE vehicle_id IN (
                  SELECT id FROM vehicles WHERE fleet_id = %s::uuid
                )
                """,
                (DEMO_FLEET,),
            )
            cur.execute(
                """
                DELETE FROM maintenance_schedules
                WHERE vehicle_id IN (
                  SELECT id FROM vehicles WHERE fleet_id = %s::uuid
                )
                """,
                (DEMO_FLEET,),
            )
            cur.execute("DELETE FROM vehicles WHERE fleet_id = %s::uuid", (DEMO_FLEET,))
            cur.execute("DELETE FROM fleets WHERE id = %s::uuid", (DEMO_FLEET,))
            # Borrar usuarios que referencian el cliente demo (FK users.client_id -> clients.id)
            cur.execute("DELETE FROM users WHERE client_id = %s::uuid", (DEMO_CLIENT,))
            for u in DEMO_USERS:
                cur.execute("DELETE FROM users WHERE lower(email) = lower(%s)", (u["email"],))
            cur.execute("DELETE FROM clients WHERE id = %s::uuid", (DEMO_CLIENT,))

            cur.execute(
                """
                INSERT INTO clients (id, name, nit, contact_email)
                VALUES (%s::uuid, %s, '900.123.456-1', 'lab@telema.example')
                """,
                (DEMO_CLIENT, LAB_CLIENT_NAME),
            )
            for u in DEMO_USERS:
                cur.execute(
                    """
                    INSERT INTO users (email, full_name, role, client_id, hashed_password, is_active)
                    VALUES (%s, %s, %s, %s::uuid, %s, TRUE)
                    """,
                    (
                        u["email"],
                        u["full_name"],
                        u["role"],
                        DEMO_CLIENT,
                        _pwd.hash(u["password"]),
                    ),
                )
            cur.execute(
                """
                INSERT INTO fleets (id, name, client_id)
                VALUES (%s::uuid, %s, %s::uuid)
                """,
                (DEMO_FLEET, LAB_FLEET_NAME, DEMO_CLIENT),
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

            # Salud inicial distinta por prueba (se actualiza con telemetría/anomalías reales)
            health_rows = []
            for i, (vid, *_rest) in enumerate(DEMO_VEHICLES):
                base = 0.82 + (i % 5) * 0.03
                health_rows.append(
                    (vid, base, base - 0.02, base - 0.01, base, base, 0.05 + (i % 3) * 0.04, 0.08),
                )
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
        print("Usuarios demo (email / password / rol):")
        for u in DEMO_USERS:
            print(f"  - {u['email']} / {u['password']} / {u['role']}")
        print("GET http://localhost:8000/vehicles")
        print("GET http://localhost:8000/fleets/%s/health" % DEMO_FLEET)
        print("Vehículos Suzuki Grand Vitara (importar .mat con scripts/import_all_matlab_tests.py):")
        for i, (vid, plate, brand, model, year) in enumerate(DEMO_VEHICLES):
            print(f"  Prueba {i + 1:02d}: {plate}  {brand} {model} {year}  id={vid}")

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
