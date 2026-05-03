"use client"

import { useTaskReminders } from "@/hooks/use-task-reminders"

/**
 * Side-effect-only component. Mounted from the dashboard layout so the
 * server-rendered shell stays static while the client hook keeps polling
 * for tasks that come due during the session.
 */
export function TaskRemindersClient() {
  useTaskReminders()
  return null
}
