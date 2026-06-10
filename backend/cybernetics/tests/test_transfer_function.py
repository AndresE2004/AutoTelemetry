from __future__ import annotations

import numpy as np
import pytest
from scipy import signal

from cybernetics.signal_flow_graph import SignalFlowGraph
from cybernetics.simulation import simulate_engine_temp
from cybernetics.transfer_function import ThermalTransferFunction
from simulator.scenarios import ScenarioId


def test_open_loop_and_closed_loop_shapes() -> None:
    tf = ThermalTransferFunction(K=1.0, tau=150.0, H=1.0)
    g = tf.open_loop()
    m = tf.closed_loop()
    _, y_g = signal.step(g, T=np.linspace(0.0, 5000.0, 2000))
    _, y_m = signal.step(m, T=np.linspace(0.0, 5000.0, 2000))
    assert float(y_g[-1]) == pytest.approx(1.0, rel=1e-2)
    assert float(y_m[-1]) == pytest.approx(tf.K / (1.0 + tf.K * tf.H), rel=1e-2)


def test_closed_loop_poles_stable() -> None:
    tf = ThermalTransferFunction(K=1.2, tau=80.0, H=1.0)
    m = tf.closed_loop()
    p = np.asarray(m.poles, dtype=float)
    assert np.all(np.real(p) < 0)


def test_steady_state_matches_dc_gain() -> None:
    tf = ThermalTransferFunction(K=1.0, tau=150.0, H=1.0)
    R = 90.0
    assert tf.steady_state_temp(R) == pytest.approx(R * tf.K / (1 + tf.K * tf.H))


def test_step_response_monotonic_increase() -> None:
    tf = ThermalTransferFunction(K=1.0, tau=150.0, H=1.0)
    t, y = tf.step_response(4000.0, n=500)
    y_scaled = y * 90.0
    assert y_scaled[-1] > y_scaled[0]
    assert y_scaled[-1] == pytest.approx(tf.steady_state_temp(90.0), rel=1e-2)


def test_settling_time_positive() -> None:
    tf = ThermalTransferFunction(K=1.0, tau=150.0, H=1.0)
    assert tf.settling_time() > 0


def test_mason_gain_finite_default_sfg() -> None:
    sfg = SignalFlowGraph()
    t = sfg.mason_gain()
    assert np.isfinite(t)


def test_sfg_to_json_shape() -> None:
    d = SignalFlowGraph().to_json()
    assert "nodes" in d and "edges" in d
    assert len(d["nodes"]) == 6
    assert d["forward_path_gain_P"] == pytest.approx(1.0)


def test_simulate_engine_temp_keys() -> None:
    out = simulate_engine_temp(ScenarioId.NORMAL, 90.0, 1.0, 150.0, t_end=120.0)
    assert set(out.keys()) >= {"time", "temperature", "error", "control_action", "params"}
    assert len(out["time"]) == len(out["temperature"])
