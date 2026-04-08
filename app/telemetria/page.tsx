"use client"

import { Suspense } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { VehicleTelemetryPanel } from "@/components/telemetry/vehicle-telemetry-panel"
import { LiveTelemetryChart } from "@/components/dashboard/live-telemetry-chart"
import { Activity } from "lucide-react"

function TelemetriaChartsFallback() {
  return <p className="text-sm text-muted-foreground">Cargando telemetría…</p>
}

export default function TelemetriaPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Activity className="h-7 w-7 text-[var(--tm-success)]" />
            Telemetría
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Datos históricos desde <span className="font-mono">telemetry_readings</span> (Kafka → consumidor →
            TimescaleDB). Elige un vehículo o entra desde <span className="font-mono">/flota</span> con el botón
            Telemetría.
          </p>
        </div>

        <Suspense fallback={<TelemetriaChartsFallback />}>
          <VehicleTelemetryPanel />
        </Suspense>

        <div className="space-y-2 border-t border-border pt-8">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Demo en navegador</p>
          <p className="text-xs text-muted-foreground">
            Gráfica animada solo en cliente (sin API); útil para maquetar sin backend.
          </p>
          <LiveTelemetryChart />
        </div>
      </div>
    </DashboardLayout>
  )
}
