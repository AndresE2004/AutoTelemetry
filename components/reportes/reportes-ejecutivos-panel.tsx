"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import {
  fetchReportFleetHealthJson,
  fetchReportMaintenanceKpiJson,
  type FleetHealthRowJson,
  type MaintenanceKpiJson,
} from "@/lib/api"
import type { Role } from "@/lib/rbac"

const PRIORITY_COLORS = ["#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444"]

/** Tarifas demostrativas (no contabilidad): solo para narrativa ejecutiva en demo. */
const DEMO_MXN_RESOLVED = 12_500
const DEMO_MXN_ACTIVE_PIPELINE = 2_800
const DEMO_MXN_CRITICAL_EXPOSURE = 42_000
const DEMO_MXN_HIGH_EXPOSURE = 9_500

function formatMxn(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Math.round(n))
}

function demoValorGestionTickets(kpi: MaintenanceKpiJson): {
  valorGestionTickets: number
  exposicionPrioritaria: number
  indicadorSintetico: number
} {
  const resolved = kpi.by_status.resolved
  const pipeline = kpi.by_status.open + kpi.by_status.in_progress
  const crit = kpi.by_priority.critical
  const high = kpi.by_priority.high
  const valorGestionTickets = resolved * DEMO_MXN_RESOLVED + pipeline * DEMO_MXN_ACTIVE_PIPELINE
  const exposicionPrioritaria = crit * DEMO_MXN_CRITICAL_EXPOSURE + high * DEMO_MXN_HIGH_EXPOSURE
  const indicadorSintetico = valorGestionTickets + exposicionPrioritaria * 0.35
  return { valorGestionTickets, exposicionPrioritaria, indicadorSintetico }
}

function parseHealth(h: string): number {
  const v = parseFloat(h)
  return Number.isFinite(v) ? v : 0
}

function fleetHealthSummary(rows: FleetHealthRowJson[]) {
  if (!rows.length) return { avg: 0, criticalAnom: 0, openTickets: 0 }
  const avg = rows.reduce((s, r) => s + parseHealth(r.overall_health), 0) / rows.length
  const criticalAnom = rows.reduce((s, r) => s + (parseInt(r.open_critical_anomalies, 10) || 0), 0)
  const openTickets = rows.reduce((s, r) => s + (parseInt(r.open_tickets, 10) || 0), 0)
  return { avg, criticalAnom, openTickets }
}

export type ReportesEjecutivosAudience = Extract<Role, "admin" | "fleet_manager" | "viewer">

type Props = {
  baseUrl: string
  fleetId: string
  /** Define qué bloques y tono se muestran (dinero solo admin; flota vs lectura). */
  audience: ReportesEjecutivosAudience
}

