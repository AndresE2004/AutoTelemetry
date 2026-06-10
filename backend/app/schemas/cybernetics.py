from __future__ import annotations

from pydantic import BaseModel, Field


class StepResponseRequest(BaseModel):
    """Parámetros para simular la respuesta al escalón del lazo cerrado M(s)."""

    K: float = Field(default=1.0, ge=0.1, le=10.0)
    tau: float = Field(default=150.0, ge=1.0, le=3600.0)
    H: float = Field(default=1.0, ge=0.1, le=5.0)
    t_end: float = Field(default=1200.0, ge=10.0, le=86400.0)
    setpoint: float = Field(default=90.0, ge=0.0, le=200.0)


class StepResponseResponse(BaseModel):
    time: list[float]
    temperature: list[float]
    G_s: str
    M_s: str
    steady_state_degC: float
    settling_time_s: float


class SimulationResponse(BaseModel):
    scenario: str
    time: list[float]
    temperature: list[float]
    error: list[float]
    control_action: list[int]
    params: dict
