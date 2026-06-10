"""
Modelo térmico de primer orden para la temperatura del motor.

Ecuación diferencial (dominio temporal):

    τ · dT/dt + T(t) = K · u(t)

Función de transferencia en lazo abierto (Laplace, CI nulas):

    G(s) = T(s) / U(s) = K / (τs + 1)

Sensor ideal H(s) = 1. Lazo cerrado estándar con realimentación unitaria:

    T(s)/R(s) = G(s) / (1 + G(s)H(s)) = K / (τs + 1 + K)

denotado en el proyecto como M(s).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import signal


@dataclass(frozen=True)
class ThermalTransferFunction:
    """Representa G(s)=K/(τs+1) y el lazo cerrado M(s)=K/(τs+1+K) con H=1."""

    K: float
    tau: float
    H: float = 1.0

    def __post_init__(self) -> None:
        if self.tau <= 0:
            raise ValueError("τ debe ser > 0")
        if self.H <= 0:
            raise ValueError("H debe ser > 0 (sensor ideal positivo)")

    def open_loop(self) -> signal.TransferFunction:
        """G(s) = K / (τs + 1)."""
        return signal.TransferFunction([self.K], [self.tau, 1.0])

    def closed_loop(self) -> signal.TransferFunction:
        """M(s) = K / (τs + 1 + K·H) con H constante (por defecto 1)."""
        return signal.TransferFunction([self.K], [self.tau, 1.0 + self.K * self.H])

    def step_response(self, t_end: float, n: int = 2000) -> tuple[np.ndarray, np.ndarray]:
        """
        Respuesta al escalón unitario del sistema en lazo cerrado M(s),
        usando scipy.signal.step.
        """
        if t_end <= 0:
            raise ValueError("t_end debe ser > 0")
        sys = self.closed_loop()
        t, y = signal.step(sys, T=np.linspace(0.0, float(t_end), int(n)))
        return t, y

    def steady_state_temp(self, setpoint: float) -> float:
        """
        Temperatura de régimen ante referencia tipo escalón (valor final escalado).

        Para escalón de amplitud R en la referencia, el valor final queda:

            T∞ = R · M(0) = R · K / (1 + K·H)
        """
        return float(setpoint) * self.K / (1.0 + self.K * self.H)

    def settling_time(self, band: float = 0.02) -> float:
        """
        Tiempo de establecimiento aproximado (2 %) para lazo cerrado de 1er orden:

            τ_lc = τ / (1 + K·H)
            t_s ≈ -ln(band) · τ_lc

        Con band=0.02 → ≈ 3.91 τ_lc (≈ 4τ/(1+K·H)).
        """
        tau_lc = self.tau / (1.0 + self.K * self.H)
        return float(-np.log(band) * tau_lc)
