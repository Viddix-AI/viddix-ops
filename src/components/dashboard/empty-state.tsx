import * as React from "react"

import { cn } from "@/lib/utils"

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-center",
        className
      )}
    >
      {icon && (
        <div className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="mt-3 font-heading text-sm font-medium text-foreground">
        {title}
      </p>
      {description && (
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
