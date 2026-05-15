"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { store } from "@/lib/data-store"
import { SEED_CLIENTS } from "@/lib/seed-data"
import type { Client } from "@/lib/types"

const KEY = ["clients"] as const

export function useClients() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => store.clients(),
    placeholderData: SEED_CLIENTS,
  })
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ["client", id],
    queryFn: async () => (id ? store.client(id) : null),
    enabled: !!id,
  })
}

export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<Client> & { name: string }) =>
      store.createClient(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Client> }) =>
      store.updateClient(input.id, input.patch),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ["client", v.id] })
    },
  })
}

export function useDeleteClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => store.deleteClient(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ["client", id] })
      // Cascaded entities — invalidate to refresh tables that join through.
      qc.invalidateQueries({ queryKey: ["client_partners"] })
      qc.invalidateQueries({ queryKey: ["notes"] })
      qc.invalidateQueries({ queryKey: ["tasks"] })
      qc.invalidateQueries({ queryKey: ["events"] })
    },
  })
}
