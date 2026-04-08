import type { ApiVehicle } from "@/lib/api"
import type { Vehicle } from "@/components/fleet/vehicle-card"

export function mapApiVehicleToVehicle(v: ApiVehicle): Vehicle {
  const h = v.overall_health ?? 0.85
  let status: Vehicle["status"] = "Activo"
  if (v.open_critical_anomalies > 0) status = "Alerta"
  else if (h < 0.82) status = "Alerta"
  else if (v.open_tickets > 1 && h < 0.88) status = "Mantenimiento"

  const temp = Math.round(72 + (1 - h) * 28)
  const voltage = Number((47.5 + h * 3.5).toFixed(1))
  const speed = h > 0.82 ? Math.round(28 + h * 35) : 0
  const rpm = h > 0.82 ? Math.round(1600 + h * 900) : 0

  return {
    id: v.id,
    plate: v.plate,
    model: [v.brand, v.model].filter(Boolean).join(" ") || "—",
    status,
    speed,
    temp,
    voltage,
    rpm,
    tempHistory: [temp - 5, temp - 4, temp - 3, temp - 2, temp - 1, temp, temp],
  }
}
