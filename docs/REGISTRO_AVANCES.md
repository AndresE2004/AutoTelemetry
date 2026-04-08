# Telema Mobility — Registro de avances

Documento vivo: ir actualizándolo cuando se complete un bloque de trabajo relevante.

---

## Estado de la base de datos

**PostgreSQL 15 + TimescaleDB está definido en código (Docker + Alembic), pero el contenedor solo corre si tienes Docker activo.**

| Qué | Dónde |
|-----|--------|
| Contenedores | `infra/docker-compose.yml` → `postgres` (TimescaleDB), `zookeeper`, `kafka` (Confluent 7.6) |
| Migraciones | `backend/alembic/versions/20260327_0001_initial_timescale_schema.py` |
| Variables backend | `backend/.env.example` → copiar a `backend/.env` (`DATABASE_URL` y `DATABASE_URL_ASYNC` con host **`127.0.0.1:5433`** por defecto) |
| Variables Docker (opcional) | `infra/.env.example` → `infra/.env` si quieres cambiar `POSTGRES_PORT` (por defecto el compose ya usa **5433** en el host) |

**Frontend:** con `NEXT_PUBLIC_API_URL` en `.env.local`, `/flota` consume `GET /vehicles` y **`/telemetria`** consume `GET /vehicles/{id}/telemetry` (FastAPI + Timescale) para series en vivo sobre la hypertable `telemetry_readings`.

**Kafka (local):** `docker compose -f infra/docker-compose.yml up -d` levanta Zookeeper + Kafka (`127.0.0.1:9092` hacia el host). El simulador publica en el topic `raw.telemetry`; el script `backend/scripts/kafka_telemetry_consumer.py` escribe en la hypertable `telemetry_readings`.

### Ejecutar el stack en local (orden recomendado)

1. **Docker Desktop** (o motor Docker) encendido.
2. **Contenedores** (raíz del repo):

```bash
docker compose -f infra/docker-compose.yml up -d
```

3. **Backend** (`backend/`): `pip install -r requirements.txt`, copiar `backend/.env.example` → `backend/.env`, comprobar que las URLs usen **`127.0.0.1:5433`** (mapeo por defecto del compose). Migraciones y datos demo:

```bash
cd backend
alembic upgrade head
python scripts/seed_demo.py
```

4. **API** (otra terminal, `backend/`): `uvicorn app.main:app --reload --host 127.0.0.1 --port 8000` — documentación en `http://127.0.0.1:8000/docs`.

5. **Front** (raíz del repo): `.env.local` con `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`, luego `npm install` (primera vez) y `npm run dev` — típicamente `http://localhost:3000` (**`/flota`**, **`/telemetria`**).

6. **Opcional (telemetría vía Kafka):** con Kafka ya arriba, en terminales aparte desde `backend/`: `python scripts/kafka_telemetry_consumer.py` y, para publicar, `python -m simulator.synthetic_generator` (definir `SIM_VEHICLE_IDS` con UUIDs del seed; ver comentarios en `backend/.env.example`).

**Credenciales BD:** usuario `telema`, contraseña `telema_dev`, base `telema`. Desde el **host** el puerto es **`5433`** (dentro del contenedor sigue siendo **5432**). Motivo: en Windows a menudo hay otro PostgreSQL en `:5432`; si conectas al equivocado aparecen fallos de contraseña o errores confusos con **asyncpg**.

### Qué crea la primera migración

- Extensión **timescaledb**
- Tablas: `clients`, `fleets`, `users`, `vehicles`, `ga_jobs`, `digital_twins`, `ml_models`, `maintenance_tickets`, `anomaly_events`, `telemetry_readings`, `digital_twin_snapshots`, `pipeline_audit_log`, `maintenance_schedules`
- Hypertables (chunks): `telemetry_readings` (7 días), `anomaly_events` (7 días), `digital_twin_snapshots` (1 día), `pipeline_audit_log` (1 día)
- Políticas de compresión según el prompt (telemetría 30 día, snapshots 30 día, audit 7 día)
- Vistas `v_fleet_health`, `v_active_ga_jobs` (con `COUNT(DISTINCT …)` para evitar duplicados por JOINs)

