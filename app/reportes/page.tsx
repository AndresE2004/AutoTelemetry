"use client"

import { useEffect, useMemo, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, FileBarChart } from "lucide-react"
import { downloadReport, fetchMe, getApiBaseUrl, getDemoFleetIdForReports, type ApiUser } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useAuthUser } from "@/components/auth/auth-context"
import { can, type Role } from "@/lib/rbac"
import { ReportesEjecutivosPanel } from "@/components/reportes/reportes-ejecutivos-panel"

type ReportFormat = "csv" | "json"

export default function ReportesPage() {
  const baseUrl = useMemo(() => getApiBaseUrl(), [])
  const ctxMe = useAuthUser()
  const [me, setMe] = useState<ApiUser | null>(ctxMe)
  const fleetId = useMemo(() => getDemoFleetIdForReports(), [])
  const [fmt, setFmt] = useState<ReportFormat>("csv")
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [techOpen, setTechOpen] = useState(false)

  useEffect(() => {
    setMe(ctxMe)
  }, [ctxMe])

  useEffect(() => {
    if (me || !baseUrl) return
    let cancelled = false
    ;(async () => {
      try {
        const u = await fetchMe(baseUrl)
        if (!cancelled) setMe(u)
      } catch {
        // AuthGuard redirige si no hay sesión.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [me, baseUrl])

  const showExec = me ? can(me.role, "reportes_ejecutivos") : false
  const showOp = me ? can(me.role, "reportes_operativos") : false
  const isAdminDual = showExec && showOp

  const execAudience = ((): "admin" | "fleet_manager" | "viewer" => {
    const r = ((me?.role || "viewer").toLowerCase() as Role) || "viewer"
    if (r === "admin") return "admin"
    if (r === "fleet_manager") return "fleet_manager"
    return "viewer"
  })()

  const q = (format: ReportFormat) => `?format=${format}`

  const run = async (key: string, pathWithQuery: string) => {
    if (!baseUrl) {
      setError("Falta NEXT_PUBLIC_API_URL en .env.local")
      return
    }
    setLoading(key)
    setError(null)
    try {
      await downloadReport(baseUrl, pathWithQuery)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al descargar")
    } finally {
      setLoading(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <FileBarChart className="h-7 w-7 text-[var(--tm-violet)]" />
            Reportes
          </h1>
          {showExec && execAudience === "admin" ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Vista de <span className="font-medium text-foreground">dirección</span>: gráficos,{" "}
              <span className="font-medium text-foreground">indicadores económicos demostrativos</span> y resumen de
              riesgo. Flota demo (<span className="font-mono text-xs">{fleetId}</span>
              ); <span className="font-mono">NEXT_PUBLIC_DEMO_FLEET_ID</span>.
            </p>
          ) : showExec && execAudience === "fleet_manager" ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Vista de <span className="font-medium text-foreground">gestor de flota</span>: salud agregada, tickets y
              prioridades por unidad, sin bloque monetario. Flota demo (
              <span className="font-mono text-xs">{fleetId}</span>).
            </p>
          ) : showExec ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Vista de <span className="font-medium text-foreground">lectura</span>: cómo va la flota y los tickets, sin
              datos financieros de demo. Flota demo (<span className="font-mono text-xs">{fleetId}</span>).
            </p>
          ) : showOp ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Exportaciones técnicas para operación y taller: archivos <span className="font-mono">CSV</span> o{" "}
              <span className="font-mono">JSON</span> vía <span className="font-mono">GET /reports/anomalies</span>.
              Requiere sesión iniciada.
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Cargando permisos de tu sesión…</p>
          )}
        </div>

        {showExec && baseUrl ? (
          <ReportesEjecutivosPanel baseUrl={baseUrl} fleetId={fleetId} audience={execAudience} />
        ) : null}
        {showExec && !baseUrl ? (
          <p className="text-sm text-destructive">
            Falta <span className="font-mono">NEXT_PUBLIC_API_URL</span> en <span className="font-mono">.env.local</span>{" "}
            para cargar la vista ejecutiva.
          </p>
        ) : null}

        {isAdminDual ? (
          <Collapsible open={techOpen} onOpenChange={setTechOpen}>
            <Card className="border-border bg-card">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-6 py-4 text-left hover:bg-muted/40"
                >
                  <div>
                    <p className="text-sm font-semibold">Exportación técnica (operaciones)</p>
                    <p className="text-xs text-muted-foreground">
                      Solo si necesitas el detalle crudo de anomalías; no es la vista recomendada para dirección.
                    </p>
                  </div>
                  <ChevronDown
                    className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", techOpen && "rotate-180")}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="flex flex-col gap-4 border-t pt-4">
                  <div className="inline-flex rounded-md border border-border p-0.5">
                    {(["csv", "json"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFmt(f)}
                        className={cn(
                          "rounded-sm px-3 py-1 text-xs font-medium transition-colors",
                          fmt === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-fit"
                    disabled={!baseUrl || loading !== null}
                    onClick={() => void run("anom", `/reports/anomalies${q(fmt)}`)}
                  >
                    {loading === "anom" ? "Descargando…" : "Descargar anomalías (CSV/JSON)"}
                  </Button>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ) : null}

        {showOp && !isAdminDual ? (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">Reportes operativos</CardTitle>
              <CardDescription>
                Detalle de eventos de anomalía; incluye referencias a tickets cuando existan en la base.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="inline-flex rounded-md border border-border p-0.5">
                {(["csv", "json"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFmt(f)}
                    className={cn(
                      "rounded-sm px-3 py-1 text-xs font-medium transition-colors",
                      fmt === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                disabled={!baseUrl || loading !== null}
                onClick={() => void run("anom", `/reports/anomalies${q(fmt)}`)}
              >
                {loading === "anom" ? "Descargando…" : "Descargar resumen de anomalías"}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {!showExec && !showOp ? (
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            No hay reportes habilitados para tu rol. Revisa el usuario en la base de datos o vuelve a iniciar sesión.
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
