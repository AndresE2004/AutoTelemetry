"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { Dna, Pause, RotateCcw, Activity, Target, Cpu } from "lucide-react"

// Generate fitness evolution data
function generateFitnessData() {
  const data = []
  let fitness = 0.35 + Math.random() * 0.1
  for (let i = 1; i <= 48; i++) {
    // Simulate convergence with some noise
    const improvement = (1 - fitness) * 0.04 * (1 + Math.random() * 0.5)
    fitness = Math.min(0.95, fitness + improvement - Math.random() * 0.01)
    data.push({
      generation: i,
      fitness: parseFloat(fitness.toFixed(3)),
    })
  }
  return data
}

const maintenancePlan = [
  { priority: 1, vehicle: "TM-3301", action: "Revisar batería", cost: 180, urgency: "Alta" },
  { priority: 2, vehicle: "TM-4821", action: "Cambio sensor temp", cost: 95, urgency: "Media" },
  { priority: 3, vehicle: "TM-1105", action: "Balanceo llantas", cost: 45, urgency: "Baja" },
  { priority: 4, vehicle: "TM-6631", action: "Actualizar firmware", cost: 120, urgency: "Media" },
  { priority: 5, vehicle: "TM-5512", action: "Inspección frenos", cost: 85, urgency: "Media" },
  { priority: 6, vehicle: "TM-0099", action: "Cambio aceite motor", cost: 65, urgency: "Baja" },
  { priority: 7, vehicle: "TM-8820", action: "Revisar suspensión", cost: 210, urgency: "Media" },
  { priority: 8, vehicle: "TM-2204", action: "Calibrar sensores", cost: 55, urgency: "Baja" },
]

const urgencyColors: Record<string, string> = {
  Alta: "bg-[#E24B4A]/15 text-[#E24B4A] border-[#E24B4A]/30",
  Media: "bg-[#EF9F27]/15 text-[#EF9F27] border-[#EF9F27]/30",
  Baja: "bg-[#1D9E75]/15 text-[#1D9E75] border-[#1D9E75]/30",
}

