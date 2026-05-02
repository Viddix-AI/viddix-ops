"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { store } from "@/lib/data-store"

export function useNotesFor(opts: { clientId?: string; leadId?: string }) {
  return useQuery({
    queryKey: ["notes", opts.clientId ?? null, opts.leadId ?? null],
    queryFn: async () => store.notesFor(opts),
  })
}

export function useCreateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { content: string; client_id?: string; lead_id?: string; author_id?: string }) =>
      store.createNote(input),
    onSuccess: (_d, v) =>
      qc.invalidateQueries({
        queryKey: ["notes", v.client_id ?? null, v.lead_id ?? null],
      }),
  })
}

export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => store.deleteNote(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  })
}
