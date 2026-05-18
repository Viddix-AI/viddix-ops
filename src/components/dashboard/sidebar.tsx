"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useCurrentProfile } from "@/hooks/use-profile"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  Activity as ActivityIcon,
  Home,
  Briefcase,
  Calendar,
  CheckSquare,
  Handshake,
  Settings,
  Sparkles,
} from "lucide-react"

export const NAV_ITEMS = [
  { href: "/dashboard",  label: "Dashboard", icon: Home },
  { href: "/leads",      label: "Pipeline",  icon: Sparkles },
  { href: "/clients",    label: "Clients",   icon: Briefcase },
  { href: "/partners",   label: "Partners",  icon: Handshake },
  { href: "/tasks",      label: "Tasks",     icon: CheckSquare },
  { href: "/calendar",   label: "Calendar",  icon: Calendar },
  { href: "/activity",   label: "Activity",  icon: ActivityIcon },
  { href: "/settings",   label: "Settings",  icon: Settings },
] as const

export function Sidebar() {
  const pathname = usePathname()
  const me = useCurrentProfile()

  return (
    <aside
      className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex"
      style={{ background: "var(--sidebar)" }}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-5">
        <span
          className="font-display text-[28px] leading-none text-white"
          style={{ fontFeatureSettings: '"ss01"', letterSpacing: "-0.04em" }}
          aria-hidden
        >
          V
        </span>
        <span className="text-[13px] font-medium tracking-[-0.01em] text-white">
          Viddix Ops
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        <p className="px-2.5 pt-2 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
          Workspace
        </p>
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href))
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors duration-150 ease-[cubic-bezier(.2,.6,.2,1)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
                active
                  ? "bg-white/[0.04] text-white before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-sidebar-primary"
                  : "text-sidebar-foreground/85 hover:bg-white/[0.04] hover:text-white"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="space-y-2 border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
          <Avatar size="sm" className="ring-1 ring-white/10">
            <AvatarFallback className="bg-white/[0.06] text-[11px] font-medium text-white">
              {initials(me.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium leading-tight text-white">
              {me.full_name}
            </p>
            <p className="mt-0.5 truncate text-[11px] leading-tight text-sidebar-foreground/60">
              {me.email}
            </p>
          </div>
        </div>
        <StorageStatus />
      </div>
    </aside>
  )
}

// useSyncExternalStore is the React-blessed way to read a value that differs
// between server and client without tripping the hydration-mismatch warning:
// the server snapshot renders first, hydration matches it exactly, and React
// then schedules a post-commit re-render with the client snapshot.
const STORAGE_SUBSCRIBE = () => () => {}
const STORAGE_SERVER_SNAPSHOT = () => "checking" as const
const STORAGE_CLIENT_SNAPSHOT = (): "ok" | "down" => {
  try {
    const probe = "__viddix_health__"
    window.localStorage.setItem(probe, "1")
    window.localStorage.removeItem(probe)
    return "ok"
  } catch {
    return "down"
  }
}

function StorageStatus() {
  const status = React.useSyncExternalStore(
    STORAGE_SUBSCRIBE,
    STORAGE_CLIENT_SNAPSHOT,
    STORAGE_SERVER_SNAPSHOT,
  )
  const tone =
    status === "ok" ? "bg-emerald-400" : status === "down" ? "bg-rose-400" : "bg-amber-400"
  const label =
    status === "ok"
      ? "Local store ready"
      : status === "down"
      ? "Local store unavailable"
      : "Checking storage…"
  return (
    <div className="flex items-center gap-2 px-2 py-1 text-[11px] text-sidebar-foreground/60">
      <span className={cn("size-1.5 rounded-full", tone)} />
      {label}
    </div>
  )
}
