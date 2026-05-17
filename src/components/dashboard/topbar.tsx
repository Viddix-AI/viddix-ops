"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useTheme } from "next-themes"
import { Bell, Check, Monitor, Moon, Search, Sun } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { TeamBadge } from "./team-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { CommandPalette } from "./command-palette"
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
  const { theme, setTheme } = useTheme()
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  // Detect Mac so the kbd hint shows ⌘ instead of Ctrl. Uses the
  // "store-info-from-previous-renders" pattern (see also Sidebar's
  // StorageStatus + client-detail's SplitInput) so we never call setState
  // inside an effect — render reads the value once, then converges.
  const [isMac, setIsMac] = React.useState<boolean | null>(null)
  if (isMac === null && typeof navigator !== "undefined") {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.userAgent))
  }

  // Global ⌘K / Ctrl+K shortcut. Capture-phase listener so it wins over any
  // focused input that might also bind cmd+k. Also handles `/` as a quick
  // open when not already typing into a form field.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

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

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        aria-label="Open search (Command-K)"
        className="hidden h-9 max-w-md flex-1 items-center gap-2 rounded-md bg-muted/60 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:flex"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 text-left">Search clients, leads, tasks…</span>
        <kbd className="inline-flex h-5 items-center gap-0.5 rounded-sm border border-border bg-background px-1 font-mono text-[10px] text-text-secondary shadow-sm">
          <span>{isMac === true ? "⌘" : "Ctrl"}</span>
          <span>K</span>
        </kbd>
      </button>

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
            <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Theme
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun />
              Light
              <Check
                className={cn(
                  "ml-auto size-3.5",
                  theme === "light" ? "opacity-100" : "opacity-0"
                )}
              />
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon />
              Dark
              <Check
                className={cn(
                  "ml-auto size-3.5",
                  theme === "dark" ? "opacity-100" : "opacity-0"
                )}
              />
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor />
              System
              <Check
                className={cn(
                  "ml-auto size-3.5",
                  theme === "system" ? "opacity-100" : "opacity-0"
                )}
              />
            </DropdownMenuItem>
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

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  )
}
