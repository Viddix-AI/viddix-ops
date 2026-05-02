"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { store } from "@/lib/data-store"
import { SEED_TASKS } from "@/lib/seed-data"
import type { Task } from "@/lib/types"

const KEY = ["tasks"] as const

export function useTasks() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => store.tasks(),
    initialData: SEED_TASKS,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<Task> & { title: string }) =>
      store.createTask(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Task> }) =>
      store.updateTask(input.id, input.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => store.deleteTask(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}
