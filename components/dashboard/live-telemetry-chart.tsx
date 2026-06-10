"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Waves, Loader2 } from "lucide-react"
import { fetchVehicleTelemetry, fetchVehicles, getApiBaseUrl } from "@/lib/api"

type Row = { t: string; vibration: number }

export function LiveTelemetryChart() {
  const baseUrl = getApiBaseUrl()
  const [vehicleId, setVehicleId] = useState<string>("")

  const vehiclesQ = useQuery({
    queryKey: ["dashboard", "telemetry-vehicles"],
    queryFn: () => fetchVehicles(baseUrl!),
    enabled: !!baseUrl,
  })

  const vehicles = vehiclesQ.data ?? []
  const activeId = vehicleId || vehicles[0]?.id || ""

  const telemetryQ = useQuery({
    queryKey: ["dashboard", "telemetry", activeId],
    queryFn: () => fetchVehicleTelemetry(baseUrl!, activeId, 60),
    enabled: !!baseUrl && !!activeId,
    refetchInterval: 8_000,
  })

  const rows: Row[] = useMemo(() => {
    const pts = telemetryQ.data
    if (!pts?.length) return []
    return pts.map((p) => ({
      t: new Date(p.time).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      vibration: p.vibration_rms ?? 0,
    }))
  }, [telemetryQ.data])

  const labelById = useMemo(() => {
    const m = new Map<string, string>()
    for (const v of vehicles) {
      m.set(v.id, `${v.plate} · ${v.model ?? v.brand ?? "vehículo"}`)
    }
    return m
  }, [vehicles])

  const hasApi = !!baseUrl && vehicles.length > 0

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Waves className="h-4 w-4 text-[var(--tm-info)]" />
            Telemetría reciente
            {hasApi ? (
              <span className="h-2 w-2 rounded-full bg-[var(--tm-success)] pulse-dot" />
            ) : null}
            {telemetryQ.isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : null}
          </CardTitle>
          {hasApi ? (
            <Select value={activeId} onValueChange={setVehicleId}>
              <SelectTrigger className="h-8 w-full text-xs sm:w-[240px]">
                <SelectValue placeholder="Vehículo" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">
                    {labelById.get(v.id) ?? v.plate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {!hasApi ? (
          <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <p>Configura `NEXT_PUBLIC_API_URL` y ejecuta seed + simulador/Kafka para ver series reales.</p>
            <p>
              También puedes abrir{" "}
              <a href="/telemetria" className="text-[var(--tm-info)] underline">
                /telemetria
              </a>
              .
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            Sin lecturas aún para esta unidad.
          </div>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 6, right: 24, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis
                  dataKey="t"
                  stroke="#94a3b8"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(148,163,184,0.25)" }}
                />
                <YAxis yAxisId="vib" stroke="#94a3b8" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  yAxisId="vib"
                  type="monotone"
                  dataKey="vibration"
                  name="Vibración RMS (g)"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
