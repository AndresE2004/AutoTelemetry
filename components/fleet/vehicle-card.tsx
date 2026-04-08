"use client"

import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Car, Gauge, Thermometer, Zap, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

export type Vehicle = {
  id: string
  /** Matrícula para mostrar; si falta, se usa `id`. */
  plate?: string
  model: string
  status: "Activo" | "Alerta" | "Mantenimiento"
  speed: number
  temp: number
  voltage: number
  rpm: number
  tempHistory: number[]
}

type VehicleCardProps = { vehicle: Vehicle }

function Sparkline({ data, stroke }: { data: number[]; stroke: string }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const w = 64
  const h = 22
  const pts = data
    .map((v, i) => {
      const x = (i / Math.max(1, data.length - 1)) * w
      const y = h - ((v - min) / span) * h
      return `${x},${y}`
    })
    .join(" ")
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const STATUS = {
  Activo: {
    dot: "var(--tm-success)",
    bar: "border-l-[var(--tm-success)]",
    chip: "border-[var(--tm-success)]/30 bg-[var(--tm-success)]/12 text-[var(--tm-success)]",
  },
  Alerta: {
    dot: "var(--tm-danger)",
    bar: "border-l-[var(--tm-danger)]",
    chip: "border-[var(--tm-danger)]/30 bg-[var(--tm-danger)]/10 text-[var(--tm-danger)]",
  },
  Mantenimiento: {
    dot: "var(--tm-warning)",
    bar: "border-l-[var(--tm-warning)]",
    chip: "border-[var(--tm-warning)]/30 bg-[var(--tm-warning)]/12 text-[var(--tm-warning)]",
  },
} as const

export function VehicleCard({ vehicle }: VehicleCardProps) {
  const cfg = STATUS[vehicle.status]
  const spark = vehicle.status === "Alerta" ? "var(--tm-danger)" : "var(--tm-info)"

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-border bg-card transition-shadow hover:shadow-md",
        "border-l-2",
        cfg.bar,
        vehicle.status === "Alerta" && "bg-[var(--tm-danger)]/[0.04]"
      )}
    >
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Car className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-mono text-sm font-bold">{vehicle.plate ?? vehicle.id}</p>
              <p className="text-xs text-muted-foreground">{vehicle.model}</p>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-[10px]", cfg.chip)}>
            <span className="mr-1.5 h-1.5 w-1.5 rounded-full" style={{ background: cfg.dot }} />
            {vehicle.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2">
            <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">Velocidad</p>
              <p className="font-mono text-xs font-medium">{vehicle.speed} km/h</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2">
            <Thermometer className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">Motor</p>
              <p
                className={cn(
                  "font-mono text-xs font-medium",
                  vehicle.temp > 85 && "text-[var(--tm-danger)]"
                )}
              >
                {vehicle.temp}°C
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2">
            <Zap className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">Voltaje</p>
              <p
                className={cn(
                  "font-mono text-xs font-medium",
                  vehicle.voltage < 47 && "text-[var(--tm-warning)]"
                )}
              >
                {vehicle.voltage} V
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">RPM</p>
              <p className="font-mono text-xs font-medium">{vehicle.rpm.toLocaleString("es-CO")}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border py-2">
          <span className="text-[10px] text-muted-foreground">Temp. reciente</span>
          <Sparkline data={vehicle.tempHistory} stroke={spark} />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 flex-1 text-xs" asChild>
            <Link href={`/twins/${vehicle.id}`}>Gemelo</Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 flex-1 border-[var(--tm-info)]/35 text-xs text-[var(--tm-info)] hover:bg-[var(--tm-info)]/10"
            asChild
          >
            <Link href={`/telemetria?vehicle=${vehicle.id}`}>Telemetría</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
