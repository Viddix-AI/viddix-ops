import * as React from "react"

import { cn } from "@/lib/utils"

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  /** Mono uppercase caption above the title, e.g. "PIPELINE — Q2 2026". */
  eyebrow?: string
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "border-b border-border-subtle bg-background px-4 pt-6 pb-5 lg:px-8",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-[32px] leading-[1.05] tracking-[-0.02em] text-text-primary sm:text-[36px]">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-text-secondary">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
