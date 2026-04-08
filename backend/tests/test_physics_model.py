from simulator.physics_model import MotorcyclePhysics


def test_thermal_step_increases_with_load() -> None:
    p = MotorcyclePhysics()
    t0 = p.state.engine_temp_c
    p.thermal_step(load=0.9, ambient=20.0, dt=1.0)
    assert p.state.engine_temp_c > t0


def test_battery_drops_on_high_draw() -> None:
    p = MotorcyclePhysics()
    v0 = p.state.battery_voltage
    for _ in range(20):
        p.electrical_step(power_draw_kw=25.0, dt=0.5)
    assert p.state.battery_voltage < v0
