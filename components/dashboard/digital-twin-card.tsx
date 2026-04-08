"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Cpu, Thermometer, Zap, Gauge, AlertTriangle } from "lucide-react"

function Metric({
  icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  unit: string
  color: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}22` }}
      >
        {icon}
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-mono text-sm font-semibold">
          {value}
          <span className="ml-1 text-muted-foreground">{unit}</span>
        </p>
      </div>
    </div>
  )
}

function sample() {
  const d: { m: string; real: number; twin: number }[] = []
  for (let i = 10; i >= 0; i--) {
    const real = 78 + Math.random() * 8
    const twin = real - 2 + Math.random() * 4
    d.push({ m: `${i}m`, real, twin })
  }
  return d
}

export function DigitalTwinCard() {
  const [data, setData] = useState<ReturnType<typeof sample>>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setData(sample())
    setReady(true)
  }, [])

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Cpu className="h-4 w-4 text-[var(--tm-cyan)]" />
            Gemelo digital · TM-4821
          </CardTitle>
          <Badge
            variant="outline"
            className="border-[var(--tm-cyan)]/35 bg-[var(--tm-cyan)]/10 text-[10px] text-[var(--tm-cyan)]"
          >
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[var(--tm-cyan)] pulse-dot" />
            En línea
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Metric
            icon={<Thermometer className="h-4 w-4 text-[var(--tm-warning)]" />}
            label="Temp. motor"
            value="84"
            unit="°C"
            color="var(--tm-warning)"
          />
          <Metric
            icon={<Zap className="h-4 w-4 text-[var(--tm-info)]" />}
            label="Batería"
            value="48.2"
            unit="V"
            color="var(--tm-info)"
          />
          <Metric
            icon={<Gauge className="h-4 w-4 text-[var(--tm-success)]" />}
            label="RPM simuladas"
            value="2.340"
            unit=""
            color="var(--tm-success)"
          />
          <Metric
            icon={<AlertTriangle className="h-4 w-4 text-[var(--tm-danger)]" />}
            label="Riesgo 7d"
            value="12.4"
            unit="%"
            color="var(--tm-danger)"
          />
        </div>

        <div>
          <p className="mb-2 text-xs text-muted-foreground">Lectura vs estado simulado</p>
          <div className="h-[120px] w-full">
            {!ready ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Cargando…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="m" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 9, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                    domain={[70, 95]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="real"
                    name="Real"
                    stroke="var(--tm-info)"
                    fill="var(--tm-info)"
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="twin"
                    name="Simulado"
                    stroke="var(--tm-warning)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-2">
          <Badge
            variant="outline"
            className="border-[var(--tm-warning)]/35 bg-[var(--tm-warning)]/10 text-xs text-[var(--tm-warning)]"
          >
            Divergencia · 3.2%
          </Badge>
          <Button variant="ghost" size="sm" className="text-xs text-[var(--tm-cyan)]" asChild>
            <Link href="/twins/TM-4821">Ficha del gemelo</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
