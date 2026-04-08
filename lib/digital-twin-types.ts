export type TwinScenarioId = "normal" | "overheating" | "battery_failure"

export type TwinTelemetryFrame = {
  vehicleId: string
  deviceTime: string
  speedKmh: number
  engineTempC: number
  batteryVoltage: number
  rpm: number
  tirePsi: { fl: number; fr: number; rl: number; rr: number }
  anomalyScore: number
  anomalyActive: boolean
  scenario: TwinScenarioId
  pipelineNote?: string
}

export const TWIN_SCENARIOS: { id: TwinScenarioId; label: string; description: string }[] = [
  {
    id: "normal",
    label: "Operación normal",
    description: "Ciudad, temperatura estable, voltaje y presiones dentro de rango.",
  },
  {
    id: "overheating",
    label: "Sobrecalentamiento",
    description: "Temperatura del motor sube de forma progresiva hasta zona crítica.",
  },
  {
    id: "battery_failure",
    label: "Degradación de batería",
    description: "Voltaje cae gradualmente simulando descarga anómala del pack.",
  },
]
