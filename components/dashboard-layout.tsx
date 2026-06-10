"use client"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { cn } from "@/lib/utils"
import { AuthGuard } from "@/components/auth/auth-guard"

interface DashboardLayoutProps {
  children: React.ReactNode
  requireAuth?: boolean
}

function DashboardShell({
  children,
  sidebarCollapsed,
  onCollapsedChange,
}: {
  children: React.ReactNode
  sidebarCollapsed: boolean
  onCollapsedChange: (v: boolean) => void
}) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar collapsed={sidebarCollapsed} onCollapsedChange={onCollapsedChange} />
      <AppHeader sidebarCollapsed={sidebarCollapsed} />
      <main
        className={cn(
          "min-h-screen pt-16 transition-all duration-300",
          sidebarCollapsed ? "pl-16" : "pl-56",
        )}
      >
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}

export function DashboardLayout({ children, requireAuth = true }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  if (!requireAuth) {
    return (
      <DashboardShell sidebarCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed}>
        {children}
      </DashboardShell>
    )
  }

  return (
    <AuthGuard>
      <DashboardShell sidebarCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed}>
        {children}
      </DashboardShell>
    </AuthGuard>
  )
}
