"""
Importa una prueba exportada desde MATLAB (CSV) y la sube a Telema.

En MATLAB (ver docs/MATLAB_A_PYTHON.md) exporta un CSV con columnas:
  time, senal_x, senal_y, senal_z
o directamente:
  time, vibration_rms

Uso (HTTP → TimescaleDB):

  cd backend
  .\\.venv\\Scripts\\Activate.ps1
  set TELEMA_API_URL=http://127.0.0.1:8000
  set TELEMA_INGEST_API_KEY=la_clave_de_tu_env
  set TELEMA_VEHICLE_ID=00000000-0000-4000-8000-000000000011
  python scripts/import_matlab_accel.py --csv C:\\ruta\\prueba1.csv --window-sec 0.5

Solo generar CSV para revisar (sin API):

  python scripts/import_matlab_accel.py --csv prueba1.csv --out telema_ready.csv
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx
import numpy as np
import pandas as pd
from dotenv import load_dotenv

_backend = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_backend))
load_dotenv(_backend / ".env", encoding="utf-8", override=True)


def _parse_time(series: pd.Series) -> pd.Series:
    t = pd.to_datetime(series, utc=True, errors="coerce")
    if t.isna().all():
        raise ValueError("No se pudo interpretar la columna 'time'")
    return t


def _windowed_rms(df: pd.DataFrame, fs: float, window_sec: float) -> pd.DataFrame:
    """Agrega RMS por ventana en cada eje y magnitud combinada (norma 3D)."""
    win = max(1, int(round(fs * window_sec)))
    n = len(df)
    rows: list[dict] = []
    for start in range(0, n, win):
        chunk = df.iloc[start : start + win]
        if len(chunk) < max(8, win // 4):
            continue
        rx = float(np.sqrt(np.mean(np.square(chunk["senal_x"].astype(float)))))
        ry = float(np.sqrt(np.mean(np.square(chunk["senal_y"].astype(float)))))
        rz = float(np.sqrt(np.mean(np.square(chunk["senal_z"].astype(float)))))
        vib = float(np.sqrt(rx * rx + ry * ry + rz * rz))
        rows.append(
            {
                "device_time": chunk["time"].iloc[len(chunk) // 2],
                "vibration_rms": vib,
                "rms_x": rx,
                "rms_y": ry,
                "rms_z": rz,
            }
        )
    return pd.DataFrame(rows)


def _load_csv(path: Path, fs: float | None, window_sec: float | None) -> pd.DataFrame:
    raw = pd.read_csv(path)
    raw.columns = [c.strip().lower() for c in raw.columns]

    if "vibration_rms" in raw.columns and "time" in raw.columns:
        out = raw[["time", "vibration_rms"]].copy()
        out["time"] = _parse_time(out["time"])
        out = out.rename(columns={"time": "device_time"})
        return out

    needed = {"time", "senal_x", "senal_y", "senal_z"}
    missing = needed - set(raw.columns)
    if missing:
        raise SystemExit(
            f"CSV sin columnas {missing}. Exporta desde MATLAB time + senal_x/y/z "
            "o time + vibration_rms."
        )

    raw["time"] = _parse_time(raw["time"])
    for col in ("senal_x", "senal_y", "senal_z"):
        raw[col] = pd.to_numeric(raw[col], errors="coerce")
    raw = raw.dropna(subset=["senal_x", "senal_y", "senal_z"])

    if fs is None or fs <= 0:
        raise SystemExit("Para ventanas RMS define --fs (ej. 2048 desde fs_real en MATLAB).")
    wsec = window_sec if window_sec and window_sec > 0 else 0.5
    return _windowed_rms(raw, fs, wsec)


def _post_rows(
    api_url: str,
    api_key: str,
    vehicle_id: str,
    df: pd.DataFrame,
) -> None:
    url = f"{api_url.rstrip('/')}/ingest/telemetry"
    ok = 0
    with httpx.Client(timeout=60.0) as client:
        for _, row in df.iterrows():
            ts = row["device_time"]
            if isinstance(ts, pd.Timestamp):
                ts = ts.to_pydatetime()
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            payload = {
                "vehicle_id": vehicle_id,
                "device_time": ts.isoformat(),
                "vibration_rms": float(row["vibration_rms"]),
            }
            r = client.post(
                url,
                json=payload,
                headers={"X-Telema-Ingest-Key": api_key},
            )
            r.raise_for_status()
            ok += 1
    print(f"Ingesta OK: {ok} lecturas → {url}")


def main() -> None:
    ap = argparse.ArgumentParser(description="MATLAB CSV → Telema (ventanas RMS)")
    ap.add_argument("--csv", type=Path, required=True, help="CSV exportado desde MATLAB")
    ap.add_argument("--fs", type=float, default=None, help="Hz (fs_real en MATLAB, ej. 2048)")
    ap.add_argument("--window-sec", type=float, default=0.5, help="Ventana para RMS")
    ap.add_argument("--out", type=Path, default=None, help="Solo escribe CSV listo, sin API")
    ap.add_argument("--vehicle-id", default=os.environ.get("TELEMA_VEHICLE_ID", ""))
    args = ap.parse_args()

    df = _load_csv(args.csv, args.fs, args.window_sec)
    print(f"Filas listas para Telema: {len(df)} (vibration_rms min/max: {df['vibration_rms'].min():.4f} / {df['vibration_rms'].max():.4f})")

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(args.out, index=False)
        print("Guardado:", args.out.resolve())
        return

    api_url = os.environ.get("TELEMA_API_URL", "http://127.0.0.1:8000").strip()
    api_key = os.environ.get("TELEMA_INGEST_API_KEY", "").strip()
    vid = (args.vehicle_id or "").strip()
    if not api_key or not vid:
        raise SystemExit("Define TELEMA_INGEST_API_KEY y TELEMA_VEHICLE_ID (o --vehicle-id).")
    _post_rows(api_url, api_key, vid, df)


if __name__ == "__main__":
    main()
