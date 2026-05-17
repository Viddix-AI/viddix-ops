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
import { Pill, type PillTone } from "@/components/ui/pill"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { useActivities } from "@/hooks/use-activities"
import { useProfiles } from "@/hooks/use-profile"
import { initials, relativeDay } from "@/lib/format"
import type { Activity, ActivityKind } from "@/lib/types"
import { cn } from "@/lib/utils"

const ICONS: Record<ActivityKind, { icon: LucideIcon; tone: PillTone }> = {
  lead_created:     { icon: Sparkles,    tone: "blue" },
  lead_updated:     { icon: Pencil,      tone: "slate" },
  lead_deleted:     { icon: Trash2,      tone: "rose" },
  lead_converted:   { icon: ArrowRight,  tone: "emerald" },
  lead_moved:       { icon: Move,        tone: "indigo" },
  client_created:   { icon: Briefcase,   tone: "emerald" },
  client_updated:   { icon: Pencil,      tone: "slate" },
  client_deleted:   { icon: Trash2,      tone: "rose" },
  task_created:     { icon: CheckSquare, tone: "amber" },
  task_updated:     { icon: Pencil,      tone: "slate" },
  task_deleted:     { icon: Trash2,      tone: "rose" },
  partner_created:  { icon: Handshake,   tone: "violet" },
  partner_updated:  { icon: Pencil,      tone: "slate" },
  partner_deleted:  { icon: Trash2,      tone: "rose" },
  partner_attached: { icon: Plus,        tone: "violet" },
  partner_detached: { icon: Trash2,      tone: "slate" },
  note_created:     { icon: Mail,        tone: "sky" },
  event_created:    { icon: CheckSquare, tone: "blue" },
  demo_reset:       { icon: RotateCcw,   tone: "amber" },
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
        eyebrow="HOLDING · LOG"
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
                        <Pill tone={tone} size="md" className="h-8 w-8 px-0">
                          <Icon className="size-3.5" />
                        </Pill>
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
