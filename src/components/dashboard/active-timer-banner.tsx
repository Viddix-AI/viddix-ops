"use client"

import * as React from "react"
import Link from "next/link"
import { Square } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { useOpenTimerFor, useStopTimer } from "@/hooks/use-time-entries"
import { useCurrentProfile } from "@/hooks/use-profile"
import { useTasks } from "@/hooks/use-tasks"

/**
 * Sticky bottom banner that surfaces the user's open time entry. Renders only
 * when there's an entry with `ended_at = null` for the current profile.
 *
 * The elapsed cronómetro re-renders every second; the banner itself only
 * mounts/unmounts when the underlying timer entry changes (React Query
 * polling at 5s + cache invalidation from start/stop mutations).
 *
 * Mounted from `(dashboard)/layout.tsx` next to TaskRemindersClient and
 * KeyboardShortcutsClient so it sits above the main grid on every dashboard
 * route. No portal — z-50 keeps it above Sheets/Dialogs only if needed.
 */
export function ActiveTimerBanner() {
  const me = useCurrentProfile()
  const { data: entry } = useOpenTimerFor(me.id)
  const { data: tasks = [] } = useTasks()
  const stop = useStopTimer()

  // Elapsed ticker — only runs while a timer is open. Storing `nowMs` in
  // state (rather than reading Date.now() during render) keeps the component
  // pure per React 19 strict rules. The interval drives subsequent updates;
  // the lazy initialiser captures the first reading.
  const [nowMs, setNowMs] = React.useState(() =>
    typeof window === "undefined" ? 0 : Date.now()
  )
  React.useEffect(() => {
    if (!entry) return
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [entry])

  if (!entry) return null

  const task = tasks.find((t) => t.id === entry.task_id)
  const startedMs = new Date(entry.started_at).getTime()
  const elapsedSec = Math.max(0, Math.floor((nowMs - startedMs) / 1000))
  const hh = Math.floor(elapsedSec / 3600)
  const mm = Math.floor((elapsedSec % 3600) / 60)
  const ss = elapsedSec % 60
  const stamp = `${hh > 0 ? `${hh}h ` : ""}${String(mm).padStart(2, "0")}m ${String(ss).padStart(2, "0")}s`

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto mb-4 flex w-fit max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full border border-primary/30 bg-primary px-4 py-2 text-primary-foreground shadow-[var(--shadow-paper-md)]"
    >
      <span className="inline-flex size-2 animate-pulse rounded-full bg-primary-foreground/80" aria-hidden />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {task ? (
            <Link
              href="/tasks"
              className="hover:underline"
              title={task.title}
            >
              {task.title}
            </Link>
          ) : (
            "Running"
          )}
        </p>
      </div>
      <span className="font-mono text-sm tabular-nums">{stamp}</span>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          stop.mutate(
            { entryId: entry.id },
            {
              onSuccess: () => toast.success("Timer stopped"),
              onError: (e) =>
                toast.error(e instanceof Error ? e.message : "Stop failed"),
            }
          )
        }}
        disabled={stop.isPending}
      >
        <Square />
        Stop
      </Button>
    </div>
  )
}
