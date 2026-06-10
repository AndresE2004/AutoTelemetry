"""
Simulación temporal de temperatura del motor con lazo cerrado cibernético simplificado.

Se usa la ODE de primer orden coherente con M(s) = K/(τs + 1 + K·H) y referencia R:

    τ · dT/dt + (1 + K·H) · T = K · R_eff(t)

donde R_eff incorpora un sesgo según `ScenarioId` (carga térmica efectiva).

En cada instante:
  - error e(t) = R - T(t) (se interpreta como error de seguimiento de referencia)
  - acción de control proxy (Isolation Forest / umbral): 1 si |e| > umbral, 0 si no
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np

from simulator.scenarios import ScenarioId


def _scenario_bias(scenario: ScenarioId) -> float:
    if scenario == ScenarioId.NORMAL:
        return 0.0
    if scenario == ScenarioId.OVERHEATING:
        return 18.0
    if scenario == ScenarioId.BATTERY_FAILURE:
        return 4.0
    return 0.0


def _threshold(scenario: ScenarioId) -> float:
    if scenario == ScenarioId.NORMAL:
        return 6.0
    if scenario == ScenarioId.OVERHEATING:
        return 3.0
    return 5.0


def simulate_engine_temp(
    scenario: ScenarioId | str,
    setpoint: float,
    K: float,
    tau: float,
    *,
    H: float = 1.0,
    dt: float = 0.5,
    t_end: float = 900.0,
    t0: float = 25.0,
) -> dict[str, Any]:
    """
    Simula T(t), e(t)=R-T y una acción de control discreta por umbral.

    Nota: E(s)=R(s)-Y(s) en Laplace; aquí e(t) es la contraparte temporal muestreada.
    """
    if tau <= 0 or dt <= 0 or t_end <= 0:
        raise ValueError("tau, dt y t_end deben ser positivos")
    scen = scenario if isinstance(scenario, ScenarioId) else ScenarioId(str(scenario))
    R = float(setpoint)
    bias = _scenario_bias(scen)
    thr = _threshold(scen)
    n = int(math.ceil(t_end / dt)) + 1
    t = np.linspace(0.0, t_end, n)
    T = np.zeros(n)
    T[0] = t0
    err = np.zeros(n)
    ctrl = np.zeros(n, dtype=np.int8)
    for k in range(n - 1):
        R_eff = R + bias + 2.0 * math.sin(0.02 * t[k]) if scen == ScenarioId.BATTERY_FAILURE else R + bias
        e = R - T[k]
        err[k] = e
        ctrl[k] = 1 if abs(e) > thr else 0
        dT = (K * R_eff - (1.0 + K * H) * T[k]) / tau
        T[k + 1] = T[k] + dt * dT
    err[-1] = R - T[-1]
    ctrl[-1] = 1 if abs(err[-1]) > thr else 0
    return {
        "scenario": str(scen),
        "time": t.tolist(),
        "temperature": T.tolist(),
        "error": err.tolist(),
        "control_action": [int(x) for x in ctrl.tolist()],
        "params": {"R": R, "K": K, "tau": tau, "H": H, "dt": dt, "bias_celsius": bias},
    }
