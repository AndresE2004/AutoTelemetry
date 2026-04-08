import type { TwinScenarioId, TwinTelemetryFrame } from "@/lib/digital-twin-types"

function isoNow() {
  return new Date().toISOString()
}

/** Avanza un frame de telemetría sintética (~500 ms de simulación lógica). */
export function nextSyntheticTwinFrame(
  prev: TwinTelemetryFrame | null,
  scenario: TwinScenarioId,
  vehicleId: string,
  tick: number
): TwinTelemetryFrame {
  const base =
    prev ??
    ({
      vehicleId,
      deviceTime: isoNow(),
      speedKmh: 42,
      engineTempC: 78,
      batteryVoltage: 49.2,
      rpm: 2200,
      tirePsi: { fl: 32, fr: 32, rl: 31, rr: 31 },
      anomalyScore: 0.05,
      anomalyActive: false,
      scenario,
    } satisfies TwinTelemetryFrame)

  let speedKmh = base.speedKmh
  let engineTempC = base.engineTempC
  let batteryVoltage = base.batteryVoltage
  let rpm = base.rpm
  let tirePsi = { ...base.tirePsi }

  if (scenario === "normal") {
    speedKmh = 38 + Math.abs(Math.sin(tick / 14)) * 22
    engineTempC = 77 + Math.sin(tick / 20) * 2.5
    batteryVoltage = 48.8 + Math.sin(tick / 31) * 0.35
    rpm = 1600 + speedKmh * 28 + Math.sin(tick / 11) * 120
    tirePsi = {
      fl: 31.5 + Math.sin(tick / 25) * 0.4,
      fr: 31.6 + Math.cos(tick / 27) * 0.35,
      rl: 30.8 + Math.sin(tick / 29) * 0.3,
      rr: 30.9 + Math.cos(tick / 23) * 0.3,
    }
  }

  if (scenario === "overheating") {
    speedKmh = 35 + Math.sin(tick / 18) * 12
    engineTempC = Math.min(97, base.engineTempC + 0.22 + Math.sin(tick / 40) * 0.08)
    batteryVoltage = 48.9 + Math.sin(tick / 35) * 0.15
    rpm = 2100 + speedKmh * 22
    tirePsi = { fl: 32, fr: 32, rl: 31.2, rr: 31.1 }
  }

  if (scenario === "battery_failure") {
    speedKmh = 32 + Math.sin(tick / 16) * 8
    engineTempC = 79 + Math.sin(tick / 30) * 1.2
    batteryVoltage = Math.max(43.8, base.batteryVoltage - 0.045)
    rpm = 1900 + speedKmh * 18
    tirePsi = {
      fl: 31.8,
      fr: 31.7,
      rl: 30.5 - tick * 0.004,
      rr: 30.6,
    }
  }

  const tempRisk = Math.max(0, (engineTempC - 84) / 14)
  const voltRisk = Math.max(0, (46.8 - batteryVoltage) / 4)
  const tireRisk =
    Math.max(0, (28 - Math.min(tirePsi.fl, tirePsi.fr, tirePsi.rl, tirePsi.rr)) / 4) || 0

  const anomalyScore = Math.min(0.99, 0.08 + tempRisk * 0.55 + voltRisk * 0.5 + tireRisk * 0.25)
  const anomalyActive = engineTempC >= 90 || batteryVoltage <= 46.2 || tireRisk > 0.35

  return {
    vehicleId,
    deviceTime: isoNow(),
    speedKmh,
    engineTempC,
    batteryVoltage,
    rpm,
    tirePsi,
    anomalyScore,
    anomalyActive,
    scenario,
    pipelineNote: anomalyActive ? "SCADA · umbral ML / reglas" : "SCADA · within range",
  }
}
