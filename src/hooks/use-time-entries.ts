// Time tracking (migration 018). The ActiveTimerBanner reads `useOpenTimerFor`
// to surface a sticky "X is running" bar; the task-detail-sheet reads
// `useTimeEntriesFor` to render the per-task log. Mutations invalidate both.
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { store } from "@/lib/data-store"

const OPEN_KEY = (userId: string) => ["time_entries", "open", userId] as const
const FOR_KEY = (taskId: string) => ["time_entries", "task", taskId] as const

export function useOpenTimerFor(userId: string | undefined) {
  return useQuery({
    queryKey: OPEN_KEY(userId ?? ""),
    queryFn: async () => (userId ? store.openTimerFor(userId) : null),
    enabled: !!userId,
    // Re-poll every 5s in case another tab/process started or stopped the
    // timer. The local store dispatches "viddix:store-changed" on every write
    // which already triggers invalidation, but the Supabase backend has no
    // realtime channel hooked up yet.
    refetchInterval: 5_000,
  })
}

export function useTimeEntriesFor(taskId: string | undefined) {
  return useQuery({
    queryKey: FOR_KEY(taskId ?? ""),
    queryFn: async () => (taskId ? store.timeEntriesFor(taskId) : []),
    enabled: !!taskId,
  })
}

export function useStartTimer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { taskId: string; userId: string | null }) =>
      store.startTimer(input),
    onSuccess: (entry, v) => {
      qc.invalidateQueries({ queryKey: FOR_KEY(v.taskId) })
      qc.invalidateQueries({ queryKey: ["tasks"] })
      if (entry.user_id) {
        qc.invalidateQueries({ queryKey: OPEN_KEY(entry.user_id) })
      }
    },
  })
}

export function useStopTimer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { entryId: string; note?: string | null }) =>
      store.stopTimer(input),
    onSuccess: (entry) => {
      qc.invalidateQueries({ queryKey: FOR_KEY(entry.task_id) })
      qc.invalidateQueries({ queryKey: ["tasks"] })
      if (entry.user_id) {
        qc.invalidateQueries({ queryKey: OPEN_KEY(entry.user_id) })
      }
    },
  })
}
