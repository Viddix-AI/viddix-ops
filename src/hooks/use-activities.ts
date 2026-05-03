"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { store } from "@/lib/data-store"
import { SEED_ACTIVITIES } from "@/lib/seed-data"

export function useActivities() {
  const qc = useQueryClient()
  // Listen for the cross-cutting "store-changed" event published by the
  // localStorage store on every write. Lets the activity feed refresh
  // without each mutation hook needing to invalidate ["activities"].
  React.useEffect(() => {
    if (typeof window === "undefined") return
    const onChange = () => qc.invalidateQueries({ queryKey: ["activities"] })
    window.addEventListener("viddix:store-changed", onChange)
    return () => window.removeEventListener("viddix:store-changed", onChange)
  }, [qc])

  return useQuery({
    queryKey: ["activities"],
    queryFn: async () => store.activities(),
    placeholderData: SEED_ACTIVITIES,
  })
}
