import { cn } from "@/lib/utils"
import type { TaskPriority } from "@/lib/types"

const TONES: Record<TaskPriority, string> = {
  low:    "bg-slate-100 text-slate-600 ring-slate-200",
  medium: "bg-blue-50 text-blue-700 ring-blue-100",
  high:   "bg-amber-50 text-amber-800 ring-amber-100",
  urgent: "bg-rose-50 text-rose-700 ring-rose-100",
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
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
        TONES[priority],
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {LABELS[priority]}
    </span>
  )
}
