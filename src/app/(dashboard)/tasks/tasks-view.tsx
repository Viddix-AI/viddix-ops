"use client"

import * as React from "react"
import { CheckSquare, ChevronRight, Clock, ExternalLink, Repeat } from "lucide-react"

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
import { useClients } from "@/hooks/use-clients"
import { useEvents } from "@/hooks/use-events"
import { useLeads } from "@/hooks/use-leads"
import { useProfiles } from "@/hooks/use-profile"
import { useTasks, useUpdateTask } from "@/hooks/use-tasks"
import { relativeDay } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Profile, Task, TaskPriority } from "@/lib/types"
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
  const { data: leads = [] } = useLeads()
  const { data: clients = [] } = useClients()
  const { data: events = [] } = useEvents()
  const update = useUpdateTask()

  const pairedTaskIds = React.useMemo(
    () => new Set(events.filter((e) => e.task_id).map((e) => e.task_id!)),
    [events]
  )

  // Subtask index — { parent_id: [children...] } so the row renderer can do
  // an O(1) lookup instead of filtering tasks on each draw.
  const subtaskMap = React.useMemo(() => {
    const m = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!t.parent_id) continue
      const arr = m.get(t.parent_id) ?? []
      arr.push(t)
      m.set(t.parent_id, arr)
    }
    return m
  }, [tasks])

  const [filterAssignee, setFilterAssignee] = React.useState("")
  const [filterPriority, setFilterPriority] = React.useState<TaskPriority | "">("")
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set())

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
  // Subtasks (parent_id != null) are excluded from the root listing — they
  // render inline under their parent when expanded.
  const filtered = tasks.filter((t) => {
    if (t.parent_id) return false
    if (filterAssignee && !t.assignee_ids.includes(filterAssignee)) return false
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
                  "mb-2 font-mono text-[11px] uppercase tracking-[0.18em]",
                  group === "overdue" ? "text-destructive" : "text-text-tertiary"
                )}
              >
                {GROUP_LABELS[group]} · {items.length}
              </h3>
              <ul className="divide-y divide-border-subtle rounded-[var(--radius-lg)] border border-border-subtle bg-card">
                {items.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    profiles={profiles}
                    leads={leads}
                    clients={clients}
                    pairedTaskIds={pairedTaskIds}
                    subtaskMap={subtaskMap}
                    expanded={expanded}
                    onToggleExpand={toggleExpand}
                    onToggleDone={toggleDone}
                    onOpen={setActiveTaskId}
                  />
                ))}
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

/**
 * One row in the tasks list. Subtasks are rendered inline-indented under
 * their parent when the parent is expanded. Recurrence and tracked-time are
 * surfaced as compact badges next to the title; expand chevron only appears
 * when the row has children.
 */
function TaskRow({
  task,
  profiles,
  leads,
  clients,
  pairedTaskIds,
  subtaskMap,
  expanded,
  onToggleExpand,
  onToggleDone,
  onOpen,
  depth = 0,
}: {
  task: Task
  profiles: Profile[]
  leads: ReturnType<typeof useLeads>["data"]
  clients: ReturnType<typeof useClients>["data"]
  pairedTaskIds: Set<string>
  subtaskMap: Map<string, Task[]>
  expanded: Set<string>
  onToggleExpand: (id: string) => void
  onToggleDone: (task: Task) => void
  onOpen: (id: string) => void
  depth?: number
}) {
  const assignees = task.assignee_ids
    .map((id) => profiles.find((p) => p.id === id))
    .filter((p): p is Profile => Boolean(p))
  const linkedLead = task.lead_id ? leads?.find((l) => l.id === task.lead_id) ?? null : null
  const linkedClient = task.client_id ? clients?.find((c) => c.id === task.client_id) ?? null : null
  const children = subtaskMap.get(task.id) ?? []
  const hasChildren = children.length > 0
  const isExpanded = expanded.has(task.id)
  const tracked = task.tracked_minutes ?? 0

  return (
    <>
      <li
        onClick={() => onOpen(task.id)}
        className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-3/60"
        style={{ paddingLeft: depth ? `${depth * 24 + 12}px` : undefined }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand(task.id)
            }}
            aria-label={isExpanded ? "Collapse subtasks" : "Expand subtasks"}
            className="grid size-5 shrink-0 place-items-center rounded text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-primary"
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform",
                isExpanded && "rotate-90"
              )}
            />
          </button>
        ) : (
          <span className="inline-block size-5 shrink-0" aria-hidden />
        )}
        <input
          type="checkbox"
          checked={task.status === "done"}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggleDone(task)}
          className="size-4 shrink-0 cursor-pointer accent-primary"
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-sm font-medium text-text-primary",
              task.status === "done" && "text-text-tertiary line-through"
            )}
          >
            {pairedTaskIds.has(task.id) && (
              <Clock
                className="mr-1 inline size-3 align-text-bottom text-muted-foreground"
                aria-label="From the calendar"
              />
            )}
            {task.title}
            {task.recurrence !== "none" && (
              <span
                className="ml-1.5 inline-flex items-center gap-0.5 align-middle font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary"
                title={`Recurs ${task.recurrence}`}
              >
                <Repeat className="size-2.5" />
                {task.recurrence}
              </span>
            )}
            {tracked > 0 && (
              <span
                className="ml-2 font-mono text-[11px] tabular-nums text-text-tertiary"
                title="Tracked time"
              >
                {tracked >= 60
                  ? `${Math.floor(tracked / 60)}h ${tracked % 60}m`
                  : `${tracked}m`}
              </span>
            )}
          </p>
          {(linkedLead || linkedClient) && (
            <p className="mt-0.5 truncate text-[11px] text-text-tertiary">
              {linkedLead && (
                <span>
                  Lead ·{" "}
                  <span className="text-text-secondary">{linkedLead.name}</span>
                </span>
              )}
              {linkedLead && linkedClient && <span className="mx-1.5">·</span>}
              {linkedClient && (
                <span>
                  Client ·{" "}
                  <span className="text-text-secondary">{linkedClient.name}</span>
                </span>
              )}
            </p>
          )}
        </div>
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
        <span className="flex w-20 shrink-0 flex-col items-end font-mono text-[11px] tabular-nums text-text-tertiary">
          <span>{relativeDay(task.due_date)}</span>
          {task.due_time && (
            <span className="text-text-secondary">{task.due_time}</span>
          )}
        </span>
      </li>
      {isExpanded &&
        children.map((c) => (
          <TaskRow
            key={c.id}
            task={c}
            profiles={profiles}
            leads={leads}
            clients={clients}
            pairedTaskIds={pairedTaskIds}
            subtaskMap={subtaskMap}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
            onToggleDone={onToggleDone}
            onOpen={onOpen}
            depth={depth + 1}
          />
        ))}
    </>
  )
}
