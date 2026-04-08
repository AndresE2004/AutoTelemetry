"use client"

import { useState } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, Bell, Car, ExternalLink, Ticket } from "lucide-react"
import { cn } from "@/lib/utils"

interface Alert {
  id: string
  vehicle: string
  type: string
  description: string
  model: string
  modelScore: number
  severity: "Alta" | "Media" | "Baja"
  status: "Abierto" | "Ticket creado" | "Revisando" | "Resuelto"
  ticketId?: string
  timestamp: string
}

const mockAlerts: Alert[] = [
  {
    id: "ALT-001",
    vehicle: "TM-4821",
    type: "Sobrecalentamiento motor",
    description: "Temperatura del motor supera 80°C durante >5 min continuos",
    model: "Isolation Forest v2.3",
    modelScore: 0.94,
    severity: "Alta",
    status: "Abierto",
    timestamp: "2026-03-26 14:23:45",
  },
  {
    id: "ALT-002",
    vehicle: "TM-3301",
    type: "Voltaje batería bajo",
    description: "Voltaje de batería por debajo de 46.5V en los últimos 30 minutos",
    model: "Autoencoder v1.8",
    modelScore: 0.91,
    severity: "Alta",
    status: "Ticket creado",
    ticketId: "TKT-4521",
    timestamp: "2026-03-26 13:45:12",
  },
  {
    id: "ALT-003",
    vehicle: "TM-1105",
    type: "RPM irregular",
    description: "Variaciones anormales en RPM detectadas durante conducción normal",
    model: "Isolation Forest v2.3",
    modelScore: 0.78,
    severity: "Media",
    status: "Revisando",
    timestamp: "2026-03-26 12:30:00",
  },
  {
    id: "ALT-004",
    vehicle: "TM-5512",
    type: "Presión llanta baja",
    description: "Presión de llanta delantera izquierda por debajo de 28 PSI",
    model: "Rule-based v1.0",
    modelScore: 1.0,
    severity: "Baja",
    status: "Abierto",
    timestamp: "2026-03-26 11:15:33",
  },
  {
    id: "ALT-005",
    vehicle: "TM-6631",
    type: "Consumo energético alto",
    description: "Consumo de energía 23% superior al promedio para este modelo",
    model: "Ensemble v3.1",
    modelScore: 0.85,
    severity: "Media",
    status: "Ticket creado",
    ticketId: "TKT-4519",
    timestamp: "2026-03-26 10:45:00",
  },
  {
    id: "ALT-006",
    vehicle: "TM-0099",
    type: "Vibración anormal",
    description: "Patrones de vibración inusuales detectados en el chasis",
    model: "FFT Analyzer v2.0",
    modelScore: 0.72,
    severity: "Media",
    status: "Resuelto",
    timestamp: "2026-03-26 09:20:18",
  },
  {
    id: "ALT-007",
    vehicle: "TM-8820",
    type: "Error comunicación ECU",
    description: "Timeout en comunicación con unidad de control electrónico",
    model: "Rule-based v1.0",
    modelScore: 1.0,
    severity: "Alta",
    status: "Revisando",
    timestamp: "2026-03-26 08:55:42",
  },
  {
    id: "ALT-008",
    vehicle: "TM-2204",
    type: "Desgaste frenos",
    description: "Indicador de desgaste de pastillas de freno activado",
    model: "Predictive Maint v1.5",
    modelScore: 0.88,
    severity: "Baja",
    status: "Abierto",
    timestamp: "2026-03-26 08:10:00",
  },
]

const severityConfig = {
  Alta: {
    color: "#E24B4A",
    bgColor: "bg-[#E24B4A]/15",
    borderColor: "border-l-[#E24B4A]",
    textColor: "text-[#E24B4A]",
  },
  Media: {
    color: "#EF9F27",
    bgColor: "bg-[#EF9F27]/15",
    borderColor: "border-l-[#EF9F27]",
    textColor: "text-[#EF9F27]",
  },
  Baja: {
    color: "#1D9E75",
    bgColor: "bg-[#1D9E75]/15",
    borderColor: "border-l-[#1D9E75]",
    textColor: "text-[#1D9E75]",
  },
}

