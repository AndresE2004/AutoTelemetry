"""
Gráfica de flujo de señal (SFG) del pipeline Telema (vista cibernética).

Nodos (y₁…y₆):
  Sensor → MQTT → Kafka → SCADA → ModeloIA → Alerta

Realimentación: y₆ → y₁ con ganancia a₆₁ (acción/alerta que condiciona la percepción
del estado en lazo cerrado cibernético; aquí se modela como arco simbólico-numerico).

Regla de Mason (caso simple):
  Un solo camino directo P del sensor a la alerta.
  Un lazo que recorre el camino y vuelve por a₆₁ con ganancia de lazo L = P · a₆₁.

  T = P / (1 - L)

Si |L| ≥ 1, la interpretación física del modelo discreto deja de ser válida;
el método devuelve el valor calculado y el JSON incluye una advertencia.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


NODE_ORDER = ("Sensor", "MQTT", "Kafka", "SCADA", "ModeloIA", "Alerta")


@dataclass
class SignalFlowGraph:
    """SFG con ganancias por rama; `mason_gain` usa el caso P y un lazo L = P·a₆₁."""

    gains: dict[str, float] = field(
        default_factory=lambda: {
            "a12": 1.0,
            "a23": 1.0,
            "a34": 1.0,
            "a45": 1.0,
            "a56": 1.0,
            "a61": 0.05,
        }
    )

    def forward_path_gain(self) -> float:
        """Producto de ganancias del camino Sensor → … → Alerta."""
        g = self.gains
        return float(g["a12"] * g["a23"] * g["a34"] * g["a45"] * g["a56"])

    def mason_gain(self) -> float:
        """
        Ganancia total por regla de Mason en topología de **un camino** y **un lazo**:

            P = a₁₂ a₂₃ a₃₄ a₄₅ a₅₆
            L = P · a₆₁
            T = P / (1 - L)
        """
        p = self.forward_path_gain()
        l_loop = p * float(self.gains.get("a61", 0.0))
        den = 1.0 - l_loop
        if abs(den) < 1e-12:
            raise ZeroDivisionError("División por cero en regla de Mason (1 - L ≈ 0)")
        return p / den

    def to_json(self) -> dict[str, Any]:
        """Serialización para el frontend (nodos, aristas y métrica de Mason)."""
        p = self.forward_path_gain()
        l_loop = p * float(self.gains.get("a61", 0.0))
        warning: str | None = None
        try:
            t = self.mason_gain()
        except ZeroDivisionError:
            t = float("nan")
            warning = "L≈1: la regla de Mason no es aplicable numéricamente."
        edge_keys = ["a12", "a23", "a34", "a45", "a56"]
        edges: list[dict[str, Any]] = [
            {
                "from": NODE_ORDER[i],
                "to": NODE_ORDER[i + 1],
                "gain": float(self.gains[key]),
            }
            for i, key in enumerate(edge_keys)
        ]
        edges.append({"from": NODE_ORDER[-1], "to": NODE_ORDER[0], "gain": float(self.gains["a61"])})
        return {
            "nodes": [{"id": i + 1, "name": name} for i, name in enumerate(NODE_ORDER)],
            "edges": edges,
            "forward_path_gain_P": p,
            "loop_gain_L": l_loop,
            "mason_total_gain_T": t,
            "warning": warning,
        }
