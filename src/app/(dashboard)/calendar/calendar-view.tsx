"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarPlus, ChevronLeft, ChevronRight, Download, Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/dashboard/page-header"
import { useEvents } from "@/hooks/use-events"
import { useTasks } from "@/hooks/use-tasks"
import { useClients } from "@/hooks/use-clients"
import { useLeads } from "@/hooks/use-leads"
import { downloadFile } from "@/lib/csv"
import { buildIcs, googleCalendarUrl, type IcsItem } from "@/lib/ics"
import { cn } from "@/lib/utils"
import { AddEventDialog } from "./add-event-dialog"

type Item =
  | {
      kind: "event"
      id: string
      title: string
      time: string
      sub: string
      tone: string
      href: string | null
      gcalUrl: string
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

const TONE_EVENT = "bg-blue-500"
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
  const day = (x.getDay() + 6) % 7 // 0..6 with Monday = 0
  x.setDate(x.getDate() - day)
  return x
}
function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
function isoDay(d: Date) {
  return d.toISOString().slice(0, 10)
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export function CalendarView() {
  const { data: events = [] } = useEvents()
  const { data: tasks = [] } = useTasks()
  const { data: clients = [] } = useClients()
  const { data: leads = [] } = useLeads()

  const [cursor, setCursor] = React.useState(() => startOfMonth(new Date()))
  const [addOpen, setAddOpen] = React.useState(false)
  const [addDate, setAddDate] = React.useState<string | null>(null)
  const today = React.useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])

  function openCreate(date?: string) {
    setAddDate(date ?? null)
    setAddOpen(true)
  }

  // Build a 6-week (42-day) grid starting on the Monday of the week that
  // contains the 1st of the visible month.
  const gridStart = startOfWeekMonday(cursor)
  const days = React.useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)),
    [gridStart]
  )

  // Pre-bucket events + tasks by ISO day for O(1) lookup per cell.
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
        time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        sub: client?.name ?? lead?.name ?? e.event_type,
        tone: TONE_EVENT,
        href: client ? `/clients/${client.id}` : lead ? `/leads` : null,
        gcalUrl: googleCalendarUrl({
          title: e.title,
          startISO: e.start_at,
          endISO: e.end_at,
          description: e.description,
        }),
      })
    }

    for (const t of tasks) {
      if (!t.due_date) continue
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
        // VTODO Google quick-add isn't a thing; skip the GCal link for tasks.
        gcalUrl: null,
      })
    }

    // Sort each day chronologically (events come with real times; tasks first
    // because we use "due" as the time string — push them to the bottom).
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "event" ? -1 : 1
        return a.time.localeCompare(b.time)
      })
    }
    return map
  }, [events, tasks, clients, leads])

  const monthLabel = cursor.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  })

  const totalEvents = days.reduce((s, d) => {
    const items = buckets.get(isoDay(d)) ?? []
    return s + items.filter((i) => i.kind === "event").length
  }, 0)
  const totalTasks = days.reduce((s, d) => {
    const items = buckets.get(isoDay(d)) ?? []
    return s + items.filter((i) => i.kind === "task").length
  }, 0)

  return (
    <>
      <PageHeader
        title="Calendar"
        description={`${totalEvents} events · ${totalTasks} tasks visible this month`}
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
                toast.success(`Exported ${events.length} events + ${tasks.filter((t) => t.due_date).length} tasks`)
              }}
            >
              <Download />
              Export .ics
            </Button>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCursor(
                    startOfMonth(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
                  )
                }
                aria-label="Previous month"
              >
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCursor(
                    startOfMonth(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
                  )
                }
                aria-label="Next month"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        }
      />

      <div className="space-y-3 px-4 py-5 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold tracking-tight">{monthLabel}</h2>
          <Legend />
        </div>

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
                        isToday && "bg-foreground text-background"
                      )}
                    >
                      {d.getDate()}
                    </span>
                    <div className="flex items-center gap-1">
                      {items.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{items.length - 3}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => openCreate(key)}
                        className="invisible inline-grid size-5 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground group-hover/cell:visible"
                        aria-label={`Add event on ${key}`}
                        title="Add event"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                  </div>
                  <ul className="space-y-1">
                    {items.slice(0, 3).map((it) => {
                      const inner = (
                        <div className="flex items-start gap-1 truncate">
                          <span className={cn("mt-1 size-1.5 shrink-0 rounded-full", it.tone)} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{it.title}</p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {it.time} · {it.sub}
                            </p>
                          </div>
                          {it.gcalUrl && (
                            <a
                              href={it.gcalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Add to Google Calendar"
                              className="ml-auto inline-grid size-4 shrink-0 place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
                            >
                              <CalendarPlus className="size-3" />
                            </a>
                          )}
                        </div>
                      )
                      return (
                        <li key={`${it.kind}-${it.id}`}>
                          {it.href ? (
                            <Link
                              href={it.href}
                              className="block rounded-sm px-1 py-0.5 hover:bg-muted"
                            >
                              {inner}
                            </Link>
                          ) : (
                            <div className="px-1 py-0.5">{inner}</div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Click any day to add an event, or hover and use the + icon. Tasks
          with due dates show up here automatically.
        </p>
      </div>

      <AddEventDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultDate={addDate}
      />
    </>
  )
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
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
