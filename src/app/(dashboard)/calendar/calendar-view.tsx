"use client"

import * as React from "react"
import Link from "next/link"
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Calendar as MiniCalendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { useClients } from "@/hooks/use-clients"
import { useEvents, useUpdateEvent } from "@/hooks/use-events"
import { useLeads } from "@/hooks/use-leads"
import { useTasks, useUpdateTask } from "@/hooks/use-tasks"
import { downloadFile } from "@/lib/csv"
import { buildIcs, googleCalendarUrl, type IcsItem } from "@/lib/ics"
import { isoDay } from "@/lib/time-grid-math"
import { cn } from "@/lib/utils"
import { AddEventDialog } from "./add-event-dialog"
import { TimeGrid } from "./time-grid"
import { TaskDetailSheet } from "../tasks/task-detail-sheet"

// ─────────────────────────────────────────────────────────────────────────
// Shared bucketing — events + tasks grouped by ISO day key
// ─────────────────────────────────────────────────────────────────────────

type Item =
  | {
      kind: "event"
      id: string
      title: string
      /** "HH:MM" for chronological sort + display */
      time: string
      sub: string
      tone: string
      href: string | null
      gcalUrl: string
      task_id: string | null
    }
  | {
      kind: "task"
      id: string
      title: string
      time: string
      sub: string
      tone: string
      href: string | null
      gcalUrl: string | null
    }

const TONE_EVENT = "bg-primary"
const TONE_TASK_OPEN = "bg-amber-500"
const TONE_TASK_DONE = "bg-emerald-500"

function startOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1)
  x.setHours(0, 0, 0, 0)
  return x
}
function startOfWeekMonday(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  return x
}
function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

type CalendarView = "month" | "week" | "day" | "agenda"

// ─────────────────────────────────────────────────────────────────────────
// Main view — holds cursor + view state, fans out to one of four panels
// ─────────────────────────────────────────────────────────────────────────

