"""Endpoints del módulo cibernético (función de transferencia, SFG, simulación)."""

from __future__ import annotations

import asyncio
from typing import Any

import numpy as np
from fastapi import APIRouter, Depends, HTTPException

from app.api.auth import require_auth

from app.schemas.cybernetics import (
    SimulationResponse,
    StepResponseRequest,
    StepResponseResponse,
)
from cybernetics.signal_flow_graph import SignalFlowGraph
from cybernetics.simulation import simulate_engine_temp
from cybernetics.transfer_function import ThermalTransferFunction
from simulator.scenarios import ScenarioId

router = APIRouter(prefix="/cybernetics", tags=["cybernetics"], dependencies=[Depends(require_auth)])


def _coef_squeeze(arr: Any) -> list[float]:
    a = np.squeeze(arr)
    if a.ndim == 0:
        return [float(a)]
    return [float(x) for x in a.tolist()]


def _fmt_tf(num: list[float], den: list[float]) -> str:
    def poly(coeffs: list[float]) -> str:
        parts: list[str] = []
        n = len(coeffs) - 1
        for i, c in enumerate(coeffs):
            power = n - i
            if abs(c) < 1e-12:
                continue
            if power == 0:
                parts.append(f"{c:g}")
            elif power == 1:
                parts.append(f"{c:g}·s")
            else:
                parts.append(f"{c:g}·s^{power}")
        return " + ".join(parts) if parts else "0"

    return f"({poly(num)}) / ({poly(den)})"


def _step_response_sync(body: StepResponseRequest) -> StepResponseResponse:
    tf = ThermalTransferFunction(K=body.K, tau=body.tau, H=body.H)
    g = tf.open_loop()
    m = tf.closed_loop()
    t, y_unit = tf.step_response(body.t_end)
    y = (y_unit * float(body.setpoint)).tolist()
    steady = tf.steady_state_temp(body.setpoint)
    ts = tf.settling_time()
    return StepResponseResponse(
        time=t.tolist(),
        temperature=y,
        G_s=_fmt_tf(_coef_squeeze(g.num), _coef_squeeze(g.den)),
        M_s=_fmt_tf(_coef_squeeze(m.num), _coef_squeeze(m.den)),
        steady_state_degC=float(steady),
        settling_time_s=float(ts),
    )


@router.post("/step-response", response_model=StepResponseResponse)
async def step_response(body: StepResponseRequest) -> StepResponseResponse:
    """Respuesta al escalón del lazo cerrado (escalada por `setpoint`, en °C)."""
    return await asyncio.to_thread(_step_response_sync, body)


@router.get("/sfg")
async def sfg_json() -> dict[str, Any]:
    """Gráfica de flujo de señal serializada y ganancia de Mason (caso simple)."""
    return SignalFlowGraph().to_json()


@router.get("/simulate/{scenario}", response_model=SimulationResponse)
async def simulate_scenario(
    scenario: str,
    setpoint: float = 90.0,
    K: float = 1.0,
    tau: float = 150.0,
) -> SimulationResponse:
    """Simulación temporal por escenario del simulador (`normal`, `overheating`, `battery_failure`)."""
    try:
        scen = ScenarioId(scenario)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"escenario inválido: {scenario}") from e
    raw = await asyncio.to_thread(
        simulate_engine_temp,
        scen,
        float(setpoint),
        float(K),
        float(tau),
    )
    return SimulationResponse(**raw)