const statusColors: Record<string, string> = {
  Abierto: "bg-[#E24B4A]/15 text-[#E24B4A] border-[#E24B4A]/30",
  "Ticket creado": "bg-[#378ADD]/15 text-[#378ADD] border-[#378ADD]/30",
  Revisando: "bg-[#EF9F27]/15 text-[#EF9F27] border-[#EF9F27]/30",
  Resuelto: "bg-[#1D9E75]/15 text-[#1D9E75] border-[#1D9E75]/30",
}

type FilterTab = "all" | "alta" | "media" | "baja" | "resueltas"

export default function AlertasPage() {
  const [activeTab, setActiveTab] = useState<FilterTab>("all")

  const filteredAlerts = mockAlerts.filter((alert) => {
    if (activeTab === "all") return alert.status !== "Resuelto"
    if (activeTab === "resueltas") return alert.status === "Resuelto"
    if (activeTab === "alta") return alert.severity === "Alta"
    if (activeTab === "media") return alert.severity === "Media"
    if (activeTab === "baja") return alert.severity === "Baja"
    return true
  })

  const counts = {
    all: mockAlerts.filter((a) => a.status !== "Resuelto").length,
    alta: mockAlerts.filter((a) => a.severity === "Alta").length,
    media: mockAlerts.filter((a) => a.severity === "Media").length,
    baja: mockAlerts.filter((a) => a.severity === "Baja").length,
    resueltas: mockAlerts.filter((a) => a.status === "Resuelto").length,
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <Bell className="w-6 h-6 text-[#EF9F27]" />
            Alertas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Anomalías detectadas por los modelos de IA en tiempo real
          </p>
        </div>

        {/* Filters */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="all" className="text-xs">
              Todas ({counts.all})
            </TabsTrigger>
            <TabsTrigger value="alta" className="text-xs text-[#E24B4A] data-[state=active]:text-[#E24B4A]">
              Alta ({counts.alta})
            </TabsTrigger>
            <TabsTrigger value="media" className="text-xs text-[#EF9F27] data-[state=active]:text-[#EF9F27]">
              Media ({counts.media})
            </TabsTrigger>
            <TabsTrigger value="baja" className="text-xs text-[#1D9E75] data-[state=active]:text-[#1D9E75]">
              Baja ({counts.baja})
            </TabsTrigger>
            <TabsTrigger value="resueltas" className="text-xs">
              Resueltas ({counts.resueltas})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Alert Cards */}
        <div className="space-y-4">
          {filteredAlerts.map((alert) => {
            const config = severityConfig[alert.severity]
            return (
              <Card
                key={alert.id}
                className={cn(
                  "bg-card border-border border-l-4 overflow-hidden",
                  config.borderColor
                )}
              >
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4">
                    {/* Left: Alert Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className={cn("text-xs font-mono", config.bgColor, config.textColor)}
                        >
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {alert.severity}
                        </Badge>
                        <span className="font-mono text-sm font-semibold flex items-center gap-1.5">
                          <Car className="w-3.5 h-3.5 text-muted-foreground" />
                          {alert.vehicle}
                        </span>
                        <span className="font-medium">{alert.type}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {alert.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          Modelo: <span className="text-foreground">{alert.model}</span>
                        </span>
                        <span>
                          Score: <span className="font-mono text-foreground">{alert.modelScore.toFixed(2)}</span>
                        </span>
                        <span className="font-mono">{alert.timestamp}</span>
                      </div>
                    </div>

                    {/* Right: Status & Actions */}
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={cn("text-xs", statusColors[alert.status])}
                      >
                        {alert.status}
                      </Badge>

                      {alert.ticketId ? (
                        <Link href={`/tickets/${alert.ticketId}`}>
                          <Button variant="outline" size="sm" className="text-xs h-8">
                            <Ticket className="w-3.5 h-3.5 mr-1.5" />
                            {alert.ticketId}
                          </Button>
                        </Link>
                      ) : alert.status !== "Resuelto" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 text-[#378ADD] border-[#378ADD]/30 hover:bg-[#378ADD]/10"
                        >
                          <Ticket className="w-3.5 h-3.5 mr-1.5" />
                          Crear ticket
                        </Button>
                      ) : null}

                      <Link href={`/flota?vehicle=${alert.vehicle}`}>
                        <Button variant="ghost" size="sm" className="text-xs h-8">
                          Ver vehículo
                          <ExternalLink className="w-3 h-3 ml-1.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {filteredAlerts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay alertas en esta categoría</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
