"use client"

import { useQuery } from "@tanstack/react-query"

import { store } from "@/lib/data-store"
import { SEED_PROFILES } from "@/lib/seed-data"

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => store.profiles(),
    initialData: SEED_PROFILES,
  })
}

// "Current" user — first profile until real auth is wired through.
export function useCurrentProfile() {
  const { data } = useProfiles()
  return data[0] ?? SEED_PROFILES[0]
}
