# AutoTelemetry (Telema Mobility)

Stack local: **Next.js (frontend)** + **FastAPI (backend)** + **TimescaleDB/Postgres + Kafka + MLflow + Prometheus + Grafana (Docker)**.

> **Retomar mañana:** levanta Docker → API → front → (opcional) consumidor Kafka + simulador. Usa **127.0.0.1** en el navegador y en las URLs (no mezcles `localhost`). Secretos solo en `backend/.env` y `.env.local` (nunca en Git).

## Requisitos

- **Docker Desktop** (Windows) encendido.
- **Node.js** (para el frontend).
- **Python** (para el backend). Recomendido usar un venv en `backend/.venv`.

## Puertos (por defecto)

- **Frontend**: `http://127.0.0.1:3000` (recomendado; también funciona `localhost:3000` si todo usa el mismo host)
- **API**: `http://127.0.0.1:8000` (docs en `http://127.0.0.1:8000/docs`; **`/metrics`** para Prometheus; **`/anomalies/*`**, **`/cybernetics/*`**)
- **Postgres/Timescale (Docker)**: **host `127.0.0.1:5433`** → contenedor `5432`  
  (se usa 5433 para evitar choque con PostgreSQL nativo en Windows en `:5432`)
- **Kafka**: `127.0.0.1:9092`
- **MLflow UI**: `http://127.0.0.1:5000` (tracking; variable `MLFLOW_TRACKING_URI` en `backend/.env`)
- **Prometheus UI**: `http://127.0.0.1:9091` (scrape a la API en el host vía `host.docker.internal:8000`)
- **Grafana**: `http://127.0.0.1:3001` (usuario/contraseña por defecto `admin` / `admin`)

## Iniciar todo (orden recomendado)

### 1) Infra (Postgres, Kafka, MLflow, Prometheus, Grafana)

Desde la raíz del repo:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Si necesitas cambiar el puerto host de Postgres, usa `infra/.env.example` como referencia (variable `POSTGRES_PORT`).

### 2) Backend (migraciones + seed + API)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
copy .env.example .env
python -m alembic upgrade head
python scripts\seed_demo.py
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Notas:
- **`backend/.env` es obligatorio** (`DATABASE_URL`, `DATABASE_URL_ASYNC`, `JWT_SECRET`). El código no trae contraseñas por defecto.
- Revisa que las URLs de Postgres usen **`127.0.0.1:5433`** (puerto del Docker compose).
- Para Kafka/simulador, en `.env` debe existir: `KAFKA_BOOTSTRAP_SERVERS=127.0.0.1:9092`
- Si moviste el proyecto de carpeta y `pip` falla con ruta a `Downloads\...`, borra `backend\.venv` y vuelve a crear el venv.
- Comprueba API: http://127.0.0.1:8000/health → `{"status":"ok"}`
- Opcional: `MLFLOW_TRACKING_URI=http://127.0.0.1:5000` para MLflow.

### 3) Frontend (Next.js)

En otra terminal, desde la raíz del repo:

```powershell
copy .env.example .env.local
npm install
npm run dev
```

En `.env.local`: `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000` y abre el front en **http://127.0.0.1:3000** (cookies de login).

**Login demo** (tras `seed_demo.py`):

| Email | Contraseña | Rol |
|-------|------------|-----|
| `admin@telema.example` | `Admin12345!` | admin |
| `technician@telema.example` | `Technician12345!` | technician |
| `fleet@telema.example` | `FleetMgr12345!` | fleet_manager |
| `viewer@telema.example` | `Viewer12345!` | viewer |

### 4) Telemetría end-to-end (Kafka → Timescale → /telemetria)

**Tres terminales** (todas en `backend/` con venv activo):

Tras `alembic upgrade head`, la tabla incluye **`vibration_rms`** (RMS de vibración / acelerómetro). El JSON de Kafka puede llevar `vibration_rms` o alias `vib_rms` / `accel_rms` / `rms_accel`; el consumidor los guarda en columna y en `raw_payload`.

En terminales separadas (dentro de `backend/` y con el venv activado):

Consumidor Kafka → BD:

```powershell
python scripts\kafka_telemetry_consumer.py
```

Simulador (lee `backend/.env`; publica a Kafka si `KAFKA_BOOTSTRAP_SERVERS` está definido):

```powershell
$env:SIM_VEHICLE_IDS="00000000-0000-4000-8000-000000000011,00000000-0000-4000-8000-000000000012,00000000-0000-4000-8000-000000000013"
python -m simulator.synthetic_generator
```

