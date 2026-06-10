"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Bell, Car, ExternalLink, Loader2, Play, Ticket } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  fetchAnomalies,
  fetchMe,
  getApiBaseUrl,
  postAnomalyRun,
  postTicketFromAnomaly,
  type ApiAnomaly,
} from "@/lib/api"
import { isAlertasReadOnly } from "@/lib/rbac"

type FilterTab = "all" | "alta" | "media" | "baja" | "resueltas"

const severityConfig: Record<string, { borderColor: string; textColor: string; bgColor: string; label: string }> = {
  critical: {
    borderColor: "border-l-[#E24B4A]",
    textColor: "text-[#E24B4A]",
    bgColor: "bg-[#E24B4A]/15",
    label: "Crítica",
  },
  high: {
    borderColor: "border-l-[#E24B4A]",
    textColor: "text-[#E24B4A]",
    bgColor: "bg-[#E24B4A]/15",
    label: "Alta",
  },
  medium: {
    borderColor: "border-l-[#EF9F27]",
    textColor: "text-[#EF9F27]",
    bgColor: "bg-[#EF9F27]/15",
    label: "Media",
  },
  low: {
    borderColor: "border-l-[#1D9E75]",
    textColor: "text-[#1D9E75]",
    bgColor: "bg-[#1D9E75]/15",
    label: "Baja",
  },
}

const statusColors: Record<string, string> = {
  Abierto: "bg-[#E24B4A]/15 text-[#E24B4A] border-[#E24B4A]/30",
  "Ticket creado": "bg-[#378ADD]/15 text-[#378ADD] border-[#378ADD]/30",
  Revisando: "bg-[#EF9F27]/15 text-[#EF9F27] border-[#EF9F27]/30",
  Resuelto: "bg-[#1D9E75]/15 text-[#1D9E75] border-[#1D9E75]/30",
}

function mapAnomaly(a: ApiAnomaly) {
  const sev = a.severity in severityConfig ? a.severity : "medium"
  const cfg = severityConfig[sev] ?? severityConfig.medium!
  const status = a.resolved_at ? "Resuelto" : a.ticket_id ? "Ticket creado" : "Abierto"
  const title =
    a.sensor_affected === "engine_temp"
      ? "Temperatura atípica"
      : a.sensor_affected === "rpm"
        ? "RPM atípicas"
        : a.sensor_affected === "speed"
          ? "Velocidad atípica"
          : a.sensor_affected === "battery_voltage"
            ? "Voltaje atípico"
            : a.sensor_affected === "vibration_rms"
              ? "Vibración atípica (RMS)"
              : "Patrón multivariable"
  return {
    id: a.id,
    vehicleId: a.vehicle_id,
    vehicle: a.plate,
    type: title,
    description: a.description ?? "Anomalía detectada por Isolation Forest.",
    model: a.model_version ?? "iforest",
    modelScore: a.anomaly_score,
    severityLabel: cfg.label,
    severityKey: sev,
    status,
    ticketId: a.ticket_id ?? undefined,
    timestamp: new Date(a.time).toLocaleString(),
    anomalyTimeIso: a.time,
  }
}

