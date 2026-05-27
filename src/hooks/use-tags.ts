// Tags (migration 020). attach/detach mutate task_tags but also invalidate
// ["tasks"] because the tasks-view shows tag chips inline; without that the
// chip wouldn't appear until the user navigated away and back.
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { store } from "@/lib/data-store"

const ALL_KEY  = ["tags"] as const
const FOR_KEY  = (taskId: string) => ["tags", "task", taskId] as const
const LINK_KEY = ["task_tags"] as const

export function useTags() {
  return useQuery({
    queryKey: ALL_KEY,
    queryFn: async () => store.tags(),
  })
}

export function useTagsFor(taskId: string | undefined) {
  return useQuery({
    queryKey: FOR_KEY(taskId ?? ""),
    queryFn: async () => (taskId ? store.tagsFor(taskId) : []),
    enabled: !!taskId,
  })
}

export function useTaskTags() {
  return useQuery({
    queryKey: LINK_KEY,
    queryFn: async () => store.taskTags(),
  })
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ALL_KEY })
  qc.invalidateQueries({ queryKey: LINK_KEY })
  qc.invalidateQueries({ queryKey: ["tags", "task"] })
  qc.invalidateQueries({ queryKey: ["tasks"] })
}

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; color?: string }) =>
      store.createTag(input),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useDeleteTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => store.deleteTag(id),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useAttachTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { task_id: string; tag_id: string }) =>
      store.attachTag(input),
    onSuccess: () => invalidateAll(qc),
  })
}

export function useDetachTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { task_id: string; tag_id: string }) =>
      store.detachTag(input),
    onSuccess: () => invalidateAll(qc),
  })
}
