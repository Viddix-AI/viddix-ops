import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Pill — small label component for status, category, and tag display.
 *
 * Two flavours:
 *   • `variant`: semantic intent (info / success / warning / danger / neutral / accent).
 *     Use this for state with meaning (Active, Overdue).
 *   • `tone`: tonal palette for data-driven coloring. The tone *keys* are kept
 *     stable (blue, emerald, amber, rose, violet, slate, sky, indigo) for
 *     backwards compatibility, but each maps to the editorial palette
 *     (jade / plum / ochre / graphite / terracota). No Tailwind rainbow.
 *
 * Pick exactly one. If both are set, `tone` wins.
 */

const pillVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
  {
    variants: {
      // Semantic intents.
      variant: {
        neutral:
          "bg-surface-3 text-text-primary border-border-subtle",
        info:
          "bg-[color-mix(in_oklch,var(--info)_12%,transparent)] text-info border-[color-mix(in_oklch,var(--info)_28%,transparent)]",
        success:
          "bg-[color-mix(in_oklch,var(--success)_12%,transparent)] text-success border-[color-mix(in_oklch,var(--success)_28%,transparent)]",
        warning:
          "bg-[color-mix(in_oklch,var(--warning)_14%,transparent)] text-warning border-[color-mix(in_oklch,var(--warning)_28%,transparent)]",
        danger:
          "bg-[color-mix(in_oklch,var(--destructive)_14%,transparent)] text-destructive border-[color-mix(in_oklch,var(--destructive)_28%,transparent)]",
        accent:
          "bg-accent text-accent-foreground border-border-subtle",
      },
      // Tonal palette — every tone resolves to the editorial palette via tokens.
      // Mapping rationale (kept stable across the codebase):
      //   blue / sky / slate → graphite (neutral data)
      //   indigo / violet     → plum
      //   emerald             → jade (success-adjacent)
      //   amber               → ochre (warm warning)
      //   rose                → terracota (hot/danger)
      tone: {
        blue:
          "bg-surface-3 text-text-secondary border-border-subtle",
        sky:
          "bg-surface-3 text-text-secondary border-border-subtle",
        slate:
          "bg-surface-3 text-text-secondary border-border-subtle",
        indigo:
          "bg-[color-mix(in_oklch,var(--info)_12%,transparent)] text-info border-[color-mix(in_oklch,var(--info)_28%,transparent)]",
        violet:
          "bg-[color-mix(in_oklch,var(--info)_10%,transparent)] text-info border-[color-mix(in_oklch,var(--info)_22%,transparent)]",
        emerald:
          "bg-[color-mix(in_oklch,var(--success)_12%,transparent)] text-success border-[color-mix(in_oklch,var(--success)_28%,transparent)]",
        amber:
          "bg-[color-mix(in_oklch,var(--warning)_14%,transparent)] text-warning border-[color-mix(in_oklch,var(--warning)_28%,transparent)]",
        rose:
          "bg-[color-mix(in_oklch,var(--destructive)_14%,transparent)] text-destructive border-[color-mix(in_oklch,var(--destructive)_28%,transparent)]",
      },
      size: {
        sm: "h-5 rounded-full px-1.5 text-[10px]",
        md: "h-6 rounded-full px-2 text-[11px]",
      },
      uppercase: {
        true: "uppercase tracking-[0.08em]",
        false: "",
      },
    },
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
