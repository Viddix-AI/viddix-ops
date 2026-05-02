"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { store } from "@/lib/data-store"
import { SEED_LEADS } from "@/lib/seed-data"
import type { Lead } from "@/lib/types"

const KEY = ["leads"] as const

export function useLeads() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => store.leads(),
    initialData: SEED_LEADS,
  })
}

export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<Lead> & { name: string }) =>
      store.createLead(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Lead> }) =>
      store.updateLead(input.id, input.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useMoveLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      toStage: Lead["stage"]
      toIndex: number
    }) => store.moveLead(input.id, input.toStage, input.toIndex),
    onMutate: async ({ id, toStage, toIndex }) => {
      await qc.cancelQueries({ queryKey: KEY })
      const prev = qc.getQueryData<Lead[]>(KEY) ?? []
      const next = prev.map((l) => ({ ...l }))
      const lead = next.find((l) => l.id === id)
      if (!lead) return { prev }
      const fromStage = lead.stage
      lead.stage = toStage
      const stages = Array.from(new Set([fromStage, toStage]))
      for (const s of stages) {
        const col = next
          .filter((l) => l.stage === s && l.id !== id)
          .sort((a, b) => a.position - b.position)
        if (s === toStage) col.splice(toIndex, 0, lead)
        col.forEach((l, i) => (l.position = i))
      }
      qc.setQueryData<Lead[]>(KEY, next)
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => store.deleteLead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useConvertLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => store.convertLeadToClient(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ["clients"] })
    },
  })
}
