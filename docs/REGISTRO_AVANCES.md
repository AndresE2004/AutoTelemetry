# Telema Mobility — Registro de avances

Documento vivo: ir actualizándolo cuando se complete un bloque de trabajo relevante.

---

## Estado de la base de datos

**PostgreSQL 15 + TimescaleDB está definido en código (Docker + Alembic), pero el contenedor solo corre si tienes Docker activo.**

| Qué | Dónde |
|-----|--------|
| Contenedores | `infra/docker-compose.yml` → `postgres`, `zookeeper`, `kafka`, **`mlflow`**, **`prometheus`**, **`grafana`** (puertos en README / `infra/.env.example`) |
| Migraciones | `backend/alembic/versions/20260327_0001_initial_timescale_schema.py` |
| Variables backend | `backend/.env.example` → copiar a `backend/.env` (`DATABASE_URL` y `DATABASE_URL_ASYNC` con host **`127.0.0.1:5433`** por defecto) |
| Variables Docker (opcional) | `infra/.env.example` → `infra/.env` si quieres cambiar `POSTGRES_PORT` (por defecto el compose ya usa **5433** en el host) |

**Frontend:** con `NEXT_PUBLIC_API_URL` en `.env.local`, `/flota` consume `GET /vehicles` y **`/telemetria`** consume `GET /vehicles/{id}/telemetry` (FastAPI + Timescale) para series en vivo sobre la hypertable `telemetry_readings`.

**Kafka (local):** `docker compose -f infra/docker-compose.yml up -d` levanta Zookeeper + Kafka (`127.0.0.1:9092` hacia el host). El simulador publica en el topic `raw.telemetry`; el script `backend/scripts/kafka_telemetry_consumer.py` escribe en la hypertable `telemetry_readings`.

---

## Anomalías (Isolation Forest), MLflow y observabilidad

### A) Detección de anomalías → `anomaly_events` + `/alertas`

**Qué hace:** sobre una ventana reciente de `telemetry_readings` (por defecto 400 puntos por vehículo), se entrena un **Isolation Forest** (scikit-learn) con features **`engine_temp`, `speed`, `battery_voltage`, `rpm`, `vibration_rms`**. Cada punto marcado como outlier (`predict == -1`) puede generar una fila en **`anomaly_events`** (evitando duplicados por `vehicle_id + time + model_version`).

**Dónde está el código:** `backend/ml/isolation_detector.py` (lógica), `backend/app/api/anomalies.py` (API), esquemas en `backend/app/schemas/anomaly.py`, script CLI `backend/scripts/run_anomaly_detection.py`.

**Endpoints:**
- `GET /anomalies/` — lista reciente con **placa** (join a `vehicles`).
- `POST /anomalies/run` — body opcional `{ vehicle_ids?, window?, contamination? }`; escanea vehículos y devuelve `{ vehicles_scanned, rows_inserted }`.
- `GET /anomalies/vehicles/{vehicle_id}` — anomalías de un vehículo.

**UI:** `app/alertas/page.tsx` + `components/alertas/alertas-panel.tsx` consumen la API (`lib/api.ts`: `fetchAnomalies`, `postAnomalyRun`). Botón **Ejecutar detección** llama al POST; la lista se refresca sola cada ~20 s.

**Requisitos prácticos:** hace falta **suficiente telemetría** por vehículo (≥ ~40 lecturas en la ventana). Si no hay outliers según el modelo, `rows_inserted` puede ser 0: es un comportamiento normal, no un fallo.

**Efecto en flota:** la vista `v_fleet_health` cuenta anomalías **high/critical** no resueltas; al insertar severidades altas, puede subir `open_critical_anomalies` en `/flota`.

### B) MLflow (tracking de experimentos / artefactos)

**Qué hace:** servicio Docker **`mlflow`** expone el UI de tracking (por defecto **`http://127.0.0.1:5000`**). El script `backend/scripts/train_iforest_mlflow.py` crea un run de ejemplo, registra parámetros/métricas y guarda un modelo sklearn como **artefacto** (dataset sintético si no quieres tocar la BD).

**Variables:** `MLFLOW_TRACKING_URI` en `backend/.env` / `.env.example` (típico `http://127.0.0.1:5000`).

**Nota:** el entrenamiento “real” sobre telemetría de Timescale se puede ampliar después reutilizando la misma URI; este bloque deja **el servidor y el flujo de logging** funcionando.

### C) Prometheus + Grafana + métricas HTTP de la API

