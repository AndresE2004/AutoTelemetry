"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Bell, ExternalLink } from "lucide-react"

const ROWS = [
  {
    id: "1",
    vehicle: "TM-4821",
    type: "Temperatura motor elevada",
    severity: "Alta" as const,
    model: "Isolation Forest · v2.3",
    status: "Abierto" as const,
  },
  {
    id: "2",
    vehicle: "TM-3301",
    type: "Voltaje de batería bajo",
    severity: "Alta" as const,
    model: "Autoencoder · v1.8",
    status: "Ticket" as const,
  },
  {
    id: "3",
    vehicle: "TM-1105",
    type: "Patrón RPM inusual",
    severity: "Media" as const,
    model: "Isolation Forest · v2.3",
    status: "En revisión" as const,
  },
  {
    id: "4",
    vehicle: "TM-5512",
    type: "Presión de neumático",
    severity: "Baja" as const,
    model: "Reglas · v1.0",
    status: "Abierto" as const,
  },
  {
    id: "5",
    vehicle: "TM-2204",
    type: "Consumo energético alto",
    severity: "Media" as const,
    model: "Ensamble · v3.1",
    status: "Cerrado" as const,
  },
]

const SEV: Record<string, string> = {
  Alta: "border-[var(--tm-danger)]/30 bg-[var(--tm-danger)]/15 text-[var(--tm-danger)]",
  Media: "border-[var(--tm-warning)]/30 bg-[var(--tm-warning)]/15 text-[var(--tm-warning)]",
  Baja: "border-[var(--tm-success)]/30 bg-[var(--tm-success)]/15 text-[var(--tm-success)]",
}

const STAT: Record<string, string> = {
  Abierto: "border-[var(--tm-danger)]/30 bg-[var(--tm-danger)]/15 text-[var(--tm-danger)]",
  Ticket: "border-[var(--tm-info)]/30 bg-[var(--tm-info)]/15 text-[var(--tm-info)]",
  "En revisión": "border-[var(--tm-warning)]/30 bg-[var(--tm-warning)]/15 text-[var(--tm-warning)]",
  Cerrado: "border-[var(--tm-success)]/30 bg-[var(--tm-success)]/15 text-[var(--tm-success)]",
}

export function RecentAlerts() {
  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Bell className="h-4 w-4 text-[var(--tm-warning)]" />
          Últimas alertas del motor de anomalías
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-xs font-medium text-muted-foreground">Unidad</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Hallazgo</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Severidad</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Modelo</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Estado</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground"> </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map((r) => (
              <TableRow key={r.id} className="border-border hover:bg-muted/40">
                <TableCell className="font-mono text-sm font-medium">{r.vehicle}</TableCell>
                <TableCell className="text-sm">{r.type}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] ${SEV[r.severity]}`}>
                    {r.severity}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.model}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] ${STAT[r.status]}`}>
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-[var(--tm-info)] hover:text-[var(--tm-info)]"
                    asChild
                  >
                    <Link href="/alertas">
                      Abrir
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="mt-4 border-t border-border pt-4">
          <Button variant="outline" className="w-full text-sm" asChild>
            <Link href="/alertas">Ir al centro de alertas</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
