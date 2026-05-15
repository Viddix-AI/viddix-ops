// Time-series + delta helpers used by the dashboard KPI tiles.
//
// We don't store snapshots of MRR or lead counts over time — only the
// current state, with `created_at` / `updated_at` / `started_at` /
// converted_client_id on each row. So every "series" here is reconstructed
// from those timestamps, treating the current value as the truth at "now"
// and rewinding backward by counting which rows existed (or hadn't yet
// converted) at each historical point.
//
// Caveats — these are approximations, not snapshots:
//   • MRR changes after a client is created aren't tracked, so the MRR
//     series uses the *current* mrr for each historical row.
//   • Leads that were "open" historically but later deleted vanish entirely.
//   • "Won this month" is anchored on lead.updated_at (the convert timestamp).
//
// These are good enough for sparklines + a directional delta chip. When we
// add per-week snapshots in a future phase we'll swap the implementation
// without touching the call sites.

import type { Client, Lead, Task } from "@/lib/types"

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Build N weekly buckets ending at the start of the current week. Returns
 * the right-edge (exclusive end) timestamp of each bucket — bucket[i]
 * covers ((bucket[i]-WEEK_MS), bucket[i]].
 */
function weekEndsBack(n: number, now = Date.now()): number[] {
  // Snap "now" to the start of today so all buckets align on day boundaries
  // and don't shift while the user keeps the tab open.
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const t0 = startOfToday.getTime()
  const ends: number[] = []
  // i=0 → end-of-current-week, i=n-1 → end of (n-1) weeks ago.
  for (let i = n - 1; i >= 0; i--) {
    ends.push(t0 - i * WEEK_MS)
  }
  return ends
}

/** Cumulative active-client count at each historical week-end. */
export function activeClientsSeries(clients: Client[], weeks = 12): number[] {
  const ends = weekEndsBack(weeks)
  return ends.map((end) =>
    clients.filter((c) => {
      const t = c.started_at ? new Date(c.started_at).getTime() : null
      return t !== null && t <= end
    }).length
  )
}

/** Cumulative MRR sum (using current mrr per row) at each historical week-end. */
export function mrrSeries(clients: Client[], weeks = 12): number[] {
  const ends = weekEndsBack(weeks)
  return ends.map((end) =>
    clients.reduce((s, c) => {
      const t = c.started_at ? new Date(c.started_at).getTime() : null
      return t !== null && t <= end ? s + Number(c.mrr || 0) : s
    }, 0)
  )
}

/**
 * "Open leads" series — leads that existed at week-end and weren't yet
 * `won`/`lost` at that point. We approximate "still open" as:
 * created_at ≤ end AND (stage not in {won,lost} OR updated_at > end).
 */
export function openLeadsSeries(leads: Lead[], weeks = 12): number[] {
  const ends = weekEndsBack(weeks)
  return ends.map((end) =>
    leads.filter((l) => {
      const created = new Date(l.created_at).getTime()
      if (created > end) return false
      const closed = l.stage === "won" || l.stage === "lost"
      if (!closed) return true
      const updated = new Date(l.updated_at).getTime()
      return updated > end
    }).length
  )
}

/**
 * Tasks completed per week (lookback window). Bucketed by updated_at when
 * status === "done", so the latest week is the most recent activity.
 */
export function tasksDoneSeries(tasks: Task[], weeks = 12): number[] {
  const ends = weekEndsBack(weeks)
  return ends.map((end) => {
    const start = end - WEEK_MS
    return tasks.filter((t) => {
      if (t.status !== "done") return false
      const u = new Date(t.updated_at).getTime()
      return u > start && u <= end
    }).length
  })
}

/**
 * Month-over-month percentage delta. Pass two values; positive when `now`
 * is higher than `prev`, undefined when there's not enough signal to
 * compare (both zero, or prev is zero so the percentage would explode).
 */
export function pctDelta(now: number, prev: number): number | null {
  if (!Number.isFinite(now) || !Number.isFinite(prev)) return null
  if (prev === 0) {
    if (now === 0) return null
    return 100 // "infinity-ish" → cap at +100%
  }
  return ((now - prev) / prev) * 100
}

/**
 * Compare the latest week vs. ~4 weeks earlier. Sparklines have 12 weeks
 * of data so the prior anchor is roughly "a month ago" without needing
 * calendar-month arithmetic (which messes up partial weeks).
 */
export function deltaFromSeries(series: number[]): {
  value: number
  direction: "up" | "down"
} | null {
  if (series.length < 2) return null
  const now = series[series.length - 1]
  // Look 4 weeks back; if the series is shorter, fall back to the first point.
  const prevIdx = Math.max(0, series.length - 1 - 4)
  const prev = series[prevIdx]
  const pct = pctDelta(now, prev)
  if (pct === null) return null
  return {
    value: Math.abs(pct),
    direction: pct >= 0 ? "up" : "down",
  }
}

/** Stage-by-stage conversion table for the funnel. */
export function pipelineFunnel(leads: Lead[]): {
  stage: Lead["stage"]
  count: number
  value: number
  /** Conversion % from the previous stage. null for the first stage. */
  conversion: number | null
}[] {
  const STAGES: Lead["stage"][] = [
    "new",
    "contacted",
    "qualified",
    "proposal",
    "negotiation",
    "won",
  ]
  // We exclude `lost` from the funnel — it's a side exit, not a stage.
  const rows = STAGES.map((stage) => {
    const inStage = leads.filter((l) => l.stage === stage)
    return {
      stage,
      count: inStage.length,
      value: inStage.reduce((s, l) => s + Number(l.value || 0), 0),
    }
  })

  // A lead at "qualified" has already been through "new" + "contacted", so the
  // historic count at stage S is `sum from S..won` of in-stage counts. That
  // produces a non-increasing funnel.
  const cumulative = rows.map((_, i) =>
    rows.slice(i).reduce((s, r) => s + r.count, 0)
  )

  return rows.map((r, i) => {
    const here = cumulative[i]
    const prev = i === 0 ? null : cumulative[i - 1]
    const conv = prev === null || prev === 0 ? null : (here / prev) * 100
    return {
      stage: r.stage,
      count: here,
      value: r.value, // dollar value stays per-stage, not cumulative
      conversion: conv,
    }
  })
}
