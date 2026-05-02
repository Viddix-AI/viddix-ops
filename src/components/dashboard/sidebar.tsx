"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import {
  Home,
  Users,
  Briefcase,
  CheckSquare,
  Calendar,
  Sparkles,
} from "lucide-react"

export const NAV_ITEMS = [
  { href: "/dashboard",  label: "Dashboard", icon: Home },
  { href: "/leads",      label: "Leads",     icon: Sparkles },
  { href: "/clients",    label: "Clients",   icon: Briefcase },
  { href: "/tasks",      label: "Tasks",     icon: CheckSquare },
  { href: "/calendar",   label: "Calendar",  icon: Calendar },
] as const

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex"
      style={{ background: "var(--sidebar)" }}
    >
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-5">
        <span
          className="grid size-7 place-items-center rounded-md text-white shadow-sm"
          style={{ background: "#4F8EF7" }}
        >
          <span className="font-heading text-sm font-semibold">V</span>
        </span>
        <span className="font-heading text-sm font-semibold tracking-tight text-white">
          Viddix Ops
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <p className="px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-sidebar-foreground/50 uppercase">
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
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-white/[0.06] text-white"
                  : "text-sidebar-foreground/80 hover:bg-white/[0.04] hover:text-white"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground/60 hover:text-white"
        >
          <span className="size-1.5 rounded-full bg-emerald-400" />
          All systems normal
        </Link>
      </div>
    </aside>
  )
}
