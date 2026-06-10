"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { TwinCanvas } from "@/components/digital-twin-viewer/TwinCanvas"
import { SensorGauges } from "@/components/digital-twin-viewer/SensorGauges"
import { AnomalyAlert } from "@/components/digital-twin-viewer/AnomalyAlert"
import { TwinControls } from "@/components/digital-twin-viewer/TwinControls"
import { EventLog } from "@/components/digital-twin-viewer/EventLog"
import { Iso10816VibrationPanel } from "@/components/telemetry/iso10816-vibration-panel"
import { useTwinWebSocket } from "@/hooks/use-twin-websocket"
import { useTwinLabPlayback } from "@/hooks/use-twin-lab-playback"
import type { TwinDataMode, TwinScenarioId } from "@/lib/digital-twin-types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Car } from "lucide-react"
import { fetchVehicles, getApiBaseUrl } from "@/lib/api"
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"

const LAB_FLEET_PREFIX = "GV-PRB-"

export function DigitalTwinViewer() {
  const apiBase = getApiBaseUrl()
  const [mode, setMode] = useState<TwinDataMode>("lab")
  const [vehicleId, setVehicleId] = useState<string>("")
  const [scenario, setScenario] = useState<TwinScenarioId>("normal")

  const { data: vehicles = [] } = useQuery({
    queryKey: ["vehicles", apiBase],
    queryFn: () => fetchVehicles(apiBase!),
    enabled: Boolean(apiBase),
  })

  const labVehicles = useMemo(
    () => vehicles.filter((v) => v.plate.startsWith(LAB_FLEET_PREFIX)),
    [vehicles],
  )

  useEffect(() => {
    if (vehicleId && vehicles.some((v) => v.id === vehicleId)) return
    const pick = labVehicles[0] ?? vehicles[0]
    if (pick) setVehicleId(pick.id)
  }, [vehicleId, vehicles, labVehicles])

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId)
  const plate = selectedVehicle?.plate ?? ""

  const lab = useTwinLabPlayback({
    vehicleId: mode === "lab" ? vehicleId : null,
    plate,
    enabled: mode === "lab",
  })

  const sim = useTwinWebSocket({
    vehicleId: plate || vehicleId || "TM-DEMO-01",
    scenario,
    enabled: mode === "simulation",
  })

  const active =
    mode === "lab"
      ? {
          frame: lab.frame,
          events: lab.events,
          sourceLabel: lab.connected ? `Laboratorio · ${plate}` : "Laboratorio (sin datos)",
          wsConnected: false,
          pointCount: lab.pointCount,
        }
      : {
          frame: sim.frame,
          events: sim.events,
          sourceLabel: sim.source === "websocket" ? "WebSocket" : "Simulación local",
          wsConnected: sim.connected,
          pointCount: undefined,
        }

  const [history, setHistory] = useState<{ t: string; vib: number }[]>([])

  useEffect(() => {
    if (!active.frame?.vibrationRms) return
    const label = new Date(active.frame.deviceTime).toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    setHistory((h) => [...h, { t: label, vib: active.frame!.vibrationRms! }].slice(-48))
  }, [active.frame])

  const onScenarioChange = useCallback((s: TwinScenarioId) => {
    setScenario(s)
  }, [])

  const vibrationSeries = useMemo(
    () => history.map((h) => h.vib),
    [history],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
          <Car className="h-7 w-7 text-[var(--tm-cyan)]" />
          Gemelo digital · Grand Vitara
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Visualización 3D del mismo vehículo del laboratorio. En modo <strong>Datos de laboratorio</strong> se
          reproduce la serie <span className="font-mono">vibration_rms</span> importada y la evaluación ISO 10816-1.
        </p>
      </div>

      <TwinControls
        mode={mode}
        onModeChange={setMode}
        vehicles={vehicles}
        vehicleId={vehicleId}
        onVehicleIdChange={setVehicleId}
        scenario={scenario}
        onScenarioChange={onScenarioChange}
        sourceLabel={active.sourceLabel}
        wsConnected={active.wsConnected}
        pointCount={active.pointCount}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div className="h-[min(52vh,520px)] w-full overflow-hidden rounded-xl border border-border">
            <TwinCanvas telemetry={active.frame} />
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            Modelo SUV procedural · Suzuki Grand Vitara LS 2009 · banco de pruebas acelerómetro
          </p>
        </div>

        <div className="space-y-4">
          <AnomalyAlert frame={active.frame} />
          <SensorGauges frame={active.frame} />
          {mode === "lab" && vibrationSeries.length > 0 ? (
            <Iso10816VibrationPanel
              vibrationValues={vibrationSeries}
              contextLabel={plate ? `Prueba ${plate}` : undefined}
            />
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vibración RMS (reproducción)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              {history.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="t" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} width={40} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="vib"
                      name="RMS (g)"
                      stroke="#a855f7"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {mode === "lab"
                    ? "Sin ventanas de vibración para este vehículo."
                    : "Activa modo laboratorio o importa .mat."}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        <EventLog lines={active.events} />
      </div>
    </div>
  )
}
