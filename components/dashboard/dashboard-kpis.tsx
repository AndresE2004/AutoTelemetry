"use client"

import { useQuery } from "@tanstack/react-query"
import { Car, AlertTriangle, HeartPulse, Cpu, ClipboardList } from "lucide-react"
import { KPICard } from "@/components/dashboard/kpi-card"
import { fetchAnomalies, fetchVehicles, getApiBaseUrl } from "@/lib/api"

export function DashboardKpis() {
  const baseUrl = getApiBaseUrl()

  const vehiclesQ = useQuery({
    queryKey: ["dashboard", "vehicles"],
    queryFn: () => fetchVehicles(baseUrl!),
    enabled: !!baseUrl,
    refetchInterval: 30_000,
  })

  const anomaliesQ = useQuery({
    queryKey: ["dashboard", "anomalies"],
    queryFn: () => fetchAnomalies(baseUrl!, 100),
    enabled: !!baseUrl,
    refetchInterval: 20_000,
  })

  const vehicles = vehiclesQ.data ?? []
  const anomalies = anomaliesQ.data ?? []

  const unitCount = vehicles.length
  const openAlerts = anomalies.filter((a) => !a.resolved_at).length
  const criticalOpen = anomalies.filter(
    (a) => !a.resolved_at && (a.severity === "high" || a.severity === "critical"),
  ).length
  const openTickets = vehicles.reduce((s, v) => s + (v.open_tickets ?? 0), 0)
  const healthValues = vehicles
    .map((v) => v.overall_health)
    .filter((h): h is number => h != null && !Number.isNaN(h))
  const fleetHealth =
    healthValues.length > 0
      ? healthValues.reduce((a, b) => a + b, 0) / healthValues.length
      : null

  const usingApi = !!baseUrl && !vehiclesQ.isError

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <KPICard
        title="Unidades en flota"
        value={usingApi ? unitCount : 3}
        trend="neutral"
        trendValue={usingApi ? "desde TimescaleDB" : "demo sin API"}
        accentColor="var(--tm-success)"
        icon={<Car className="h-4 w-4 text-[var(--tm-success)]" />}
      />
      <KPICard
        title="Alertas abiertas"
        value={usingApi ? openAlerts : 0}
        trend={openAlerts > 0 ? "down" : "neutral"}
        trendValue={
          usingApi ? `${criticalOpen} críticas/altas` : "conecta API + telemetría"
        }
        accentColor="var(--tm-danger)"
        icon={<AlertTriangle className="h-4 w-4 text-[var(--tm-danger)]" />}
      />
      <KPICard
        title="Salud de flota"
        value={fleetHealth ?? 94.2}
        suffix="%"
        decimals={1}
        trend="up"
        trendValue={usingApi ? "promedio overall_health" : "estimado demo"}
        accentColor="var(--tm-info)"
        icon={<HeartPulse className="h-4 w-4 text-[var(--tm-info)]" />}
      />
      <KPICard
        title="Gemelos (vehículos)"
        value={usingApi ? unitCount : 3}
        trend="neutral"
        trendValue={usingApi ? "1:1 con unidades" : "modo demo"}
        accentColor="var(--tm-cyan)"
        icon={<Cpu className="h-4 w-4 text-[var(--tm-cyan)]" />}
      />
      <KPICard
        title="Tickets abiertos"
        value={usingApi ? openTickets : 0}
        trend="neutral"
        trendValue={usingApi ? "vista v_fleet_health" : "—"}
        accentColor="var(--tm-violet)"
        icon={<ClipboardList className="h-4 w-4 text-[var(--tm-violet)]" />}
      />
    </div>
  )
}