**Prometheus** (contenedor `telema-prometheus`, UI en host **`127.0.0.1:9091`** por defecto) scrapea la métrica **`/metrics`** de la API FastAPI en el **host** usando `host.docker.internal:8000` (Docker Desktop). Config: `infra/prometheus.yml`.

**Grafana** (`telema-grafana`, UI **`http://127.0.0.1:3001`** por defecto, usuario/contraseña `admin`/`admin` salvo que cambies env) arranca con datasource **Prometheus** precargado (`infra/grafana/provisioning/datasources/datasources.yaml`).

**FastAPI:** `prometheus-fastapi-instrumentator` expone **`GET /metrics`** (registrado al final de `app/main.py` para incluir todas las rutas). Sirve para latencias, contadores de requests, etc.

**Orden recomendado al probar:** levantar `docker compose ... up -d` → arrancar **uvicorn en el host :8000** → abrir Prometheus *Targets* y Grafana → explorar métricas.

---

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

5. **Front** (raíz del repo): `.env.local` con `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`, luego `npm install` (primera vez) y `npm run dev` — típicamente `http://localhost:3000` (**`/flota`**, **`/telemetria`**, **`/alertas`**, **`/cibernetica`**).

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

### 2026-04-12 — Anomalías (IForest) + MLflow + Prometheus/Grafana + `/alertas` real

- **ML:** paquete `backend/ml/` con Isolation Forest persistiendo en **`anomaly_events`**; tests en `backend/ml/tests/`.
- **API:** `GET /anomalies/`, `POST /anomalies/run`, `GET /anomalies/vehicles/{id}`; **`GET /metrics`** (Prometheus).
- **Scripts:** `scripts/run_anomaly_detection.py`, `scripts/train_iforest_mlflow.py`.
- **Infra:** servicios `mlflow`, `prometheus`, `grafana` en `infra/docker-compose.yml` + `infra/prometheus.yml` + provisioning Grafana.
- **Front:** `/alertas` enlazado a datos reales y botón de detección.
- **Dependencias:** `scikit-learn`, `mlflow`, `prometheus-fastapi-instrumentator` en `backend/requirements.txt`.

### 2026-05-06 — WebSocket gemelo digital (`/ws/twin/{vehicle_id}`)

- **FastAPI:** `GET` implícito como upgrade WS en **`/ws/twin/{vehicle_id}?scenario=normal|overheating|battery_failure`**, ~**2 Hz** (`asyncio.sleep(0.5)`); JSON con la misma forma que **`TwinTelemetryFrame`** (`lib/digital-twin-types.ts`).
- **Lógica:** `backend/app/twin_synthetic.py` (`next_twin_frame`) alineada con el generador TS del cliente.
- **Front:** `hooks/use-twin-websocket.ts` añade `scenario` en query al conectar; variable **`NEXT_PUBLIC_TWIN_WS_URL`** (ej. `ws://127.0.0.1:8000`) en `.env.example` raíz.
- **Auth:** sin cookie en WS en esta versión (demo); se puede añadir validación de token en subprotocolo o query si hace falta.
- **Front:** `getTwinWsBaseUrl()` deriva `ws://` desde `NEXT_PUBLIC_API_URL` si no hay `NEXT_PUBLIC_TWIN_WS_URL`; `useTwinWebSocket` hace fallback a simulación local si el WS no conecta en ~4 s.

### 2026-05-06 — Tickets desde anomalía (`POST /tickets/from-anomaly`)

- **API:** crea fila en **`maintenance_tickets`** (prioridad según severidad de la anomalía) y actualiza **`anomaly_events.ticket_id`**. Cuerpo con `anomaly_id` + `anomaly_time` (PK compuesta en Timescale). Requiere rol **admin**, **technician** o **fleet_manager** (`require_roles`).
- **Listado y estado:** `GET /tickets` (filtros `status`, `vehicle_id`, `limit`), `GET /tickets/{id}`, `PATCH /tickets/{id}` (cuerpo `status` y/o `priority`; **viewer** puede listar pero no parchear). Orden de rutas: **`POST /from-anomaly`** declarado antes de **`/{ticket_id}`** para evitar conflicto con UUID.
- **Código:** `backend/app/api/tickets.py`, esquemas `backend/app/schemas/ticket.py`; router en `app/main.py`.
- **UI:** `components/alertas/alertas-panel.tsx` — botón **Crear ticket**; enlace **Ver tickets** → **`/tickets`**. `components/tickets/tickets-panel.tsx` — tabla, filtros por estado, `Select` para estado/prioridad (roles operativos).
- **Pendiente opcional:** asignación a usuario (`assigned_to`), comentarios/historial, notificaciones.

