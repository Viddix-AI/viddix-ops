// Multi-contact per client. The primary contact mirrors to
// clients.contact_name/email/phone via the seed/backfill in migration 016,
// so any mutation that touches is_primary also invalidates ["clients"] and
// ["client", clientId] for the legacy reads.
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { store } from "@/lib/data-store"
import type { Contact } from "@/lib/types"

const LIST_KEY = (clientId: string) => ["contacts", clientId] as const
const ALL_KEY = ["contacts", "all"] as const

export function useContacts() {
  return useQuery({
    queryKey: ALL_KEY,
    queryFn: async () => store.contacts(),
  })
}

export function useContactsFor(clientId: string | undefined) {
  return useQuery({
    queryKey: LIST_KEY(clientId ?? ""),
    queryFn: async () => (clientId ? store.contactsFor(clientId) : []),
    enabled: !!clientId,
  })
}

function invalidateClient(qc: ReturnType<typeof useQueryClient>, clientId: string) {
  qc.invalidateQueries({ queryKey: LIST_KEY(clientId) })
  qc.invalidateQueries({ queryKey: ALL_KEY })
  qc.invalidateQueries({ queryKey: ["clients"] })
  qc.invalidateQueries({ queryKey: ["client", clientId] })
}

export function useCreateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Partial<Contact> & { client_id: string; full_name: string }) =>
      store.createContact(input),
    onSuccess: (_d, v) => invalidateClient(qc, v.client_id),
  })
}

export function useUpdateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; clientId: string; patch: Partial<Contact> }) =>
      store.updateContact(input.id, input.patch),
    onSuccess: (_d, v) => invalidateClient(qc, v.clientId),
  })
}

export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; clientId: string }) =>
      store.deleteContact(input.id),
    onSuccess: (_d, v) => invalidateClient(qc, v.clientId),
  })
}

export function useSetPrimaryContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { clientId: string; contactId: string }) =>
      store.setPrimaryContact(input.clientId, input.contactId),
    onSuccess: (_d, v) => invalidateClient(qc, v.clientId),
  })
}