export function AlertasPanel() {
  const baseUrl = useMemo(() => getApiBaseUrl(), [])
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<FilterTab>("all")
  const [creatingTicketFor, setCreatingTicketFor] = useState<string | null>(null)
  const [ticketMessage, setTicketMessage] = useState<string | null>(null)

  const q = useQuery({
    queryKey: ["anomalies", baseUrl],
    queryFn: async () => {
      if (!baseUrl) return [] as ApiAnomaly[]
      return fetchAnomalies(baseUrl, 300)
    },
    enabled: Boolean(baseUrl),
    refetchInterval: 20_000,
  })

  const meQuery = useQuery({
    queryKey: ["me", baseUrl],
    queryFn: async () => {
      if (!baseUrl) return null
      return fetchMe(baseUrl)
    },
    enabled: Boolean(baseUrl),
  })

  const readOnlyAlerts = isAlertasReadOnly(meQuery.data?.role ?? null)

  const runMutation = useMutation({
    mutationFn: async () => {
      if (!baseUrl) throw new Error("Sin API")
      return postAnomalyRun(baseUrl, { window: 400, contamination: 0.06 })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["anomalies", baseUrl] })
    },
  })

  const rows = useMemo(() => (q.data ?? []).map(mapAnomaly), [q.data])

  const filtered = rows.filter((alert) => {
    if (activeTab === "all") return alert.status !== "Resuelto"
    if (activeTab === "resueltas") return alert.status === "Resuelto"
    if (activeTab === "alta") return alert.severityLabel === "Alta" || alert.severityLabel === "Crítica"
    if (activeTab === "media") return alert.severityLabel === "Media"
    if (activeTab === "baja") return alert.severityLabel === "Baja"
    return true
  })

  const counts = {
    all: rows.filter((a) => a.status !== "Resuelto").length,
    alta: rows.filter((a) => a.severityLabel === "Alta" || a.severityLabel === "Crítica").length,
    media: rows.filter((a) => a.severityLabel === "Media").length,
    baja: rows.filter((a) => a.severityLabel === "Baja").length,
    resueltas: rows.filter((a) => a.status === "Resuelto").length,
  }

  if (!baseUrl) {
    return (
      <p className="text-sm text-muted-foreground">
        Configura <span className="font-mono">NEXT_PUBLIC_API_URL</span> en <span className="font-mono">.env.local</span>{" "}
        para ver anomalías reales.
      </p>
    )
  }

  return (
    <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-semibold">
            <Bell className="h-6 w-6 text-[#EF9F27]" />
            Alertas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Eventos en <span className="font-mono">anomaly_events</span> (Isolation Forest).
            {readOnlyAlerts
              ? " Vista solo lectura: la detección y tickets los ejecutan roles operativos."
              : " Ejecuta la detección cuando tengas telemetría reciente."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/tickets">
            <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2">
              <Ticket className="h-4 w-4" />
              Ver tickets
            </Button>
          </Link>
          {!readOnlyAlerts ? (
            <Button
              type="button"
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
              className="shrink-0 gap-2"
            >
              {runMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Ejecutar detección
            </Button>
          ) : null}
        </div>
      </div>

      {runMutation.isError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {runMutation.error instanceof Error ? runMutation.error.message : String(runMutation.error)}
        </p>
      ) : null}
      {runMutation.isSuccess ? (
        <p className="text-xs text-muted-foreground">
          Última corrida: insertadas {runMutation.data.rows_inserted} filas · vehículos escaneados{" "}
          {runMutation.data.vehicles_scanned}
        </p>
      ) : null}
      {ticketMessage ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">{ticketMessage}</p>
      ) : null}

      {q.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : null}
      {q.isError ? (
        <p className="text-sm text-destructive">
          {q.error instanceof Error ? q.error.message : "Error al cargar anomalías"}
        </p>
      ) : null}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all" className="text-xs">
            Todas ({counts.all})
          </TabsTrigger>
          <TabsTrigger value="alta" className="text-xs text-[#E24B4A] data-[state=active]:text-[#E24B4A]">
            Alta/Crítica ({counts.alta})
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

      <div className="space-y-4">
        {filtered.map((alert) => {
          const cfg = severityConfig[alert.severityKey] ?? severityConfig.medium!
          return (
            <Card
              key={alert.id}
              className={cn("overflow-hidden border border-border border-l-4 bg-card", cfg.borderColor)}
            >
              <CardContent className="p-0">
                <div className="flex flex-col justify-between gap-4 p-4 lg:flex-row lg:items-center">
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="outline" className={cn("text-xs font-mono", cfg.bgColor, cfg.textColor)}>
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        {alert.severityLabel}
                      </Badge>
                      <span className="flex items-center gap-1.5 font-mono text-sm font-semibold">
                        <Car className="h-3.5 w-3.5 text-muted-foreground" />
                        {alert.vehicle}
                      </span>
                      <span className="font-medium">{alert.type}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.description}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        Modelo: <span className="text-foreground">{alert.model}</span>
                      </span>
                      <span>
                        Score:{" "}
                        <span className="font-mono text-foreground">{alert.modelScore.toFixed(3)}</span>
                      </span>
                      <span className="font-mono">{alert.timestamp}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={cn("text-xs", statusColors[alert.status])}>
                      {alert.status}
                    </Badge>
                    {alert.ticketId ? (
                      <Button variant="outline" size="sm" className="h-8 font-mono text-[10px]" disabled type="button">
                        <Ticket className="mr-1.5 h-3.5 w-3.5" />
                        {String(alert.ticketId).slice(0, 8)}…
                      </Button>
                    ) : alert.status !== "Resuelto" && !readOnlyAlerts ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        type="button"
                        disabled={creatingTicketFor !== null}
                        onClick={() => {
                          if (!baseUrl) return
                          setTicketMessage(null)
                          setCreatingTicketFor(alert.id)
                          void (async () => {
                            try {
                              const t = await postTicketFromAnomaly(baseUrl, {
                                anomaly_id: alert.id,
                                anomaly_time: alert.anomalyTimeIso,
                              })
                              setTicketMessage(`Ticket creado: ${t.id.slice(0, 8)}… (${t.priority})`)
                              await qc.invalidateQueries({ queryKey: ["anomalies", baseUrl] })
                              await qc.invalidateQueries({ queryKey: ["tickets", baseUrl] })
                            } catch (e) {
                              setTicketMessage(
                                e instanceof Error ? e.message : "No se pudo crear el ticket (¿rol autorizado?)",
                              )
                            } finally {
                              setCreatingTicketFor(null)
                            }
                          })()
                        }}
                      >
                        {creatingTicketFor === alert.id ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Ticket className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        Crear ticket
                      </Button>
                    ) : null}
                    <Link href={`/telemetria?vehicle=${encodeURIComponent(alert.vehicleId)}`}>
                      <Button variant="ghost" size="sm" className="h-8 text-xs">
                        Ver telemetría
                        <ExternalLink className="ml-1.5 h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {!q.isLoading && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No hay alertas en esta categoría.</p>
          <p className="mt-2 max-w-md text-xs text-muted-foreground">
            {readOnlyAlerts ? (
              <>
                Si no ves eventos, un técnico o gerente debe ejecutar la detección cuando haya telemetría suficiente (~40
                puntos por vehículo en la ventana).
              </>
            ) : (
              <>
                Genera telemetría (Kafka + consumidor o datos de prueba) y pulsa <strong>Ejecutar detección</strong>.
                Cada vehículo necesita al menos ~40 puntos en la ventana.
              </>
            )}
          </p>
        </div>
      ) : null}
    </div>
  )
}
