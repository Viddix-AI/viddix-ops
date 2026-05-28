"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CheckSquare, ChevronRight, Clock, ExternalLink, Plus, Repeat, Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Pill, type PillTone } from "@/components/ui/pill"
import { Button } from "@/components/ui/button"
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
import { useTags, useTaskTags } from "@/hooks/use-tags"
import { useTasks, useUpdateTask } from "@/hooks/use-tasks"
import { relativeDay } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Profile, Tag, Task, TaskPriority } from "@/lib/types"
import { AddTaskDialog } from "./add-task-dialog"
import { TaskDetailSheet } from "./task-detail-sheet"

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
]

// Group-by axis chosen by the user. Each value maps to its own grouping
// function further down; the rendered group labels are derived per-task.
type GroupBy = "due" | "assignee" | "client" | "priority"

const GROUP_BY_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "due",      label: "Group by · Due date" },
  { value: "assignee", label: "Group by · Assignee" },
  { value: "client",   label: "Group by · Client" },
  { value: "priority", label: "Group by · Priority" },
]

// Due-date buckets — kept as a distinct type from GroupBy because their
// ordering matters (overdue is louder than later, urgent louder than low).
type DueBucket = "overdue" | "today" | "week" | "later"

const DUE_BUCKET_LABELS: Record<DueBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "This week",
  later: "Later",
}

const DUE_BUCKET_ORDER: DueBucket[] = ["overdue", "today", "week", "later"]
const PRIORITY_ORDER: TaskPriority[] = ["urgent", "high", "medium", "low"]

// Status filter has its own vocabulary beyond TaskStatus — "open" matches
// any non-done, "overdue" cross-cuts status + due_date.
type StatusFilter = "all" | "open" | "todo" | "in_progress" | "done" | "overdue"

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all",         label: "All statuses" },
  { value: "open",        label: "Open (not done)" },
  { value: "todo",        label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done",        label: "Done" },
  { value: "overdue",     label: "Overdue" },
]

const TAG_TONE_SET = new Set<string>(["slate", "blue", "sky", "indigo", "violet", "emerald", "amber", "rose"])
function tagTone(t: Tag): PillTone {
  return (TAG_TONE_SET.has(t.color) ? t.color : "slate") as PillTone
}

// Filter persistence: URL params win when present (deep-link / back-forward
// preserves filters), localStorage backs them up so a navigation away and
// back inside the app retains the choices.
const FILTERS_KEY = "viddix:tasks-filters"

type Filters = {
  q: string
  status: StatusFilter
  assignee: string
  priority: TaskPriority | ""
  client: string
  lead: string
  tags: string[] // tag ids; OR-match
  group: GroupBy
}

const EMPTY_FILTERS: Filters = {
  q: "",
  status: "all",
  assignee: "",
  priority: "",
  client: "",
  lead: "",
  tags: [],
  group: "due",
}

function filtersFromParams(params: URLSearchParams): Filters {
  const status = params.get("status") as StatusFilter | null
  const priority = params.get("priority") as TaskPriority | null
  const group = params.get("group") as GroupBy | null
  const tagsRaw = params.get("tags")
  return {
    q:        params.get("q") ?? "",
    status:   status && STATUS_FILTERS.some((s) => s.value === status) ? status : "all",
    assignee: params.get("assignee") ?? "",
    priority: priority && PRIORITIES.some((p) => p.value === priority) ? priority : "",
    client:   params.get("client") ?? "",
    lead:     params.get("lead") ?? "",
    tags:     tagsRaw ? tagsRaw.split(",").filter(Boolean) : [],
    group:    group && GROUP_BY_OPTIONS.some((g) => g.value === group) ? group : "due",
  }
}

function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q)                            p.set("q", f.q)
  if (f.status && f.status !== "all") p.set("status", f.status)
  if (f.assignee)                     p.set("assignee", f.assignee)
  if (f.priority)                     p.set("priority", f.priority)
  if (f.client)                       p.set("client", f.client)
  if (f.lead)                         p.set("lead", f.lead)
  if (f.tags.length > 0)              p.set("tags", f.tags.join(","))
  if (f.group && f.group !== "due")   p.set("group", f.group)
  return p
}

function isEmpty(f: Filters): boolean {
  return (
    !f.q && f.status === "all" && !f.assignee && !f.priority &&
    !f.client && !f.lead && f.tags.length === 0 && f.group === "due"
  )
}

