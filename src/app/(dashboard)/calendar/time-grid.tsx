"use client"

// Hourly time-grid for Day and Week calendar views.
//
// Coordinate model lives in src/lib/time-grid-math.ts. This file is the
// orchestrator: it lays out events + timed tasks inside per-day columns,
// renders an all-day lane on top for untimed tasks, and handles drag-to-move
// and drag-to-resize via pointer events captured at the grid root.
//
// The grid is purely presentational; mutations are reported back via the
// onUpdateEvent / onUpdateTask / onCreateAt callbacks. Parents wire those to
// React Query mutations.

import * as React from "react"
import Link from "next/link"

import { Lock } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  END_HOUR,
  ROW_PX,
  SLOT_MIN,
  START_HOUR,
  TOTAL_MIN,
  TOTAL_PX,
  clampMinutes,
  formatHHmm,
  formatHourLabel,
  isoDay,
  layoutDay,
  minutesFromStart,
  parseHHmmToMin,
  pixelToMin,
  snapMinutes,
  topPx,
} from "@/lib/time-grid-math"
import type { Event, Task } from "@/lib/types"

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

export type TimeGridProps = {
  days: Date[]
  events: Event[]
  tasks: Task[]
  /** Open the create-event dialog with date+time pre-filled. */
  onCreateAt: (date: string, time: string) => void
  /** Commit a drag/resize change for an event. */
  onUpdateEvent: (id: string, patch: Partial<Event>) => void
  /** Commit a drag for a timed task (moves due_date/due_time). */
  onUpdateTask: (id: string, patch: Partial<Task>) => void
  /** Optional: clicking a block opens detail. Receives the original Event/Task. */
  onSelectItem?: (item: GridItem) => void
}

export type GridItem =
  | { kind: "event"; id: string; event: Event; dayIdx: number; startMin: number; endMin: number; title: string; subtitle: string | null; href: string | null }
  | { kind: "task";  id: string; task: Task;   dayIdx: number; startMin: number; endMin: number; title: string; subtitle: string | null; href: string | null }

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

const HOUR_LABEL_WIDTH_PX = 56

