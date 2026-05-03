// ICS (RFC 5545) generators + Google Calendar quick-link builder.
// Used to feed the agency calendar into Apple/Google/Outlook without an
// OAuth integration. Format is the bare-minimum VCALENDAR with VEVENT/VTODO
// entries — a calendar app will subscribe via the /api/calendar.ics endpoint.

import type { Event as VEvent, Task } from "@/lib/types"

export function toIcsDate(iso: string): string {
  const d = new Date(iso)
  // Floating UTC: YYYYMMDDTHHMMSSZ (no TZID — covers cross-tool compatibility)
  return (
    d.getUTCFullYear().toString().padStart(4, "0") +
    (d.getUTCMonth() + 1).toString().padStart(2, "0") +
    d.getUTCDate().toString().padStart(2, "0") +
    "T" +
    d.getUTCHours().toString().padStart(2, "0") +
    d.getUTCMinutes().toString().padStart(2, "0") +
    d.getUTCSeconds().toString().padStart(2, "0") +
    "Z"
  )
}

export function toIcsAllDay(date: string): string {
  // YYYY-MM-DD → YYYYMMDD (treated as DATE, not DATE-TIME).
  return date.replace(/-/g, "")
}

function escape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
}

// Lines longer than 75 octets must be folded per RFC 5545 §3.1.
function fold(line: string): string {
  if (line.length <= 75) return line
  const chunks: string[] = []
  let i = 0
  while (i < line.length) {
    chunks.push((i === 0 ? "" : " ") + line.slice(i, i + (i === 0 ? 75 : 74)))
    i += i === 0 ? 75 : 74
  }
  return chunks.join("\r\n")
}

function joinLines(lines: string[]): string {
  return lines.map(fold).join("\r\n") + "\r\n"
}

export type IcsItem =
  | { kind: "event"; event: VEvent }
  | { kind: "task";  task: Task }

export function buildIcs(items: IcsItem[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Viddix//Ops//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ]
  const stamp = toIcsDate(new Date().toISOString())

  for (const item of items) {
    if (item.kind === "event") {
      const e = item.event
      lines.push("BEGIN:VEVENT")
      lines.push(`UID:event-${e.id}@viddix.ai`)
      lines.push(`DTSTAMP:${stamp}`)
      lines.push(`DTSTART:${toIcsDate(e.start_at)}`)
      lines.push(
        `DTEND:${toIcsDate(
          e.end_at ?? new Date(new Date(e.start_at).getTime() + 60 * 60_000).toISOString()
        )}`
      )
      lines.push(`SUMMARY:${escape(e.title)}`)
      if (e.description) lines.push(`DESCRIPTION:${escape(e.description)}`)
      lines.push(`CATEGORIES:${escape(e.event_type)}`)
      lines.push("END:VEVENT")
    } else {
      const t = item.task
      if (!t.due_date) continue
      lines.push("BEGIN:VTODO")
      lines.push(`UID:task-${t.id}@viddix.ai`)
      lines.push(`DTSTAMP:${stamp}`)
      lines.push(`DUE;VALUE=DATE:${toIcsAllDay(t.due_date)}`)
      lines.push(`SUMMARY:${escape(t.title)}`)
      if (t.description) lines.push(`DESCRIPTION:${escape(t.description)}`)
      lines.push(
        `STATUS:${
          t.status === "done" ? "COMPLETED" : t.status === "in_progress" ? "IN-PROCESS" : "NEEDS-ACTION"
        }`
      )
      lines.push(
        `PRIORITY:${
          t.priority === "urgent" ? 1 : t.priority === "high" ? 3 : t.priority === "medium" ? 5 : 7
        }`
      )
      lines.push("END:VTODO")
    }
  }

  lines.push("END:VCALENDAR")
  return joinLines(lines)
}

/**
 * Build a Google Calendar quick-add URL for a single event. Click → opens
 * GCal pre-filled. Doesn't require OAuth or any GCal API key.
 * https://support.google.com/calendar/thread/81344786
 */
export function googleCalendarUrl(opts: {
  title: string
  startISO: string
  endISO?: string | null
  description?: string | null
  location?: string | null
}): string {
  const fmt = (iso: string) => toIcsDate(iso)
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${fmt(opts.startISO)}/${fmt(
      opts.endISO ?? new Date(new Date(opts.startISO).getTime() + 60 * 60_000).toISOString()
    )}`,
  })
  if (opts.description) params.set("details", opts.description)
  if (opts.location) params.set("location", opts.location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
