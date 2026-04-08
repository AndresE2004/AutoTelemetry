"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  Car,
  Activity,
  Cpu,
  Dna,
  Bell,
  Workflow,
  FileBarChart,
  Settings,
  ChevronLeft,
  ChevronRight,
  Radio,
  Box,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  live?: boolean
  badge?: number
}

const NAV: NavItem[] = [
  { href: "/", label: "Resumen", icon: LayoutDashboard },
  { href: "/flota", label: "Flota", icon: Car },
  { href: "/telemetria", label: "Telemetría", icon: Activity, live: true },
  { href: "/twins", label: "Gemelos digitales", icon: Cpu },
  { href: "/digital-twin", label: "Twin 3D (inversores)", icon: Box },
  { href: "/optimizacion", label: "Optimización GA", icon: Dna },
  { href: "/alertas", label: "Alertas", icon: Bell, badge: 3 },
  { href: "/pipeline", label: "Pipeline SCADA", icon: Workflow },
  { href: "/reportes", label: "Reportes", icon: FileBarChart },
  { href: "/configuracion", label: "Ajustes", icon: Settings },
]

type AppSidebarProps = {
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

export function AppSidebar({ collapsed = false, onCollapsedChange }: AppSidebarProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(collapsed)

  const toggleCollapsed = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    onCollapsedChange?.(next)
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
          isCollapsed ? "w-16" : "w-56"
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center border-b border-sidebar-border px-4",
            isCollapsed ? "justify-center" : "gap-3"
          )}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--tm-info)]">
            <Radio className="h-5 w-5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">Telema Mobility</p>
              <p className="truncate text-[10px] text-muted-foreground">Auteco Mobility · demo UI</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-1">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`)

              const inner = (
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                    "hover:bg-sidebar-accent",
                    active
                      ? "bg-sidebar-accent text-[var(--tm-info)]"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                    isCollapsed && "justify-center px-2"
                  )}
                >
                  <span className="relative">
                    <item.icon className={cn("h-5 w-5", active && "text-[var(--tm-info)]")} />
                    {item.live ? (
                      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-[var(--tm-success)] pulse-dot" />
                    ) : null}
                  </span>
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 text-sm font-medium">{item.label}</span>
                      {item.badge != null ? (
                        <Badge
                          variant="destructive"
                          className="flex h-[18px] min-w-[18px] items-center justify-center border-0 bg-[var(--tm-danger)] px-1.5 py-0 text-[10px] text-white"
                        >
                          {item.badge}
                        </Badge>
                      ) : null}
                    </>
                  )}
                </Link>
              )

              if (isCollapsed) {
                return (
                  <li key={item.href}>
                    <Tooltip>
                      <TooltipTrigger asChild>{inner}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                  </li>
                )
              }

              return <li key={item.href}>{inner}</li>
            })}
          </ul>
        </nav>

        <div
          className={cn("border-t border-sidebar-border p-4", isCollapsed && "flex justify-center")}
        >
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-9 w-9 cursor-pointer">
                  <AvatarFallback className="bg-[var(--tm-info)]/20 text-xs text-[var(--tm-info)]">
                    AM
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="font-medium">Operador de flota</p>
                <p className="text-xs text-muted-foreground">Sesión local</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-[var(--tm-info)]/20 text-xs text-[var(--tm-info)]">
                  AM
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-foreground">Operador de flota</p>
                <p className="truncate text-xs text-muted-foreground">Sesión local</p>
              </div>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-3 top-20 h-6 w-6 rounded-full border border-border bg-card shadow-sm hover:bg-accent"
          type="button"
          onClick={toggleCollapsed}
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>
      </aside>
    </TooltipProvider>
  )
}
