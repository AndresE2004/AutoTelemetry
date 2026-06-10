"""
Detección de anomalías con Isolation Forest sobre ventanas de `telemetry_readings`.

Características: `engine_temp`, `speed`, `battery_voltage`, `rpm` y, **si existe la columna**
`vibration_rms` en la BD, también vibración (5 dimensiones). Si la migración no se ha aplicado,
se usa solo el vector de 4 magnitudes (compatible con bases anteriores).

Solo inserta filas en `anomaly_events` cuando `predict == -1` (outlier) y no existe ya
un evento con el mismo `(vehicle_id, time, model_version)`.
"""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Sequence

import numpy as np
import psycopg
from psycopg import errors as psycopg_errors
from psycopg.rows import dict_row
from sklearn.ensemble import IsolationForest

MODEL_VERSION_WITH_VIB = "iforest-1.1-vib"
MODEL_VERSION_LEGACY = "iforest-1.0"
# Compatibilidad con tests que importan `MODEL_VERSION`.
MODEL_VERSION = MODEL_VERSION_WITH_VIB


def _normalize_dsn(url: str) -> str:
    for prefix in ("postgresql+psycopg2://", "postgresql+psycopg://", "postgresql+asyncpg://"):
        if url.startswith(prefix):
            return "postgresql://" + url[len(prefix) :]
    return url


def _severity_from_score(s: float) -> str:
    """Menor `decision_function` → más anómalo (IsolationForest en sklearn)."""
    if s < -0.45:
        return "critical"
    if s < -0.28:
        return "high"
    if s < -0.12:
        return "medium"
    return "low"


def _anomaly_score_from_decision(s: float) -> float:
    """Escala a (0,1] con saturación suave para almacenar en `anomaly_events.anomaly_score`."""
    v = float(-s)
    return float(min(1.0, max(0.01, 1.0 / (1.0 + np.exp(-v)))))


def _dominant_sensor(row: Sequence[Any], *, use_vibration: bool) -> str:
    """Heurística: magnitud que más se aleja de cero en la fila (índices 1..n = features)."""
    if use_vibration:
        names = ("engine_temp", "speed", "battery_voltage", "rpm", "vibration_rms")
        vals = np.array(
            [float(row[i] or 0) for i in range(1, 6)],
            dtype=float,
        )
    else:
        names = ("engine_temp", "speed", "battery_voltage", "rpm")
        vals = np.array(
            [float(row[i] or 0) for i in range(1, 5)],
            dtype=float,
        )
    return names[int(np.argmax(np.abs(vals)))]


