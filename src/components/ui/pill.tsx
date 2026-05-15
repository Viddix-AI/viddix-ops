import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Pill — small label component for status, category, and tag display.
 *
 * Two flavours:
 *   • `variant`: semantic intent (info / success / warning / danger / neutral / accent).
 *     Use this for state that has meaning (Active, Overdue, Error).
 *   • `tone`: tonal palette for data-driven coloring (blue, emerald, amber, rose,
 *     violet, slate, sky, indigo). Use when colour distinguishes data categories
 *     (e.g. each lead stage in a kanban, each team).
 *
 * Pick exactly one. If both are set, `tone` wins (it's the more specific intent).
 */

const pillVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap font-medium ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
  {
    variants: {
      // Semantic intents — preferred for state.
      variant: {
        neutral: "bg-secondary text-secondary-foreground ring-border",
        info:    "bg-info/10 text-info ring-info/20",
        success: "bg-success/10 text-success ring-success/20",
        warning: "bg-warning/10 text-warning ring-warning/20",
        danger:  "bg-destructive/10 text-destructive ring-destructive/20",
        accent:  "bg-accent text-accent-foreground ring-accent",
      },
      // Tonal palettes — for data display (kanban stages, teams, etc.).
      // Each one maps to a fixed Tailwind palette so it carries through dark
      // mode (the `dark:` variants stay tonally consistent vs. the light).
      tone: {
        blue:    "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20",
        sky:     "bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20",
        indigo:  "bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/20",
        violet:  "bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20",
        emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20",
        amber:   "bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20",
        rose:    "bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20",
        slate:   "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/20",
      },
      size: {
        sm: "h-5 rounded-sm px-1.5 text-[10px]",
        md: "h-6 rounded-md px-2 text-xs",
      },
      uppercase: {
        true: "uppercase tracking-wider",
        false: "",
      },
    },
    compoundVariants: [
      // Don't let `tone` produce a separate visual override when no variant is given —
      // both are mutually exclusive by intent. CVA picks the last matching class.
    ],
    defaultVariants: {
      variant: "neutral",
      size: "sm",
      uppercase: false,
    },
  }
)

export type PillTone = NonNullable<VariantProps<typeof pillVariants>["tone"]>

export type PillProps = Omit<React.HTMLAttributes<HTMLSpanElement>, "color"> &
  VariantProps<typeof pillVariants> & {
    /** Show a small dot in the leading edge (matches Linear/Attio status chips). */
    dot?: boolean
  }

export function Pill({
  className,
  variant,
  tone,
  size,
  uppercase,
  dot,
  children,
  ...props
}: PillProps) {
  // When a `tone` is provided, drop the variant so the tonal class set wins
  // cleanly. cva merges in order — we use cn so the explicit tone classes
  // come last and override the variant defaults.
  const resolvedVariant = tone ? undefined : variant
  return (
    <span
      className={cn(
        pillVariants({ variant: resolvedVariant, tone, size, uppercase }),
        className
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden
          className="size-1.5 rounded-full bg-current opacity-70"
        />
      )}
      {children}
    </span>
  )
}

export { pillVariants }
