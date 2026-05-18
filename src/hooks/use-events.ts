"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { store } from "@/lib/data-store"
import { SEED_EVENTS } from "@/lib/seed-data"
import type { Event } from "@/lib/types"

const KEY = ["events"] as const

export function useEvents() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => store.events(),
    placeholderData: SEED_EVENTS,
  })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<Event> & { title: string; start_at: string }) =>
      store.createEvent(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Event> }) =>
      store.updateEvent(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => store.deleteEvent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
