"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { store } from "@/lib/data-store"
import { SEED_CLIENT_PARTNERS, SEED_PARTNERS } from "@/lib/seed-data"
import type { ClientPartner, Partner } from "@/lib/types"

const KEY = ["partners"] as const
const LINK_KEY = ["client_partners"] as const

export function usePartners() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => store.partners(),
    placeholderData: SEED_PARTNERS,
  })
}

export function useClientPartners() {
  return useQuery({
    queryKey: LINK_KEY,
    queryFn: async () => store.clientPartners(),
    placeholderData: SEED_CLIENT_PARTNERS,
  })
}

export function usePartnersForClient(clientId: string | undefined) {
  return useQuery({
    queryKey: ["partners", "client", clientId ?? null],
    queryFn: async () => (clientId ? store.partnersFor(clientId) : []),
    enabled: !!clientId,
  })
}

export function useCreatePartner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<Partner> & { name: string }) =>
      store.createPartner(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useUpdatePartner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Partner> }) =>
      store.updatePartner(input.id, input.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeletePartner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => store.deletePartner(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: LINK_KEY })
      qc.invalidateQueries({ queryKey: ["partners", "client"] })
    },
  })
}

export function useAttachPartner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { client_id: string; partner_id: string; split_pct?: number }) =>
      store.attachPartner(input),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: LINK_KEY })
      qc.invalidateQueries({ queryKey: ["partners", "client", v.client_id] })
    },
  })
}

export function useUpdateClientPartner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Pick<ClientPartner, "split_pct">> }) =>
      store.updateClientPartner(input.id, input.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LINK_KEY })
      qc.invalidateQueries({ queryKey: ["partners", "client"] })
    },
  })
}

export function useDetachPartner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => store.detachPartner(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LINK_KEY })
      qc.invalidateQueries({ queryKey: ["partners", "client"] })
    },
  })
}