### 2026-05-06 — Reportes CSV/JSON (`/reports`)

- **API:** `GET /reports/anomalies?format=json|csv`, `GET /reports/fleet-health/{fleet_id}`, `GET /reports/maintenance-kpi?fleet_id=&format=` — autenticadas (`require_auth`); **RBAC por endpoint:** `anomalies` → **admin, technician**; `fleet-health` y `maintenance-kpi` → **admin, fleet_manager, viewer**. Respuesta con `Content-Disposition` attachment.
- **Código:** `backend/app/api/reports.py`, router incluido en `app/main.py`.
- **Front:** `app/reportes/page.tsx` — selector CSV/JSON y descarga con cookie; flota demo configurable con `NEXT_PUBLIC_DEMO_FLEET_ID` (`lib/api.ts`).
- **PDF/XLSX:** no implementados; ampliación natural vía misma capa o librería servidor.
- **Documentación de política (ejecutivos vs operativos, rutas y API):** `docs/RBAC_REPORTES_Y_ACCESO.md`.

### 2026-05-04 — Auth JWT + cookie HttpOnly + Swagger + refresh

**Objetivo:** sesión segura contra la API, RBAC por rol, y poder probar la API desde OpenAPI como lo haría un integrador externo.

**Documentación consolidada** (auth, roles demo, alertas, tickets, WebSocket gemelo; aparte del detalle de reportes ejecutivos/operativos): `docs/AUTH_ROLES_ALERTAS_TICKETS_GEMELO.md`.

| Capa | Qué hay |
|------|---------|
| **Tokens** | Access JWT (HS256, `JWT_SECRET`; **`JWT_ACCESS_MINUTES=7`** por defecto en `backend/app/core/config.py`) y refresh JWT con claim **`typ: "refresh"`** y `JWT_REFRESH_DAYS` (`backend/app/core/security.py`). |
| **Login** | `POST /auth/login` — body form OAuth2 (`username` = email, `password`). Devuelve `TokenPair`; además **`Set-Cookie` HttpOnly** `AUTH_COOKIE_NAME` (p. ej. `telema_access`) para el front en el mismo host que la API (`backend/app/api/auth.py`). |
| **Refresh** | `POST /auth/refresh` — JSON `{ "refresh_token": "<jwt refresh>" }` → nuevo **access + refresh** (rotación) y cookie de access renovada (`RefreshRequest` en `backend/app/schemas/user.py`). Cliente TS: `refreshSession()` en `lib/api.ts`. |
| **Sesión actual** | `GET /auth/me` — usa **Bearer** o cookie (`get_token_from_request`). |
| **Rutas protegidas** | Dependencia `require_auth` + **`OAuth2PasswordBearer`** (`tokenUrl=auth/login`, `auto_error=False`) para que **Swagger `/docs`** muestre **Authorize** (usuario/contraseña en el modal → token automático **o** flujo cookie en navegador). |
| **RBAC** | `require_roles("admin", ...)` en anomalías y admin en CRUD usuarios (`/users`). Credenciales seed: ver `backend/scripts/seed_demo.py` (`admin@telema.example` / `Admin12345!`). |
| **Front** | `/login` (credenciales + cookie), `components/auth/auth-guard.tsx`, `/usuarios`, etc. **`NEXT_PUBLIC_API_URL`** debe ser el mismo host que uses en el navegador (**recomendado `127.0.0.1`**) para que la cookie cruce bien entre front :3000 y API :8000 con CORS + `credentials`. Tras login/setup se guarda **`refresh_token` en `localStorage`** (`lib/auth-session.ts`) y **`AuthGuard`** llama **`POST /auth/refresh` cada 7 min** (`ACCESS_REFRESH_INTERVAL_MS`) para rotar tokens y renovar la cookie HttpOnly. |

**Para el siguiente agente:** valorar **margen** entre vida del access y el intervalo (hoy ambos 7 min; el refresh solo necesita el JWT refresh válido), **revocación** de refreshes en producción, y `AUTH_COOKIE_SECURE=1` con HTTPS.

### Usuarios demo (cuatro roles)

Tras `python scripts/seed_demo.py` existen **cuatro cuentas** en el cliente demo (misma flota):

