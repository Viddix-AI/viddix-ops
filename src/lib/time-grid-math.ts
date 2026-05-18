// Pure helpers for the calendar TimeGrid. No React, no DOM — keeps the
// arithmetic separable from the component for clarity and future testing.
//
// Coordinate model:
//   - "minutes" = minutes since START_HOUR on a given day.
//   - "pixels"  = vertical offset inside a day column.
// Slots are SLOT_MIN minutes tall and ROW_PX pixels tall.

// Full 24h grid so multi-timezone work (ES/US) is visible at a glance.
// ROW_PX is tuned for readable 30-min blocks; the grid is taller than most
// viewports on purpose — the page scroll handles overflow rather than the
// calendar having its own scroll area. 48 slots × 22px = 1056px.
export const START_HOUR = 0
export const END_HOUR = 24
export const SLOT_MIN = 30
export const ROW_PX = 22

export const TOTAL_MIN = (END_HOUR - START_HOUR) * 60
export const TOTAL_PX = (TOTAL_MIN / SLOT_MIN) * ROW_PX
export const SLOTS_PER_HOUR = 60 / SLOT_MIN

/** Minutes since START_HOUR for a given Date. Negative if before, > TOTAL_MIN if after. */
export function minutesFromStart(d: Date): number {
  return (d.getHours() - START_HOUR) * 60 + d.getMinutes()
}

/** Pixel offset from the top of the grid for a given minute count. */
export function topPx(min: number): number {
  return (min / SLOT_MIN) * ROW_PX
}

/** Pixel height for an [start, end) range in minutes. Minimum one slot. */
export function heightPx(startMin: number, endMin: number): number {
  return Math.max(ROW_PX, ((endMin - startMin) / SLOT_MIN) * ROW_PX)
}

/** Snap a raw minute value to the nearest SLOT_MIN multiple. */
export function snapMinutes(rawMin: number): number {
  return Math.round(rawMin / SLOT_MIN) * SLOT_MIN
}

/** Clamp a minute value into the visible grid range. */
export function clampMinutes(min: number): number {
  return Math.max(0, Math.min(TOTAL_MIN, min))
}

/** Convert a pixel offset to minutes, unsnapped. */
export function pixelToMin(px: number): number {
  return (px / ROW_PX) * SLOT_MIN
}

/** Format minutes as "HH:MM" (24h). */
export function formatHHmm(min: number): string {
  const total = (START_HOUR * 60) + min
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** Format the leftmost hour column label. 24h notation keeps it compact. */
export function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`
}

/** ISO YYYY-MM-DD for a Date, in local time. */
export function isoDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// ── Overlap layout ─────────────────────────────────────────────────────────
// Greedy lane assignment: walk items in start order, place each in the first
// lane whose last item has ended. Returns laneIdx + totalLanes (for width).

export type LayoutInput = { id: string; startMin: number; endMin: number }
export type LayoutOutput = LayoutInput & { laneIdx: number; totalLanes: number }

export function layoutDay(items: LayoutInput[]): LayoutOutput[] {
  if (items.length === 0) return []
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin)
  // lanes[i] holds the end-minute of the last item in lane i.
  const lanes: number[] = []
  const assigned = sorted.map((it) => {
    let lane = lanes.findIndex((end) => end <= it.startMin)
    if (lane === -1) {
      lane = lanes.length
      lanes.push(it.endMin)
    } else {
      lanes[lane] = it.endMin
    }
    return { ...it, laneIdx: lane }
  })
  // Compute totalLanes per overlap group. A group is a set of items that
  // transitively overlap. Two passes: find groups, then stamp totalLanes.
  const groupId = new Map<string, number>()
  let nextGroup = 0
  for (const it of assigned) {
    let gid = -1
    for (const other of assigned) {
      if (other.id === it.id) continue
      if (other.startMin < it.endMin && other.endMin > it.startMin) {
        const og = groupId.get(other.id)
        if (og !== undefined) {
          gid = og
          break
        }
      }
    }
    if (gid === -1) gid = nextGroup++
    groupId.set(it.id, gid)
  }
  const groupTotal = new Map<number, number>()
  for (const it of assigned) {
    const g = groupId.get(it.id)!
    groupTotal.set(g, Math.max(groupTotal.get(g) ?? 1, it.laneIdx + 1))
  }
  return assigned.map((it) => ({
    ...it,
    totalLanes: groupTotal.get(groupId.get(it.id)!) ?? 1,
  }))
}

/** Parse "HH:MM" into total minutes since START_HOUR. Returns null on bad input. */
export function parseHHmmToMin(value: string | null | undefined): number | null {
  if (!value) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return (h - START_HOUR) * 60 + min
}
