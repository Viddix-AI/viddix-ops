"use client"

import { useQuery } from "@tanstack/react-query"

import { SUPABASE_CONFIGURED } from "@/lib/backend"
import { store } from "@/lib/data-store"
import { SEED_PROFILES } from "@/lib/seed-data"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types"

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => store.profiles(),
    placeholderData: SEED_PROFILES,
  })
}

/**
 * The signed-in user as a Profile row. When Supabase is configured we read
 * `auth.getUser()` and match it to the public.profiles table; otherwise we
 * return the first seed profile so the demo always has an "actor".
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: async (): Promise<Profile | null> => {
      if (!SUPABASE_CONFIGURED) return SEED_PROFILES[0]
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      const u = data.user
      if (!u) return null
      // Try the matching profiles row first (richer fields), fall back to a
      // synthetic profile derived from auth metadata if nothing's there yet.
      const r = await supabase.from("profiles").select("*").eq("id", u.id).maybeSingle()
      if (r.data) return r.data as Profile
      return {
        id: u.id,
        full_name:
          (u.user_metadata?.full_name as string | undefined) ?? u.email?.split("@")[0] ?? "Member",
        email: u.email ?? "",
        avatar_url: (u.user_metadata?.avatar_url as string | undefined) ?? null,
        role: "member",
        created_at: u.created_at,
      }
    },
    placeholderData: SEED_PROFILES[0],
    staleTime: 60_000,
  })
}

export function useCurrentProfile(): Profile {
  const { data: user } = useCurrentUser()
  const { data: profiles } = useProfiles()
  // Prefer the auth-resolved user; fall back to the first profile in the
  // workspace if auth isn't ready yet.
  return user ?? profiles?.[0] ?? SEED_PROFILES[0]
}
