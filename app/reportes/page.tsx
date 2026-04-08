"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileBarChart } from "lucide-react"

export default function ReportesPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <FileBarChart className="h-7 w-7 text-[var(--tm-violet)]" />
            Reportes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Exportaciones PDF / CSV / XLSX se conectarán a los endpoints <span className="font-mono">/reports/*</span>{" "}
            de FastAPI.
          </p>
        </div>
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Descargas (placeholder)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" disabled>
              Resumen de anomalías
            </Button>
            <Button type="button" variant="outline" disabled>
              Salud de flota
            </Button>
            <Button type="button" variant="outline" disabled>
              KPI de mantenimiento
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