**Nota:** `maintenance_tickets` se crea primero **sin** `anomaly_event_id`; luego se añade la columna y FK hacia `anomaly_events` para romper el ciclo con `ticket_id`.

### Cerrar el entorno al terminar (sin borrar datos)

1. En cada terminal donde algo siga corriendo: **Ctrl+C** (consumidor Kafka, simulador, `uvicorn`, `npm run dev`).
2. **Contenedores Docker:** desde la raíz del repo, bajar servicios **manteniendo volúmenes** (la BD y Kafka conservan datos para la próxima vez):

```bash
docker compose -f infra/docker-compose.yml stop
```

   O, equivalente, **apagado y eliminación de contenedores** (los volúmenes nombrados como `telema_pg_data` **no** se borran con este comando):

```bash
docker compose -f infra/docker-compose.yml down
```

3. **Docker Desktop:** puedes cerrarlo si no vas a usar más contenedores hoy (opcional).

**No uses `down -v`** salvo que quieras **eliminar volúmenes** y empezar la BD desde cero (habría que volver a `alembic upgrade head` y `seed_demo.py`).

---

## Cronología de lo implementado

### 2026-03-27 — Limpieza del front generado por v0 y marca Telema

- Eliminada caché `.next` y `components.json`; renombrado el paquete a `telema-mobility-web`.
- Reescritura de layout, estilos (`globals.css`), sidebar, header, tarjetas del dashboard, flota, alertas, optimización GA, páginas de apoyo (`/pipeline`, `/telemetria`, `/twins`, etc.).
- Pipeline descrito como **SCADA en Python** (sin Scala/Flink en la UI).
- Añadido `.gitignore` básico; ajuste de `next.config.mjs`.

### 2026-03-27 — Módulo Gemelo digital visual (prompt ampliado)

- Dependencias: **Three.js**, **@react-three/fiber**, **@react-three/drei**.
- Ruta **`/digital-twin`**: visor 3D procedural, gauges, alertas, log de eventos, gráfica Recharts, tres escenarios (normal / sobrecalentamiento / batería).
- Hook **`useTwinWebSocket`**: simulación local cada ~500 ms si no hay `NEXT_PUBLIC_TWIN_WS_URL`; si existe, intenta WebSocket `.../ws/twin/{vehicle_id}`.
- Backend: `backend/simulator/` (`physics_model`, `scenarios`, `kafka_publisher`, `synthetic_generator`) + tests pytest mínimos.

### 2026-03-27 — Postgres + TimescaleDB listos (infra y migración)

- `infra/docker-compose.yml` con volumen persistente `telema_pg_data`.
- Alembic en `backend/`: `alembic.ini`, `alembic/env.py`, revisión `20260327_0001`.
- `backend/requirements.txt`: SQLAlchemy, Alembic, `psycopg[binary]` (v3, migraciones), pydantic-settings.
- `backend/.env.example` con `DATABASE_URL` de ejemplo.

### 2026-03-27 — Corte vertical API ↔ TimescaleDB ↔ Flota (TanStack Query)

- **FastAPI** (`backend/app/main.py`): `GET /health`, `GET /vehicles`, `GET /vehicles/{id}`, `GET /fleets/{fleet_id}/health`, CORS, OpenAPI en `/docs`.
- **SQLAlchemy async + asyncpg** (`app/core/database.py`); variables `DATABASE_URL_ASYNC` y `CORS_ORIGINS` en `backend/.env.example`.
- **Seed demo** idempotente: `backend/scripts/seed_demo.py` (cliente, flota, 3 vehículos, `digital_twins`). Flota UUID fijo: `00000000-0000-4000-8000-000000000002`.
- **Frontend**: `@tanstack/react-query`, `AppProviders` en `app/layout.tsx`, `NEXT_PUBLIC_API_URL` en `.env.example` raíz; **`/flota`** lee `GET …/vehicles` con fallback a mock si no hay URL, error o carga.
- **Tests**: `backend/tests/test_api_health.py` (health + OpenAPI).

