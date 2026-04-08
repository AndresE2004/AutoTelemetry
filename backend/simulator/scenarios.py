"""Escenarios de simulación alineados con la demo para inversores."""

from __future__ import annotations

from enum import StrEnum


class ScenarioId(StrEnum):
    NORMAL = "normal"
    OVERHEATING = "overheating"
    BATTERY_FAILURE = "battery_failure"


SCENARIO_HELP = {
    ScenarioId.NORMAL: "Operación urbana, temperatura y voltaje estables.",
    ScenarioId.OVERHEATING: "Carga térmica elevada; temperatura converge a zona crítica.",
    ScenarioId.BATTERY_FAILURE: "Voltaje del pack cae de forma sostenida.",
}