| Email | Contraseña | Rol |
|-------|------------|-----|
| `admin@telema.example` | `Admin12345!` | `admin` |
| `viewer@telema.example` | `Viewer12345!` | `viewer` |
| `technician@telema.example` | `Technician12345!` | `technician` |
| `fleet@telema.example` | `FleetMgr12345!` | `fleet_manager` |

**Menú (frontend `lib/rbac.ts`):** `admin` ve todo; `fleet_manager` igual salvo **Usuarios**; `technician` operación + lab (sin **Optimización GA**); `fleet_manager` sí incluye **Optimización GA**; `viewer` observabilidad (**flota, telemetría, alertas, tickets**, **pipeline**, **ajustes**) sin gemelos / lab — en **`/alertas`** y **`/tickets`** solo lectura para **viewer**. **Reportes:** `fleet_manager` y `viewer` solo **ejecutivos** (salud de flota, KPI); `technician` solo **operativos** (export de anomalías); `admin` ambos. **`AuthGuard`** bloquea **acceso directo por URL** a rutas no permitidas (además del menú).

### 2026-05-12 — Vibración en telemetría (`vibration_rms`)

- **BD:** migración **`20260512_0002_telemetry_vibration_rms`** — columna **`telemetry_readings.vibration_rms`** (double, nullable).
- **Ingesta Kafka:** `kafka_telemetry_consumer.py` mapea **`vibration_rms`** o alias **`vib_rms`**, **`accel_rms`**, **`rms_accel`** desde el JSON del topic `raw.telemetry`.
- **API:** `GET /vehicles/{id}/telemetry` devuelve **`vibration_rms`** en cada punto (`TelemetryPointRead`).
- **ML:** `isolation_detector.py` incluye **`vibration_rms`** en el vector de features; **`model_version`** pasa a **`iforest-1.1-vib`** (eventos nuevos no colisionan con corridas antiguas `iforest-1.0`).
- **Simulador:** `simulator/synthetic_generator.py` publica **`vibration_rms`** sintético para pruebas sin hardware.
- **Front:** `/telemetría` muestra serie **Vibración RMS** si hay datos; alertas etiquetan **`vibration_rms`** en el texto del tipo de evento.

### 2026-05-18 — Seguridad config + dashboard con API real

- **`backend/app/core/config.py`:** sin DSN ni `JWT_SECRET` en código; obligatorios vía `backend/.env` (plantilla en `.env.example`, archivo real en `.gitignore`).
- **Resumen (`/`):** KPIs, últimas alertas y gráfica de telemetría consumen `GET /vehicles`, `GET /anomalies/` y `GET /vehicles/{id}/telemetry` cuando hay sesión y API.
- **Sidebar:** nombre/rol del usuario autenticado; badge de alertas abiertas desde la API.
- **Gemelo WS:** URL automática desde la API + fallback sintético si no hay conexión.

### 2026-05-18 — Correo en tickets + ingesta DAQ (acelerómetro)

- **Correo:** al `POST /tickets/from-anomaly`, si `SMTP_ENABLED=1` y `TICKET_NOTIFY_EMAILS`, envío SMTP en background (`app/core/email_notify.py`).
- **Ingesta HTTP:** `POST /ingest/telemetry` con header `X-Telema-Ingest-Key` (`TELEMA_INGEST_API_KEY` en `.env`); persiste en `telemetry_readings` incl. `vibration_rms`.
- **Script:** `backend/scripts/daq_to_telema.py` (HTTP o Kafka, CSV o RMS manual).
- **Guía laboratorio:** `docs/DAQ_ACELEROMETRO_Y_CORREOS.md`.

### 2026-05-18 — ISO 10816-1 en telemetría + gemelo Grand Vitara

- **ISO 10816-1:** panel lateral en `/telemetria` y gemelo (`lib/iso10816.ts`, `components/telemetry/iso10816-vibration-panel.tsx`) — RMS (g) → velocidad estimada (mm/s), zonas A–D grupo 2.
- **Gemelo 3D:** modelo SUV procedural (`GrandVitaraModel.tsx`), modo **Datos de laboratorio** reproduce `telemetry_readings` (`hooks/use-twin-lab-playback.ts`); moto demo sustituida en vista principal.

### Pendiente (opcional / producción)

- **MQTT** delante de Kafka (bridge).
- **IForest** programado desde Timescale + versionado de modelos en prod.
- **PDF/XLSX** en reportes; **WS con auth**; revocación de refresh JWT y `AUTH_COOKIE_SECURE=1` con HTTPS.

---

*Última actualización: 2026-05-18 — config sin secretos en repo; dashboard y WS gemelo pulidos.*
