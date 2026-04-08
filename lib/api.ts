export function getApiBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (!raw) return null
  return raw.replace(/\/$/, "")
}

export type ApiVehicle = {
  id: string
  plate: string
  vin: string | null
  model: string | null
  brand: string | null
  year: number | null
  fleet_id: string
  fleet_name: string
  firmware_version: string | null
  created_at: string
  updated_at: string
  overall_health: number | null
  open_critical_anomalies: number
  open_tickets: number
}

export async function fetchVehicles(baseUrl: string): Promise<ApiVehicle[]> {
  const res = await fetch(`${baseUrl}/vehicles`, { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`vehicles ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

export type ApiTelemetryPoint = {
  time: string
  device_time: string
  speed: number | null
  engine_temp: number | null
  battery_voltage: number | null
  rpm: number | null
  latitude: number | null
  longitude: number | null
  odometer: number | null
}

export async function fetchVehicleTelemetry(
  baseUrl: string,
  vehicleId: string,
  limit = 500,
): Promise<ApiTelemetryPoint[]> {
  const q = new URLSearchParams({ limit: String(limit) })
  const res = await fetch(`${baseUrl}/vehicles/${vehicleId}/telemetry?${q}`, { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`telemetry ${res.status}: ${await res.text()}`)
  }
  return res.json()
}