### 2026-03-27 — Kafka en Docker + consumidor a Timescale

- `infra/docker-compose.yml`: servicios **zookeeper** y **kafka** (Confluent 7.6.1); broker en host `127.0.0.1:${KAFKA_HOST_PORT:-9092}`, entre contenedores `kafka:29092`.
- `backend/scripts/kafka_telemetry_consumer.py`: lee `raw.telemetry`, inserta en `telemetry_readings` (`DATABASE_URL_ASYNC`, `KAFKA_*` en `.env`).
- `backend/.env.example`: variables Kafka y ejemplo `SIM_VEHICLE_IDS` alineado al seed.

### 2026-03-27 — Puerto Postgres en el host: 5433 (Windows / convivencia con Postgres local)

- **`infra/docker-compose.yml`:** mapeo por defecto **`5433:5432`** (`POSTGRES_PORT` en el host). Así el Timescale de Docker no compite con **PostgreSQL nativo** en Windows en el mismo **:5432** (si no, las conexiones pueden ir al servidor equivocado: error de contraseña o mensajes raros con **asyncpg**).
- **`backend/.env.example`** y documentación alineados a **`127.0.0.1:5433`**. **`infra/.env.example`** documenta cómo fijar otro `POSTGRES_PORT` si hace falta.

### 2026-03-27 — Telemetría visible en la app (API + `/telemetria`)

**Objetivo:** que un compañero (o demo) vea telemetría en el navegador sin abrir pgAdmin, si hay filas en `telemetry_readings` (seed, simulador o consumidor Kafka).

| Capa | Qué se añadió |
|------|----------------|
| **API** | `GET /vehicles/{vehicle_id}/telemetry?limit=` — por defecto 500 puntos, máximo 5000; devuelve puntos ordenados por `time` **ASC** para graficar. Si el vehículo no existe → **404**. |
| **Código backend** | Esquema Pydantic `TelemetryPointRead` en `backend/app/schemas/telemetry.py`. Consulta y ruta en `backend/app/api/vehicles.py`. **Importante:** la ruta `/telemetry` va **antes** que `GET /vehicles/{vehicle_id}` para que FastAPI no interprete `"telemetry"` como UUID. |
| **Front** | `lib/api.ts`: tipo `ApiTelemetryPoint` y `fetchVehicleTelemetry`. `components/telemetry/vehicle-telemetry-panel.tsx`: selector de vehículo, actualización automática (~8 s) con TanStack Query, gráficas **Recharts** (velocidad, temp. motor, RPM, voltaje batería). |
| **Página** | `app/telemetria/page.tsx`: envuelve el panel en `Suspense` (requisito de `useSearchParams` en el cliente). Mantiene la zona de demo en navegador si se quiere probar sin API. |
| **Enlace** | Desde **`/flota`**, cada tarjeta enlaza a `/telemetria?vehicle=<uuid_del_vehículo>`. |
| **QA** | En `backend/tests/test_api_health.py`, `test_openapi_docs_available` comprueba que en `/openapi.json` exista alguna ruta que contenga `telemetry`. |

**Requisitos para ver curvas reales:** Postgres + migraciones + (opcional) `seed_demo.py`; si usas Kafka, topic `raw.telemetry` + `kafka_telemetry_consumer.py` escribiendo en `telemetry_readings`; API y front con la misma `NEXT_PUBLIC_API_URL` que el `uvicorn`.

Los pasos de API y front están resumidos arriba en **«Ejecutar el stack en local»** y el cierre en **«Cerrar el entorno al terminar»**.

### Pendiente (siguientes pasos)

- Docker Compose: MLflow, Prometheus/Grafana (ampliar `infra/`); Kafka en compose **ya** está para entorno local.
- Pipeline SCADA escribiendo en `telemetry_readings` y `pipeline_audit_log`.
- Resto de routers del prompt (auth, tickets, GA, reportes, WebSockets).

---

*Última actualización: 2026-03-27 — guía ejecutar/cerrar stack, puerto 5433 documentado.*
