import { Pill } from "@/components/ui/pill"
import type { TaskStatus } from "@/lib/types"

const VARIANT: Record<TaskStatus, "neutral" | "info" | "success"> = {
  todo:        "neutral",
  in_progress: "info",
  done:        "success",
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
    <Pill variant={VARIANT[status]} size="sm" dot className={className}>
      {TASK_LABEL[status]}
    </Pill>
  )
}
