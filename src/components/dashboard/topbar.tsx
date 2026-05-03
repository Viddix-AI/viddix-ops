"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Search, Bell } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { TeamBadge } from "./team-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCurrentProfile } from "@/hooks/use-profile"
import { ensureNotificationPermission } from "@/hooks/use-task-reminders"
import { store } from "@/lib/data-store"
import { initials } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"
import { MobileNav } from "./mobile-nav"

export function Topbar() {
  const router = useRouter()
  const me = useCurrentProfile()
  const qc = useQueryClient()

  async function signOut() {
    try {
      if (
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ) {
        await createClient().auth.signOut()
      }
      router.push("/login")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-out failed")
    }
  }

  async function enableNotifications() {
    const result = await ensureNotificationPermission()
    if (result === "granted") toast.success("Notifications enabled")
    else if (result === "denied") toast.error("Notifications blocked. Allow them in your browser settings.")
    else if (result === "unsupported") toast.error("This browser does not support notifications.")
    else toast.message("Notification permission unchanged")
  }

  function resetDemoData() {
    if (
      !confirm(
        "Reset all demo data? This wipes leads, clients, partners, tasks, notes and events stored in this browser."
      )
    ) {
      return
    }
    store.reset()
    qc.invalidateQueries()
    toast.success("Demo data reset")
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur lg:px-6">
      <MobileNav />

      <div className="relative hidden flex-1 max-w-md md:block">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search clients, leads, tasks…"
          className="h-9 pl-8 bg-muted/50 border-transparent focus-visible:bg-background"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="Notifications">
          <Bell />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition-colors hover:bg-muted"
                aria-label="Account menu"
              />
            }
          >
            <Avatar size="sm">
              <AvatarFallback>{initials(me.full_name)}</AvatarFallback>
            </Avatar>
            <span className="hidden items-center gap-1.5 text-xs font-medium text-foreground sm:inline-flex">
              {me.full_name}
              <TeamBadge team={me.team} />
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex items-center gap-1.5 font-medium">
                {me.full_name}
                <TeamBadge team={me.team} />
              </div>
              <div className="text-xs text-muted-foreground">{me.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={enableNotifications}>
              Enable task notifications
            </DropdownMenuItem>
            <DropdownMenuItem onClick={resetDemoData}>
              Reset demo data
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} variant="destructive">
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
