"use client"

import Link from "next/link"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Cpu } from "lucide-react"

const IDS = ["TM-4821", "TM-3301", "TM-1105", "TM-2204", "TM-5512", "TM-6631"]

export default function TwinsIndexPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Cpu className="h-7 w-7 text-[var(--tm-cyan)]" />
            Gemelos digitales
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecciona una unidad para ver el estado simulado frente a las lecturas reales (datos de demostración).
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {IDS.map((id) => (
            <Card key={id} className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="font-mono text-base">{id}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href={`/twins/${id}`}>Abrir ficha</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
