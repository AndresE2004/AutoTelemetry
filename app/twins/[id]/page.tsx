"use client"

import { use, useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts"
import { Cpu, CheckCircle2, TrendingUp, TrendingDown, Minus } from "lucide-react"

interface TwinPageProps {
  params: Promise<{ id: string }>
}

const comparisonData = [
  { metric: "Temp motor", real: "84°C", simulated: "81°C", delta: "+3°C", trend: "up" },
  { metric: "Voltaje", real: "48.2V", simulated: "48.5V", delta: "-0.3V", trend: "down" },
  { metric: "RPM", real: "2,340", simulated: "2,290", delta: "+50", trend: "up" },
  { metric: "Presión L.ant", real: "32 PSI", simulated: "32 PSI", delta: "0", trend: "neutral" },
  { metric: "Presión L.post", real: "31 PSI", simulated: "31 PSI", delta: "0", trend: "neutral" },
  { metric: "Consumo energía", real: "4.2 kWh", simulated: "4.1 kWh", delta: "+0.1 kWh", trend: "up" },
]

const historyData = [
  { time: "14:00", event: "Sincronización completada", status: "success" },
  { time: "13:45", event: "Divergencia detectada > 5%", status: "warning" },
  { time: "13:30", event: "Sincronización completada", status: "success" },
  { time: "13:15", event: "Sincronización completada", status: "success" },
  { time: "13:00", event: "Gemelo reiniciado", status: "info" },
]

const alertsData = [
  { time: "13:45", type: "Divergencia alta", description: "Temperatura real excede simulación en 5.2°C", severity: "Media" },
  { time: "12:20", type: "Drift detectado", description: "Modelo requiere recalibración", severity: "Baja" },
  { time: "11:05", type: "Sincronización fallida", description: "Timeout de conexión IoT", severity: "Alta" },
]

const logsData = [
  { time: "14:00:12", level: "INFO", message: "Sincronización del gemelo en 234 ms" },
  { time: "13:59:58", level: "DEBUG", message: "Paquete de telemetría #892341 recibido" },
  { time: "13:59:45", level: "INFO", message: "Estado: temp=84, voltaje=48.2" },
  { time: "13:59:30", level: "WARN", message: "Umbral de divergencia superado: 3.2%" },
  { time: "13:59:15", level: "DEBUG", message: "Paso de simulación 48291" },
]

function generateChartData() {
  const data = []
  for (let i = 60; i >= 0; i -= 5) {
    const baseReal = 82 + Math.random() * 6
    const baseTwin = baseReal - 2 + Math.random() * 4
    const divergence = Math.abs(baseReal - baseTwin) > 4
    data.push({
      time: `${i}m`,
      real: baseReal,
      twin: baseTwin,
      divergenceArea: divergence ? [Math.min(baseReal, baseTwin), Math.max(baseReal, baseTwin)] : null,
    })
  }
  return data
}

// SVG Arc for health ring
function HealthRing({ percentage }: { percentage: number }) {
  const radius = 45
  const strokeWidth = 8
  const circumference = 2 * Math.PI * radius
  const progress = ((100 - percentage) / 100) * circumference

  return (
    <div className="relative w-28 h-28">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#378ADD"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-xl font-bold">{percentage}%</span>
        <span className="text-[10px] text-muted-foreground">Divergencia</span>
      </div>
    </div>
  )
}

// Mini gauge for prediction
function MiniGauge({ value, max = 100 }: { value: number; max?: number }) {
  const percentage = (value / max) * 100
  const color = percentage > 50 ? "#E24B4A" : percentage > 25 ? "#EF9F27" : "#1D9E75"

  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${percentage}%`, backgroundColor: color }}
      />
    </div>
  )
}

export default function TwinDetailPage({ params }: TwinPageProps) {
  const { id } = use(params)
  const [chartData, setChartData] = useState<Array<{
    time: string
    real: number
    twin: number
    divergenceArea: number[] | null
  }>>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setChartData(generateChartData())
    setMounted(true)
  }, [])

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === "up") return <TrendingUp className="w-3 h-3 text-[#EF9F27]" />
    if (trend === "down") return <TrendingDown className="w-3 h-3 text-[#378ADD]" />
    return <Minus className="w-3 h-3 text-muted-foreground" />
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-3">
              <Cpu className="w-6 h-6 text-[#06B6D4]" />
              Gemelo digital — {id}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Modelo de simulación en tiempo real del vehículo
            </p>
          </div>
          <Badge
            variant="outline"
            className="bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/30"
          >
            <CheckCircle2 className="w-3 h-3 mr-1.5" />
            Sincronizado
          </Badge>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Panel - 40% */}
          <div className="lg:col-span-2 space-y-6">
            {/* Comparison Table */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  Real vs Simulado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-xs text-muted-foreground font-medium">Métrica</TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium">Real</TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium">Simulado</TableHead>
                      <TableHead className="text-xs text-muted-foreground font-medium">Divergencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonData.map((row) => (
                      <TableRow key={row.metric} className="border-border hover:bg-muted/50">
                        <TableCell className="text-sm">{row.metric}</TableCell>
                        <TableCell className="font-mono text-sm">{row.real}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{row.simulated}</TableCell>
                        <TableCell className="font-mono text-sm flex items-center gap-1">
                          {row.delta}
                          <TrendIcon trend={row.trend} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Health Ring & Prediction */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="p-4 flex flex-col items-center justify-center">
                  <HealthRing percentage={3.2} />
                  <p className="text-xs text-muted-foreground mt-2">Divergencia total</p>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardContent className="p-4 space-y-3">
                  <p className="text-xs text-muted-foreground">Prob. falla en 7 días</p>
                  <p className="font-mono text-2xl font-bold text-[#EF9F27]">12.4%</p>
                  <MiniGauge value={12.4} />
                  <p className="text-[10px] text-muted-foreground">
                    Basado en modelo predictivo v3.2
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Sync Status */}
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1D9E75] pulse-dot" />
                    <span className="text-sm font-medium">Estado del twin: Sincronizado</span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    Última sync: hace 12s
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - 60% */}
          <div className="lg:col-span-3 space-y-6">
            {/* Chart */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">
                  Estado real vs simulado (60 min)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mounted ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis
                          dataKey="time"
                          stroke="#64748b"
                          tick={{ fill: '#64748b', fontSize: 10 }}
                          axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                        />
                        <YAxis
                          stroke="#64748b"
                          tick={{ fill: '#64748b', fontSize: 10 }}
                          axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                          domain={[70, 95]}
                          tickFormatter={(v) => `${v}°C`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1F2937',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          labelStyle={{ color: '#f8fafc' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                        <ReferenceLine y={85} stroke="#E24B4A" strokeDasharray="5 5" label={{ value: 'Umbral', fill: '#E24B4A', fontSize: 10 }} />
                        <Area
                          type="monotone"
                          dataKey="real"
                          fill="#378ADD"
                          fillOpacity={0.1}
                          stroke="none"
                        />
                        <Line
                          type="monotone"
                          dataKey="real"
                          name="Real"
                          stroke="#378ADD"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="twin"
                          name="Simulado"
                          stroke="#EF9F27"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Cargando...
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tabs */}
            <Card className="bg-card border-border">
              <Tabs defaultValue="historial">
                <CardHeader className="pb-0">
                  <TabsList className="bg-muted/50">
                    <TabsTrigger value="historial" className="text-xs">Historial</TabsTrigger>
                    <TabsTrigger value="alertas" className="text-xs">Alertas del twin</TabsTrigger>
                    <TabsTrigger value="logs" className="text-xs">Logs de sincronización</TabsTrigger>
                  </TabsList>
                </CardHeader>
                <CardContent className="pt-4">
                  <TabsContent value="historial" className="mt-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-xs text-muted-foreground font-medium w-20">Hora</TableHead>
                          <TableHead className="text-xs text-muted-foreground font-medium">Evento</TableHead>
                          <TableHead className="text-xs text-muted-foreground font-medium w-24">Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyData.map((row, i) => (
                          <TableRow key={i} className="border-border hover:bg-muted/50">
                            <TableCell className="font-mono text-xs">{row.time}</TableCell>
                            <TableCell className="text-sm">{row.event}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  row.status === "success"
                                    ? "bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/30"
                                    : row.status === "warning"
                                    ? "bg-[#EF9F27]/10 text-[#EF9F27] border-[#EF9F27]/30"
                                    : "bg-[#378ADD]/10 text-[#378ADD] border-[#378ADD]/30"
                                }
                              >
                                {row.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  <TabsContent value="alertas" className="mt-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-xs text-muted-foreground font-medium w-20">Hora</TableHead>
                          <TableHead className="text-xs text-muted-foreground font-medium">Tipo</TableHead>
                          <TableHead className="text-xs text-muted-foreground font-medium">Descripción</TableHead>
                          <TableHead className="text-xs text-muted-foreground font-medium w-20">Severidad</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {alertsData.map((row, i) => (
                          <TableRow key={i} className="border-border hover:bg-muted/50">
                            <TableCell className="font-mono text-xs">{row.time}</TableCell>
                            <TableCell className="text-sm font-medium">{row.type}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{row.description}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  row.severity === "Alta"
                                    ? "bg-[#E24B4A]/10 text-[#E24B4A] border-[#E24B4A]/30"
                                    : row.severity === "Media"
                                    ? "bg-[#EF9F27]/10 text-[#EF9F27] border-[#EF9F27]/30"
                                    : "bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/30"
                                }
                              >
                                {row.severity}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  <TabsContent value="logs" className="mt-0">
                    <div className="font-mono text-xs space-y-1 bg-muted/50 p-3 rounded-lg max-h-[200px] overflow-y-auto">
                      {logsData.map((log, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="text-muted-foreground">{log.time}</span>
                          <span
                            className={
                              log.level === "WARN"
                                ? "text-[#EF9F27]"
                                : log.level === "INFO"
                                ? "text-[#378ADD]"
                                : "text-muted-foreground"
                            }
                          >
                            [{log.level}]
                          </span>
                          <span className="text-foreground">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
