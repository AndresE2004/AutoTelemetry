"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Dna } from "lucide-react"

const GENS = [39, 40, 41, 42, 43, 44, 45, 46, 47, 48].map((g, i) => ({
  gen: `G${g}`,
  fitness: 0.72 + i * 0.02 + (i === 9 ? 0.012 : 0),
}))

export function GeneticAlgorithmCard() {
  const [gen, setGen] = useState(48)
  const [pct, setPct] = useState(48)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    const id = window.setInterval(() => {
      setPct((p) => (p >= 100 ? 100 : Math.min(100, p + 0.4)))
      setGen((g) => (g >= 100 ? 100 : g + 1))
    }, 2200)
    return () => window.clearInterval(id)
  }, [ready])

  const fitness = useMemo(() => GENS[GENS.length - 1]!.fitness, [])

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Dna className="h-4 w-4 text-[var(--tm-violet)]" />
          Planificador genético (demo)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!ready ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            Preparando gráfico…
          </div>
        ) : (
          <>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Generación <span className="font-mono text-foreground">{gen}</span> / 100
                </span>
                <span className="font-mono text-sm">
                  Fitness · <span className="text-[var(--tm-success)]">{fitness.toFixed(3)}</span>
                </span>
              </div>
              <Progress value={pct} className="h-2 bg-muted" />
            </div>

            <div className="h-[140px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={GENS} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
                  <XAxis dataKey="gen" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis
                    domain={[0.65, 0.95]}
                    tick={{ fontSize: 9, fill: "#94a3b8" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    formatter={(v: number) => [v.toFixed(3), "fitness"]}
                  />
                  <Bar dataKey="fitness" radius={[4, 4, 0, 0]}>
                    {GENS.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i === GENS.length - 1 ? "var(--tm-success)" : "rgba(148,163,184,0.35)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                población 200
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">
                mutación 0.02
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">
                ~23 min restantes
              </Badge>
            </div>

            <div className="border-t border-border pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full border-[var(--tm-violet)]/35 text-xs text-[var(--tm-violet)] hover:bg-[var(--tm-violet)]/10"
                asChild
              >
                <Link href="/optimizacion">Ver job y cromosoma</Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
