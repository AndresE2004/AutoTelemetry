"""Vehículo banco de pruebas: Suzuki Grand Vitara LS 2009 — 13 corridas (.mat)."""

from __future__ import annotations

# Flota / cliente demo (mismos UUID que seed_demo.py)
LAB_CLIENT_ID = "00000000-0000-4000-8000-000000000001"
LAB_FLEET_ID = "00000000-0000-4000-8000-000000000002"

LAB_CLIENT_NAME = "Laboratorio de vibraciones — Grand Vitara"
LAB_FLEET_NAME = "Suzuki Grand Vitara 2009 — 13 pruebas acelerómetro"

BRAND = "Suzuki"
MODEL = "Grand Vitara LS"
YEAR = 2009

# UUID estable por prueba: ...0011 ..001d (13 vehículos, misma plataforma física)
def lab_vehicle_uuid(prueba_index: int) -> str:
    """prueba_index: 0..12 (prueba 1 .. prueba 13)."""
    if not 0 <= prueba_index <= 12:
        raise ValueError("prueba_index debe estar entre 0 y 12")
    return f"00000000-0000-4000-8000-{0x11 + prueba_index:012x}"


def lab_vehicle_plate(prueba_index: int) -> str:
    return f"GV-PRB-{prueba_index + 1:02d}"


# Lista para seed_demo: (uuid, plate, brand, model, year, etiqueta)
LAB_VEHICLES: list[tuple[str, str, str, str, int, str]] = [
    (
        lab_vehicle_uuid(i),
        lab_vehicle_plate(i),
        BRAND,
        MODEL,
        YEAR,
        f"Prueba {i + 1:02d}",
    )
    for i in range(13)
]

PRIMARY_VEHICLE_ID = lab_vehicle_uuid(0)

ALL_LAB_VEHICLE_IDS: tuple[str, ...] = tuple(v[0] for v in LAB_VEHICLES)
