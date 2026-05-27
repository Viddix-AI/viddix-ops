// Build a `tasks` insert payload from an event row. Shared by:
//   - src/lib/data-store.ts and src/lib/supabase-backend.ts (event auto-pairing
//     when an in-app meeting/call is created or updated)
//   - src/app/api/webhooks/cal/route.ts (ensurePairedTask after a Cal.com
//     BOOKING_CREATED / BOOKING_RESCHEDULED)
//
// This module deliberately has NO "use client" directive so it can be
// imported from both client modules and server route handlers without
// crossing the App Router server/client boundary. The previous arrangement
// (this helper exported from data-store.ts) caused a silent task-create
// failure in production when the webhook route pulled in client-only code.
//
// Invariants the call sites rely on:
//   - The returned task is always status="todo" / priority="medium". Cal.com-
//     originated tasks are paired 1:1 with the event row via events.task_id
//     (migration 014) so the calendar UI can hide the shadow task; a tracker
//     of recurrence/subtasks must NOT promote these.
//   - Date+time are extracted in the local timezone so e.g. a 23:30 booking
//     in Madrid lands on the same day in the tasks list, not the next UTC day.
//   - Title falls back to the capitalised event type when blank.

export function buildTaskFromEvent(e: {
  title: string
  start_at: string
  event_type: string
  client_id: string | null
  lead_id: string | null
}): {
  title: string
  due_date: string
  due_time: string
  status: "todo"
  priority: "medium"
  client_id: string | null
  lead_id: string | null
} {
  const d = new Date(e.start_at)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return {
    title: e.title.trim() || (e.event_type.charAt(0).toUpperCase() + e.event_type.slice(1)),
    due_date: `${y}-${m}-${day}`,
    due_time: `${hh}:${mm}`,
    status: "todo",
    priority: "medium",
    client_id: e.client_id,
    lead_id: e.lead_id,
  }
}
