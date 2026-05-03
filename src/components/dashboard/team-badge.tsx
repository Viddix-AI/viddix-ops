import { cn } from "@/lib/utils"
import { teamFor, type Team } from "@/lib/types"

/**
 * Small inline pill used next to a profile name (or anywhere a team needs
 * to be flagged). Two variants: a 2-letter short label (saves space in
 * dense lists) and a full label.
 */
export function TeamBadge({
  team,
  variant = "short",
  className,
}: {
  team: Team | null | undefined
  variant?: "short" | "full"
  className?: string
}) {
  if (!team) return null
  const t = teamFor(team)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider",
        t.badge,
        className
      )}
      title={t.label}
    >
      {variant === "short" ? t.short : t.label}
    </span>
  )
}
