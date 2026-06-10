"""
Transformación SCADA sobre mensajes Kafka (telemetría cruda).

No duplica el bucle del consumidor: solo expone funciones puras que el consumidor invoca
tras validar el payload.

`pipeline_audit_log` no tiene columna JSON libre; se usa `error_detail` (TEXT) para
almacenar un JSON con métricas cibernéticas sin alterar el esquema SQL.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from cybernetics.transfer_function import ThermalTransferFunction


def compute_thermal_control_metrics(
    engine_temp_c: float | None,
    *,
    setpoint_deg_c: float = 90.0,
    K: float = 1.0,
    tau_s: float = 150.0,
    H: float = 1.0,
) -> dict[str, Any]:
    """
    Calcula magnitudes asociadas a E(s)=R(s)-Y(s) en sentido **DC / régimen**:

    - `error_tracking_degC`: R - T_medida (error instantáneo en °C).
    - `thermal_steady_state_model_degC`: R · K/(1+K·H) (predicción de régimen del modelo M(s)).
    - `error_model_vs_measured_degC`: predicción de régimen − T_medida.

    La parte dinámica E(s) punto a punto en s requiere estimación de planta; aquí se
    documenta el vínculo conceptual y se persisten señales **temporales** ya observables.
    """
    if engine_temp_c is None:
        return {"skipped": True, "reason": "sin engine_temp en el payload"}
    tf = ThermalTransferFunction(K=K, tau=tau_s, H=H)
    T_meas = float(engine_temp_c)
    T_ss_model = tf.steady_state_temp(setpoint_deg_c)
    return {
        "thermal_setpoint_degC": setpoint_deg_c,
        "thermal_steady_state_model_degC": T_ss_model,
        "error_tracking_degC": float(setpoint_deg_c) - T_meas,
        "error_model_vs_measured_degC": T_ss_model - T_meas,
        "open_loop_dc_gain": tf.K,
        "closed_loop_dc_gain": tf.K / (1.0 + tf.K * tf.H),
        "tau_seconds": tf.tau,
    }


def build_pipeline_audit_row(
    payload: dict[str, Any],
    kafka_offset: int,
    *,
    setpoint_deg_c: float = 90.0,
    K: float = 1.0,
    tau_s: float = 150.0,
) -> tuple[Any, ...]:
    """
    Construye la tupla de valores para `INSERT INTO pipeline_audit_log (...)`.

    Orden de columnas alineado con `kafka_telemetry_consumer.AUDIT_INSERT_SQL`.
    """
    now = datetime.now(timezone.utc)
    device_time_raw = payload.get("device_time")
    if isinstance(device_time_raw, str):
        try:
            mqtt_dt = datetime.fromisoformat(device_time_raw.replace("Z", "+00:00"))
        except ValueError:
            mqtt_dt = now
    else:
        mqtt_dt = now
    cyber = compute_thermal_control_metrics(
        float(payload["engine_temp"]) if payload.get("engine_temp") is not None else None,
        setpoint_deg_c=setpoint_deg_c,
        K=K,
        tau_s=tau_s,
    )
    detail = json.dumps({"cybernetics": cyber}, ensure_ascii=False)
    vid = str(payload.get("vehicle_id", "")) or None
    return (
        now,
        vid,
        int(kafka_offset),
        mqtt_dt,
        now,
        now,
        now,
        0,
        "scada",
        "ok",
        detail,
    )