export function TasksView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { data: tasks = [] } = useTasks()
  const { data: profiles = [] } = useProfiles()
  const { data: leads = [] } = useLeads()
  const { data: clients = [] } = useClients()
  const { data: events = [] } = useEvents()
  const { data: tags = [] } = useTags()
  const { data: taskTags = [] } = useTaskTags()
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

  // ── Filters ─────────────────────────────────────────────────────────────
  // Initial value: URL params win, fall back to localStorage, then EMPTY.
  // Doing this in a lazy initialiser avoids a flicker on first render.
  const [filters, setFilters] = React.useState<Filters>(() => {
    if (typeof window === "undefined") return EMPTY_FILTERS
    const fromUrl = filtersFromParams(new URLSearchParams(window.location.search))
    if (!isEmpty(fromUrl)) return fromUrl
    try {
      const raw = window.localStorage.getItem(FILTERS_KEY)
      if (raw) return { ...EMPTY_FILTERS, ...(JSON.parse(raw) as Partial<Filters>) }
    } catch {}
    return EMPTY_FILTERS
  })

  // Keep URL + localStorage in sync with the filter state. Replacing (not
  // pushing) so the back button isn't littered with each filter tweak.
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const qs = filtersToParams(filters).toString()
    const next = qs ? `${pathname}?${qs}` : pathname
    if (next !== window.location.pathname + window.location.search) {
      router.replace(next, { scroll: false })
    }
    try {
      if (isEmpty(filters)) window.localStorage.removeItem(FILTERS_KEY)
      else window.localStorage.setItem(FILTERS_KEY, JSON.stringify(filters))
    } catch {}
  }, [filters, pathname, router])

  // External URL changes (browser back/forward, command palette deep link)
  // should win over local state. Bridge via the searchParams hook.
  const urlSnapshot = searchParams.toString()
  const [prevUrlSnapshot, setPrevUrlSnapshot] = React.useState(urlSnapshot)
  if (urlSnapshot !== prevUrlSnapshot) {
    setPrevUrlSnapshot(urlSnapshot)
    const fromUrl = filtersFromParams(new URLSearchParams(urlSnapshot))
    if (JSON.stringify(fromUrl) !== JSON.stringify(filters)) {
      setFilters(fromUrl)
    }
  }

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }))
  }
  function toggleTagFilter(tagId: string) {
    setFilters((f) =>
      f.tags.includes(tagId)
        ? { ...f, tags: f.tags.filter((id) => id !== tagId) }
        : { ...f, tags: [...f.tags, tagId] }
    )
  }
  function resetFilters() {
    setFilters(EMPTY_FILTERS)
  }

  // Tag index — { task_id: Set<tag_id> } for O(1) membership tests.
  const tagsByTask = React.useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const tt of taskTags) {
      const set = m.get(tt.task_id) ?? new Set<string>()
      set.add(tt.tag_id)
      m.set(tt.task_id, set)
    }
    return m
  }, [taskTags])
  const tagById = React.useMemo(() => {
    const m = new Map<string, Tag>()
    for (const t of tags) m.set(t.id, t)
    return m
  }, [tags])

  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set())
  const [addOpen, setAddOpen] = React.useState(false)

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

  const dueBucketOf = React.useCallback(
    (task: Task): DueBucket => {
      if (!task.due_date) return "later"
      const d = new Date(task.due_date)
      d.setHours(0, 0, 0, 0)
      const t = d.getTime()
      if (t < todayMs && task.status !== "done") return "overdue"
      if (t === todayMs) return "today"
      if (t > todayMs && t <= weekEndMs) return "week"
      return "later"
    },
    [todayMs, weekEndMs]
  )

  // Filtering: subtasks (parent_id != null) are excluded from the root
  // listing — they render inline under their parent when expanded.
  // Everything else is in-memory client-side; the contract of `filtered`
  // doesn't change if we later push filters server-side.
  const todayISO = React.useMemo(() => new Date().toISOString().slice(0, 10), [])
  const needle = filters.q.trim().toLowerCase()
  const filtered = tasks.filter((t) => {
    if (t.parent_id) return false

    // status
    if (filters.status === "open" && t.status === "done") return false
    if (filters.status === "todo" && t.status !== "todo") return false
    if (filters.status === "in_progress" && t.status !== "in_progress") return false
    if (filters.status === "done" && t.status !== "done") return false
    if (filters.status === "overdue") {
      if (t.status === "done") return false
      if (!t.due_date || t.due_date >= todayISO) return false
    }

    if (filters.assignee && !t.assignee_ids.includes(filters.assignee)) return false
    if (filters.priority && t.priority !== filters.priority) return false
    if (filters.client && t.client_id !== filters.client) return false
    if (filters.lead && t.lead_id !== filters.lead) return false

    // Tags: OR-match. A task passes if it carries ANY of the selected tags.
    if (filters.tags.length > 0) {
      const taskTagSet = tagsByTask.get(t.id)
      if (!taskTagSet) return false
      if (!filters.tags.some((id) => taskTagSet.has(id))) return false
    }

    if (needle) {
      const haystack = (
        t.title +
        " " +
        (t.description ?? "")
      ).toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })

  // Group `filtered` by the chosen axis. Output is a list of
  // {key, label, tone, tasks} so the renderer doesn't need to know about each
  // axis's semantics. Empty buckets are dropped before render.
  type RenderedGroup = { key: string; label: string; tone?: "danger"; tasks: Task[] }
  const renderedGroups: RenderedGroup[] = React.useMemo(() => {
    if (filters.group === "due") {
      const m: Record<DueBucket, Task[]> = { overdue: [], today: [], week: [], later: [] }
      for (const t of filtered) m[dueBucketOf(t)].push(t)
      return DUE_BUCKET_ORDER.filter((b) => m[b].length > 0).map((b) => ({
        key: b,
        label: DUE_BUCKET_LABELS[b],
        tone: b === "overdue" ? ("danger" as const) : undefined,
        tasks: m[b],
      }))
    }
    if (filters.group === "priority") {
      const m = new Map<TaskPriority, Task[]>()
      for (const t of filtered) {
        const arr = m.get(t.priority) ?? []
        arr.push(t)
        m.set(t.priority, arr)
      }
      return PRIORITY_ORDER.filter((p) => (m.get(p)?.length ?? 0) > 0).map((p) => ({
        key: p,
        label: `${p[0].toUpperCase()}${p.slice(1)} priority`,
        tasks: m.get(p) ?? [],
      }))
    }
    if (filters.group === "assignee") {
      // One bucket per profile that has at least one task in the filtered set,
      // plus a trailing "Unassigned" bucket if any rows have no assignees.
      const m = new Map<string, Task[]>()
      const unassigned: Task[] = []
      for (const t of filtered) {
        if (t.assignee_ids.length === 0) {
          unassigned.push(t)
          continue
        }
        // A task with multiple assignees shows up in each of their buckets.
        for (const id of t.assignee_ids) {
          const arr = m.get(id) ?? []
          arr.push(t)
          m.set(id, arr)
        }
      }
      const named: RenderedGroup[] = profiles
        .filter((p) => m.has(p.id))
        .map((p) => ({ key: `a:${p.id}`, label: p.full_name, tasks: m.get(p.id) ?? [] }))
      if (unassigned.length > 0) {
        named.push({ key: "a:none", label: "Unassigned", tasks: unassigned })
      }
      return named
    }
    // "client"
    const m = new Map<string, Task[]>()
    const noClient: Task[] = []
    for (const t of filtered) {
      if (!t.client_id) noClient.push(t)
      else {
        const arr = m.get(t.client_id) ?? []
        arr.push(t)
        m.set(t.client_id, arr)
      }
    }
    const named: RenderedGroup[] = (clients ?? [])
      .filter((c) => m.has(c.id))
      .map((c) => ({ key: `c:${c.id}`, label: c.name, tasks: m.get(c.id) ?? [] }))
    if (noClient.length > 0) {
      named.push({ key: "c:none", label: "No client", tasks: noClient })
    }
    return named
  }, [filtered, filters.group, profiles, clients, dueBucketOf])

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
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus />
            New task
          </Button>
        }
      />

      <div className="space-y-6 px-4 py-5 lg:px-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-text-tertiary" />
              <Input
                value={filters.q}
                onChange={(e) => set("q", e.target.value)}
                placeholder="Search tasks…"
                className="h-8 pl-8"
              />
            </div>
            <FilterSelect
              value={filters.status}
              onChange={(v) => set("status", v as StatusFilter)}
              placeholder="All statuses"
              options={STATUS_FILTERS}
            />
            <FilterSelect
              value={filters.assignee}
              onChange={(v) => set("assignee", v)}
              placeholder="All assignees"
              options={[
                { value: "", label: "All assignees" },
                ...profiles.map((p) => ({ value: p.id, label: p.full_name })),
              ]}
            />
            <FilterSelect
              value={filters.priority}
              onChange={(v) => set("priority", v as TaskPriority | "")}
              placeholder="All priorities"
              options={[
                { value: "", label: "All priorities" },
                ...PRIORITIES.map((p) => ({ value: p.value, label: p.label })),
              ]}
            />
            <FilterSelect
              value={filters.client}
              onChange={(v) => set("client", v)}
              placeholder="All clients"
              options={[
                { value: "", label: "All clients" },
                ...clients.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <FilterSelect
              value={filters.lead}
              onChange={(v) => set("lead", v)}
              placeholder="All leads"
              options={[
                { value: "", label: "All leads" },
                ...leads.map((l) => ({ value: l.id, label: l.name })),
              ]}
            />
            <FilterSelect
              value={filters.group}
              onChange={(v) => set("group", (v || "due") as GroupBy)}
              placeholder="Group by"
              options={GROUP_BY_OPTIONS.map((g) => ({ value: g.value, label: g.label }))}
            />
            {!isEmpty(filters) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="text-text-tertiary"
              >
                <X />
                Reset
              </Button>
            )}
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                Tags
              </span>
              {tags.map((t) => {
                const active = filters.tags.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTagFilter(t.id)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-full transition-opacity",
                      !active && "opacity-60 hover:opacity-100"
                    )}
                  >
                    <Pill tone={tagTone(t)} size="sm">
                      {t.name}
                    </Pill>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {renderedGroups.map((g) => {
          return (
            <section key={g.key}>
              <h3
                className={cn(
                  "mb-2 font-mono text-[11px] uppercase tracking-[0.18em]",
                  g.tone === "danger" ? "text-destructive" : "text-text-tertiary"
                )}
              >
                {g.label} · {g.tasks.length}
              </h3>
              <ul className="divide-y divide-border-subtle rounded-[var(--radius-lg)] border border-border-subtle bg-card">
                {g.tasks.map((task) => (
                  <TaskRow
                    key={`${g.key}:${task.id}`}
                    task={task}
                    profiles={profiles}
                    leads={leads}
                    clients={clients}
                    pairedTaskIds={pairedTaskIds}
                    subtaskMap={subtaskMap}
                    tagsByTask={tagsByTask}
                    tagById={tagById}
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
      <AddTaskDialog open={addOpen} onOpenChange={setAddOpen} />
    </>
  )
}

/**
 * Compact filter <Select> used in the toolbar. Takes a sentinel "" value to
 * mean "no filter" (Base-UI Select can't accept "" as an item value, so we
 * map it through a private NONE constant on its way in/out).
 */
const NONE = "__none__"
function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: { value: string; label: string }[]
}) {
  return (
    <Select
      value={value === "" ? NONE : value}
      onValueChange={(v) => onChange(!v || v === NONE ? "" : v)}
    >
      <SelectTrigger size="sm" className="min-w-[140px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value || NONE} value={o.value === "" ? NONE : o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
  tagsByTask,
  tagById,
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
  tagsByTask: Map<string, Set<string>>
  tagById: Map<string, Tag>
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
  const ownTags = Array.from(tagsByTask.get(task.id) ?? [])
    .map((id) => tagById.get(id))
    .filter((t): t is Tag => Boolean(t))
  const visibleTags = ownTags.slice(0, 3)
  const extraTagCount = Math.max(0, ownTags.length - visibleTags.length)

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
            {visibleTags.length > 0 && (
              <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                {visibleTags.map((t) => (
                  <Pill key={t.id} tone={tagTone(t)} size="sm">
                    {t.name}
                  </Pill>
                ))}
                {extraTagCount > 0 && (
                  <span className="text-[10px] font-medium text-text-tertiary">
                    +{extraTagCount}
                  </span>
                )}
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
            tagsByTask={tagsByTask}
            tagById={tagById}
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
