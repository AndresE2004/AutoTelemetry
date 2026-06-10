# Acelerómetro Axiomet + DAQ y correos de ticket

## ¿Se puede mandar correo automático al crear un ticket?

**Sí.** Al crear un ticket con `POST /tickets/from-anomaly` (botón **Crear ticket** en `/alertas`), si SMTP está activo en `backend/.env`, la API envía un correo en segundo plano a los destinatarios de `TICKET_NOTIFY_EMAILS`.

No bloquea la respuesta HTTP: si el SMTP falla, el ticket **sí queda creado**; el error solo queda en el log del backend.

### Configuración SMTP (ejemplo Gmail con contraseña de aplicación)

En `backend/.env`:

```env
SMTP_ENABLED=1
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_correo@gmail.com
SMTP_PASSWORD=xxxx xxxx xxxx xxxx
SMTP_FROM=Telema <tu_correo@gmail.com>
SMTP_USE_TLS=1
TICKET_NOTIFY_EMAILS=tecnico@empresa.com,jefe.flota@empresa.com
FRONTEND_BASE_URL=http://127.0.0.1:3000
```

Reinicia `uvicorn` tras cambiar `.env`.

**Prueba rápida:** inicia sesión → `/alertas` → crea ticket desde una anomalía → revisa bandeja (y spam).

Otros proveedores: Outlook (`smtp.office365.com`), SendGrid, Amazon SES — mismo esquema host/puerto/usuario/clave.

---

## Mañana: acelerómetro + tarjeta de adquisición

Flujo recomendado:

```text
Axiomet + software DAQ  →  script Python  →  POST /ingest/telemetry  →  TimescaleDB
                                                      ↓
                                            Isolation Forest (vibration_rms)
                                                      ↓
                                            Alertas → Ticket → correo (opcional)
```

### 1. Preparar hoy (antes del laboratorio)

1. Stack arriba: Docker, migraciones, `seed_demo.py`, API, front.
2. En `backend/.env`:

```env
TELEMA_INGEST_API_KEY=elige_una_clave_larga_aleatoria
TELEMA_VEHICLE_ID=00000000-0000-4000-8000-000000000011
```

3. UUID del vehículo: el que uses en banco de pruebas debe existir en tabla `vehicles` (los del seed o uno nuevo).

### 2. Durante la captura

**Opción A — HTTP directo (más simple)**

```powershell
cd backend
$env:TELEMA_API_URL="http://127.0.0.1:8000"
$env:TELEMA_INGEST_API_KEY="tu_clave"
$env:TELEMA_VEHICLE_ID="00000000-0000-4000-8000-000000000011"
python scripts/daq_to_telema.py --mode http --vibration-rms 0.35 --interval 0.5
```

Calcula RMS en tu software DAQ (ventana 100–500 ms) y pásalo con `--vibration-rms`, o exporta CSV y:

```powershell
python scripts/daq_to_telema.py --mode http --csv C:\ruta\muestras.csv --interval 0.5
```

Columnas CSV reconocidas: `vibration_rms`, `accel_rms`, `rms_accel`; opcional `speed`, `engine_temp`, etc.

**Opción B — Kafka** (si ya tienes el consumidor)

```powershell
python scripts/kafka_telemetry_consumer.py
python scripts/daq_to_telema.py --mode kafka --vibration-rms 0.35 --interval 0.5
```

### 3. Ver datos y entrenar

1. `/telemetria` — serie **Vibración RMS**.
2. Acumula ~40+ lecturas por vehículo.
3. `/alertas` → **Ejecutar detección** (o `python scripts/run_anomaly_detection.py`).
4. Entrenamiento MLflow: `python scripts/train_iforest_mlflow.py` (artefacto de referencia; el detector en prod usa ventana Timescale).

### Alias de vibración aceptados

En JSON/Kafka/HTTP: `vibration_rms`, `vib_rms`, `accel_rms`, `rms_accel`.

Calibra unidades (m/s² vs g) de forma consistente; el modelo aprende patrones relativos en la misma escala.

### Integrar software del fabricante

Patrón típico en Python en el PC del DAQ:

1. Leer buffer del acelerómetro.
2. Calcular RMS: `sqrt(mean(a**2))` en la ventana.
3. `httpx.post(f"{API}/ingest/telemetry", json={...}, headers={"X-Telema-Ingest-Key": KEY})`.

Reutiliza `scripts/daq_to_telema.py` como plantilla.

---

## Checklist “todo listo”

| Ítem | Comando / ruta |
|------|----------------|
| BD + seed | `alembic upgrade head` + `seed_demo.py` |
| API | `uvicorn app.main:app --host 127.0.0.1 --port 8000` |
| Front | `npm run dev` + `.env.local` |
| Ingesta DAQ | `TELEMA_INGEST_API_KEY` + `POST /ingest/telemetry` |
| Kafka (opcional) | consumidor + `daq_to_telema.py --mode kafka` |
| Anomalías | `POST /anomalies/run` |
| Tickets + mail | SMTP en `.env` + crear ticket en UI |

Documentación general: `README.md` y `docs/REGISTRO_AVANCES.md`.
