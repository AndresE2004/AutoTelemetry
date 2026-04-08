"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TWIN_SCENARIOS, type TwinScenarioId } from "@/lib/digital-twin-types"
import { cn } from "@/lib/utils"

type TwinControlsProps = {
  vehicleId: string
  onVehicleIdChange: (v: string) => void
  scenario: TwinScenarioId
  onScenarioChange: (s: TwinScenarioId) => void
  source: "websocket" | "synthetic"
  wsConnected: boolean
}

export function TwinControls({
  vehicleId,
  onVehicleIdChange,
  scenario,
  onScenarioChange,
  source,
  wsConnected,
}: TwinControlsProps) {
  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Controles de demo</p>
          <p className="text-xs text-muted-foreground">
            Tres escenarios listos para inversores (sin hardware). Con backend: publica en Kafka igual que un sensor
            real.
          </p>
        </div>
        <div className="text-right text-[10px] uppercase tracking-wide text-muted-foreground">
          Fuente:{" "}
          <span className="font-mono text-foreground">
            {source === "websocket" ? (wsConnected ? "WebSocket" : "WS…") : "Simulación local"}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="twin-vid">ID de vehículo</Label>
        <Input
          id="twin-vid"
          value={vehicleId}
          onChange={(e) => onVehicleIdChange(e.target.value.trim() || "TM-DEMO-01")}
          className="font-mono"
          placeholder="TM-DEMO-01"
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Escenario</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {TWIN_SCENARIOS.map((s) => (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={scenario === s.id ? "default" : "outline"}
              className={cn(
                "h-auto flex-1 flex-col items-start py-2 text-left",
                scenario === s.id && "bg-[var(--tm-info)] text-primary-foreground hover:bg-[var(--tm-info)]/90"
              )}
              onClick={() => onScenarioChange(s.id)}
            >
              <span className="text-xs font-semibold">{s.label}</span>
              <span className="text-[10px] font-normal opacity-90">{s.description}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
