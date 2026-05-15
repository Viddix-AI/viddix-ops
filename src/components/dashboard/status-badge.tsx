import { cn } from "@/lib/utils"
import type { TaskStatus } from "@/lib/types"

const TASK: Record<TaskStatus, string> = {
  todo:        "bg-slate-100 text-slate-700 ring-slate-200",
  in_progress: "bg-blue-50 text-blue-700 ring-blue-100",
  done:        "bg-emerald-50 text-emerald-700 ring-emerald-100",
}

const TASK_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
}

export function TaskStatusBadge({
  status,
  className,
}: {
  status: TaskStatus
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
        TASK[status],
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {TASK_LABEL[status]}
    </span>
  )
}
