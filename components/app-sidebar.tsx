"use client"

import { useEffect, useState } from "react"
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
  Users,
  ChevronLeft,
  ChevronRight,
  Radio,
  Box,
  Sigma,
  ClipboardList,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useQuery } from "@tanstack/react-query"
import { fetchAnomalies, fetchMe, getApiBaseUrl, type ApiUser } from "@/lib/api"
import { can, canAccessReportes } from "@/lib/rbac"
import { useAuthUser } from "@/components/auth/auth-context"
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
  { href: "/cibernetica", label: "Cibernética", icon: Sigma },
  { href: "/twins", label: "Gemelos digitales", icon: Cpu },
  { href: "/digital-twin", label: "Twin 3D", icon: Box },
  { href: "/optimizacion", label: "Optimización GA", icon: Dna },
  { href: "/alertas", label: "Alertas", icon: Bell },
  { href: "/tickets", label: "Tickets", icon: ClipboardList },
  { href: "/usuarios", label: "Usuarios", icon: Users },
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
  const authUser = useAuthUser()
  const [me, setMe] = useState<ApiUser | null>(null)
  const baseUrl = getApiBaseUrl()
  const role = authUser?.role ?? me?.role ?? null

  useEffect(() => {
    if (authUser) {
      setMe(authUser)
      return
    }
    if (!baseUrl) return
    fetchMe(baseUrl)
      .then(setMe)
      .catch(() => setMe(null))
  }, [baseUrl, authUser])

  const anomaliesQ = useQuery({
    queryKey: ["sidebar", "open-anomalies"],
    queryFn: async () => {
      const rows = await fetchAnomalies(baseUrl!, 100)
      return rows.filter((a) => !a.resolved_at).length
    },
    enabled: !!baseUrl && can(role, "alertas"),
    refetchInterval: 30_000,
  })
  const openAlertCount = anomaliesQ.data ?? 0

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
              <p className="truncate text-[10px] text-muted-foreground">Suzuki Grand Vitara · 13 pruebas</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4">
          <ul className="space-y-1">
            {NAV.filter((item) => {
              if (item.href === "/usuarios") return can(role, "usuarios")
              if (item.href === "/cibernetica") return can(role, "cibernetica")
              if (item.href === "/alertas") return can(role, "alertas")
              if (item.href === "/tickets") return can(role, "tickets")
              if (item.href === "/telemetria") return can(role, "telemetria")
              if (item.href === "/flota") return can(role, "flota")
              if (item.href === "/reportes") return canAccessReportes(role)
              if (item.href === "/pipeline") return can(role, "pipeline")
              if (item.href === "/twins") return can(role, "twins")
              if (item.href === "/digital-twin") return can(role, "digital_twin")
              if (item.href === "/optimizacion") return can(role, "optimizacion")
              if (item.href === "/configuracion") return can(role, "configuracion")
              return true
            }).map((item) => {
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
                      {item.href === "/alertas" && openAlertCount > 0 ? (
                        <Badge
                          variant="destructive"
                          className="flex h-[18px] min-w-[18px] items-center justify-center border-0 bg-[var(--tm-danger)] px-1.5 py-0 text-[10px] text-white"
                        >
                          {openAlertCount > 99 ? "99+" : openAlertCount}
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
                <p className="font-medium">{me?.full_name ?? me?.email ?? "Sin sesión"}</p>
                <p className="text-xs text-muted-foreground">{me?.role ?? "—"}</p>
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
                <p className="truncate text-sm font-medium text-sidebar-foreground">
                  {me?.full_name ?? me?.email ?? "Sin sesión"}
                </p>
                <p className="truncate text-xs text-muted-foreground">{me?.role ?? "—"}</p>
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
