import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Skeleton — placeholder shimmer for async content.
 *
 *   <Skeleton className="h-4 w-32" />            // single bar
 *   <Skeleton className="h-9 w-9 rounded-full" />// circle
 *
 * Composes plain divs; use multiple in a flow for richer placeholders.
 * Backed by `animate-pulse` so it respects prefers-reduced-motion (Tailwind
 * disables the animation under that media query automatically).
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "animate-pulse rounded-md bg-muted/60 dark:bg-muted/40",
        className
      )}
      {...props}
    />
  )
}
