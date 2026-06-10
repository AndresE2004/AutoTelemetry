"use client"

import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getApiBaseUrl } from "@/lib/api"
import { CheckCircle2, Database, Gauge, Settings, ShieldCheck, Webhook } from "lucide-react"

export default function ConfiguracionPage() {
  const apiBase = getApiBaseUrl()

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Settings className="h-7 w-7 text-muted-foreground" />
            Ajustes
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Panel de configuración y estado operativo del entorno local.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="border-border bg-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Entorno de aplicación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Webhook className="mt-0.5 h-4 w-4 text-[var(--tm-info)]" />
                <div>
                  <p className="font-medium">API base detectada</p>
                  <p className="font-mono text-xs text-muted-foreground">{apiBase ?? "No configurada"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-[var(--tm-success)]" />
                <div>
                  <p className="font-medium">Autenticación</p>
                  <p className="text-muted-foreground">Sesión protegida por login y control de acceso por rol.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Database className="mt-0.5 h-4 w-4 text-[var(--tm-cyan)]" />
                <div>
                  <p className="font-medium">Persistencia</p>
                  <p className="text-muted-foreground">Telemetría y alertas almacenadas en TimescaleDB/PostgreSQL.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Gauge className="mt-0.5 h-4 w-4 text-[var(--tm-warning)]" />
                <div>
                  <p className="font-medium">Criterio de vibración</p>
                  <p className="text-muted-foreground">Evaluación visible en telemetría según ISO 10816-1.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">Estado rápido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-md border border-border p-2">
                <span className="text-muted-foreground">API URL</span>
                <Badge variant={apiBase ? "default" : "secondary"}>{apiBase ? "OK" : "Pendiente"}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-2">
                <span className="text-muted-foreground">Telemetría vibración</span>
                <Badge variant="default">Activa</Badge>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-2">
                <span className="text-muted-foreground">Gemelo 3D</span>
                <Badge variant="default">Disponible</Badge>
              </div>
              <div className="pt-2">
                <Button asChild size="sm" className="w-full">
                  <Link href="/telemetria">Ir a telemetría</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">Checklist de verificación</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[var(--tm-success)]" />
              Login y control por roles activos
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[var(--tm-success)]" />
              Importación de pruebas de laboratorio disponible
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[var(--tm-success)]" />
              Detección de anomalías habilitada
            </p>
            <p className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[var(--tm-success)]" />
              Paneles de telemetría y gemelo listos para demo
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
