# Pasar datos de MATLAB (acelerómetro) a Python / Telema

## Solo tienes archivos `.mat` del profesor (sin MATLAB abierto)

No necesitas la sesión ni el código original. Guarda los `.mat` en una carpeta, por ejemplo:

`C:\Users\ASUS\Desktop\AutoTelemetry\data\matlab\`

### 1) Ver qué trae cada archivo

```powershell
cd C:\Users\ASUS\Desktop\AutoTelemetry\backend
.\.venv\Scripts\Activate.ps1
python scripts/import_matlab_mat.py --mat "C:\ruta\prueba1.mat" --inspect
```

Lista nombres (`senal_x`, `data`, etc.). Si falla la importación, copia esa lista.

### 2) Las 13 pruebas Grand Vitara (recomendado)

```powershell
cd backend
python scripts/seed_demo.py
python scripts/import_all_matlab_tests.py --dir "C:\Users\ASUS\Desktop\Datos"
```

Cada `.mat` (orden alfabético) se asigna a `GV-PRB-01` … `GV-PRB-13`.

### 3) Un solo .mat → Telema (Python lee el .mat directo)

API encendida + `TELEMA_INGEST_API_KEY` en `backend/.env`:

```powershell
python scripts/import_matlab_mat.py --mat "C:\ruta\prueba1.mat" --fs 2048 --window-sec 0.5
```

Varias pruebas = un comando por cada `.mat` (o distinto `vehicle_id` por prueba).

### 3) (Opcional) Si tienes MATLAB instalado

Doble clic en el `.mat` o en MATLAB: `load('C:\ruta\prueba1.mat')` → luego exportar CSV (sección abajo).

---

Variables típicas en el Workspace (como en tu captura):

| Variable | Qué es |
|----------|--------|
| `data` | `timetable` 20480×3 (tiempo + 3 ejes) |
| `senal_x`, `senal_y`, `senal_z` | Señal cruda por eje (20480 muestras) |
| `fs_real` | 2048 Hz |
| `rms_x`, `rms_y`, `rms_z` | RMS **global** de toda la prueba (un número por eje) |
| `startTime` | Inicio de la captura |

Telema guarda **series en el tiempo** (`vibration_rms` por lectura), no solo un RMS escalar. Por eso en Python se calculan **ventanas** (p. ej. 0,5 s) a partir de `senal_*`.

---

## Paso 1 — Exportar desde MATLAB

Pega esto en el **Command Window** (ajusta la ruta de salida):

```matlab
% Ruta de salida
outDir = 'C:\Users\ASUS\Desktop\AutoTelemetry\data\matlab';
if ~exist(outDir, 'dir'), mkdir(outDir); end

% Si tienes timetable "data" con variables x,y,z:
% (ajusta nombres de variables si tu timetable usa otros nombres)
T = data.Time;
sx = senal_x;
sy = senal_y;
sz = senal_z;

tbl = timetable(T, sx, sy, sz, 'VariableNames', {'senal_x','senal_y','senal_z'});
writetimetable(tbl, fullfile(outDir, 'prueba_accel_raw.csv'));

% Metadatos útiles para Python
meta = table(fs_real, rms_x, rms_y, rms_z, {char(startTime)}, ...
    'VariableNames', {'fs_hz','rms_x','rms_y','rms_z','start_time'});
writetable(meta, fullfile(outDir, 'prueba_accel_meta.csv'));

disp('Exportado: prueba_accel_raw.csv y prueba_accel_meta.csv');
```

Si `data` ya contiene las tres columnas de aceleración, puedes exportar directo:

```matlab
writetimetable(data, fullfile(outDir, 'prueba_accel_raw.csv'));
```

**Alternativa:** guardar todo el workspace para Python:

```matlab
save(fullfile(outDir, 'prueba_accel.mat'), ...
    'data', 'senal_x', 'senal_y', 'senal_z', 'fs_real', 'rms_x', 'rms_y', 'rms_z', 'startTime');
```

---

## Paso 2 — Análisis en Python (notebook o script)

```powershell
cd C:\Users\ASUS\Desktop\AutoTelemetry\backend
.\.venv\Scripts\Activate.ps1
pip install pandas numpy matplotlib scipy
```

Ejemplo rápido en consola:

```python
import pandas as pd
import numpy as np

df = pd.read_csv(r"C:\Users\ASUS\Desktop\AutoTelemetry\data\matlab\prueba_accel_raw.csv")
df.columns = [c.strip().lower() for c in df.columns]
# Columna de tiempo puede llamarse "time" o "t"
if "time" not in df.columns and "t" in df.columns:
    df = df.rename(columns={"t": "time"})

for c in ("senal_x", "senal_y", "senal_z"):
    df[c] = pd.to_numeric(df[c], errors="coerce")

fs = 2048  # fs_real
win = int(fs * 0.5)  # 0.5 s
rms = []
for i in range(0, len(df), win):
    block = df.iloc[i:i+win]
    r = np.sqrt((block[["senal_x","senal_y","senal_z"]]**2).mean().sum())
    rms.append(r)
print("Ventanas:", len(rms), "RMS medio:", np.mean(rms))
```

Desde `.mat` (sin CSV):

```python
from scipy.io import loadmat
m = loadmat(r"...\prueba_accel.mat")
sx = m["senal_x"].squeeze()
fs = float(m["fs_real"].squeeze())
```

---

## Paso 3 — Cargar en Telema (base de datos + app)

1. API arriba, `TELEMA_INGEST_API_KEY` y un `vehicle_id` del seed en `backend/.env`.
2. Script del repo:

```powershell
cd backend
$env:TELEMA_API_URL="http://127.0.0.1:8000"
$env:TELEMA_INGEST_API_KEY="tu_clave"
$env:TELEMA_VEHICLE_ID="00000000-0000-4000-8000-000000000011"
python scripts/import_matlab_accel.py --csv "C:\Users\ASUS\Desktop\AutoTelemetry\data\matlab\prueba_accel_raw.csv" --fs 2048 --window-sec 0.5
```

3. En el navegador: `/telemetria` → elegir vehículo → serie **Vibración RMS**.
4. `/alertas` → **Ejecutar detección** (necesitas varias decenas de puntos; con 10 s a 0,5 s ≈ 20 lecturas; si hace falta, usa `--window-sec 0.25` o concatena varias pruebas).

Solo generar CSV intermedio sin API:

```powershell
python scripts/import_matlab_accel.py --csv prueba_accel_raw.csv --fs 2048 --out telema_ready.csv
```

---

## Cómo se mapea a Telema

| MATLAB | Telema |
|--------|--------|
| `senal_x/y/z` + `fs_real` | Ventanas → `vibration_rms` (norma 3D del RMS por eje) |
| `startTime` / `data.Time` | `device_time` en cada lectura |
| `rms_x/y/z` (escalares) | Referencia para el informe; la serie temporal sale de ventanas |
| Prueba / condición | Carpeta o nombre de archivo + `vehicle_id` distinto por prueba |

---

## Varias pruebas (normal vs falla)

- Exporta un CSV por prueba: `prueba_normal.csv`, `prueba_falla.csv`.
- Repite `import_matlab_accel.py` para cada una (mismo o distinto `vehicle_id`).
- En el informe: compara RMS y anomalías detectadas.

---

## Siguiente: entrenar / MLflow

Cuando tengas varios CSV agregados (matriz de features), adapta `scripts/train_iforest_mlflow.py` para leer ese archivo en lugar de datos sintéticos. La detección en la app seguirá usando `run_anomaly_detection` / `/alertas` sobre lo cargado en Timescale.
