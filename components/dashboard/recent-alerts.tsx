"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Bell, ExternalLink, Loader2 } from "lucide-react"
import { fetchAnomalies, getApiBaseUrl, type ApiAnomaly } from "@/lib/api"

const SEV: Record<string, string> = {
  critical: "border-[var(--tm-danger)]/30 bg-[var(--tm-danger)]/15 text-[var(--tm-danger)]",
  high: "border-[var(--tm-danger)]/30 bg-[var(--tm-danger)]/15 text-[var(--tm-danger)]",
  medium: "border-[var(--tm-warning)]/30 bg-[var(--tm-warning)]/15 text-[var(--tm-warning)]",
  low: "border-[var(--tm-success)]/30 bg-[var(--tm-success)]/15 text-[var(--tm-success)]",
}

const SEV_LABEL: Record<string, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Media",
  low: "Baja",
}

const STAT: Record<string, string> = {
  Abierto: "border-[var(--tm-danger)]/30 bg-[var(--tm-danger)]/15 text-[var(--tm-danger)]",
  "Ticket creado": "border-[var(--tm-info)]/30 bg-[var(--tm-info)]/15 text-[var(--tm-info)]",
  Resuelto: "border-[var(--tm-success)]/30 bg-[var(--tm-success)]/15 text-[var(--tm-success)]",
}

function rowFromAnomaly(a: ApiAnomaly) {
  const sev = a.severity in SEV_LABEL ? a.severity : "medium"
  const status = a.resolved_at ? "Resuelto" : a.ticket_id ? "Ticket creado" : "Abierto"
  const type =
    a.sensor_affected === "engine_temp"
      ? "Temperatura motor elevada"
      : a.sensor_affected === "battery_voltage"
        ? "Voltaje de batería bajo"
        : a.sensor_affected === "rpm"
          ? "Patrón RPM inusual"
          : a.sensor_affected === "vibration_rms"
            ? "Vibración RMS atípica"
            : "Patrón multivariable"
  return {
    id: a.id,
    vehicle: a.plate,
    type,
    severity: SEV_LABEL[sev] ?? "Media",
    model: a.model_version ?? "Isolation Forest",
    status,
  }
}

const DEMO_ROWS = [
  {
    id: "demo-1",
    vehicle: "MED-1001",
    type: "Sin API — ejemplo",
    severity: "Media",
    model: "—",
    status: "Abierto",
  },
]

export function RecentAlerts() {
  const baseUrl = getApiBaseUrl()
  const q = useQuery({
    queryKey: ["dashboard", "recent-anomalies"],
    queryFn: () => fetchAnomalies(baseUrl!, 8),
    enabled: !!baseUrl,
    refetchInterval: 20_000,
  })

  const rows = baseUrl && !q.isError && q.data?.length
    ? q.data.slice(0, 5).map(rowFromAnomaly)
    : DEMO_ROWS

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Bell className="h-4 w-4 text-[var(--tm-warning)]" />
          Últimas alertas del motor de anomalías
          {q.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs font-medium text-muted-foreground">Unidad</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Hallazgo</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Severidad</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Modelo</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Estado</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="border-border hover:bg-muted/40">
                <TableCell className="font-mono text-sm font-medium">{r.vehicle}</TableCell>
                <TableCell className="text-sm">{r.type}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      SEV[
                        r.severity === "Crítica"
                          ? "critical"
                          : r.severity === "Alta"
                            ? "high"
                            : r.severity === "Media"
                              ? "medium"
                              : "low"
                      ] ?? SEV.medium
                    }`}
                  >
                    {r.severity}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.model}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] ${STAT[r.status] ?? ""}`}>
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-[var(--tm-info)] hover:text-[var(--tm-info)]"
                    asChild
                  >
                    <Link href="/alertas">
                      Abrir
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-4 border-t border-border pt-4">
          <Button variant="outline" className="w-full text-sm" asChild>
            <Link href="/alertas">Ir al centro de alertas</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
