"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { TrendingDown, TrendingUp, Minus } from "lucide-react"

export type KPICardProps = {
  title: string
  value: number
  suffix?: string
  prefix?: string
  decimals?: number
  trend?: "up" | "down" | "neutral"
  trendValue?: string
  accentColor?: string
  icon?: React.ReactNode
}

export function KPICard({
  title,
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
  trend = "neutral",
  trendValue,
  accentColor = "var(--tm-info)",
  icon,
}: KPICardProps) {
  const [display, setDisplay] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (done) return
    const duration = 1200
    const steps = 48
    const stepMs = duration / steps
    const delta = value / steps
    let acc = 0
    const id = window.setInterval(() => {
      acc += delta
      if (acc >= value) {
        setDisplay(value)
        window.clearInterval(id)
        setDone(true)
      } else {
        setDisplay(acc)
      }
    }, stepMs)
    return () => window.clearInterval(id)
  }, [value, done])

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus
  const trendClass =
    trend === "up"
      ? "text-[var(--tm-success)]"
      : trend === "down"
        ? "text-[var(--tm-danger)]"
        : "text-muted-foreground"

  return (
    <Card
      className="relative overflow-hidden border-border bg-card p-4"
      style={{ borderLeftWidth: 2, borderLeftColor: accentColor }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="count-fade font-mono text-2xl font-semibold text-card-foreground">
            {prefix}
            {display.toFixed(decimals)}
            {suffix}
          </p>
          {trendValue ? (
            <div className={cn("flex items-center gap-1 text-xs", trendClass)}>
              <TrendIcon className="h-3 w-3" />
              <span>{trendValue}</span>
            </div>
          ) : null}
        </div>
        {icon ? (
          <div className="shrink-0 rounded-lg p-2" style={{ backgroundColor: `${accentColor}22` }}>
            {icon}
          </div>
        ) : null}
      </div>
    </Card>
  )
}