export function ReportesEjecutivosPanel({ baseUrl, fleetId, audience }: Props) {
  const [kpi, setKpi] = useState<MaintenanceKpiJson | null>(null)
  const [health, setHealth] = useState<FleetHealthRowJson[] | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadErr(null)
      try {
        const [k, h] = await Promise.all([
          fetchReportMaintenanceKpiJson(baseUrl, fleetId),
          fetchReportFleetHealthJson(baseUrl, fleetId),
        ])
        if (!cancelled) {
          setKpi(k)
          setHealth(h)
        }
      } catch (e) {
        if (!cancelled) {
          setLoadErr(e instanceof Error ? e.message : "No se pudieron cargar los indicadores")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [baseUrl, fleetId])

  const statusChart = useMemo(() => {
    if (!kpi) return []
    return [
      { name: "Abiertos", value: kpi.by_status.open },
      { name: "En curso", value: kpi.by_status.in_progress },
      { name: "Resueltos", value: kpi.by_status.resolved },
      { name: "Cancelados", value: kpi.by_status.cancelled },
    ]
  }, [kpi])

  const priorityChart = useMemo(() => {
    if (!kpi) return []
    return [
      { name: "Baja", value: kpi.by_priority.low },
      { name: "Media", value: kpi.by_priority.medium },
      { name: "Alta", value: kpi.by_priority.high },
      { name: "Crítica", value: kpi.by_priority.critical },
    ]
  }, [kpi])

  const healthByVehicle = useMemo(() => {
    if (!health?.length) return []
    return [...health]
      .map((r) => ({
        plate: r.plate || r.vehicle_id.slice(0, 8),
        salud: Math.round(parseHealth(r.overall_health) * 100) / 100,
      }))
      .sort((a, b) => a.salud - b.salud)
      .slice(0, 12)
  }, [health])

  const money = useMemo(() => (kpi ? demoValorGestionTickets(kpi) : null), [kpi])
  const fh = useMemo(() => (health ? fleetHealthSummary(health) : null), [health])

  const showMoney = audience === "admin"
  const badgePrimary =
    audience === "admin"
      ? "Vista ejecutiva"
      : audience === "fleet_manager"
        ? "Gestión de flota"
        : "Estado de la flota"
  const badgeSecondary =
    audience === "admin"
      ? "Indicadores económicos demostrativos"
      : audience === "fleet_manager"
        ? "Rendimiento operativo y prioridades"
        : "Solo lectura · resumen claro"

  const intro =
    audience === "admin" ? (
      <>
        Los importes se calculan con <span className="font-medium text-foreground">fórmulas fijas de demo</span> a
        partir de tus KPI y tickets; no sustituyen un modelo financiero ni estados contables. Sirven para explicar
        impacto y tendencias a dirección.
      </>
    ) : audience === "fleet_manager" ? (
      <>
        Vista orientada a <span className="font-medium text-foreground">operación de flota</span>: salud por unidad,
        colas de tickets y severidad. Sin indicadores monetarios ejecutivos.
      </>
    ) : (
      <>
        Resumen para <span className="font-medium text-foreground">seguimiento del vehículo o la flota</span> en modo
        lectura: salud, tickets abiertos y prioridades, sin indicadores monetarios.
      </>
    )

  const statusChartDescription =
    audience === "admin"
      ? "Volumen operativo que alimenta coste y riesgo."
      : audience === "fleet_manager"
        ? "Carga de trabajo del taller y seguimiento de cierres."
        : "Cuántos tickets hay en cada etapa."

  const priorityChartDescription =
    audience === "admin"
      ? "Enfoque en colas que suelen concentrar coste evitable."
      : audience === "fleet_manager"
        ? "Dónde concentrar recursos según severidad."
        : "Distribución de prioridades en la cola."

  const vehicleChartDescription =
    audience === "admin"
      ? "Hasta 12 unidades; útil para priorizar inversión o paradas."
      : audience === "fleet_manager"
        ? "Hasta 12 unidades; ordenadas por peor salud para planificar intervenciones."
        : "Hasta 12 unidades; identifica rápidamente unidades con salud baja."

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-8 text-muted-foreground">
        <Spinner className="h-5 w-5" />
        Cargando vista ejecutiva…
      </div>
    )
  }

  if (loadErr || !kpi || !health) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-card p-6 text-sm text-destructive">
        {loadErr ?? "Sin datos para mostrar."}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="font-normal">
          {badgePrimary}
        </Badge>
        <Badge variant="outline" className="font-normal text-muted-foreground">
          {badgeSecondary}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{intro}</p>

      {showMoney && money ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Valor atribuible a gestión de tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{formatMxn(money.valorGestionTickets)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Resueltos + trabajo en pipeline (tarifas demo).</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Exposición prioritaria (alta/crítica)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{formatMxn(money.exposicionPrioritaria)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Suma ponderada de tickets de alta severidad (demo).</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Indicador sintético de valor</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight text-[var(--tm-violet)]">
                {formatMxn(money.indicadorSintetico)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Combinación demo para un solo número “tipo dashboard”.</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {fh ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Salud media de la flota</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{(fh.avg * 100).toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Anomalías críticas abiertas (suma)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{fh.criticalAnom}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tickets abiertos (suma)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{fh.openTickets}</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tickets por estado</CardTitle>
            <CardDescription>{statusChartDescription}</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8 }}
                  formatter={(v: number) => [v, "Tickets"]}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" name="Tickets" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tickets por prioridad</CardTitle>
            <CardDescription>{priorityChartDescription}</CardDescription>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={priorityChart}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {priorityChart.map((_, i) => (
                    <Cell key={i} fill={PRIORITY_COLORS[i % PRIORITY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [v, "Tickets"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Salud por vehículo (peor desempeño primero)</CardTitle>
          <CardDescription>{vehicleChartDescription}</CardDescription>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={healthByVehicle}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <YAxis type="category" dataKey="plate" width={100} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, "Salud"]}
                contentStyle={{ borderRadius: 8 }}
              />
              <Bar dataKey="salud" fill="var(--tm-violet)" name="Salud" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Generado: <span className="font-mono">{kpi.generated_at}</span> · Flota:{" "}
        <span className="font-mono">{fleetId}</span>
      </p>
    </div>
  )
}
