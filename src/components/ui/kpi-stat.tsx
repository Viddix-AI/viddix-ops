import * as React from "react"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * KPIStat — editorial KPI tile. The value reads as the display element on the
 * page: serif, large, tabular. Delta sits as a subtle outline pill. Sparkline
 * is line-only (no fill) at the bottom of the card so the eye lands on the
 * number first.
 */
export function KPIStat({
  label,
  value,
  sub,
  icon,
  trend,
  sparkline,
  tone = "default",
  className,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon?: React.ReactNode
  trend?: { value: number; direction: "up" | "down"; label?: string }
  sparkline?: React.ReactNode
  tone?: "default" | "ok" | "warn" | "danger"
  className?: string
}) {
  const TrendIcon = trend?.direction === "up" ? ArrowUpRight : ArrowDownRight
  const trendIsGood = trend?.direction === "up"
  return (
    <Card className={cn("gap-0", className)}>
      <CardContent className="flex flex-col gap-3 px-5 py-4">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
            {label}
          </p>
          {icon && (
            <span
              className={cn(
                "grid size-7 place-items-center rounded-[var(--radius-sm)] ring-1",
                tone === "warn"
                  ? "bg-warning/10 text-warning ring-warning/20"
                  : tone === "ok"
                  ? "bg-success/10 text-success ring-success/20"
                  : tone === "danger"
                  ? "bg-destructive/10 text-destructive ring-destructive/20"
                  : "bg-accent text-accent-foreground ring-border-subtle"
              )}
            >
              {icon}
            </span>
          )}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-[44px] leading-none tracking-[-0.03em] tabular-nums text-text-primary">
              {value}
            </p>
            {(sub || trend) && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary">
                {sub}
                {trend && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                      trendIsGood
                        ? "border-[color-mix(in_oklch,var(--success)_30%,transparent)] bg-[color-mix(in_oklch,var(--success)_12%,transparent)] text-success"
                        : "border-[color-mix(in_oklch,var(--destructive)_30%,transparent)] bg-[color-mix(in_oklch,var(--destructive)_12%,transparent)] text-destructive"
                    )}
                    title={trend.label ?? "vs. previous period"}
                    aria-label={`${trendIsGood ? "Up" : "Down"} ${trend.value}% ${trend.label ?? "versus previous period"}`}
                  >
                    <TrendIcon className="size-3" />
                    {Math.abs(trend.value).toFixed(1)}%
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        {sparkline && (
          <div className="-mb-1 h-10 w-full text-chart-1" aria-hidden>
            {sparkline}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
