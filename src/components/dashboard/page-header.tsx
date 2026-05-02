import * as React from "react"

import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border bg-background px-4 pt-5 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6 lg:px-6",
        className
      )}
    >
      <div>
        <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-[1.375rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
