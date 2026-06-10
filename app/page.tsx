"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { DashboardKpis } from "@/components/dashboard/dashboard-kpis"
import { LiveTelemetryChart } from "@/components/dashboard/live-telemetry-chart"
import { RecentAlerts } from "@/components/dashboard/recent-alerts"
import { DigitalTwinCard } from "@/components/dashboard/digital-twin-card"
import { GeneticAlgorithmCard } from "@/components/dashboard/genetic-algorithm-card"
import { PipelineCard } from "@/components/dashboard/pipeline-card"

export default function HomePage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <DashboardKpis />

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