export function CalendarView() {
  const { data: events = [] } = useEvents()
  const { data: tasks = [] } = useTasks()
  const { data: clients = [] } = useClients()
  const { data: leads = [] } = useLeads()
  const updateEvent = useUpdateEvent()
  const updateTask = useUpdateTask()

  const [view, setView] = React.useState<CalendarView>("month")
  const [cursor, setCursor] = React.useState(() => startOfDay(new Date()))
  const [addOpen, setAddOpen] = React.useState(false)
  const [addDate, setAddDate] = React.useState<string | null>(null)
  const [addTime, setAddTime] = React.useState<string | null>(null)
  const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null)
  const today = React.useMemo(() => startOfDay(new Date()), [])

  function openCreate(date?: string, time?: string) {
    setAddDate(date ?? null)
    setAddTime(time ?? null)
    setAddOpen(true)
  }

  // Bucket all events + tasks by ISO day key — used by every view + the
  // sidebar's today panel. Tasks paired with an event are skipped here: the
  // event already represents the meeting on the calendar; the shadow task
  // only exists to surface the meeting in /tasks.
  const pairedTaskIds = React.useMemo(
    () => new Set(events.map((e) => e.task_id).filter((id): id is string => !!id)),
    [events]
  )
  const buckets = React.useMemo(() => {
    const map = new Map<string, Item[]>()
    const push = (k: string, item: Item) => {
      const list = map.get(k) ?? []
      list.push(item)
      map.set(k, list)
    }

    for (const e of events) {
      const d = new Date(e.start_at)
      const key = isoDay(d)
      const client = clients.find((c) => c.id === e.client_id)
      const lead = leads.find((l) => l.id === e.lead_id)
      push(key, {
        kind: "event",
        id: e.id,
        title: e.title,
        time: d.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
        sub: client?.name ?? lead?.name ?? e.event_type,
        tone: TONE_EVENT,
        href: client ? `/clients/${client.id}` : lead ? `/leads` : null,
        gcalUrl: googleCalendarUrl({
          title: e.title,
          startISO: e.start_at,
          endISO: e.end_at,
          description: e.description,
        }),
        task_id: e.task_id,
      })
    }
    for (const t of tasks) {
      if (!t.due_date) continue
      if (pairedTaskIds.has(t.id)) continue
      const client = clients.find((c) => c.id === t.client_id)
      const lead = leads.find((l) => l.id === t.lead_id)
      push(t.due_date, {
        kind: "task",
        id: t.id,
        title: t.title,
        time: "due",
        sub: client?.name ?? lead?.name ?? "task",
        tone: t.status === "done" ? TONE_TASK_DONE : TONE_TASK_OPEN,
        href: client ? `/clients/${client.id}` : null,
        gcalUrl: null,
      })
    }

    // Events come first per day (have real times); tasks land below.
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "event" ? -1 : 1
        return a.time.localeCompare(b.time)
      })
    }
    return map
  }, [events, tasks, clients, leads, pairedTaskIds])

  // ── Header navigation per view ──────────────────────────────────────────
  function navPrev() {
    if (view === "month") {
      setCursor((c) => startOfMonth(new Date(c.getFullYear(), c.getMonth() - 1, 1)))
    } else if (view === "week") {
      setCursor((c) => addDays(c, -7))
    } else if (view === "day") {
      setCursor((c) => addDays(c, -1))
    }
    // Agenda view has no prev/next — it's anchored on today.
  }
  function navNext() {
    if (view === "month") {
      setCursor((c) => startOfMonth(new Date(c.getFullYear(), c.getMonth() + 1, 1)))
    } else if (view === "week") {
      setCursor((c) => addDays(c, 7))
    } else if (view === "day") {
      setCursor((c) => addDays(c, 1))
    }
  }
  function navToday() {
    setCursor(startOfDay(new Date()))
  }

  const headerLabel = React.useMemo(() => {
    if (view === "month") {
      return cursor.toLocaleString("en-US", { month: "long", year: "numeric" })
    }
    if (view === "week") {
      const start = startOfWeekMonday(cursor)
      const end = addDays(start, 6)
      const sameMonth = start.getMonth() === end.getMonth()
      return sameMonth
        ? `${start.toLocaleString("en-US", { month: "long" })} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`
        : `${start.toLocaleString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    }
    if (view === "day") {
      return cursor.toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    }
    return "Upcoming"
  }, [view, cursor])

  // Totals — shown in the description line of the page header. Month view
  // uses the month-grid range, others use the visible range of the view.
  const visibleCount = React.useMemo(() => {
    let evCount = 0
    let tkCount = 0
    let rangeStart: Date
    let rangeEnd: Date
    if (view === "month") {
      rangeStart = startOfWeekMonday(startOfMonth(cursor))
      rangeEnd = addDays(rangeStart, 41)
    } else if (view === "week") {
      rangeStart = startOfWeekMonday(cursor)
      rangeEnd = addDays(rangeStart, 6)
    } else if (view === "day") {
      rangeStart = startOfDay(cursor)
      rangeEnd = rangeStart
    } else {
      rangeStart = today
      rangeEnd = addDays(today, 30)
    }
    for (
      let d = new Date(rangeStart);
      d.getTime() <= rangeEnd.getTime();
      d.setDate(d.getDate() + 1)
    ) {
      const items = buckets.get(isoDay(d)) ?? []
      for (const it of items) {
        if (it.kind === "event") evCount++
        else tkCount++
      }
    }
    return { events: evCount, tasks: tkCount }
  }, [view, cursor, buckets, today])

  return (
    <>
      <PageHeader
        eyebrow="HOLDING · SCHEDULE"
        title="Calendar"
        description={`${visibleCount.events} events · ${visibleCount.tasks} tasks visible`}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => openCreate()}>
              <Plus />
              New event
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const items: IcsItem[] = [
                  ...events.map((e) => ({ kind: "event" as const, event: e })),
                  ...tasks.map((t) => ({ kind: "task" as const, task: t })),
                ]
                const ics = buildIcs(items)
                downloadFile(
                  `viddix-calendar-${new Date().toISOString().slice(0, 10)}.ics`,
                  ics,
                  "text/calendar;charset=utf-8"
                )
                toast.success(
                  `Exported ${events.length} events + ${tasks.filter((t) => t.due_date).length} tasks`
                )
              }}
            >
              <Download />
              Export .ics
            </Button>
          </div>
        }
      />

      <div className="space-y-4 px-4 py-5 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              {headerLabel}
            </h2>
            {view !== "agenda" && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={navPrev}
                  aria-label="Previous"
                >
                  <ChevronLeft />
                </Button>
                <Button variant="outline" size="sm" onClick={navToday}>
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={navNext}
                  aria-label="Next"
                >
                  <ChevronRight />
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ViewSwitcher value={view} onChange={setView} />
            <Legend />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="min-w-0">
            {view === "month" && (
              <MonthView
                cursor={cursor}
                today={today}
                buckets={buckets}
                onCreateAt={openCreate}
                onOpenTask={setSelectedTaskId}
              />
            )}
            {view === "week" && (
              <TimeGrid
                days={Array.from({ length: 7 }, (_, i) =>
                  addDays(startOfWeekMonday(cursor), i)
                )}
                events={events}
                tasks={tasks}
                onCreateAt={openCreate}
                onUpdateEvent={(id, patch) =>
                  updateEvent.mutate({ id, patch })
                }
                onUpdateTask={(id, patch) =>
                  updateTask.mutate({ id, patch })
                }
                onSelectItem={(it) => {
                  if (it.kind === "event" && it.event.task_id) {
                    setSelectedTaskId(it.event.task_id)
                  } else if (it.kind === "task") {
                    setSelectedTaskId(it.task.id)
                  }
                }}
              />
            )}
            {view === "day" && (
              <TimeGrid
                days={[cursor]}
                events={events}
                tasks={tasks}
                onCreateAt={openCreate}
                onUpdateEvent={(id, patch) =>
                  updateEvent.mutate({ id, patch })
                }
                onUpdateTask={(id, patch) =>
                  updateTask.mutate({ id, patch })
                }
                onSelectItem={(it) => {
                  if (it.kind === "event" && it.event.task_id) {
                    setSelectedTaskId(it.event.task_id)
                  } else if (it.kind === "task") {
                    setSelectedTaskId(it.task.id)
                  }
                }}
              />
            )}
            {view === "agenda" && (
              <AgendaView
                today={today}
                buckets={buckets}
                onCreateAt={openCreate}
                onOpenTask={setSelectedTaskId}
              />
            )}
          </div>

          <aside className="space-y-4">
            <Card>
              <CardContent className="py-2">
                <MiniCalendar
                  mode="single"
                  selected={cursor}
                  onSelect={(d) => {
                    if (!d) return
                    setCursor(startOfDay(d))
                    // Jumping from the mini calendar feels like "show me this
                    // day". Switch to day view unless the user is already on
                    // week — week likes to keep its weekly context.
                    if (view !== "week" && view !== "month") setView("day")
                  }}
                  month={cursor}
                  onMonthChange={(d) => setCursor(startOfDay(d))}
                  className="w-full p-0"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Today&apos;s agenda</CardTitle>
              </CardHeader>
              <CardContent>
                <TodayAgenda
                  items={buckets.get(isoDay(today)) ?? []}
                  onAdd={() => openCreate(isoDay(today))}
                  onOpenTask={setSelectedTaskId}
                />
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      <AddEventDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultDate={addDate}
        defaultTime={addTime}
      />
      <TaskDetailSheet
        task={tasks.find((t) => t.id === selectedTaskId) ?? null}
        open={selectedTaskId !== null}
        onOpenChange={(o) => { if (!o) setSelectedTaskId(null) }}
      />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// View switcher (segmented control)
// ─────────────────────────────────────────────────────────────────────────

function ViewSwitcher({
  value,
  onChange,
}: {
  value: CalendarView
  onChange: (v: CalendarView) => void
}) {
  const VIEWS: { id: CalendarView; label: string }[] = [
    { id: "month", label: "Month" },
    { id: "week", label: "Week" },
    { id: "day", label: "Day" },
    { id: "agenda", label: "Agenda" },
  ]
  return (
    <div
      role="tablist"
      aria-label="Calendar view"
      className="inline-flex rounded-md border border-border bg-card p-0.5 shadow-sm"
    >
      {VIEWS.map((v) => {
        const active = v.id === value
        return (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v.id)}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {v.label}
          </button>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Month view
// ─────────────────────────────────────────────────────────────────────────

function MonthView({
  cursor,
  today,
  buckets,
  onCreateAt,
  onOpenTask,
}: {
  cursor: Date
  today: Date
  buckets: Map<string, Item[]>
  onCreateAt: (date: string) => void
  onOpenTask: (taskId: string) => void
}) {
  const gridStart = React.useMemo(
    () => startOfWeekMonday(startOfMonth(cursor)),
    [cursor]
  )
  const days = React.useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)),
    [gridStart]
  )

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-border shadow-sm">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-1.5">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const key = isoDay(d)
          const inMonth = d.getMonth() === cursor.getMonth()
          const isToday = d.getTime() === today.getTime()
          const items = buckets.get(key) ?? []
          return (
            <div
              key={i}
              className={cn(
                "group/cell relative min-h-[110px] border-b border-r border-border p-1.5 text-xs last:border-r-0",
                !inMonth && "bg-muted/30 text-muted-foreground/70",
                (i + 1) % 7 === 0 && "border-r-0"
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    "inline-grid size-5 place-items-center rounded-full text-[11px] font-medium",
                    isToday && "bg-primary text-primary-foreground"
                  )}
                >
                  {d.getDate()}
                </span>
                <div className="flex items-center gap-1">
                  {items.length > 3 && (
                    <span className="text-[10px] font-medium text-muted-foreground">
                      +{items.length - 3}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onCreateAt(key)}
                    className="invisible inline-grid size-5 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground group-hover/cell:visible"
                    aria-label={`Add event on ${key}`}
                    title="Add event"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
              </div>
              <ul className="space-y-1">
                {items.slice(0, 3).map((it) => (
                  <ItemRow key={`${it.kind}-${it.id}`} item={it} compact onOpenTask={onOpenTask} />
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Agenda view — chronological forward-only list grouped by day
// ─────────────────────────────────────────────────────────────────────────

function AgendaView({
  today,
  buckets,
  onCreateAt,
  onOpenTask,
}: {
  today: Date
  buckets: Map<string, Item[]>
  onCreateAt: (date: string) => void
  onOpenTask: (taskId: string) => void
}) {
  // Walk 30 days forward, keep only days that have any items.
  const groups = React.useMemo(() => {
    const out: { date: Date; key: string; items: Item[] }[] = []
    for (let i = 0; i < 30; i++) {
      const d = addDays(today, i)
      const key = isoDay(d)
      const items = buckets.get(key) ?? []
      if (items.length === 0) continue
      out.push({ date: d, key, items })
    }
    return out
  }, [today, buckets])

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <EmptyState
            size="sm"
            title="Nothing on the agenda"
            description="No events or tasks in the next 30 days."
            action={
              <Button size="sm" onClick={() => onCreateAt(isoDay(today))}>
                <Plus />
                Add event
              </Button>
            }
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const isToday = g.date.getTime() === today.getTime()
        return (
          <section key={g.key}>
            <div className="mb-2 flex items-baseline gap-2">
              <p
                className={cn(
                  "text-sm font-semibold tracking-tight",
                  isToday ? "text-primary" : "text-foreground"
                )}
              >
                {isToday
                  ? "Today"
                  : g.date.toLocaleString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
              </p>
              <span className="text-[11px] font-medium text-muted-foreground">
                {g.items.length} item{g.items.length === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="space-y-1.5 rounded-xl bg-card p-2 ring-1 ring-border">
              {g.items.map((it) => (
                <ItemRow key={`${it.kind}-${it.id}`} item={it} expanded onOpenTask={onOpenTask} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Sidebar — Today's agenda summary
// ─────────────────────────────────────────────────────────────────────────

function TodayAgenda({
  items,
  onAdd,
  onOpenTask,
}: {
  items: Item[]
  onAdd: () => void
  onOpenTask: (taskId: string) => void
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        size="sm"
        title="Nothing today"
        description="Nada agendado hoy."
        action={
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus />
            Add event
          </Button>
        }
      />
    )
  }
  return (
    <ul className="space-y-1.5">
      {items.map((it) => (
        <ItemRow key={`${it.kind}-${it.id}`} item={it} expanded onOpenTask={onOpenTask} />
      ))}
    </ul>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// ItemRow — single event/task row, density variants
// ─────────────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  compact,
  expanded,
  onOpenTask,
}: {
  item: Item
  /** Tight, single-line layout for the month grid cells. */
  compact?: boolean
  /** Two-line layout with bigger title — week/day/agenda views. */
  expanded?: boolean
  onOpenTask: (taskId: string) => void
}) {
  const inner = (
    <div
      className={cn(
        "flex items-start gap-1.5 truncate transition-colors",
        compact && "rounded-sm px-1 py-0.5 hover:bg-muted",
        expanded && "rounded-md px-2 py-1.5 hover:bg-muted/60",
        !compact && !expanded && "rounded-sm px-1 py-0.5 hover:bg-muted"
      )}
    >
      <span
        className={cn(
          "mt-1 size-1.5 shrink-0 rounded-full",
          item.tone
        )}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate font-medium",
            compact ? "text-xs" : "text-sm"
          )}
        >
          {item.title}
        </p>
        <p
          className={cn(
            "truncate font-medium text-muted-foreground",
            compact ? "text-[10px]" : "text-[11px]"
          )}
        >
          {item.time} · {item.sub}
        </p>
      </div>
      {item.gcalUrl && (
        <a
          href={item.gcalUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Add to Google Calendar"
          className="ml-auto inline-grid size-5 shrink-0 place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <CalendarPlus className="size-3" />
        </a>
      )}
    </div>
  )
  return (
    <li>
      {item.kind === "event" && item.task_id ? (
        <button
          type="button"
          className="block w-full text-left"
          onClick={() => onOpenTask(item.task_id!)}
        >
          {inner}
        </button>
      ) : item.href ? (
        <Link href={item.href} className="block">
          {inner}
        </Link>
      ) : (
        <div>{inner}</div>
      )}
    </li>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Legend
// ─────────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="hidden items-center gap-3 text-[11px] font-medium text-muted-foreground sm:flex">
      <span className="inline-flex items-center gap-1.5">
        <span className={cn("size-2 rounded-full", TONE_EVENT)} /> Event
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className={cn("size-2 rounded-full", TONE_TASK_OPEN)} /> Task due
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className={cn("size-2 rounded-full", TONE_TASK_DONE)} /> Task done
      </span>
    </div>
  )
}
