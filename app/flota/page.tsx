"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { DashboardLayout } from "@/components/dashboard-layout"
import { VehicleCard, type Vehicle } from "@/components/fleet/vehicle-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchVehicles, getApiBaseUrl } from "@/lib/api"
import { mapApiVehicleToVehicle } from "@/lib/map-api-vehicle"
import { Plus, Search } from "lucide-react"

const mockVehicles: Vehicle[] = [
  {
    id: "TM-4821",
    model: "Auteco E-Cargo",
    status: "Alerta",
    speed: 45,
    temp: 89,
    voltage: 47.8,
    rpm: 2340,
    tempHistory: [82, 84, 85, 87, 89, 88, 89],
  },
  {
    id: "TM-3301",
    model: "Auteco E-City",
    status: "Alerta",
    speed: 0,
    temp: 72,
    voltage: 46.2,
    rpm: 0,
    tempHistory: [71, 70, 71, 72, 72, 71, 72],
  },
  {
    id: "TM-1105",
    model: "Auteco E-Cargo",
    status: "Activo",
    speed: 62,
    temp: 78,
    voltage: 49.1,
    rpm: 2180,
    tempHistory: [76, 77, 78, 78, 77, 78, 78],
  },
  {
    id: "TM-2204",
    model: "Auteco E-Max",
    status: "Mantenimiento",
    speed: 0,
    temp: 35,
    voltage: 48.5,
    rpm: 0,
    tempHistory: [35, 35, 35, 35, 35, 35, 35],
  },
  {
    id: "TM-5512",
    model: "Auteco E-City",
    status: "Activo",
    speed: 38,
    temp: 76,
    voltage: 50.2,
    rpm: 1950,
    tempHistory: [74, 75, 75, 76, 76, 76, 76],
  },
  {
    id: "TM-6631",
    model: "Auteco E-Cargo",
    status: "Activo",
    speed: 55,
    temp: 81,
    voltage: 48.7,
    rpm: 2450,
    tempHistory: [79, 80, 80, 81, 81, 81, 81],
  },
  {
    id: "TM-0099",
    model: "Auteco E-Max",
    status: "Activo",
    speed: 72,
    temp: 83,
    voltage: 47.9,
    rpm: 2680,
    tempHistory: [80, 81, 82, 82, 83, 83, 83],
  },
  {
    id: "TM-7743",
    model: "Auteco E-City",
    status: "Mantenimiento",
    speed: 0,
    temp: 32,
    voltage: 51.0,
    rpm: 0,
    tempHistory: [32, 32, 32, 32, 32, 32, 32],
  },
  {
    id: "TM-8820",
    model: "Auteco E-Cargo",
    status: "Activo",
    speed: 48,
    temp: 77,
    voltage: 49.5,
    rpm: 2100,
    tempHistory: [75, 76, 76, 77, 77, 77, 77],
  },
]

type FilterTab = "all" | "alertas" | "mantenimiento" | "activos"

export default function FlotaPage() {
  const apiBase = getApiBaseUrl()
  const { data: apiRows, isError, isFetching, isPending, isSuccess } = useQuery({
    queryKey: ["vehicles", apiBase],
    queryFn: () => fetchVehicles(apiBase!),
    enabled: Boolean(apiBase),
  })

  const vehicles: Vehicle[] = useMemo(() => {
    if (!apiBase) return mockVehicles
    if (isError) return mockVehicles
    if (isPending) return []
    if (apiRows === undefined) return []
    return apiRows.map(mapApiVehicleToVehicle)
  }, [apiBase, isError, isPending, apiRows])

  const showApiEmpty = Boolean(apiBase && isSuccess && apiRows?.length === 0)
  const dataSource: "api" | "mock" = !apiBase
    ? "mock"
    : isSuccess && apiRows && apiRows.length > 0
      ? "api"
      : "mock"

  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<FilterTab>("all")

  const filteredVehicles = vehicles.filter((vehicle) => {
    const hay = `${vehicle.plate ?? ""} ${vehicle.id} ${vehicle.model}`.toLowerCase()
    const matchesSearch = hay.includes(searchQuery.toLowerCase())

    const matchesTab =
      activeTab === "all" ||
      (activeTab === "alertas" && vehicle.status === "Alerta") ||
      (activeTab === "mantenimiento" && vehicle.status === "Mantenimiento") ||
      (activeTab === "activos" && vehicle.status === "Activo")

    return matchesSearch && matchesTab
  })

  const counts = {
    all: vehicles.length,
    alertas: vehicles.filter((v) => v.status === "Alerta").length,
    mantenimiento: vehicles.filter((v) => v.status === "Mantenimiento").length,
    activos: vehicles.filter((v) => v.status === "Activo").length,
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Flota de vehículos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gestiona y monitorea todos los vehículos de la flota
            </p>
          </div>
          <Button className="bg-[var(--tm-info)] text-primary-foreground hover:bg-[var(--tm-info)]/90">
            <Plus className="mr-2 h-4 w-4" />
            Agregar vehículo
          </Button>
        </div>

        {apiBase && isPending ? (
          <p className="text-sm text-muted-foreground">Cargando vehículos desde la API…</p>
        ) : null}
        {apiBase && isError ? (
          <p className="rounded-lg border border-[var(--tm-warning)]/40 bg-[var(--tm-warning)]/10 px-3 py-2 text-sm text-[var(--tm-warning)]">
            No se pudo cargar <span className="font-mono">GET {apiBase}/vehicles</span>. Comprueba que la API esté en
            marcha y el seed aplicado. Mostrando datos locales de respaldo.
          </p>
        ) : null}
        {showApiEmpty ? (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            La API respondió vacío. Ejecuta{" "}
            <span className="font-mono">python scripts/seed_demo.py</span> desde <span className="font-mono">backend/</span>{" "}
            tras <span className="font-mono">alembic upgrade head</span>.
          </p>
        ) : null}
        {dataSource === "api" && !isError ? (
          <p className="text-xs text-muted-foreground">
            Fuente: <span className="font-medium text-[var(--tm-success)]">TimescaleDB vía FastAPI</span>
            {isFetching ? " · actualizando…" : null}
          </p>
        ) : null}
        {!apiBase ? (
          <p className="text-xs text-muted-foreground">
            Sin <span className="font-mono">NEXT_PUBLIC_API_URL</span>: modo solo demo. Copia{" "}
            <span className="font-mono">.env.example</span> → <span className="font-mono">.env.local</span>.
          </p>
        ) : null}

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por placa, modelo…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-muted/50 pl-9"
            />
          </div>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="all" className="text-xs">
                Todos ({counts.all})
              </TabsTrigger>
              <TabsTrigger
                value="alertas"
                className="text-xs text-[var(--tm-danger)] data-[state=active]:text-[var(--tm-danger)]"
              >
                Alertas ({counts.alertas})
              </TabsTrigger>
              <TabsTrigger
                value="mantenimiento"
                className="text-xs text-[var(--tm-warning)] data-[state=active]:text-[var(--tm-warning)]"
              >
                Mantenimiento ({counts.mantenimiento})
              </TabsTrigger>
              <TabsTrigger
                value="activos"
                className="text-xs text-[var(--tm-success)] data-[state=active]:text-[var(--tm-success)]"
              >
                Activos ({counts.activos})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredVehicles.map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>

        {filteredVehicles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground">No se encontraron vehículos</p>
            <p className="mt-1 text-sm text-muted-foreground">Prueba otros filtros o la búsqueda</p>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
