import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * EmptyState — uniform "no data yet" surface.
 *
 *   size="default"  → page-level: icon-in-circle + title + description + CTA.
 *                     Use in main route bodies (tables, kanban, lists).
 *   size="sm"       → in-panel: compact, no border, smaller icon. Use inside
 *                     sheet tabs and other tight containers where the default
 *                     would dwarf the surrounding UI.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "default",
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  size?: "default" | "sm"
  className?: string
}) {
  const compact = size === "sm"
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact
          ? "gap-1.5 py-5"
          : "gap-0 rounded-xl border border-dashed border-border bg-card/50 px-6 py-10",
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            "grid place-items-center rounded-full bg-muted text-muted-foreground",
            compact ? "size-7" : "mb-3 size-9"
          )}
        >
          {icon}
        </div>
      )}
      <p
        className={cn(
          "font-heading font-medium text-foreground",
          compact ? "text-xs" : "text-sm"
        )}
      >
        {title}
      </p>
      {description && (
        <p
          className={cn(
            "max-w-sm text-muted-foreground",
            compact ? "text-[11px]" : "mt-1 text-xs"
          )}
        >
          {description}
        </p>
      )}
      {action && <div className={compact ? "mt-2" : "mt-4"}>{action}</div>}
    </div>
  )
}