**Bien:** `Simulador publicando a Kafka` y `Publicado tick=...`  
**Mal:** `Simulador en modo SOLO-LOG` → falta `KAFKA_BOOTSTRAP_SERVERS` en `.env` o en la sesión:

```powershell
$env:KAFKA_BOOTSTRAP_SERVERS="127.0.0.1:9092"
```

Luego abre en el front:
- **`/flota`** para ver vehículos
- **`/telemetria?vehicle=<uuid>`** para ver gráficas (o entra a `/telemetria` y selecciona)
- **`/cibernetica`** para el laboratorio de función de transferencia + SFG (requiere API arriba)
- **`/alertas`** para ver `anomaly_events` reales y lanzar **Ejecutar detección** (Isolation Forest; necesita telemetría suficiente)

### 5) (Opcional) MLflow — registrar un run de ejemplo

Con el contenedor **mlflow** arriba y `MLFLOW_TRACKING_URI` en `backend/.env`:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python scripts\train_iforest_mlflow.py
```

Abre la UI de MLflow en `http://127.0.0.1:5000`.

### 6) (Opcional) Detección de anomalías vía CLI

```powershell
cd backend
python scripts\run_anomaly_detection.py
```

Equivale a `POST /anomalies/run` sin filtrar vehículos (respeta `TELEMA_ANOMALY_VEHICLE_IDS` si la defines).

### 7) Suzuki Grand Vitara — 13 pruebas `.mat` (laboratorio)

Tras `seed_demo.py` la flota tiene **13 unidades** `GV-PRB-01` … `GV-PRB-13` (mismo modelo: **Suzuki Grand Vitara LS 2009**).

Coloca los `.mat` del profesor en una carpeta (ej. `C:\Users\ASUS\Desktop\Datos`) e importa:

```powershell
python scripts\seed_demo.py
python scripts\import_all_matlab_tests.py --dir "C:\Users\ASUS\Desktop\Datos"
```

Vista previa sin escribir en BD: añade `--dry-run`. Detalle: `data/matlab/README.md`.

### 8) Acelerómetro / DAQ (tiempo real opcional) y correo de tickets

- **Ingesta HTTP (sin Kafka):** `TELEMA_INGEST_API_KEY` en `backend/.env` → `python scripts/daq_to_telema.py --mode http --vibration-rms 0.4 --interval 0.5`
- **Correo automático al crear ticket:** en `backend/.env` → `SMTP_ENABLED=1`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, `TICKET_NOTIFY_EMAILS`, `FRONTEND_BASE_URL`
- Guía detallada: [`docs/DAQ_ACELEROMETRO_Y_CORREOS.md`](docs/DAQ_ACELEROMETRO_Y_CORREOS.md)

## Terminales típicas (resumen)

| # | Comando | Dónde |
|---|---------|--------|
| 1 | `docker compose -f infra/docker-compose.yml up -d` | raíz repo |
| 2 | `uvicorn app.main:app --reload --host 127.0.0.1 --port 8000` | `backend/` |
| 3 | `npm run dev` | raíz repo |
| 4 | `python scripts\kafka_telemetry_consumer.py` | `backend/` (opcional) |
| 5 | `python -m simulator.synthetic_generator` | `backend/` (opcional) |

## Rutas útiles en el front

`/flota` · `/telemetria` · `/alertas` (Ejecutar detección) · `/tickets` · `/digital-twin` · `/cibernetica` · `/reportes` · `/usuarios` (admin)

## Problemas frecuentes

| Síntoma | Qué hacer |
|---------|-----------|
| Login no persiste | Mismo host `127.0.0.1` en front y API; reinicia `npm run dev` |
| API no arranca | Falta `backend/.env` o variables obligatorias |
| `pip` apunta a Downloads | Borrar `.venv` y recrear venv en la ruta actual |
| Simulador SOLO-LOG | `KAFKA_BOOTSTRAP_SERVERS=127.0.0.1:9092` en `.env` |
| Telemetría vacía | Consumidor + simulador corriendo; esperar ~30 s |
| Anomalías `rows_inserted: 0` | Más telemetría o normal si no hay outliers |

## Cerrar todo (sin borrar datos)

1. En cada terminal: **Ctrl+C** (API, `npm run dev`, consumidor, simulador).
2. Contenedores Docker (raíz del repo):

```bash
docker compose -f infra/docker-compose.yml down
```

No uses `down -v` salvo que quieras borrar los volúmenes (perderías la BD y tendrías que re-correr migraciones/seed).

