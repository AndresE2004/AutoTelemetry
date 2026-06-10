"""
Lee archivos .mat del profesor (sin abrir MATLAB) y sube ventanas RMS a Telema.

Uso:
  cd backend
  .\\.venv\\Scripts\\Activate.ps1
  python scripts/import_matlab_mat.py --mat "C:\\ruta\\prueba1.mat" --fs 2048

Ver qué variables trae cada .mat (sin subir):
  python scripts/import_matlab_mat.py --mat "C:\\ruta\\prueba1.mat" --inspect

Requisitos API (igual que import_matlab_accel.py):
  TELEMA_API_URL, TELEMA_INGEST_API_KEY, TELEMA_VEHICLE_ID en .env o entorno.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from scipy.io import loadmat

_backend = Path(__file__).resolve().parent.parent
_scripts = Path(__file__).resolve().parent
sys.path.insert(0, str(_backend))
sys.path.insert(0, str(_scripts))
load_dotenv(_backend / ".env", encoding="utf-8", override=True)

from import_matlab_accel import _post_rows, _windowed_rms  # noqa: E402
from lab_vehicles import PRIMARY_VEHICLE_ID, lab_vehicle_uuid  # noqa: E402


def _squeeze(a: np.ndarray) -> np.ndarray:
    return np.asarray(a, dtype=float).squeeze()


def inspect_mat(path: Path) -> None:
    m = loadmat(path, squeeze_me=True, struct_as_record=False)
    keys = [k for k in m if not k.startswith("__")]
    print(f"Archivo: {path.name}")
    print("Variables:", ", ".join(keys) if keys else "(ninguna)")
    for k in keys:
        v = m[k]
        sh = getattr(v, "shape", None)
        print(f"  - {k}: tipo={type(v).__name__}, shape={sh}")


def _extract_signals(m: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray, float | None]:
    """Busca senal_x/y/z o columnas en timetable/struct."""
    fs = None
    if "fs_real" in m:
        fs = float(_squeeze(m["fs_real"]))
    elif "fs" in m:
        fs = float(_squeeze(m["fs"]))

    for xk, yk, zk in (
        ("senal_x", "senal_y", "senal_z"),
        ("Senal_x", "Senal_y", "Senal_z"),
        ("ax", "ay", "az"),
        ("x", "y", "z"),
    ):
        if xk in m and yk in m and zk in m:
            return _squeeze(m[xk]), _squeeze(m[yk]), _squeeze(m[zk]), fs

    if "data" in m:
        d = m["data"]
        # timetable guardado a veces como struct con campos
        if hasattr(d, "_fieldnames"):
            fn = list(d._fieldnames)
            # intentar variables x,y,z dentro del struct
            for trip in (
                ("senal_x", "senal_y", "senal_z"),
                ("x", "y", "z"),
            ):
                if all(t in fn for t in trip):
                    return (
                        _squeeze(getattr(d, trip[0])),
                        _squeeze(getattr(d, trip[1])),
                        _squeeze(getattr(d, trip[2])),
                        fs,
                    )
        arr = np.asarray(d, dtype=float)
        if arr.ndim == 2 and arr.shape[1] >= 3:
            return arr[:, 0], arr[:, 1], arr[:, 2], fs

    keys = [k for k in m if not k.startswith("__")]
    raise SystemExit(
        f"No encontré senal_x/y/z en el .mat. Variables: {keys}\n"
        "Ejecuta con --inspect y dime los nombres al asistente."
    )


def mat_to_telema_df(path: Path, fs: float, window_sec: float) -> pd.DataFrame:
    m = loadmat(path, squeeze_me=True, struct_as_record=False)
    sx, sy, sz, fs_mat = _extract_signals(m)
    if fs <= 0 and fs_mat:
        fs = fs_mat
    if fs <= 0:
        raise SystemExit("Indica --fs 2048 (o el valor que diga el profesor).")

    n = min(len(sx), len(sy), len(sz))
    raw = pd.DataFrame(
        {
            "time": np.arange(n, dtype=float) / fs,
            "senal_x": sx[:n],
            "senal_y": sy[:n],
            "senal_z": sz[:n],
        }
    )
    return _windowed_rms(raw, fs, window_sec)


def main() -> None:
    ap = argparse.ArgumentParser(description="Importar .mat → Telema")
    ap.add_argument("--mat", type=Path, required=True, help="Archivo .mat del profesor")
    ap.add_argument("--fs", type=float, default=2048, help="Hz si no viene en el .mat")
    ap.add_argument("--window-sec", type=float, default=0.5)
    ap.add_argument("--inspect", action="store_true", help="Solo listar variables del .mat")
    ap.add_argument("--out", type=Path, default=None, help="Guardar CSV sin llamar API")
    ap.add_argument("--vehicle-id", default=os.environ.get("TELEMA_VEHICLE_ID", ""))
    ap.add_argument(
        "--prueba",
        type=int,
        default=None,
        help="Número de prueba 1..13 (asigna vehicle_id GV-PRB-XX del seed)",
    )
    args = ap.parse_args()

    if not args.mat.is_file():
        raise SystemExit(f"No existe: {args.mat}")

    if args.inspect:
        inspect_mat(args.mat)
        return

    df = mat_to_telema_df(args.mat, args.fs, args.window_sec)
    print(f"Ventanas: {len(df)} · vibration_rms {df['vibration_rms'].min():.4f} … {df['vibration_rms'].max():.4f}")

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(args.out, index=False)
        print("CSV:", args.out.resolve())
        return

    api_url = os.environ.get("TELEMA_API_URL", "http://127.0.0.1:8000").strip()
    api_key = os.environ.get("TELEMA_INGEST_API_KEY", "").strip()
    vid = (args.vehicle_id or "").strip()
    if args.prueba is not None:
        if not 1 <= args.prueba <= 13:
            raise SystemExit("--prueba debe ser entre 1 y 13")
        vid = lab_vehicle_uuid(args.prueba - 1)
    elif not vid:
        vid = PRIMARY_VEHICLE_ID
    if not api_key or not vid:
        raise SystemExit("Define TELEMA_INGEST_API_KEY y TELEMA_VEHICLE_ID en backend/.env")
    _post_rows(api_url, api_key, vid, df)


if __name__ == "__main__":
    main()
