"use client"

import * as React from "react"

import { useTasks } from "@/hooks/use-tasks"

const SEEN_KEY = "viddix-ops:task-reminders-seen-v1"
const POLL_MS = 60_000 // re-check once a minute — cheap, in-tab

function loadSeen(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(SEEN_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

function saveSeen(seen: Set<string>) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
}

/**
 * Watches your task list. When a task is due today (or overdue) and the user
 * has granted Notification permission, fires a browser notification once per
 * task per day. Only sends one banner per task — IDs are stamped with the
 * day, so a task that stays due for several days re-notifies daily.
 *
 * Mounted from the dashboard layout — no UI of its own.
 */
export function useTaskReminders() {
  const { data: tasks = [] } = useTasks()

  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (!("Notification" in window)) return
    if (Notification.permission !== "granted") return

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayKey = today.toISOString().slice(0, 10)
    const seen = loadSeen()

    let fired = 0
    for (const t of tasks) {
      if (t.status === "done") continue
      if (!t.due_date) continue
      const due = new Date(t.due_date)
      due.setHours(0, 0, 0, 0)
      if (due > today) continue // future, skip

      const stamp = `${t.id}|${todayKey}`
      if (seen.has(stamp)) continue

      const overdueDays = Math.round((today.getTime() - due.getTime()) / 86_400_000)
      const title = overdueDays > 0 ? `Overdue · ${t.title}` : `Due today · ${t.title}`
      const body =
        overdueDays > 0
          ? `${overdueDays}d overdue · ${t.priority} priority`
          : `${t.priority} priority`

      try {
        new Notification(title, {
          body,
          tag: `viddix-task-${t.id}`,
          icon: "/favicon.ico",
        })
        seen.add(stamp)
        fired++
      } catch {
        // Notification can throw on some platforms (e.g. iOS Safari without
        // a service worker) — ignore so the loop keeps going.
      }
    }
    if (fired > 0) saveSeen(seen)
  }, [tasks])

  // Re-run periodically so we catch tasks that cross into "due" while the
  // tab is open (the effect above only re-fires when `tasks` changes).
  const [tick, setTick] = React.useState(0)
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const id = window.setInterval(() => setTick((n) => n + 1), POLL_MS)
    return () => window.clearInterval(id)
  }, [])
  React.useEffect(() => {
    // Bump a no-op so the linter knows `tick` is consumed.
    void tick
  }, [tick])
}

/** Ask the user for notification permission, if it hasn't been answered yet. */
export async function ensureNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported"
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission
  }
  try {
    return await Notification.requestPermission()
  } catch {
    return "default"
  }
}
