"""
Entrena un Isolation Forest de ejemplo y registra el run en MLflow.

Requiere MLflow arriba (Docker) y variable MLFLOW_TRACKING_URI, p. ej.:
  http://127.0.0.1:5000

  cd backend
  python scripts/train_iforest_mlflow.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np
from sklearn.ensemble import IsolationForest

_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(_backend / ".env", encoding="utf-8", override=True)


def main() -> None:
    uri = os.environ.get("MLFLOW_TRACKING_URI", "http://127.0.0.1:5000").strip()
    os.environ["MLFLOW_TRACKING_URI"] = uri

    import mlflow  # noqa: WPS433 — import diferido tras fijar URI

    rng = np.random.default_rng(42)
    X = rng.normal(size=(500, 4))
    X[:20] += np.array([6.0, 15.0, -1.5, 800.0])

    contamination = 0.06
    with mlflow.start_run(run_name="iforest-telemetry-demo"):
        mlflow.log_param("contamination", contamination)
        mlflow.log_param("n_samples", X.shape[0])
        mlflow.log_param("n_features", X.shape[1])
        model = IsolationForest(contamination=contamination, random_state=42, n_estimators=150)
        model.fit(X)
        n_out = int((model.predict(X) == -1).sum())
        mlflow.log_metric("train_outliers_detected", float(n_out))
        mlflow.sklearn.log_model(model, artifact_path="model")
        print("MLflow run OK. Outliers en dataset sintético:", n_out)
        print("Tracking URI:", uri)


if __name__ == "__main__":
    main()
