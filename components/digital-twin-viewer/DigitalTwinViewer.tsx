"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { TwinCanvas } from "@/components/digital-twin-viewer/TwinCanvas"
import { SensorGauges } from "@/components/digital-twin-viewer/SensorGauges"
import { AnomalyAlert } from "@/components/digital-twin-viewer/AnomalyAlert"
import { TwinControls } from "@/components/digital-twin-viewer/TwinControls"
import { EventLog } from "@/components/digital-twin-viewer/EventLog"
import { useTwinWebSocket } from "@/hooks/use-twin-websocket"
import type { TwinScenarioId } from "@/lib/digital-twin-types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Box } from "lucide-react"
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"

const DEFAULT_VEHICLE = "TM-DEMO-01"

export function DigitalTwinViewer() {
  const [vehicleId, setVehicleId] = useState(DEFAULT_VEHICLE)
  const [scenario, setScenario] = useState<TwinScenarioId>("normal")
  const { frame, connected, source, events } = useTwinWebSocket({ vehicleId, scenario })

  const [history, setHistory] = useState<{ t: string; temp: number; volt: number; speed: number }[]>([])
  const tick = useRef(0)

  useEffect(() => {
    if (!frame) return
    tick.current += 1
    const label = `${tick.current}s`
    setHistory((h) => {
      const next = [...h, { t: label, temp: frame.engineTempC, volt: frame.batteryVoltage, speed: frame.speedKmh }]
      return next.slice(-36)
    })
  }, [frame])

  const onScenarioChange = useCallback((s: TwinScenarioId) => {
    setScenario(s)
  }, [])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
            <Box className="h-7 w-7 text-[var(--tm-cyan)]" />
            Gemelo digital visual
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Visualización 3D con React Three Fiber. Sin Unity. Los datos pueden venir del simulador Python → Kafka →
            SCADA o, mientras tanto, del generador sintético en el navegador (~500 ms). Opcional:{" "}
            <span className="font-mono">NEXT_PUBLIC_TWIN_WS_URL</span> para{" "}
            <span className="font-mono">/ws/twin/{"{vehicle_id}"}</span>.
          </p>
        </div>

        <TwinControls
          vehicleId={vehicleId}
          onVehicleIdChange={setVehicleId}
          scenario={scenario}
          onScenarioChange={onScenarioChange}
          source={source}
          wsConnected={connected}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">
            <div className="h-[min(52vh,520px)] w-full overflow-hidden rounded-xl border border-border">
              <TwinCanvas telemetry={frame} />
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              Modelo procedural · reemplaza por <span className="font-mono">.glb</span> en{" "}
              <span className="font-mono">public/models/</span> cuando tengas el activo.
            </p>
          </div>

          <div className="space-y-4">
            <AnomalyAlert frame={frame} />
            <SensorGauges frame={frame} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Serie reciente (demo)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="t" hide />
                    <YAxis yAxisId="l" tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Line
                      yAxisId="l"
                      type="monotone"
                      dataKey="temp"
                      name="°C"
                      stroke="var(--tm-warning)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      yAxisId="r"
                      type="monotone"
                      dataKey="volt"
                      name="V"
                      stroke="var(--tm-info)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <EventLog lines={events} />
        </div>
      </div>
    </DashboardLayout>
  )
}
