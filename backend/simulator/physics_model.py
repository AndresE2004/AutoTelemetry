"""Modelo físico simplificado para telemetría de moto eléctrica (entrenamiento / demo)."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class MotorcycleState:
    speed_kmh: float = 0.0
    engine_temp_c: float = 25.0
    battery_voltage: float = 52.0
    rpm: float = 0.0
    tire_psi: tuple[float, float, float, float] = (32.0, 32.0, 31.0, 31.0)
    odometer_km: float = 0.0


class MotorcyclePhysics:
    """Evolución muy simple en el tiempo (Euler) — sustituir por datos reales cuando exista CAN."""

    def __init__(self, rng: np.random.Generator | None = None) -> None:
        self.rng = rng or np.random.default_rng()
        self.state = MotorcycleState()

    def thermal_step(self, load: float, ambient: float = 24.0, dt: float = 0.5) -> float:
        """load ~ 0..1 según par motor; retorna nueva temperatura."""
        s = self.state
        cooling = 0.08 * (s.engine_temp_c - ambient)
        heating = 12.0 * load
        s.engine_temp_c = float(np.clip(s.engine_temp_c + (heating - cooling) * dt, 20.0, 120.0))
        return s.engine_temp_c

    def electrical_step(self, power_draw_kw: float, dt: float = 0.5) -> float:
        """Descarga simple del pack (sin modelo equivalente Thevenin completo)."""
        s = self.state
        drop = 0.004 * power_draw_kw * dt
        noise = self.rng.normal(0, 0.01)
        s.battery_voltage = float(np.clip(s.battery_voltage - drop + noise, 40.0, 54.6))
        return s.battery_voltage

    def motion_step(self, target_speed: float, dt: float = 0.5) -> tuple[float, float]:
        """Suaviza velocidad y deriva RPM como función monotónica simple."""
        s = self.state
        s.speed_kmh = float(np.clip(s.speed_kmh + (target_speed - s.speed_kmh) * 0.35, 0.0, 120.0))
        s.rpm = float(800.0 + s.speed_kmh * 42.0 + self.rng.normal(0, 25))
        s.odometer_km += (s.speed_kmh / 3600.0) * dt
        return s.speed_kmh, s.rpm

    def tire_leak_step(self, corner_index: int, rate_psi_per_s: float, dt: float) -> tuple[float, float, float, float]:
        psi = np.array(self.state.tire_psi, dtype=float)
        psi[corner_index] = max(20.0, psi[corner_index] - rate_psi_per_s * dt)
        self.state.tire_psi = (float(psi[0]), float(psi[1]), float(psi[2]), float(psi[3]))
        return self.state.tire_psi
