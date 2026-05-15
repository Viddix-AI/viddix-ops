"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRight,
  Briefcase,
  CheckSquare,
  Handshake,
  Mail,
  Move,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { useActivities } from "@/hooks/use-activities"
import { useProfiles } from "@/hooks/use-profile"
import { initials, relativeDay } from "@/lib/format"
import type { Activity, ActivityKind } from "@/lib/types"
import { cn } from "@/lib/utils"

const ICONS: Record<ActivityKind, { icon: LucideIcon; tone: string }> = {
  lead_created:     { icon: Sparkles,  tone: "bg-blue-100 text-blue-700" },
  lead_updated:     { icon: Pencil,    tone: "bg-slate-100 text-slate-700" },
  lead_deleted:     { icon: Trash2,    tone: "bg-rose-100 text-rose-700" },
  lead_converted:   { icon: ArrowRight, tone: "bg-emerald-100 text-emerald-700" },
  lead_moved:       { icon: Move,      tone: "bg-indigo-100 text-indigo-700" },
  client_created:   { icon: Briefcase, tone: "bg-emerald-100 text-emerald-700" },
  client_updated:   { icon: Pencil,    tone: "bg-slate-100 text-slate-700" },
  client_deleted:   { icon: Trash2,    tone: "bg-rose-100 text-rose-700" },
  task_created:     { icon: CheckSquare, tone: "bg-amber-100 text-amber-800" },
  task_updated:     { icon: Pencil,    tone: "bg-slate-100 text-slate-700" },
  task_deleted:     { icon: Trash2,    tone: "bg-rose-100 text-rose-700" },
  partner_created:  { icon: Handshake, tone: "bg-violet-100 text-violet-700" },
  partner_updated:  { icon: Pencil,    tone: "bg-slate-100 text-slate-700" },
  partner_deleted:  { icon: Trash2,    tone: "bg-rose-100 text-rose-700" },
  partner_attached: { icon: Plus,      tone: "bg-violet-100 text-violet-700" },
  partner_detached: { icon: Trash2,    tone: "bg-slate-100 text-slate-700" },
  note_created:     { icon: Mail,      tone: "bg-sky-100 text-sky-700" },
  event_created:    { icon: CheckSquare, tone: "bg-blue-100 text-blue-700" },
  demo_reset:       { icon: RotateCcw, tone: "bg-amber-100 text-amber-800" },
}

const FILTERS: { id: "all" | "leads" | "clients" | "tasks" | "partners"; label: string }[] = [
  { id: "all",      label: "All" },
  { id: "leads",    label: "Leads" },
  { id: "clients",  label: "Clients" },
  { id: "tasks",    label: "Tasks" },
  { id: "partners", label: "Partners" },
]

function categoryOf(a: Activity): "leads" | "clients" | "tasks" | "partners" | "other" {
  if (a.kind.startsWith("lead_"))    return "leads"
  if (a.kind.startsWith("client_"))  return "clients"
  if (a.kind.startsWith("task_"))    return "tasks"
  if (a.kind.startsWith("partner_")) return "partners"
  return "other"
}

function hrefFor(a: Activity): string | null {
  if (a.client_id) return `/clients/${a.client_id}`
  if (a.lead_id)   return `/leads`
  if (a.partner_id) return `/partners`
  return null
}

export function ActivityView() {
  const { data: activities = [] } = useActivities()
  const { data: profiles = [] } = useProfiles()
  const [filter, setFilter] = React.useState<typeof FILTERS[number]["id"]>("all")

  const sorted = React.useMemo(
    () =>
      [...activities].sort(
        (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
      ),
    [activities]
  )

  const visible = React.useMemo(
    () => (filter === "all" ? sorted : sorted.filter((a) => categoryOf(a) === filter)),
    [sorted, filter]
  )

  // Group by day for a friendlier feed.
  const grouped = React.useMemo(() => {
    const map = new Map<string, Activity[]>()
    for (const a of visible) {
      const key = a.created_at.slice(0, 10)
      const list = map.get(key) ?? []
      list.push(a)
      map.set(key, list)
    }
    return Array.from(map.entries())
  }, [visible])

  return (
    <>
      <PageHeader
        title="Activity"
        description={`${activities.length} events tracked across the workspace`}
      />

      <div className="space-y-5 px-4 py-5 lg:px-6">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                filter === f.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="No activity yet"
            description="Mutations across leads, clients, tasks and partners will show up here."
          />
        ) : (
          <div className="space-y-6">
            {grouped.map(([day, items]) => (
              <section key={day}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {relativeDay(day)}
                </h3>
                <ul className="space-y-2">
                  {items.map((a) => {
                    const { icon: Icon, tone } = ICONS[a.kind]
                    const actor = profiles.find((p) => p.id === a.actor_id)
                    const href = hrefFor(a)
                    const inner = (
                      <div className="flex items-start gap-3 rounded-md border border-border bg-background p-3">
                        <span
                          className={cn(
                            "grid size-8 shrink-0 place-items-center rounded-md",
                            tone
                          )}
                        >
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug">{a.message}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {actor?.full_name ?? "System"} ·{" "}
                            {new Date(a.created_at).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        {actor && (
                          <Avatar size="sm" title={actor.full_name}>
                            <AvatarFallback>{initials(actor.full_name)}</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    )
                    return (
                      <li key={a.id}>
                        {href ? (
                          <Link href={href} className="block hover:bg-muted/40 rounded-md">
                            {inner}
                          </Link>
                        ) : (
                          inner
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
