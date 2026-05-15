import * as React from "react"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * KPIStat — a single KPI tile for dashboards.
 *
 * Replaces the inline `StatCard` defined in dashboard/page.tsx so the same
 * tile can be reused across pages (Clients table summary, Partners summary,
 * etc.) with consistent typography and tone.
 *
 *   <KPIStat
 *     label="Monthly recurring revenue"
 *     value={money(mrr)}
 *     sub={`${clients.length} clients`}
 *     icon={<TrendingUp className="size-4" />}
 *     trend={{ value: 12.3, direction: "up" }}
 *     sparkline={<Sparkline data={...} />}
 *   />
 *
 * `tone` only affects the icon chip; the value text stays on `--foreground`.
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
  /** Period-over-period change. `value` is a percentage; sign comes from `direction`. */
  trend?: { value: number; direction: "up" | "down"; label?: string }
  /** Drop-in slot for a sparkline component (added in Fase 2). */
  sparkline?: React.ReactNode
  tone?: "default" | "ok" | "warn" | "danger"
  className?: string
}) {
  const TrendIcon = trend?.direction === "up" ? ArrowUpRight : ArrowDownRight
  const trendIsGood = trend?.direction === "up"
  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-3 py-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {icon && (
            <span
              className={cn(
                "grid size-7 place-items-center rounded-md ring-1",
                tone === "warn"
                  ? "bg-warning/10 text-warning ring-warning/20"
                  : tone === "ok"
                  ? "bg-success/10 text-success ring-success/20"
                  : tone === "danger"
                  ? "bg-destructive/10 text-destructive ring-destructive/20"
                  : "bg-accent text-accent-foreground ring-accent"
              )}
            >
              {icon}
            </span>
          )}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="font-heading text-2xl font-semibold tabular-nums tracking-tight">
              {value}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              {sub}
              {trend && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[11px] font-medium tabular-nums",
                    trendIsGood
                      ? "bg-success/10 text-success"
                      : "bg-destructive/10 text-destructive"
                  )}
                  title={trend.label ?? "vs. previous period"}
                  aria-label={`${trendIsGood ? "Up" : "Down"} ${trend.value}% ${trend.label ?? "versus previous period"}`}
                >
                  <TrendIcon className="size-3" />
                  {Math.abs(trend.value).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
          {sparkline && (
            <div className="shrink-0" aria-hidden>
              {sparkline}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
