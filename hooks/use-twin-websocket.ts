"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { TwinScenarioId, TwinTelemetryFrame } from "@/lib/digital-twin-types"
import { nextSyntheticTwinFrame } from "@/lib/synthetic-twin-tick"

const INTERVAL_MS = 500

type Options = {
  vehicleId: string
  scenario: TwinScenarioId
  /** Si está definida, se intenta WebSocket; si falla o no hay URL, se usa simulación local. */
  wsBaseUrl?: string | null
}

type TwinStream = {
  frame: TwinTelemetryFrame | null
  connected: boolean
  source: "websocket" | "synthetic"
  events: string[]
  pushEvent: (msg: string) => void
}

function trimEvents(prev: string[], line: string, max = 40) {
  const next = [line, ...prev]
  return next.slice(0, max)
}

/**
 * Consume el estado del gemelo: prioriza `NEXT_PUBLIC_TWIN_WS_URL` + `/ws/twin/{vehicleId}`,
 * con fallback determinístico al generador sintético (misma cadencia ~500 ms que el prompt).
 */
export function useTwinWebSocket({ vehicleId, scenario, wsBaseUrl }: Options): TwinStream {
  const [frame, setFrame] = useState<TwinTelemetryFrame | null>(null)
  const [connected, setConnected] = useState(false)
  const [source, setSource] = useState<"websocket" | "synthetic">("synthetic")
  const [events, setEvents] = useState<string[]>([])
  const tickRef = useRef(0)
  const prevRef = useRef<TwinTelemetryFrame | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const pushEvent = useCallback((msg: string) => {
    const t = new Date().toLocaleTimeString("es-CO", { hour12: false })
    setEvents((e) => trimEvents(e, `[${t}] ${msg}`))
  }, [])

  const envUrl =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_TWIN_WS_URL?.replace(/\/$/, "") ?? null
      : null
  const base = wsBaseUrl ?? envUrl

  useEffect(() => {
    tickRef.current = 0
    prevRef.current = null
  }, [scenario, vehicleId])

  useEffect(() => {
    if (!base) {
      setSource("synthetic")
      setConnected(false)
      const id = window.setInterval(() => {
        tickRef.current += 1
        const wasActive = prevRef.current?.anomalyActive ?? false
        const next = nextSyntheticTwinFrame(prevRef.current, scenario, vehicleId, tickRef.current)
        prevRef.current = next
        setFrame(next)
        if (tickRef.current === 1) {
          pushEvent(`Simulación local · escenario «${scenario}» · ${vehicleId}`)
        }
        if (next.anomalyActive && !wasActive) {
          pushEvent(`Anomalía · score ${next.anomalyScore.toFixed(2)} · ${next.pipelineNote ?? ""}`)
        }
      }, INTERVAL_MS)
      return () => window.clearInterval(id)
    }

    const url = `${base}/ws/twin/${encodeURIComponent(vehicleId)}`
    let cancelled = false
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (cancelled) return
      setConnected(true)
      setSource("websocket")
      pushEvent(`WebSocket conectado · ${url}`)
    }

    ws.onmessage = (ev) => {
      if (cancelled) return
      try {
        const data = JSON.parse(ev.data as string) as TwinTelemetryFrame
        setFrame(data)
      } catch {
        pushEvent("Mensaje WS no JSON · ignorado")
      }
    }

    ws.onerror = () => {
      if (cancelled) return
      pushEvent("Error de WebSocket · revisa TLS/CORS/backend")
    }

    ws.onclose = () => {
      if (cancelled) return
      setConnected(false)
      pushEvent("WebSocket cerrado")
    }

    return () => {
      cancelled = true
      ws.close()
      wsRef.current = null
    }
  }, [base, scenario, vehicleId, pushEvent])

  return { frame, connected, source, events, pushEvent }
}
