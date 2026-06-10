"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Car, ClipboardList, ExternalLink, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchMe, fetchTickets, getApiBaseUrl, patchTicket, type ApiMaintenanceTicket } from "@/lib/api"
import { isTicketsReadOnly } from "@/lib/rbac"
import { cn } from "@/lib/utils"

type StatusTab = "all" | "open" | "in_progress" | "resolved" | "cancelled"

const STATUS_LABEL: Record<string, string> = {
  open: "Abierto",
  in_progress: "En curso",
  resolved: "Resuelto",
  cancelled: "Cancelado",
}

const PRIORITY_LABEL: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
}

const statusBadge: Record<string, string> = {
  open: "border-[#E24B4A]/40 bg-[#E24B4A]/10 text-[#E24B4A]",
  in_progress: "border-[#EF9F27]/40 bg-[#EF9F27]/10 text-[#EF9F27]",
  resolved: "border-[#1D9E75]/40 bg-[#1D9E75]/10 text-[#1D9E75]",
  cancelled: "border-muted-foreground/40 bg-muted text-muted-foreground",
}

export function TicketsPanel() {
  const baseUrl = getApiBaseUrl()
  const qc = useQueryClient()
  const [tab, setTab] = useState<StatusTab>("all")

  const meQuery = useQuery({
    queryKey: ["me", baseUrl],
    queryFn: async () => {
      if (!baseUrl) return null
      return fetchMe(baseUrl)
    },
    enabled: Boolean(baseUrl),
  })

  const readOnly = isTicketsReadOnly(meQuery.data?.role ?? null)

  const ticketsQuery = useQuery({
    queryKey: ["tickets", baseUrl],
    queryFn: async () => {
      if (!baseUrl) return [] as ApiMaintenanceTicket[]
      return fetchTickets(baseUrl, { limit: 500 })
    },
    enabled: Boolean(baseUrl),
    refetchInterval: 25_000,
  })

  const allRows = ticketsQuery.data ?? []

  const filtered = useMemo(() => {
    if (tab === "all") return allRows
    return allRows.filter((t) => t.status === tab)
  }, [allRows, tab])

  const counts = useMemo(() => {
    return {
      open: allRows.filter((t) => t.status === "open").length,
      in_progress: allRows.filter((t) => t.status === "in_progress").length,
      resolved: allRows.filter((t) => t.status === "resolved").length,
      cancelled: allRows.filter((t) => t.status === "cancelled").length,
    }
  }, [allRows])

  const patchMut = useMutation({
    mutationFn: async (vars: { id: string; status?: string; priority?: string }) => {
      if (!baseUrl) throw new Error("Sin API")
      return patchTicket(baseUrl, vars.id, { status: vars.status, priority: vars.priority })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tickets", baseUrl] })
    },
  })

  if (!baseUrl) {
    return (
      <p className="text-sm text-muted-foreground">
        Configura <span className="font-mono">NEXT_PUBLIC_API_URL</span> en <span className="font-mono">.env.local</span>.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-semibold">
            <ClipboardList className="h-6 w-6 text-[var(--tm-info)]" />
            Tickets de mantenimiento
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Listado desde <span className="font-mono">GET /tickets</span>. Estados y prioridad con{" "}
            <span className="font-mono">PATCH /tickets/{"{id}"}</span>
            {readOnly ? " (tu rol es solo lectura)." : "."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={ticketsQuery.isFetching}
          onClick={() => void ticketsQuery.refetch()}
        >
          {ticketsQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Actualizar
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as StatusTab)}>
        <TabsList className="flex flex-wrap bg-muted/50">
          <TabsTrigger value="all" className="text-xs">
            Todos ({allRows.length})
          </TabsTrigger>
          <TabsTrigger value="open" className="text-xs">
            Abiertos ({counts.open})
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="text-xs">
            En curso ({counts.in_progress})
          </TabsTrigger>
          <TabsTrigger value="resolved" className="text-xs">
            Resueltos ({counts.resolved})
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="text-xs">
            Cancelados ({counts.cancelled})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {ticketsQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando tickets…
        </div>
      ) : null}
      {ticketsQuery.isError ? (
        <p className="text-sm text-destructive">
          {ticketsQuery.error instanceof Error ? ticketsQuery.error.message : "Error al cargar"}
        </p>
      ) : null}
      {patchMut.isError ? (
        <p className="text-sm text-destructive">
          {patchMut.error instanceof Error ? patchMut.error.message : "Error al guardar"}
        </p>
      ) : null}

      <Card className="border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Estado</TableHead>
                  <TableHead className="w-[110px]">Prioridad</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead className="min-w-[200px]">Título</TableHead>
                  <TableHead className="hidden lg:table-cell">Flota</TableHead>
                  <TableHead className="w-[120px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && !ticketsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      No hay tickets en este filtro. Crea uno desde{" "}
                      <Link href="/alertas" className="underline">
                        Alertas
                      </Link>
                      .
                    </TableCell>
                  </TableRow>
                ) : null}
                {filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      {readOnly ? (
                        <Badge variant="outline" className={cn("text-xs", statusBadge[t.status] ?? "")}>
                          {STATUS_LABEL[t.status] ?? t.status}
                        </Badge>
                      ) : (
                        <Select
                          value={t.status}
                          disabled={patchMut.isPending}
                          onValueChange={(v) => patchMut.mutate({ id: t.id, status: v })}
                        >
                          <SelectTrigger className="h-8 w-[130px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Abierto</SelectItem>
                            <SelectItem value="in_progress">En curso</SelectItem>
                            <SelectItem value="resolved">Resuelto</SelectItem>
                            <SelectItem value="cancelled">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {readOnly ? (
                        <span className="text-xs text-muted-foreground">{PRIORITY_LABEL[t.priority] ?? t.priority}</span>
                      ) : (
                        <Select
                          value={t.priority}
                          disabled={patchMut.isPending}
                          onValueChange={(v) => patchMut.mutate({ id: t.id, priority: v })}
                        >
                          <SelectTrigger className="h-8 w-[120px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Baja</SelectItem>
                            <SelectItem value="medium">Media</SelectItem>
                            <SelectItem value="high">Alta</SelectItem>
                            <SelectItem value="critical">Crítica</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 font-mono text-sm">
                        <Car className="h-3.5 w-3.5 text-muted-foreground" />
                        {t.plate}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="max-w-[320px] truncate text-sm font-medium">{t.title}</p>
                      {t.description ? (
                        <p className="max-w-[320px] truncate text-xs text-muted-foreground">{t.description}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                      {t.fleet_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/telemetria?vehicle=${encodeURIComponent(t.vehicle_id)}`}>
                        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                          Telemetría
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
