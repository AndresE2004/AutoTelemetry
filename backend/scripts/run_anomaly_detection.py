"""
Ejecuta detección Isolation Forest → tabla `anomaly_events`.

  cd backend
  .\\.venv\\Scripts\\Activate.ps1
  python scripts/run_anomaly_detection.py

Opcional: IDs de vehículo separados por coma en env TELEMA_ANOMALY_VEHICLE_IDS
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(_backend / ".env", encoding="utf-8", override=True)

from ml.isolation_detector import run_isolation_detection  # noqa: E402


def main() -> None:
    raw = os.environ.get("TELEMA_ANOMALY_VEHICLE_IDS", "").strip()
    vids = [x.strip() for x in raw.split(",") if x.strip()] or None
    r = run_isolation_detection(vehicle_ids=vids)
    print("Vehículos escaneados:", r.vehicles_scanned)
    print("Filas insertadas en anomaly_events:", r.rows_inserted)


if __name__ == "__main__":
    main()
