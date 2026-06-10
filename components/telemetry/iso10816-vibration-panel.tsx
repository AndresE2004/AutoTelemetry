"use client"

import { useMemo } from "react"
import { ShieldCheck, ShieldAlert } from "lucide-react"
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  evaluateIso10816FromAccelRms,
  ISO10816_BANDS_CHART,
  iso10816ZoneColor,
  type Iso10816Zone,
} from "@/lib/iso10816"

type Props = {
  vibrationValues: (number | null)[]
  /** Etiqueta de la prueba / vehículo */
  contextLabel?: string
}

const BAND_COLORS: Record<Iso10816Zone, string> = {
  A: "rgba(34, 197, 94, 0.35)",
  B: "rgba(59, 130, 246, 0.35)",
  C: "rgba(245, 158, 11, 0.4)",
  D: "rgba(239, 68, 68, 0.45)",
}

export function Iso10816VibrationPanel({ vibrationValues, contextLabel }: Props) {
  const stats = useMemo(() => {
    const nums = vibrationValues.filter((v): v is number => v != null && Number.isFinite(v))
    if (nums.length === 0) return null
    const max = Math.max(...nums)
    const mean = nums.reduce((a, b) => a + b, 0) / nums.length
    const latest = nums[nums.length - 1]!
    return {
      max,
      mean,
      latest,
      evalMax: evaluateIso10816FromAccelRms(max, { unit: "g", nominalHz: 50 }),
      evalLatest: evaluateIso10816FromAccelRms(latest, { unit: "g", nominalHz: 50 }),
    }
  }, [vibrationValues])

  const bandChartData = useMemo(
    () =>
      ISO10816_BANDS_CHART.map((b) => ({
        name: `Zona ${b.label}`,
        width: b.to - b.from,
        zone: b.zone,
        from: b.from,
        to: b.to,
      })),
    [],
  )

  if (!stats) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">ISO 10816-1</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Sin datos de vibración RMS para evaluar zonas A–D.
        </CardContent>
      </Card>
    )
  }

  const { evalMax, evalLatest, max, mean } = stats
  const marker = evalMax.velocityMmS

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          {evalMax.inCompliance ? (
            <ShieldCheck className="h-5 w-5" style={{ color: iso10816ZoneColor(evalMax.zone) }} />
          ) : (
            <ShieldAlert className="h-5 w-5" style={{ color: iso10816ZoneColor(evalMax.zone) }} />
          )}
          ISO 10816-1 · Vibración
        </CardTitle>
        {contextLabel ? (
          <p className="text-xs text-muted-foreground">{contextLabel}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="rounded-lg border px-3 py-3"
          style={{
            borderColor: `${iso10816ZoneColor(evalMax.zone)}55`,
            background: `${iso10816ZoneColor(evalMax.zone)}12`,
          }}
        >
          <p className="text-sm font-medium" style={{ color: iso10816ZoneColor(evalMax.zone) }}>
            {evalMax.inCompliance ? "En regla (operación)" : "Fuera de regla"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{evalMax.zoneLabel}</p>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{evalMax.description}</p>
        </div>

        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-muted-foreground">RMS máx. (acel.)</dt>
            <dd className="font-mono text-sm">{max.toFixed(4)} g</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Velocidad est. (ISO)</dt>
            <dd className="font-mono text-sm">{evalMax.velocityMmS.toFixed(2)} mm/s</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">RMS medio</dt>
            <dd className="font-mono text-sm">{mean.toFixed(4)} g</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Último punto · zona</dt>
            <dd className="font-mono text-sm">
              {evalLatest.velocityMmS.toFixed(2)} mm/s · {evalLatest.zone}
            </dd>
          </div>
        </dl>

        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Bandas grupo 2 (mm/s) — marcador = pico de la serie
          </p>
          <div className="h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={bandChartData}
                margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
              >
                <XAxis type="number" domain={[0, 22]} tick={{ fontSize: 9 }} unit=" mm/s" />
                <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 9 }} />
                <Tooltip
                  formatter={(value: number) => [`${value.toFixed(1)} mm/s ancho de banda`, ""]}
                  contentStyle={{ fontSize: 11 }}
                />
                <Bar dataKey="width" radius={4} barSize={18}>
                  {bandChartData.map((entry) => (
                    <Cell key={entry.zone} fill={BAND_COLORS[entry.zone]} />
                  ))}
                </Bar>
                <ReferenceLine
                  x={marker}
                  stroke={iso10816ZoneColor(evalMax.zone)}
                  strokeWidth={2}
                  label={{
                    value: "Pico",
                    position: "top",
                    fontSize: 10,
                    fill: iso10816ZoneColor(evalMax.zone),
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Evaluación orientativa: RMS de acelerómetro (g) → velocidad RMS estimada con f<sub>n</sub> = 50 Hz,
          comparada con límites ISO 10816-1 grupo 2. No sustituye medición de tachómetro ni informe oficial de
          balanceo.
        </p>
      </CardContent>
    </Card>
  )
}
