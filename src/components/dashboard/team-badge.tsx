import { Pill } from "@/components/ui/pill"
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
    <Pill
      tone={t.pillTone}
      size="sm"
      uppercase
      title={t.label}
      className={className}
    >
      {variant === "short" ? t.short : t.label}
    </Pill>
  )
}