export default function OptimizacionPage() {
  const [fitnessData, setFitnessData] = useState<Array<{ generation: number; fitness: number }>>([])
  const [mounted, setMounted] = useState(false)
  const [currentGen, setCurrentGen] = useState(48)
  const [isPaused, setIsPaused] = useState(false)

  // Algorithm parameters
  const [populationSize, setPopulationSize] = useState(200)
  const [mutationRate, setMutationRate] = useState([0.02])
  const [crossoverRate, setCrossoverRate] = useState([0.85])
  const [maxGenerations, setMaxGenerations] = useState(100)

  useEffect(() => {
    setFitnessData(generateFitnessData())
    setMounted(true)
  }, [])

  // Simulate progress
  useEffect(() => {
    if (!mounted || isPaused || currentGen >= maxGenerations) return

    const interval = setInterval(() => {
      setCurrentGen((prev) => {
        if (prev >= maxGenerations) return prev
        return prev + 1
      })
      setFitnessData((prev) => {
        if (prev.length >= maxGenerations) return prev
        const lastFitness = prev[prev.length - 1]?.fitness || 0.89
        const improvement = (1 - lastFitness) * 0.03 * (1 + Math.random() * 0.3)
        const newFitness = Math.min(0.98, lastFitness + improvement - Math.random() * 0.005)
        return [...prev, { generation: prev.length + 1, fitness: parseFloat(newFitness.toFixed(3)) }]
      })
    }, 2000)

    return () => clearInterval(interval)
  }, [mounted, isPaused, currentGen, maxGenerations])

  const totalCost = maintenancePlan.reduce((sum, item) => sum + item.cost, 0)
  const costWithoutOptimization = 2180
  const savings = Math.round(((costWithoutOptimization - totalCost) / costWithoutOptimization) * 100)
  const bestFitness = fitnessData[fitnessData.length - 1]?.fitness || 0.892

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <Dna className="w-6 h-6 text-[#A78BFA]" />
            Optimización Genética de Mantenimiento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Algoritmo genético para optimizar el plan de mantenimiento preventivo de la flota
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-card border-border border-l-2 border-l-[#A78BFA]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Generación actual</p>
                  <p className="font-mono text-2xl font-semibold mt-1">
                    {currentGen} <span className="text-muted-foreground text-base">/ {maxGenerations}</span>
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-[#A78BFA]/15">
                  <Activity className="w-5 h-5 text-[#A78BFA]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border border-l-2 border-l-[#1D9E75]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Mejor fitness</p>
                  <p className="font-mono text-2xl font-semibold mt-1 text-[#1D9E75]">
                    {bestFitness.toFixed(3)}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-[#1D9E75]/15">
                  <Target className="w-5 h-5 text-[#1D9E75]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border border-l-2 border-l-[#06B6D4]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Vehículos optimizados</p>
                  <p className="font-mono text-2xl font-semibold mt-1">247</p>
                </div>
                <div className="p-2 rounded-lg bg-[#06B6D4]/15">
                  <Cpu className="w-5 h-5 text-[#06B6D4]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fitness Evolution Chart */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                Evolución del fitness
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mounted ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={fitnessData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="fitnessGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#378ADD" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#378ADD" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="generation"
                        stroke="#64748b"
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                        tickFormatter={(v) => `G${v}`}
                      />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                        domain={[0.3, 1]}
                        tickFormatter={(v) => v.toFixed(1)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                        labelStyle={{ color: '#f8fafc' }}
                        formatter={(value: number) => [value.toFixed(3), "Fitness"]}
                        labelFormatter={(label) => `Generación ${label}`}
                      />
                      <ReferenceLine
                        y={0.85}
                        stroke="#E24B4A"
                        strokeDasharray="5 5"
                        label={{ value: 'Umbral mínimo', fill: '#E24B4A', fontSize: 10, position: 'right' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="fitness"
                        stroke="#378ADD"
                        strokeWidth={2}
                        fill="url(#fitnessGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Cargando...
                </div>
              )}
            </CardContent>
          </Card>

          {/* Maintenance Plan */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                Plan de mantenimiento óptimo (Cromosoma #{currentGen})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[260px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-xs text-muted-foreground font-medium w-16">#</TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium">Vehículo</TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium">Acción</TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium text-right">Costo</TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium">Urgencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenancePlan.map((item) => (
                      <TableRow key={item.priority} className="border-border hover:bg-muted/50">
                        <TableCell className="font-mono text-sm">{item.priority}</TableCell>
                        <TableCell className="font-mono text-sm font-medium">{item.vehicle}</TableCell>
                        <TableCell className="text-sm">{item.action}</TableCell>
                        <TableCell className="font-mono text-sm text-right">${item.cost}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${urgencyColors[item.urgency]}`}>
                            {item.urgency}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Cost Summary */}
              <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center gap-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Costo total optimizado: </span>
                  <span className="font-mono font-semibold">${totalCost.toLocaleString()}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">vs Sin optimización: </span>
                  <span className="font-mono text-muted-foreground line-through">${costWithoutOptimization.toLocaleString()}</span>
                </div>
                <Badge className="bg-[#1D9E75] text-white border-0">
                  Ahorro: {savings}%
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Algorithm Parameters */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Parámetros del algoritmo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Population Size */}
              <div className="space-y-2">
                <Label htmlFor="population" className="text-sm">Tamaño de población</Label>
                <Input
                  id="population"
                  type="number"
                  value={populationSize}
                  onChange={(e) => setPopulationSize(parseInt(e.target.value) || 100)}
                  className="font-mono bg-muted/50"
                />
              </div>

              {/* Mutation Rate */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Tasa de mutación</Label>
                  <span className="font-mono text-sm text-muted-foreground">{mutationRate[0].toFixed(2)}</span>
                </div>
                <Slider
                  value={mutationRate}
                  onValueChange={setMutationRate}
                  min={0}
                  max={0.1}
                  step={0.01}
                  className="mt-2"
                />
              </div>

              {/* Crossover Rate */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Tasa de cruce</Label>
                  <span className="font-mono text-sm text-muted-foreground">{crossoverRate[0].toFixed(2)}</span>
                </div>
                <Slider
                  value={crossoverRate}
                  onValueChange={setCrossoverRate}
                  min={0}
                  max={1}
                  step={0.05}
                  className="mt-2"
                />
              </div>

              {/* Max Generations */}
              <div className="space-y-2">
                <Label htmlFor="maxgen" className="text-sm">Máximo generaciones</Label>
                <Input
                  id="maxgen"
                  type="number"
                  value={maxGenerations}
                  onChange={(e) => setMaxGenerations(parseInt(e.target.value) || 100)}
                  className="font-mono bg-muted/50"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6 pt-4 border-t border-border">
              <Button
                variant="destructive"
                onClick={() => {
                  setCurrentGen(0)
                  setFitnessData([])
                  setIsPaused(false)
                  setTimeout(() => setFitnessData(generateFitnessData()), 100)
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reiniciar optimización
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsPaused(!isPaused)}
              >
                <Pause className="w-4 h-4 mr-2" />
                {isPaused ? "Reanudar" : "Pausar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
