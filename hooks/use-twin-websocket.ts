"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { TwinScenarioId, TwinTelemetryFrame } from "@/lib/digital-twin-types"
import { getTwinWsBaseUrl } from "@/lib/api"
import { nextSyntheticTwinFrame } from "@/lib/synthetic-twin-tick"

const INTERVAL_MS = 500
const WS_CONNECT_MS = 4000

type Options = {
  vehicleId: string
  scenario: TwinScenarioId
  /** Si se pasa, tiene prioridad sobre env / derivación desde API URL. */
  wsBaseUrl?: string | null
  enabled?: boolean
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
 * Gemelo digital: intenta WebSocket en `/ws/twin/{vehicleId}`; si falla o no hay URL, simulación local.
 */
export function useTwinWebSocket({ vehicleId, scenario, wsBaseUrl, enabled = true }: Options): TwinStream {
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

  const base = wsBaseUrl ?? getTwinWsBaseUrl()

  useEffect(() => {
    tickRef.current = 0
    prevRef.current = null
  }, [scenario, vehicleId])

  useEffect(() => {
    if (!enabled) {
      setFrame(null)
      setConnected(false)
      setSource("synthetic")
      return
    }

    let cancelled = false
    let syntheticTimer: ReturnType<typeof setInterval> | null = null
    let connectTimer: ReturnType<typeof setTimeout> | null = null

    const startSynthetic = (reason: string) => {
      if (cancelled || syntheticTimer) return
      wsRef.current?.close()
      wsRef.current = null
      setSource("synthetic")
      setConnected(false)
      pushEvent(reason)
      syntheticTimer = window.setInterval(() => {
        tickRef.current += 1
        const wasActive = prevRef.current?.anomalyActive ?? false
        const next = nextSyntheticTwinFrame(prevRef.current, scenario, vehicleId, tickRef.current)
        prevRef.current = next
        setFrame(next)
        if (next.anomalyActive && !wasActive) {
          pushEvent(`Anomalía · score ${next.anomalyScore.toFixed(2)} · ${next.pipelineNote ?? ""}`)
        }
      }, INTERVAL_MS)
    }

    if (!base) {
      startSynthetic(`Simulación local · escenario «${scenario}» · ${vehicleId}`)
      return () => {
        cancelled = true
        if (syntheticTimer) window.clearInterval(syntheticTimer)
      }
    }

    const url = `${base}/ws/twin/${encodeURIComponent(vehicleId)}?scenario=${encodeURIComponent(scenario)}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    connectTimer = window.setTimeout(() => {
      if (cancelled || ws.readyState === WebSocket.OPEN) return
      ws.close()
      startSynthetic("WebSocket sin respuesta · simulación local")
    }, WS_CONNECT_MS)

    ws.onopen = () => {
      if (cancelled) return
      if (connectTimer) window.clearTimeout(connectTimer)
      setConnected(true)
      setSource("websocket")
      pushEvent(`WebSocket conectado · ${base}`)
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
      pushEvent("Error de WebSocket · revisa que la API esté en :8000")
    }

    ws.onclose = () => {
      if (cancelled) return
      if (connectTimer) window.clearTimeout(connectTimer)
      setConnected(false)
      if (!syntheticTimer && ws.readyState !== WebSocket.OPEN) {
        startSynthetic("WebSocket cerrado · simulación local")
      }
    }

    return () => {
      cancelled = true
      if (connectTimer) window.clearTimeout(connectTimer)
      if (syntheticTimer) window.clearInterval(syntheticTimer)
      ws.close()
      wsRef.current = null
    }
  }, [base, scenario, vehicleId, pushEvent, enabled])

  return { frame, connected, source, events, pushEvent }
}
