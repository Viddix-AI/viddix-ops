"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import {
  Activity as ActivityIcon,
  Home,
  Briefcase,
  Calendar,
  CheckSquare,
  Handshake,
  Sparkles,
} from "lucide-react"

export const NAV_ITEMS = [
  { href: "/dashboard",  label: "Dashboard", icon: Home },
  { href: "/leads",      label: "Leads",     icon: Sparkles },
  { href: "/clients",    label: "Clients",   icon: Briefcase },
  { href: "/partners",   label: "Partners",  icon: Handshake },
  { href: "/tasks",      label: "Tasks",     icon: CheckSquare },
  { href: "/calendar",   label: "Calendar",  icon: Calendar },
  { href: "/activity",   label: "Activity",  icon: ActivityIcon },
] as const

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex"
      style={{ background: "var(--sidebar)" }}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-5">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm">
          <span className="font-heading text-sm font-semibold">V</span>
        </span>
        <span className="font-heading text-sm font-semibold tracking-tight text-white">
          Viddix Ops
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        <p className="px-2.5 pt-2 pb-1.5 text-[10px] font-semibold tracking-wider text-sidebar-foreground/70 uppercase">
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
                "relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
                active
                  ? "bg-sidebar-accent text-white before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-sidebar-primary"
                  : "text-sidebar-foreground/85 hover:bg-white/[0.05] hover:text-white"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <StorageStatus />
      </div>
    </aside>
  )
}

function StorageStatus() {
  // Show whether the localStorage-backed store is healthy. Using the
  // store-info-from-previous-renders pattern (instead of useEffect) keeps the
  // probe SSR-safe — first render reports "checking", a subsequent client
  // render flips it to ok/down based on a tiny round-trip.
  const [status, setStatus] = React.useState<"checking" | "ok" | "down">("checking")
  const [checked, setChecked] = React.useState(false)
  if (!checked && typeof window !== "undefined") {
    setChecked(true)
    try {
      const probe = "__viddix_health__"
      window.localStorage.setItem(probe, "1")
      window.localStorage.removeItem(probe)
      setStatus("ok")
    } catch {
      setStatus("down")
    }
  }
  const tone =
    status === "ok" ? "bg-emerald-400" : status === "down" ? "bg-rose-400" : "bg-amber-400"
  const label =
    status === "ok"
      ? "Local store ready"
      : status === "down"
      ? "Local store unavailable"
      : "Checking storage…"
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-sidebar-foreground/60">
      <span className={cn("size-1.5 rounded-full", tone)} />
      {label}
    </div>
  )
}
