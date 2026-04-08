"use client"

import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Search, Bell, Sun, Moon, Command } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const ROUTE_LABELS: Record<string, string> = {
  "": "Resumen",
  flota: "Flota",
  telemetria: "Telemetría",
  twins: "Gemelos digitales",
  "digital-twin": "Twin 3D",
  optimizacion: "Optimización GA",
  alertas: "Alertas",
  pipeline: "Pipeline SCADA",
  reportes: "Reportes",
  configuracion: "Ajustes",
}

type AppHeaderProps = {
  sidebarCollapsed?: boolean
}

export function AppHeader({ sidebarCollapsed = false }: AppHeaderProps) {
  const pathname = usePathname()
  const { setTheme } = useTheme()
  const segments = pathname.split("/").filter(Boolean)

  return (
    <header
      className={cn(
        "fixed right-0 top-0 z-30 h-16 border-b border-border bg-background/90 backdrop-blur transition-all duration-300 supports-[backdrop-filter]:bg-background/70",
        sidebarCollapsed ? "left-16" : "left-56"
      )}
    >
      <div className="absolute left-0 right-0 top-0 h-px overflow-hidden bg-gradient-to-r from-transparent via-[var(--tm-info)] to-transparent">
        <div className="h-full w-24 bg-[var(--tm-info)] radar-sweep" />
      </div>

      <div className="flex h-full items-center justify-between px-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/" className="text-muted-foreground hover:text-foreground">
                Telema Mobility
              </BreadcrumbLink>
            </BreadcrumbItem>
            {segments.length > 0 ? (
              <>
                <BreadcrumbSeparator />
                {segments.map((segment, index) => {
                  const last = index === segments.length - 1
                  const href = `/${segments.slice(0, index + 1).join("/")}`
                  const label = ROUTE_LABELS[segment] ?? segment
                  return (
                    <BreadcrumbItem key={href}>
                      {last ? (
                        <BreadcrumbPage className="font-medium text-foreground">{label}</BreadcrumbPage>
                      ) : (
                        <>
                          <BreadcrumbLink href={href} className="text-muted-foreground hover:text-foreground">
                            {label}
                          </BreadcrumbLink>
                          <BreadcrumbSeparator />
                        </>
                      )}
                    </BreadcrumbItem>
                  )
                })}
              </>
            ) : (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-medium text-foreground">Resumen</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="hidden w-56 justify-start border-border bg-muted/40 text-muted-foreground md:flex"
            type="button"
          >
            <Search className="mr-2 h-4 w-4" />
            <span className="flex-1 text-left text-sm">Buscar vehículo o ticket…</span>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <Command className="h-3 w-3" />K
            </kbd>
          </Button>

          <div className="flex items-center gap-2 rounded-full border border-[var(--tm-success)]/25 bg-[var(--tm-success)]/10 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--tm-success)] pulse-dot" />
            <span className="text-xs font-medium text-[var(--tm-success)]">Ingesta estable</span>
            <span className="font-mono text-xs text-muted-foreground">1.0k evt/s</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-9 w-9">
                <Sun className="h-4 w-4 scale-100 rotate-0 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
                <span className="sr-only">Tema</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")}>Claro</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>Oscuro</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>Sistema</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="icon" className="relative h-9 w-9" type="button">
            <Bell className="h-4 w-4" />
            <Badge className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center border-0 bg-[var(--tm-danger)] p-0 text-[10px] text-white">
              3
            </Badge>
          </Button>
        </div>
      </div>
    </header>
  )
}