def _has_vibration_column(cur: psycopg.Cursor) -> bool:
    cur.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'telemetry_readings'
              AND column_name = 'vibration_rms'
        ) AS has_vib
        """
    )
    row = cur.fetchone()
    return bool(row and row.get("has_vib"))


@dataclass
class DetectionResult:
    vehicles_scanned: int
    rows_inserted: int


def run_isolation_detection(
    *,
    dsn: str | None = None,
    vehicle_ids: list[str] | None = None,
    window: int = 400,
    contamination: float = 0.06,
    max_inserts_per_vehicle: int = 25,
    random_state: int = 42,
) -> DetectionResult:
    """
    Entrena un Isolation Forest **por vehículo** con los últimos `window` puntos y persiste outliers.
    """
    raw = dsn or os.environ.get("DATABASE_URL")
    if not raw:
        raise SystemExit("DATABASE_URL no definido")
    dsn_n = _normalize_dsn(raw)
    inserted = 0
    scanned = 0

    with psycopg.connect(dsn_n, autocommit=False) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            use_vibration = _has_vibration_column(cur)
            model_version = MODEL_VERSION_WITH_VIB if use_vibration else MODEL_VERSION_LEGACY
            desc_suffix = (
                "(temperatura, velocidad, voltaje, RPM, vibración RMS)."
                if use_vibration
                else "(temperatura, velocidad, voltaje, RPM)."
            )

            if vehicle_ids:
                vids = [str(uuid.UUID(v)) for v in vehicle_ids]
            else:
                cur.execute("SELECT id::text AS id FROM vehicles ORDER BY plate")
                vids = [r["id"] for r in cur.fetchall()]

            select_sql = (
                """
                    SELECT time, engine_temp, speed, battery_voltage, rpm, vibration_rms
                    FROM telemetry_readings
                    WHERE vehicle_id = %s::uuid
                    ORDER BY time DESC
                    LIMIT %s
                    """
                if use_vibration
                else """
                    SELECT time, engine_temp, speed, battery_voltage, rpm
                    FROM telemetry_readings
                    WHERE vehicle_id = %s::uuid
                    ORDER BY time DESC
                    LIMIT %s
                    """
            )

            for vid in vids:
                scanned += 1
                try:
                    cur.execute(select_sql, (vid, int(window)))
                except psycopg_errors.UndefinedColumn:
                    # Columna añadida en código pero migración no aplicada: degradar a 4 features.
                    use_vibration = False
                    model_version = MODEL_VERSION_LEGACY
                    desc_suffix = "(temperatura, velocidad, voltaje, RPM)."
                    select_sql = """
                    SELECT time, engine_temp, speed, battery_voltage, rpm
                    FROM telemetry_readings
                    WHERE vehicle_id = %s::uuid
                    ORDER BY time DESC
                    LIMIT %s
                    """
                    cur.execute(select_sql, (vid, int(window)))

                rows = cur.fetchall()
                if len(rows) < 40:
                    continue
                rows_chrono = list(reversed(rows))
                if use_vibration:
                    X = np.array(
                        [
                            [
                                float(r["engine_temp"] or 0),
                                float(r["speed"] or 0),
                                float(r["battery_voltage"] or 0),
                                float(r["rpm"] or 0),
                                float(r.get("vibration_rms") or 0),
                            ]
                            for r in rows_chrono
                        ],
                        dtype=float,
                    )
                else:
                    X = np.array(
                        [
                            [
                                float(r["engine_temp"] or 0),
                                float(r["speed"] or 0),
                                float(r["battery_voltage"] or 0),
                                float(r["rpm"] or 0),
                            ]
                            for r in rows_chrono
                        ],
                        dtype=float,
                    )

                clf = IsolationForest(
                    contamination=float(contamination),
                    random_state=random_state,
                    n_estimators=200,
                )
                pred = clf.fit_predict(X)
                scores = clf.decision_function(X)
                n_ins = 0
                for i, r in enumerate(rows_chrono):
                    if pred[i] != -1:
                        continue
                    t = r["time"]
                    if not isinstance(t, datetime):
                        t = datetime.now(timezone.utc)
                    sev = _severity_from_score(float(scores[i]))
                    ascore = _anomaly_score_from_decision(float(scores[i]))
                    if use_vibration:
                        sensor = _dominant_sensor(
                            (t, r["engine_temp"], r["speed"], r["battery_voltage"], r["rpm"], r.get("vibration_rms")),
                            use_vibration=True,
                        )
                    else:
                        sensor = _dominant_sensor(
                            (t, r["engine_temp"], r["speed"], r["battery_voltage"], r["rpm"]),
                            use_vibration=False,
                        )
                    cur.execute(
                        """
                        SELECT 1 FROM anomaly_events
                        WHERE vehicle_id = %s::uuid AND time = %s AND model_version = %s
                        LIMIT 1
                        """,
                        (vid, t, model_version),
                    )
                    if cur.fetchone():
                        continue
                    cur.execute(
                        """
                        INSERT INTO anomaly_events (
                          time, vehicle_id, anomaly_score, severity, sensor_affected,
                          model_version, description, ticket_id, resolved_at
                        ) VALUES (
                          %s, %s::uuid, %s, %s, %s, %s, %s, NULL, NULL
                        )
                        """,
                        (
                            t,
                            vid,
                            ascore,
                            sev,
                            sensor,
                            model_version,
                            "Isolation Forest: patrón atípico en ventana reciente " + desc_suffix,
                        ),
                    )
                    inserted += 1
                    n_ins += 1
                    if n_ins >= max_inserts_per_vehicle:
                        break
        conn.commit()

    return DetectionResult(vehicles_scanned=scanned, rows_inserted=inserted)
