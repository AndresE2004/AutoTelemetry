"use client"

import type { TwinTelemetryFrame } from "@/lib/digital-twin-types"

function Gauge({
  label,
  value,
  unit,
  min,
  max,
  decimals,
  dangerHigh,
  dangerLow,
}: {
  label: string
  value: number
  unit: string
  min: number
  max: number
  decimals: number
  dangerHigh?: number
  dangerLow?: number
}) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
  const warn =
    (dangerHigh != null && value >= dangerHigh) || (dangerLow != null && value <= dangerLow)
  return (
    <div className="rounded-lg border border-border bg-card/80 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg text-foreground">
        {value.toFixed(decimals)}
        <span className="ml-1 text-xs text-muted-foreground">{unit}</span>
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${warn ? "bg-[var(--tm-danger)]" : "bg-[var(--tm-info)]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function SensorGauges({ frame }: { frame: TwinTelemetryFrame | null }) {
  if (!frame) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[88px] animate-pulse rounded-lg bg-muted/60" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Gauge label="Velocidad" value={frame.speedKmh} unit="km/h" min={0} max={100} decimals={1} />
      <Gauge
        label="Temp. motor"
        value={frame.engineTempC}
        unit="°C"
        min={60}
        max={105}
        decimals={1}
        dangerHigh={88}
      />
      <Gauge
        label="Voltaje batería"
        value={frame.batteryVoltage}
        unit="V"
        min={42}
        max={54}
        decimals={2}
        dangerLow={46.5}
      />
      <Gauge label="RPM" value={frame.rpm} unit="" min={0} max={6500} decimals={0} />
      <Gauge
        label="PSI delantero izq."
        value={frame.tirePsi.fl}
        unit="PSI"
        min={24}
        max={36}
        decimals={1}
        dangerLow={28}
      />
      <Gauge
        label="PSI delantero der."
        value={frame.tirePsi.fr}
        unit="PSI"
        min={24}
        max={36}
        decimals={1}
        dangerLow={28}
      />
      <Gauge
        label="PSI trasero izq."
        value={frame.tirePsi.rl}
        unit="PSI"
        min={24}
        max={36}
        decimals={1}
        dangerLow={28}
      />
      <Gauge
        label="PSI trasero der."
        value={frame.tirePsi.rr}
        unit="PSI"
        min={24}
        max={36}
        decimals={1}
        dangerLow={28}
      />
    </div>
  )
}
