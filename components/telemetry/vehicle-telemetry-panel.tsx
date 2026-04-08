"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Activity } from "lucide-react"
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
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { fetchVehicleTelemetry, fetchVehicles, getApiBaseUrl, type ApiTelemetryPoint } from "@/lib/api"

type ChartRow = {
  label: string
  speed: number | null
  engine_temp: number | null
  battery_voltage: number | null
  rpm: number | null
}

function toChartRows(points: ApiTelemetryPoint[]): ChartRow[] {
  return points.map((p) => ({
    label: new Date(p.time).toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    speed: p.speed,
    engine_temp: p.engine_temp,
    battery_voltage: p.battery_voltage,
    rpm: p.rpm,
  }))
}

export function VehicleTelemetryPanel() {
  const apiBase = getApiBaseUrl()
  const router = useRouter()
  const searchParams = useSearchParams()
  const vehicleFromUrl = searchParams.get("vehicle")

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", apiBase],
    queryFn: () => fetchVehicles(apiBase!),
    enabled: Boolean(apiBase),
  })

  const selectedId = useMemo(() => {
    if (vehicleFromUrl && vehicles.some((v) => v.id === vehicleFromUrl)) return vehicleFromUrl
    return vehicles[0]?.id ?? null
  }, [vehicleFromUrl, vehicles])

  const { data: points = [], isFetching, isError, refetch } = useQuery({
    queryKey: ["telemetry", apiBase, selectedId],
    queryFn: () => fetchVehicleTelemetry(apiBase!, selectedId!, 600),
    enabled: Boolean(apiBase && selectedId),
    refetchInterval: 8000,
  })

  const chartData = useMemo(() => toChartRows(points), [points])
  const selectedVehicle = vehicles.find((v) => v.id === selectedId)

  if (!apiBase) {
    return (
      <p className="text-sm text-muted-foreground">
        Configura <span className="font-mono">NEXT_PUBLIC_API_URL</span> en{" "}
        <span className="font-mono">.env.local</span> para ver telemetría desde TimescaleDB.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Vehículo</p>
          <Select
            value={selectedId ?? ""}
            onValueChange={(id) => {
              router.replace(`/telemetria?vehicle=${encodeURIComponent(id)}`)
            }}
          >
            <SelectTrigger className="w-[min(100%,320px)] bg-muted/50">
              <SelectValue placeholder="Elegir vehículo" />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.plate} · {v.brand} {v.model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            Actualizar
          </Button>
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href="/flota">Ver flota</Link>
          </Button>
        </div>
      </div>

      {selectedVehicle ? (
        <p className="text-xs text-muted-foreground">
          Hasta 600 puntos recientes de <span className="font-medium text-foreground">{selectedVehicle.plate}</span>
          {isFetching ? " · sincronizando…" : null}
        </p>
      ) : null}

      {vehicles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay vehículos en la API. Aplica el seed en <span className="font-mono">backend/</span> y vuelve a
          cargar.
        </p>
      ) : null}

      {isError ? (
        <p className="rounded-lg border border-[var(--tm-warning)]/40 bg-[var(--tm-warning)]/10 px-3 py-2 text-sm text-[var(--tm-warning)]">
          No se pudo cargar la telemetría. ¿Hay filas en <span className="font-mono">telemetry_readings</span> para
          este vehículo?
        </p>
      ) : null}

      {selectedId && !isError && chartData.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin datos de telemetría para este vehículo. Levanta simulador + consumidor Kafka o revisa pgAdmin.
        </p>
      ) : null}

      {chartData.length > 0 ? (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Activity className="h-5 w-5 text-[var(--tm-success)]" />
              Series (TimescaleDB vía API)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[340px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} width={36} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} width={40} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="speed"
                  name="Velocidad"
                  stroke="var(--chart-1)"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="engine_temp"
                  name="Temp. motor °C"
                  stroke="var(--chart-3)"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="rpm"
                  name="RPM"
                  stroke="var(--chart-2)"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="battery_voltage"
                  name="Voltaje"
                  stroke="var(--chart-4)"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
