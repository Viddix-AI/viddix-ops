"use client"

import * as React from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { PriorityBadge } from "@/components/dashboard/priority-badge"
import { TaskStatusBadge } from "@/components/dashboard/status-badge"
import { useTasks, useUpdateTask } from "@/hooks/use-tasks"
import { useProfiles } from "@/hooks/use-profile"
import { initials, relativeDay } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Task, TaskPriority } from "@/lib/types"

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
]

type Group = "overdue" | "today" | "week" | "later"

const GROUP_LABELS: Record<Group, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "This week",
  later: "Later",
}

export function TasksView() {
  const { data: tasks = [] } = useTasks()
  const { data: profiles = [] } = useProfiles()
  const update = useUpdateTask()

  const [filterAssignee, setFilterAssignee] = React.useState("")
  const [filterPriority, setFilterPriority] = React.useState<TaskPriority | "">("")

  const { todayMs, weekEndMs } = React.useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    const todayMs = d.getTime()
    return { todayMs, weekEndMs: todayMs + 6 * 86_400_000 }
  }, [])

  function groupOf(task: Task): Group {
    if (!task.due_date) return "later"
    const d = new Date(task.due_date)
    d.setHours(0, 0, 0, 0)
    const t = d.getTime()
    if (t < todayMs && task.status !== "done") return "overdue"
    if (t === todayMs) return "today"
    if (t > todayMs && t <= weekEndMs) return "week"
    return "later"
  }

  const filtered = tasks.filter((t) => {
    if (filterAssignee && t.assignee_id !== filterAssignee) return false
    if (filterPriority && t.priority !== filterPriority) return false
    return true
  })

  const groups: Record<Group, Task[]> = { overdue: [], today: [], week: [], later: [] }
  for (const t of filtered) {
    groups[groupOf(t)].push(t)
  }

  function toggleDone(task: Task) {
    update.mutate({
      id: task.id,
      patch: { status: task.status === "done" ? "todo" : "done" },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Select
          value={filterAssignee}
          onValueChange={(v) => setFilterAssignee(v ?? "")}
        >
          <SelectTrigger size="sm">
            <SelectValue placeholder="All assignees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All assignees</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filterPriority}
          onValueChange={(v) => setFilterPriority((v ?? "") as TaskPriority | "")}
        >
          <SelectTrigger size="sm">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All priorities</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(["overdue", "today", "week", "later"] as Group[]).map((group) => {
        const items = groups[group]
        if (!items.length) return null
        return (
          <section key={group}>
            <h3
              className={cn(
                "mb-2 text-xs font-semibold uppercase tracking-wider",
                group === "overdue" ? "text-rose-600" : "text-muted-foreground"
              )}
            >
              {GROUP_LABELS[group]} · {items.length}
            </h3>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {items.map((task) => {
                const assignee = profiles.find((p) => p.id === task.assignee_id)
                return (
                  <li key={task.id} className="flex items-center gap-3 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={task.status === "done"}
                      onChange={() => toggleDone(task)}
                      className="size-4 shrink-0 cursor-pointer accent-primary"
                    />
                    <span
                      className={cn(
                        "flex-1 text-sm font-medium",
                        task.status === "done" && "line-through text-muted-foreground"
                      )}
                    >
                      {task.title}
                    </span>
                    <div className="hidden items-center gap-2 sm:flex">
                      <PriorityBadge priority={task.priority} />
                      <TaskStatusBadge status={task.status} />
                    </div>
                    {assignee ? (
                      <Avatar size="sm" title={assignee.full_name}>
                        {assignee.avatar_url && (
                          <AvatarImage
                            src={assignee.avatar_url}
                            alt={assignee.full_name}
                          />
                        )}
                        <AvatarFallback>{initials(assignee.full_name)}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <div className="size-6 shrink-0 rounded-full bg-muted" />
                    )}
                    <span className="w-16 shrink-0 text-right text-[11px] text-muted-foreground">
                      {relativeDay(task.due_date)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      {filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">No tasks</p>
      )}
    </div>
  )
}