export function TimeGrid({
  days,
  events,
  tasks,
  onCreateAt,
  onUpdateEvent,
  onUpdateTask,
  onSelectItem,
}: TimeGridProps) {
  const today = React.useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])
  const todayKey = isoDay(today)

  // Bucket items into per-day columns + an all-day list of tasks without
  // due_time. Events without end_at default to 60 min duration. Tasks that
  // are paired with an event are skipped — the event already represents the
  // meeting; the shadow task only exists so it appears in /tasks.
  const { columns, allDayTasks } = React.useMemo(() => {
    const dayKeys = days.map(isoDay)
    const columns: GridItem[][] = days.map(() => [])
    const allDayTasks: { task: Task; dayIdx: number }[] = []
    const pairedTaskIds = new Set(
      events.map((e) => e.task_id).filter((id): id is string => !!id)
    )

    for (const e of events) {
      const start = new Date(e.start_at)
      const key = isoDay(start)
      const dayIdx = dayKeys.indexOf(key)
      if (dayIdx === -1) continue
      const startMin = minutesFromStart(start)
      const endMin = e.end_at
        ? minutesFromStart(new Date(e.end_at))
        : startMin + 60
      if (endMin <= 0 || startMin >= TOTAL_MIN) continue
      columns[dayIdx].push({
        kind: "event",
        id: e.id,
        event: e,
        dayIdx,
        startMin: clampMinutes(startMin),
        endMin: clampMinutes(endMin),
        title: e.title,
        subtitle: e.event_type,
        href: null,
      })
    }

    for (const t of tasks) {
      if (!t.due_date) continue
      if (pairedTaskIds.has(t.id)) continue
      const dayIdx = dayKeys.indexOf(t.due_date)
      if (dayIdx === -1) continue
      const timeMin = parseHHmmToMin(t.due_time)
      if (timeMin === null) {
        allDayTasks.push({ task: t, dayIdx })
        continue
      }
      columns[dayIdx].push({
        kind: "task",
        id: t.id,
        task: t,
        dayIdx,
        startMin: clampMinutes(timeMin),
        endMin: clampMinutes(timeMin + SLOT_MIN),
        title: t.title,
        subtitle: t.status === "done" ? "done" : "task",
        href: null,
      })
    }

    return { columns, allDayTasks }
  }, [days, events, tasks])

  // ── Drag state ─────────────────────────────────────────────────────────
  type Drag = {
    mode: "move" | "resize"
    item: GridItem
    startClientX: number
    startClientY: number
    deltaMin: number
    targetDayIdx: number
  }
  const [drag, setDrag] = React.useState<Drag | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const dayColumnsRef = React.useRef<Array<HTMLDivElement | null>>([])

  function dayIdxFromClientX(clientX: number): number {
    if (!containerRef.current) return drag?.item.dayIdx ?? 0
    for (let i = 0; i < dayColumnsRef.current.length; i++) {
      const el = dayColumnsRef.current[i]
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right) return i
    }
    return drag?.item.dayIdx ?? 0
  }

  function beginDrag(mode: Drag["mode"], item: GridItem, e: React.PointerEvent) {
    if (item.kind === "event" && item.event.cal_booking_id) {
      onSelectItem?.(item)
      return
    }
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDrag({
      mode,
      item,
      startClientX: e.clientX,
      startClientY: e.clientY,
      deltaMin: 0,
      targetDayIdx: item.dayIdx,
    })
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return
    const dyPx = e.clientY - drag.startClientY
    const deltaMin = snapMinutes(pixelToMin(dyPx))
    const targetDayIdx =
      drag.mode === "move" ? dayIdxFromClientX(e.clientX) : drag.item.dayIdx
    if (deltaMin !== drag.deltaMin || targetDayIdx !== drag.targetDayIdx) {
      setDrag({ ...drag, deltaMin, targetDayIdx })
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!drag) return
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
    const { mode, item, deltaMin, targetDayIdx } = drag
    setDrag(null)
    if (deltaMin === 0 && targetDayIdx === item.dayIdx) {
      // No effective movement — treat as a click for selection.
      onSelectItem?.(item)
      return
    }
    if (item.kind === "event") {
      const e0 = item.event
      const baseDay = days[targetDayIdx] ?? days[item.dayIdx]
      if (mode === "move") {
        const newStartMin = clampMinutes(item.startMin + deltaMin)
        const duration = item.endMin - item.startMin
        const newEndMin = newStartMin + duration
        onUpdateEvent(e0.id, {
          start_at: composeISO(baseDay, newStartMin),
          end_at: composeISO(baseDay, newEndMin),
        })
      } else {
        // resize: lock start, push end
        const newEndMin = Math.max(
          item.startMin + SLOT_MIN,
          clampMinutes(item.endMin + deltaMin)
        )
        onUpdateEvent(e0.id, {
          start_at: composeISO(new Date(e0.start_at), minutesFromStart(new Date(e0.start_at))),
          end_at: composeISO(baseDay, newEndMin),
        })
      }
    } else {
      // task — move only
      const baseDay = days[targetDayIdx] ?? days[item.dayIdx]
      const newStartMin = clampMinutes(item.startMin + deltaMin)
      onUpdateTask(item.task.id, {
        due_date: isoDay(baseDay),
        due_time: formatHHmm(newStartMin),
      })
    }
  }

  // Click on empty grid area → create at that slot.
  // Uses `click` instead of `pointerdown` because Base UI dialogs register
  // their outside-click detection on `pointerdown` (capture phase) — opening
  // on the same pointerdown means the dialog dismisses itself instantly. The
  // synthetic `click` event fires after the pointer sequence, by which point
  // there's nothing for outside-click to grab onto yet.
  function onEmptyClick(dayIdx: number, e: React.MouseEvent<HTMLDivElement>) {
    if (drag) return
    if (e.target !== e.currentTarget) return // ignore clicks bubbled from blocks
    const rect = e.currentTarget.getBoundingClientRect()
    const min = clampMinutes(snapMinutes(pixelToMin(e.clientY - rect.top)))
    onCreateAt(isoDay(days[dayIdx]), formatHHmm(min))
  }

  // Layout per column
  const laidOut = columns.map((items) =>
    layoutDay(items.map((it) => ({ id: it.id, startMin: it.startMin, endMin: it.endMin })))
  )

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-border shadow-sm">
      {/* Header row: day names */}
      <div
        className="grid border-b border-border bg-muted/40"
        style={{ gridTemplateColumns: `${HOUR_LABEL_WIDTH_PX}px repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div />
        {days.map((d) => {
          const isToday = isoDay(d) === todayKey
          return (
            <div key={isoDay(d)} className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {d.toLocaleString("en-US", { weekday: "short" })}
              </span>
              <span
                className={cn(
                  "inline-grid size-6 place-items-center rounded-full text-sm font-semibold tabular-nums",
                  isToday && "bg-primary text-primary-foreground"
                )}
              >
                {d.getDate()}
              </span>
            </div>
          )
        })}
      </div>

      {/* All-day lane */}
      {allDayTasks.length > 0 && (
        <div
          className="grid border-b border-border bg-muted/20"
          style={{ gridTemplateColumns: `${HOUR_LABEL_WIDTH_PX}px repeat(${days.length}, minmax(0, 1fr))` }}
        >
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            All-day
          </div>
          {days.map((_, dayIdx) => {
            const cellTasks = allDayTasks.filter((t) => t.dayIdx === dayIdx)
            return (
              <div key={dayIdx} className="space-y-0.5 border-l border-border px-1 py-1">
                {cellTasks.map(({ task }) => (
                  <div
                    key={task.id}
                    className={cn(
                      "truncate rounded px-1.5 py-0.5 text-[11px] font-medium",
                      task.status === "done"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    )}
                  >
                    {task.title}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Body — full 24h fits without scroll thanks to ROW_PX tuning. */}
      <div
        ref={containerRef}
        className="relative"
        onPointerMove={drag ? onPointerMove : undefined}
        onPointerUp={drag ? onPointerUp : undefined}
        onPointerCancel={drag ? onPointerUp : undefined}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `${HOUR_LABEL_WIDTH_PX}px repeat(${days.length}, minmax(0, 1fr))`,
            height: TOTAL_PX,
          }}
        >
          {/* Hour labels */}
          <div className="sticky left-0 z-10 bg-card">
            {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
              <div
                key={i}
                className="relative text-[10px] font-medium text-muted-foreground"
                style={{ height: ROW_PX * (60 / SLOT_MIN) }}
              >
                <span className="absolute right-1 top-0 -translate-y-1/2 bg-card px-1">
                  {formatHourLabel(START_HOUR + i)}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIdx) => {
            const isToday = isoDay(day) === todayKey
            const nowMin = isToday ? minutesFromStart(new Date()) : null
            return (
              <div
                key={isoDay(day)}
                ref={(el) => { dayColumnsRef.current[dayIdx] = el }}
                className="relative border-l border-border"
                onClick={(e) => onEmptyClick(dayIdx, e)}
              >
                {/* Horizontal hour lines */}
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                  <div
                    key={i}
                    className="pointer-events-none absolute inset-x-0 border-t border-border/60"
                    style={{ top: ROW_PX * (60 / SLOT_MIN) * i }}
                  />
                ))}
                {/* Mid-hour lighter line */}
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
                  <div
                    key={`mid-${i}`}
                    className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border/30"
                    style={{ top: ROW_PX * (60 / SLOT_MIN) * i + ROW_PX }}
                  />
                ))}
                {/* Now line */}
                {nowMin !== null && nowMin >= 0 && nowMin <= TOTAL_MIN && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 h-px bg-rose-500"
                    style={{ top: topPx(nowMin) }}
                  >
                    <span className="absolute -left-1 -top-1 size-2 rounded-full bg-rose-500" />
                  </div>
                )}
                {/* Blocks */}
                {columns[dayIdx].map((item, idx) => {
                  const layout = laidOut[dayIdx][idx]
                  if (!layout) return null
                  const isDragging = drag?.item.id === item.id
                  const dragDelta = isDragging ? drag.deltaMin : 0
                  const dragTargetDayIdx = isDragging ? drag.targetDayIdx : item.dayIdx
                  // Live start/end during a drag. Both are clean SLOT_MIN
                  // multiples because deltaMin is already snapped upstream.
                  const liveStartMin =
                    isDragging && drag.mode === "move"
                      ? clampMinutes(item.startMin + dragDelta)
                      : item.startMin
                  const liveEndMin =
                    isDragging && drag.mode === "move"
                      ? liveStartMin + (item.endMin - item.startMin)
                      : isDragging && drag.mode === "resize"
                        ? Math.max(item.startMin + SLOT_MIN, clampMinutes(item.endMin + dragDelta))
                        : item.endMin
                  const tempTop = topPx(liveStartMin)
                  const tempHeight = Math.max(
                    ROW_PX,
                    ((liveEndMin - liveStartMin) / SLOT_MIN) * ROW_PX
                  )
                  const widthPct = 100 / layout.totalLanes
                  const leftPct = layout.laneIdx * widthPct
                  // Hide the block in its source column while it's being dragged
                  // to another column; we render a ghost in the target column.
                  const visibleInThisColumn =
                    !isDragging || drag.mode === "resize" || dragTargetDayIdx === dayIdx
                  if (!visibleInThisColumn) return null
                  return (
                    <Block
                      key={item.id}
                      item={item}
                      top={tempTop}
                      height={tempHeight}
                      leftPct={leftPct}
                      widthPct={widthPct}
                      isDragging={isDragging}
                      liveStartMin={liveStartMin}
                      liveEndMin={liveEndMin}
                      onBodyPointerDown={(e) => beginDrag("move", item, e)}
                      onResizePointerDown={(e) => beginDrag("resize", item, e)}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Block — a single positioned event/task with drag + resize handles
// ─────────────────────────────────────────────────────────────────────────

function Block({
  item,
  top,
  height,
  leftPct,
  widthPct,
  isDragging,
  liveStartMin,
  liveEndMin,
  onBodyPointerDown,
  onResizePointerDown,
}: {
  item: GridItem
  top: number
  height: number
  leftPct: number
  widthPct: number
  isDragging: boolean
  liveStartMin: number
  liveEndMin: number
  onBodyPointerDown: (e: React.PointerEvent) => void
  onResizePointerDown: (e: React.PointerEvent) => void
}) {
  const colors =
    item.kind === "event"
      ? "bg-primary/15 text-primary border-primary/30"
      : item.kind === "task" && item.task.status === "done"
        ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-300"
        : "bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-300"
  // With ROW_PX=14, blocks are tight. Use a single inline row (title + time)
  // so a 30-min block still reads clearly.
  const content = (
    <div
      className={cn(
        "absolute select-none overflow-hidden rounded-md border px-1.5 py-0.5 text-[11px] font-medium shadow-sm transition-shadow",
        colors,
        isDragging
          ? "z-30 cursor-grabbing shadow-lg ring-2 ring-primary/40"
          : "cursor-grab hover:shadow-md"
      )}
      style={{
        top,
        height,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
      }}
      onPointerDown={onBodyPointerDown}
    >
      {item.kind === "event" && item.event.cal_booking_id && (
        <Lock className="absolute right-1 top-1 size-2.5 opacity-70" aria-label="From Cal.com" />
      )}
      <div className="flex min-w-0 items-baseline gap-1.5 leading-tight">
        <span className="min-w-0 flex-1 truncate font-semibold">{item.title}</span>
        <span className="shrink-0 text-[9px] tabular-nums opacity-70">
          {liveTimeLabel(item, liveStartMin, liveEndMin)}
        </span>
      </div>
      {/* Resize handle — last few pixels, ns-resize cursor. Tasks don't resize. Cal.com events are locked. */}
      {item.kind === "event" && !item.event.cal_booking_id && (
        <div
          className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
          onPointerDown={onResizePointerDown}
        />
      )}
    </div>
  )
  if (item.href) return <Link href={item.href}>{content}</Link>
  return content
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers used by component-internal handlers
// ─────────────────────────────────────────────────────────────────────────

function composeISO(day: Date, min: number): string {
  const d = new Date(day)
  d.setHours(START_HOUR, 0, 0, 0)
  d.setMinutes(d.getMinutes() + min)
  return d.toISOString()
}

function liveTimeLabel(item: GridItem, startMin: number, endMin: number): string {
  // Always format from the live minute values so the label tracks the block
  // visually during drag/resize — including before the mutation commits.
  if (item.kind === "task") return formatHHmm(startMin)
  if (endMin <= startMin + 0) return formatHHmm(startMin)
  return `${formatHHmm(startMin)} – ${formatHHmm(endMin)}`
}
