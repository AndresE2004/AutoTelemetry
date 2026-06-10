"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TWIN_SCENARIOS, type TwinDataMode, type TwinScenarioId } from "@/lib/digital-twin-types"
import { cn } from "@/lib/utils"
import type { ApiVehicle } from "@/lib/api"

type TwinControlsProps = {
  mode: TwinDataMode
  onModeChange: (m: TwinDataMode) => void
  vehicles: ApiVehicle[]
  vehicleId: string
  onVehicleIdChange: (id: string) => void
  scenario: TwinScenarioId
  onScenarioChange: (s: TwinScenarioId) => void
  sourceLabel: string
  wsConnected: boolean
  pointCount?: number
}

export function TwinControls({
  mode,
  onModeChange,
  vehicles,
  vehicleId,
  onVehicleIdChange,
  scenario,
  onScenarioChange,
  sourceLabel,
  wsConnected,
  pointCount,
}: TwinControlsProps) {
  const labVehicles = vehicles.filter((v) => v.plate.startsWith("GV-PRB-"))

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Gemelo · Suzuki Grand Vitara 2009</p>
          <p className="text-xs text-muted-foreground">
            Modo laboratorio reproduce ventanas RMS importadas desde Postgres. Simulación = escenarios demo.
          </p>
        </div>
        <div className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">
          Fuente: <span className="font-mono text-foreground">{sourceLabel}</span>
          {mode === "simulation" && wsConnected ? " · WS OK" : null}
          {mode === "lab" && pointCount != null ? ` · ${pointCount} pts` : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "lab" ? "default" : "outline"}
          className={mode === "lab" ? "bg-[var(--tm-success)] hover:bg-[var(--tm-success)]/90" : ""}
          onClick={() => onModeChange("lab")}
        >
          Datos de laboratorio
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "simulation" ? "default" : "outline"}
          onClick={() => onModeChange("simulation")}
        >
          Simulación demo
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Prueba / vehículo</Label>
        <Select value={vehicleId} onValueChange={onVehicleIdChange}>
          <SelectTrigger className="font-mono">
            <SelectValue placeholder="Elegir GV-PRB-XX" />
          </SelectTrigger>
          <SelectContent>
            {(labVehicles.length > 0 ? labVehicles : vehicles).map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.plate} · {v.brand} {v.model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mode === "simulation" ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Escenario sintético</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {TWIN_SCENARIOS.map((s) => (
              <Button
                key={s.id}
                type="button"
                size="sm"
                variant={scenario === s.id ? "default" : "outline"}
                className={cn(
                  "h-auto flex-1 flex-col items-start py-2 text-left",
                  scenario === s.id && "bg-[var(--tm-info)] text-primary-foreground hover:bg-[var(--tm-info)]/90",
                )}
                onClick={() => onScenarioChange(s.id)}
              >
                <span className="text-xs font-semibold">{s.label}</span>
                <span className="text-[10px] font-normal opacity-90">{s.description}</span>
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-md border border-[var(--tm-success)]/30 bg-[var(--tm-success)]/10 px-3 py-2 text-xs text-muted-foreground">
          Reproducción secuencial de <span className="font-mono">telemetry_readings</span> (vibración RMS).
          La animación del motor y el estado ISO siguen cada ventana de la prueba importada.
        </p>
      )}
    </div>
  )
}
