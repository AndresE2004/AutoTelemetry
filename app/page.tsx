"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { KPICard } from "@/components/dashboard/kpi-card"
import { LiveTelemetryChart } from "@/components/dashboard/live-telemetry-chart"
import { RecentAlerts } from "@/components/dashboard/recent-alerts"
import { DigitalTwinCard } from "@/components/dashboard/digital-twin-card"
import { GeneticAlgorithmCard } from "@/components/dashboard/genetic-algorithm-card"
import { PipelineCard } from "@/components/dashboard/pipeline-card"
import { Car, AlertTriangle, HeartPulse, Cpu, Timer } from "lucide-react"

export default function HomePage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KPICard
            title="Unidades en ruta"
            value={247}
            trend="up"
            trendValue="+12 vs ayer"
            accentColor="var(--tm-success)"
            icon={<Car className="h-4 w-4 text-[var(--tm-success)]" />}
          />
          <KPICard
            title="Alertas 24 h"
            value={18}
            trend="down"
            trendValue="-5 vs ayer"
            accentColor="var(--tm-danger)"
            icon={<AlertTriangle className="h-4 w-4 text-[var(--tm-danger)]" />}
          />
          <KPICard
            title="Salud de flota"
            value={94.2}
            suffix="%"
            decimals={1}
            trend="up"
            trendValue="+1.2 pts"
            accentColor="var(--tm-info)"
            icon={<HeartPulse className="h-4 w-4 text-[var(--tm-info)]" />}
          />
          <KPICard
            title="Gemelos activos"
            value={247}
            trend="neutral"
            trendValue="100% sincronizados"
            accentColor="var(--tm-cyan)"
            icon={<Cpu className="h-4 w-4 text-[var(--tm-cyan)]" />}
          />
          <KPICard
            title="Latencia p95 (demo)"
            value={420}
            suffix=" ms"
            decimals={0}
            trend="down"
            trendValue="-40 ms"
            accentColor="var(--tm-violet)"
            icon={<Timer className="h-4 w-4 text-[var(--tm-violet)]" />}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <LiveTelemetryChart />
            <RecentAlerts />
          </div>
          <div className="space-y-6">
            <DigitalTwinCard />
            <GeneticAlgorithmCard />
          </div>
        </div>

        <PipelineCard />
      </div>
    </DashboardLayout>
  )
}
