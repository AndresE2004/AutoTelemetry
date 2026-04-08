"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Layers,
  Radio,
  Database,
  Cpu,
  Activity,
  Server,
  ChevronRight,
  Braces,
} from "lucide-react"

type StageStatus = "ok" | "warn" | "err"

function Stage({
  icon,
  label,
  status,
}: {
  icon: React.ReactNode
  label: string
  status: StageStatus
}) {
  const color =
    status === "ok" ? "var(--tm-success)" : status === "warn" ? "var(--tm-warning)" : "var(--tm-danger)"
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted/80">
        {icon}
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card pulse-dot"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="max-w-[72px] text-center text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}

function Arrow() {
  return (
    <div className="flex w-6 items-center justify-center">
      <ChevronRight className="h-4 w-4 text-muted-foreground/45" />
    </div>
  )
}

const METRICS = [
  { label: "Kafka", value: "1.02k msg/s", key: "k" },
  { label: "Lag consumidor", value: "12 ms", key: "l" },
  { label: "Escrituras DB", value: "840 /s", key: "d" },
  { label: "Twins activos", value: "247", key: "t" },
] as const

export function PipelineCard() {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Layers className="h-4 w-4 text-[var(--tm-info)]" />
          Pipeline SCADA · Python + Kafka
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Supervisión del flujo MQTT → Kafka → servicio async (aiokafka) → TimescaleDB → modelos ML.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between overflow-x-auto px-2 py-4">
          <Stage
            icon={<Radio className="h-5 w-5 text-[var(--tm-info)]" />}
            label="MQTT TLS"
            status="ok"
          />
          <Arrow />
          <Stage
            icon={<Server className="h-5 w-5 text-[var(--tm-warning)]" />}
            label="Kafka"
            status="ok"
          />
          <Arrow />
          <Stage
            icon={<Braces className="h-5 w-5 text-[var(--tm-success)]" />}
            label="SCADA Python"
            status="ok"
          />
          <Arrow />
          <Stage
            icon={<Cpu className="h-5 w-5 text-[var(--tm-cyan)]" />}
            label="Gemelo digital"
            status="ok"
          />
          <Arrow />
          <Stage
            icon={<Database className="h-5 w-5 text-[var(--tm-violet)]" />}
            label="TimescaleDB"
            status="ok"
          />
          <Arrow />
          <Stage
            icon={<Activity className="h-5 w-5 text-[var(--tm-danger)]" />}
            label="Detección ML"
            status="ok"
          />
          <Arrow />
          <Stage
            icon={<Layers className="h-5 w-5 text-[var(--tm-info)]" />}
            label="API + UI"
            status="ok"
          />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {METRICS.map((m) => (
            <Badge
              key={m.key}
              variant="outline"
              className="text-xs font-normal"
              style={{
                backgroundColor: "color-mix(in srgb, var(--tm-info) 12%, transparent)",
                borderColor: "color-mix(in srgb, var(--tm-info) 35%, transparent)",
                color: "var(--tm-info)",
              }}
            >
              <span
                className="mr-1.5 h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "var(--tm-info)" }}
              />
              {m.label}: <span className="ml-1 font-mono">{m.value}</span>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
