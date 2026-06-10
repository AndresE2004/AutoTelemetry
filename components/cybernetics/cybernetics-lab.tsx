"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Loader2 } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { getApiBaseUrl, fetchCyberneticsSfg, postCyberneticsStepResponse, type CyberSfgJson } from "@/lib/api"

type ChartRow = { t: number; T: number }

function SfgSvg({ data }: { data: CyberSfgJson | null }) {
  const nodes = (data?.nodes as { id: number; name: string }[] | undefined) ?? []
  const edges = (data?.edges as { from: string; to: string; gain: number }[] | undefined) ?? []
  if (!nodes.length) {
    return <p className="text-sm text-muted-foreground">Sin datos del SFG (¿API caída?).</p>
  }
  const positions = [
    { x: 40, y: 120 },
    { x: 140, y: 120 },
    { x: 240, y: 120 },
    { x: 340, y: 120 },
    { x: 440, y: 120 },
    { x: 540, y: 120 },
  ]
  return (
    <svg viewBox="0 0 620 200" className="h-auto w-full max-w-3xl text-foreground">
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" />
        </marker>
      </defs>
      {nodes.map((n, i) => {
        const p = positions[i] ?? { x: 40 + i * 100, y: 120 }
        return (
          <g key={n.id}>
            <circle cx={p.x} cy={p.y} r="22" className="fill-card stroke-border" strokeWidth="1.5" />
            <text x={p.x} y={p.y + 4} textAnchor="middle" className="fill-foreground text-[10px] font-medium">
              {n.name}
            </text>
          </g>
        )
      })}
      {edges.slice(0, 5).map((e, i) => {
        const from = positions[nodes.findIndex((n) => n.name === e.from)] ?? positions[0]
        const to = positions[nodes.findIndex((n) => n.name === e.to)] ?? positions[1]
        if (!from || !to) return null
        return (
          <line
            key={`${e.from}-${e.to}-${i}`}
            x1={from.x + 22}
            y1={from.y}
            x2={to.x - 22}
            y2={to.y}
            stroke="currentColor"
            strokeWidth="1.2"
            markerEnd="url(#arrow)"
          />
        )
      })}
      {edges[5] ? (
        <path
          d="M 562 120 Q 300 20 62 120"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="4 3"
          markerEnd="url(#arrow)"
        />
      ) : null}
      <text x="310" y="185" textAnchor="middle" className="fill-muted-foreground text-[10px]">
        Lazo (Alerta → Sensor) · ganancias en JSON de la API
      </text>
    </svg>
  )
}

export function CyberneticsLab() {
  const baseUrl = useMemo(() => getApiBaseUrl(), [])
  const [K, setK] = useState([1.0])
  const [tau, setTau] = useState([150.0])
  const [sfg, setSfg] = useState<CyberSfgJson | null>(null)
  const [chart, setChart] = useState<ChartRow[]>([])
  const [Gs, setGs] = useState("—")
  const [Ms, setMs] = useState("—")
  const [steady, setSteady] = useState<number | null>(null)
  const [settling, setSettling] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const kVal = K[0] ?? 1
  const tauVal = tau[0] ?? 150

  const runStep = useCallback(async () => {
    if (!baseUrl) {
      setErr("Falta NEXT_PUBLIC_API_URL en .env.local")
      return
    }
    setLoading(true)
    setErr(null)
    try {
      const res = await postCyberneticsStepResponse(baseUrl, {
        K: kVal,
        tau: tauVal,
        H: 1,
        t_end: 2400,
        setpoint: 90,
      })
      setGs(res.G_s)
      setMs(res.M_s)
      setSteady(res.steady_state_degC)
      setSettling(res.settling_time_s)
      setChart(res.time.map((t, i) => ({ t, T: res.temperature[i] ?? 0 })))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [baseUrl, kVal, tauVal])

  useEffect(() => {
    if (!baseUrl) return
    void fetchCyberneticsSfg(baseUrl)
      .then(setSfg)
      .catch(() => setSfg(null))
  }, [baseUrl])

  useEffect(() => {
    if (!baseUrl) return
    const h = window.setTimeout(() => {
      void runStep()
    }, 300)
    return () => window.clearTimeout(h)
  }, [baseUrl, runStep])

  return (
    <div className="space-y-6">
      {err ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {err}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Respuesta al escalón (lazo cerrado)</CardTitle>
            <CardDescription>
              Ajusta K y τ (s); la API recalcula con scipy. Setpoint fijo 90 °C en esta vista.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>K (ganancia)</span>
                <span className="font-mono text-muted-foreground">{K[0]?.toFixed(2)}</span>
              </div>
              <Slider min={0.5} max={2} step={0.05} value={K} onValueChange={setK} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>τ (constante térmica, s)</span>
                <span className="font-mono text-muted-foreground">{tau[0]?.toFixed(0)}</span>
              </div>
              <Slider min={60} max={300} step={5} value={tau} onValueChange={setTau} />
            </div>
            <Button type="button" variant="secondary" onClick={() => void runStep()} disabled={loading || !baseUrl}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Recalcular
            </Button>
            <div className="grid gap-2 text-sm">
              <p>
                <span className="text-muted-foreground">G(s) = </span>
                <span className="font-mono break-all">{Gs}</span>
              </p>
              <p>
                <span className="text-muted-foreground">M(s) = </span>
                <span className="font-mono break-all">{Ms}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Temperatura de régimen (modelo): </span>
                <span className="font-mono">{steady != null ? `${steady.toFixed(2)} °C` : "—"}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Tiempo de establecimiento (aprox. 2 %): </span>
                <span className="font-mono">{settling != null ? `${settling.toFixed(1)} s` : "—"}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gráfica T(t)</CardTitle>
            <CardDescription>Respuesta escalada por el setpoint (90 °C).</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            {chart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="t" tickFormatter={(v) => `${Math.round(v)}s`} className="text-xs" />
                  <YAxis domain={["auto", "auto"]} tickFormatter={(v) => `${v}`} className="text-xs" />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(2)} °C`, "T"]} labelFormatter={(l) => `t = ${l} s`} />
                  <Legend />
                  <Line type="monotone" dataKey="T" name="Temperatura" stroke="hsl(var(--chart-1))" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Sin datos aún.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gráfica de flujo de señal (SFG)</CardTitle>
          <CardDescription>
            Vista esquemática; métricas numéricas (Mason P, L, T) en{" "}
            <span className="font-mono">GET /cybernetics/sfg</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SfgSvg data={sfg} />
          {sfg && typeof sfg.mason_total_gain_T === "number" ? (
            <p className="text-sm text-muted-foreground">
              Ganancia Mason (T): <span className="font-mono text-foreground">{String(sfg.mason_total_gain_T)}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
