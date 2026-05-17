"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useTheme } from "next-themes"
import { Bell, Check, Monitor, Moon, Search, Sun } from "lucide-react"
import { toast } from "sonner"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { MobileNav } from "./mobile-nav"
import { TeamBadge } from "./team-badge"
import { useCurrentProfile } from "@/hooks/use-profile"
import { ensureNotificationPermission } from "@/hooks/use-task-reminders"
import { store } from "@/lib/data-store"
import { initials } from "@/lib/format"
import { createClient } from "@/lib/supabase/client"

// Breadcrumb labels keyed by path prefix. Kept tiny — we only need the leaf
// node, the eyebrow is "Holding" by convention.
const BREADCRUMB: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/leads": "Leads",
  "/clients": "Clients",
  "/partners": "Partners",
  "/tasks": "Tasks",
  "/calendar": "Calendar",
  "/activity": "Activity",
}

function leafFromPath(pathname: string): string {
  // Match the longest known prefix so /clients/<id> still resolves to "Clients".
  const match = Object.keys(BREADCRUMB)
    .filter((p) => pathname === p || pathname.startsWith(`${p}/`))
    .sort((a, b) => b.length - a.length)[0]
  return match ? BREADCRUMB[match] : "Workspace"
}

export function Topbar() {
  const router = useRouter()
  const pathname = usePathname()
  const me = useCurrentProfile()
  const qc = useQueryClient()
  const { theme, setTheme } = useTheme()
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  // Detect Mac so the kbd hint shows ⌘ instead of Ctrl. "Store-info-from-
  // previous-renders" pattern: render reads it once, converges.
  const [isMac, setIsMac] = React.useState<boolean | null>(null)
  if (isMac === null && typeof navigator !== "undefined") {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.userAgent))
  }

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

  const leaf = leafFromPath(pathname ?? "")

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border-subtle bg-background/85 px-4 backdrop-blur lg:px-8">
      <MobileNav />

      {/* Editorial breadcrumb — eyebrow in sans, leaf in serif italic. */}
      <nav aria-label="Breadcrumb" className="hidden items-baseline gap-2 md:flex">
        <span className="text-[13px] text-text-tertiary">Holding</span>
        <span className="text-text-tertiary" aria-hidden>·</span>
        <span className="font-display text-[16px] italic tracking-[-0.01em] text-text-primary">
          {leaf}
        </span>
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label="Open search (Command-K)"
          className="hidden h-8 items-center gap-2 rounded-[var(--radius-md)] border border-border-subtle bg-surface-3/60 px-2.5 text-[13px] text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:inline-flex"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="text-left">Search</span>
          <kbd className="ml-1 inline-flex h-5 items-center gap-0.5 rounded-sm border border-border-subtle bg-card px-1.5 font-mono text-[11px] text-text-tertiary">
            <span>{isMac === true ? "⌘" : "Ctrl"}</span>
            <span>K</span>
          </kbd>
        </button>

        <Button variant="ghost" size="icon-sm" aria-label="Notifications">
          <Bell />
        </Button>

        <span aria-hidden className="hidden h-5 w-px bg-border-subtle md:block" />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition-colors hover:bg-surface-3"
                aria-label="Account menu"
              />
            }
          >
            <Avatar size="sm">
              <AvatarFallback>{initials(me.full_name)}</AvatarFallback>
            </Avatar>
            <span className="hidden items-center gap-1.5 text-xs font-medium text-text-primary sm:inline-flex">
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
              <div className="text-xs text-text-secondary">{me.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">
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
