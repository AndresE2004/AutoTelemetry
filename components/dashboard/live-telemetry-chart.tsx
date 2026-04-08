"use client"

import { useCallback, useEffect, useState } from "react"
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
import { Waves } from "lucide-react"

const UNITS = [
  { id: "TM-4821", label: "TM-4821 · furgón eléctrico" },
  { id: "TM-3301", label: "TM-3301 · urbano" },
  { id: "TM-1105", label: "TM-1105 · carga mediana" },
  { id: "TM-2204", label: "TM-2204 · máximo" },
  { id: "TM-5512", label: "TM-5512 · urbano" },
] as const

type Row = { t: string; rpm: number; temp: number }

function seed(): Row[] {
  const out: Row[] = []
  for (let i = 30; i >= 0; i--) {
    out.push({
      t: `${i}s`,
      rpm: 1950 + Math.random() * 700,
      temp: 74 + Math.random() * 10,
    })
  }
  return out
}

export function LiveTelemetryChart() {
  const [vehicle, setVehicle] = useState<string>(UNITS[0].id)
  const [rows, setRows] = useState<Row[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setRows(seed())
    setReady(true)
  }, [])

  const tick = useCallback(() => {
    setRows((prev) => {
      if (prev.length === 0) return seed()
      const next = prev.slice(1)
      const last = prev[prev.length - 1]!
      next.push({
        t: "0s",
        rpm: Math.max(1750, Math.min(2850, last.rpm + (Math.random() - 0.5) * 180)),
        temp: Math.max(68, Math.min(96, last.temp + (Math.random() - 0.5) * 3)),
      })
      return next.map((r, i) => ({ ...r, t: `${30 - i}s` }))
    })
  }, [])

  useEffect(() => {
    if (!ready) return
    const id = window.setInterval(tick, 1600)
    return () => window.clearInterval(id)
  }, [ready, tick])

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Waves className="h-4 w-4 text-[var(--tm-info)]" />
            Serie en vivo (demo)
            <span className="h-2 w-2 rounded-full bg-[var(--tm-success)] pulse-dot" />
          </CardTitle>
          <Select value={vehicle} onValueChange={setVehicle}>
            <SelectTrigger className="h-8 w-full text-xs sm:w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNITS.map((u) => (
                <SelectItem key={u.id} value={u.id} className="text-xs">
                  {u.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {!ready ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            Inicializando buffer…
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
                <YAxis
                  yAxisId="rpm"
                  stroke="#94a3b8"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  domain={[1500, 3000]}
                />
                <YAxis
                  yAxisId="temp"
                  orientation="right"
                  stroke="#94a3b8"
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  domain={[60, 100]}
                  tickFormatter={(v) => `${v}°`}
                />
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
                  yAxisId="rpm"
                  type="monotone"
                  dataKey="rpm"
                  name="RPM"
                  stroke="var(--tm-info)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="temp"
                  type="monotone"
                  dataKey="temp"
                  name="Temp. motor (°C)"
                  stroke="var(--tm-warning)"
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
