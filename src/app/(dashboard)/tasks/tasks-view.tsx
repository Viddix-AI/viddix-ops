"use client"

import * as React from "react"
import { CheckSquare, ExternalLink } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AvatarStack } from "@/components/dashboard/avatar-stack"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { PriorityBadge } from "@/components/dashboard/priority-badge"
import { TaskStatusBadge } from "@/components/dashboard/status-badge"
import { TeamBadge } from "@/components/dashboard/team-badge"
import { useTasks, useUpdateTask } from "@/hooks/use-tasks"
import { useProfiles } from "@/hooks/use-profile"
import { relativeDay } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  TEAMS,
  type Profile,
  type Task,
  type TaskPriority,
  type Team,
} from "@/lib/types"
import { TaskDetailSheet } from "./task-detail-sheet"

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
  const [filterTeam, setFilterTeam] = React.useState<Team | "">("")
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null)

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

  // Filtering: assignee filter matches if the task contains the picked id.
  // Team filter matches if ANY assignee belongs to the picked team — so a
  // cross-team task still surfaces under either team filter.
  const filtered = tasks.filter((t) => {
    if (filterAssignee && !t.assignee_ids.includes(filterAssignee)) return false
    if (filterPriority && t.priority !== filterPriority) return false
    if (filterTeam) {
      const teams = t.assignee_ids
        .map((id) => profiles.find((p) => p.id === id)?.team)
        .filter(Boolean) as Team[]
      if (!teams.includes(filterTeam)) return false
    }
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

  const openCount = tasks.filter((t) => t.status !== "done").length
  const activeTask = tasks.find((t) => t.id === activeTaskId) ?? null

  return (
    <>
      <PageHeader
        eyebrow="HOLDING · TASKS"
        title="Tasks"
        description={`${openCount} open · ${tasks.length} total`}
      />

      <div className="space-y-6 px-4 py-5 lg:px-6">
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
                  <span className="inline-flex items-center gap-1.5">
                    {p.full_name}
                    <TeamBadge team={p.team} />
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filterTeam}
            onValueChange={(v) => setFilterTeam((v ?? "") as Team | "")}
          >
            <SelectTrigger size="sm">
              <SelectValue placeholder="All teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All teams</SelectItem>
              {TEAMS.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
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
                  "mb-2 font-mono text-[11px] uppercase tracking-[0.18em]",
                  group === "overdue" ? "text-destructive" : "text-text-tertiary"
                )}
              >
                {GROUP_LABELS[group]} · {items.length}
              </h3>
              <ul className="divide-y divide-border-subtle rounded-[var(--radius-lg)] border border-border-subtle bg-card">
                {items.map((task) => {
                  const assignees = task.assignee_ids
                    .map((id) => profiles.find((p) => p.id === id))
                    .filter((p): p is Profile => Boolean(p))
                  return (
                    <li
                      key={task.id}
                      onClick={() => setActiveTaskId(task.id)}
                      className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-3/60"
                    >
                      <input
                        type="checkbox"
                        checked={task.status === "done"}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleDone(task)}
                        className="size-4 shrink-0 cursor-pointer accent-primary"
                      />
                      <span
                        className={cn(
                          "flex-1 text-sm font-medium text-text-primary",
                          task.status === "done" &&
                            "text-text-tertiary line-through"
                        )}
                      >
                        {task.title}
                      </span>
                      <div className="hidden items-center gap-2 sm:flex">
                        <PriorityBadge priority={task.priority} />
                        <TaskStatusBadge status={task.status} />
                      </div>
                      {task.link && (
                        <a
                          href={task.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title={task.link}
                          aria-label="Open task link in a new tab"
                          className="grid size-7 shrink-0 place-items-center rounded-sm text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-primary"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                      <AvatarStack profiles={assignees} max={3} size="sm" />
                      <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-tertiary">
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
          <EmptyState
            icon={<CheckSquare className="size-4" />}
            title="No tasks match your filters"
            description="Loosen a filter or create your first task to get started."
          />
        )}
      </div>

      <TaskDetailSheet
        task={activeTask}
        open={!!activeTaskId}
        onOpenChange={(o) => !o && setActiveTaskId(null)}
      />
    </>
  )
}
