import { Pill, type PillTone } from "@/components/ui/pill"
import type { TaskPriority } from "@/lib/types"

const TONES: Record<TaskPriority, PillTone> = {
  low:    "slate",
  medium: "blue",
  high:   "amber",
  urgent: "rose",
}

const LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: TaskPriority
  className?: string
}) {
  return (
    <Pill tone={TONES[priority]} size="sm" dot className={className}>
      {LABELS[priority]}
    </Pill>
  )
}
