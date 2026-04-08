"use client"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings } from "lucide-react"

export default function ConfiguracionPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Settings className="h-7 w-7 text-muted-foreground" />
            Ajustes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Preferencias de cuenta, umbrales de alerta y claves de API vivirán aquí cuando exista backend.
          </p>
        </div>
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Estado</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Pantalla reservada — sin persistencia todavía.
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
