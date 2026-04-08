"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { PipelineCard } from "@/components/dashboard/pipeline-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Workflow } from "lucide-react"

export default function PipelinePage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Workflow className="h-7 w-7 text-[var(--tm-info)]" />
            Pipeline SCADA
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            El servicio de supervisión consume <span className="font-mono text-foreground">raw.telemetry</span> en
            Kafka, valida con Pydantic, aplica modelos de anomalías y persiste en TimescaleDB. Sin componentes JVM en
            esta ruta de despliegue.
          </p>
        </div>
        <PipelineCard />
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Próximos pasos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>— Integrar métricas Prometheus (lag, latencias por etapa).</p>
            <p>— Enlazar con <span className="font-mono">pipeline_audit_log</span> para trazabilidad ISO.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
