"use client"

import { AlertTriangle, ShieldCheck } from "lucide-react"
import type { TwinTelemetryFrame } from "@/lib/digital-twin-types"
import { cn } from "@/lib/utils"

export function AnomalyAlert({ frame }: { frame: TwinTelemetryFrame | null }) {
  if (!frame) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-4 text-sm text-muted-foreground">
        Esperando telemetría…
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 transition-colors",
        frame.anomalyActive
          ? "border-[var(--tm-danger)]/50 bg-[var(--tm-danger)]/10"
          : "border-[var(--tm-success)]/35 bg-[var(--tm-success)]/8"
      )}
    >
      {frame.anomalyActive ? (
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--tm-danger)]" />
      ) : (
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--tm-success)]" />
      )}
      <div className="min-w-0">
        <p className="font-semibold text-foreground">
          {frame.anomalyActive ? "Anomalía detectada" : "Dentro de parámetros"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Score modelo ·{" "}
          <span className="font-mono text-foreground">{frame.anomalyScore.toFixed(3)}</span>
          {frame.pipelineNote ? ` · ${frame.pipelineNote}` : null}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Escenario simulado: <span className="font-medium text-foreground">{frame.scenario}</span>
        </p>
      </div>
    </div>
  )
}
