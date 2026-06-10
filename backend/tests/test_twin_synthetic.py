"""Tests mínimos del generador de frames del gemelo."""

from app.twin_synthetic import next_twin_frame


def test_next_twin_frame_shape() -> None:
    f0 = next_twin_frame(None, "normal", "V-1", 0)
    assert f0["vehicleId"] == "V-1"
    assert "speedKmh" in f0 and "tirePsi" in f0
    f1 = next_twin_frame(f0, "normal", "V-1", 1)
    assert f1["scenario"] == "normal"
