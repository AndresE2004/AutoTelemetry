"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchVehicleTelemetry, getApiBaseUrl, type ApiTelemetryPoint } from "@/lib/api"
import type { TwinTelemetryFrame } from "@/lib/digital-twin-types"
import { evaluateIso10816FromAccelRms } from "@/lib/iso10816"

const TICK_MS = 450

function pointToFrame(
  p: ApiTelemetryPoint,
  vehicleId: string,
  plate: string,
  index: number,
  total: number,
): TwinTelemetryFrame {
  const vib = p.vibration_rms ?? 0
  const iso = vib > 0 ? evaluateIso10816FromAccelRms(vib, { unit: "g", nominalHz: 50 }) : null
  const anomalyActive = iso ? !iso.inCompliance : false
  const anomalyScore = iso
    ? iso.zone === "D"
      ? 0.92
      : iso.zone === "C"
        ? 0.72
        : iso.zone === "B"
          ? 0.25
          : 0.08
    : 0.05

  return {
    vehicleId,
    plate,
    deviceTime: p.device_time || p.time,
    speedKmh: p.speed ?? 0,
    engineTempC: p.engine_temp ?? 75,
    batteryVoltage: p.battery_voltage ?? 12.4,
    rpm: p.rpm ?? 0,
    vibrationRms: vib,
    tirePsi: { fl: 32, fr: 32, rl: 31, rr: 31 },
    anomalyScore,
    anomalyActive,
    scenario: "lab_playback",
    pipelineNote: `Prueba de laboratorio · ventana ${index + 1}/${total}${iso ? ` · ISO ${iso.zone}` : ""}`,
  }
}

type Options = {
  vehicleId: string | null
  plate?: string
  enabled?: boolean
}

export function useTwinLabPlayback({ vehicleId, plate = "", enabled = true }: Options) {
  const apiBase = getApiBaseUrl()
  const [frame, setFrame] = useState<TwinTelemetryFrame | null>(null)
  const [events, setEvents] = useState<string[]>([])
  const idxRef = useRef(0)

  const pushEvent = useCallback((msg: string) => {
    const t = new Date().toLocaleTimeString("es-CO", { hour12: false })
    setEvents((e) => [ `[${t}] ${msg}`, ...e ].slice(0, 40))
  }, [])

  const { data: points = [], isSuccess } = useQuery({
    queryKey: ["twin-lab-telemetry", apiBase, vehicleId],
    queryFn: () => fetchVehicleTelemetry(apiBase!, vehicleId!, 600),
    enabled: Boolean(enabled && apiBase && vehicleId),
    staleTime: 30_000,
  })

  useEffect(() => {
    idxRef.current = 0
    if (!vehicleId || points.length === 0) {
      setFrame(null)
      return
    }
    pushEvent(`Cargadas ${points.length} ventanas · ${plate || vehicleId}`)
  }, [vehicleId, points.length, plate, pushEvent])

  useEffect(() => {
    if (!vehicleId || points.length === 0) return

    const timer = window.setInterval(() => {
      const i = idxRef.current % points.length
      idxRef.current += 1
      const next = pointToFrame(points[i]!, vehicleId, plate, i, points.length)
      setFrame(next)
    }, TICK_MS)

    const first = pointToFrame(points[0]!, vehicleId, plate, 0, points.length)
    setFrame(first)

    return () => window.clearInterval(timer)
  }, [vehicleId, plate, points])

  return {
    frame,
    connected: isSuccess && points.length > 0,
    source: "lab" as const,
    events,
    pushEvent,
    pointCount: points.length,
  }
}
