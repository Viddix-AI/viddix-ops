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
  Star,
  Trash2,
  UserPlus,
  type LucideIcon,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Pill, type PillTone } from "@/components/ui/pill"
import { EmptyState } from "@/components/dashboard/empty-state"
import { UserAvatar } from "@/components/dashboard/user-avatar"
import { useActivities } from "@/hooks/use-activities"
import { useProfiles } from "@/hooks/use-profile"
import type { Activity, ActivityKind } from "@/lib/types"

/**
 * Recent activity feed for the dashboard.
 *
 * Renders the latest N activities from `useActivities()` grouped by day
 * (Today / Yesterday / Mon, Feb 12). Each row shows actor avatar +
 * message + relative time + a small tinted icon.
 *
 * Differs from the full /activity route by:
 *   • Showing only the last DEFAULT_LIMIT entries.
 *   • No filter chips — the route owns that UX.
 *   • A "View all activity →" link to /activity.
 *
 * The icon tone map mirrors the /activity route's so the same event type
 * reads consistently across both surfaces; refactoring both to a shared
 * lookup is in docs/ui-debt.md.
 */

const DEFAULT_LIMIT = 8

const ICON: Record<ActivityKind, { icon: LucideIcon; tone: PillTone }> = {
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
  event_updated:    { icon: Pencil,      tone: "slate" },
  demo_reset:       { icon: RotateCcw,   tone: "amber" },
  contact_created:     { icon: UserPlus,    tone: "emerald" },
  contact_updated:     { icon: Pencil,      tone: "slate" },
  contact_deleted:     { icon: Trash2,      tone: "rose" },
  contact_set_primary: { icon: Star,        tone: "amber" },
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function dayLabel(iso: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

function timeOnly(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

function hrefFor(a: Activity): string | null {
  if (a.client_id) return `/clients/${a.client_id}`
  if (a.lead_id) return "/leads"
  if (a.partner_id) return "/partners"
  if (a.task_id) return "/tasks"
  return null
}

export function RecentActivity({ limit = DEFAULT_LIMIT }: { limit?: number }) {
  const { data: activities = [] } = useActivities()
  const { data: profiles = [] } = useProfiles()

  const sorted = React.useMemo(
    () =>
      [...activities]
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        .slice(0, limit),
    [activities, limit]
  )

  // Group by day. Order is preserved because `sorted` is already
  // newest-first, so the first item per key sets the group ordering.
  const grouped = React.useMemo(() => {
    const map = new Map<string, Activity[]>()
    for (const a of sorted) {
      const key = dayKey(a.created_at)
      const list = map.get(key) ?? []
      list.push(a)
      map.set(key, list)
    }
    return Array.from(map.entries())
  }, [sorted])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <EmptyState
            size="sm"
            title="Nothing yet"
            description="Lead, client, task and partner changes will show up here."
          />
        ) : (
          <div className="space-y-4">
            {grouped.map(([day, items]) => {
              const sample = items[0]
              return (
                <section key={day}>
                  <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
                    {dayLabel(sample.created_at)}
                  </p>
                  <ul className="space-y-1.5">
                    {items.map((a) => {
                      const { icon: Icon, tone } = ICON[a.kind]
                      const actor = profiles.find((p) => p.id === a.actor_id)
                      const href = hrefFor(a)
                      const row = (
                        <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-3">
                          <Pill
                            tone={tone}
                            size="sm"
                            className="size-6 justify-center px-0"
                          >
                            <Icon className="size-3" />
                          </Pill>
                          <p className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                            {a.message}
                          </p>
                          {actor && (
                            <UserAvatar profile={actor} size="sm" />
                          )}
                          <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-text-tertiary">
                            {timeOnly(a.created_at)}
                          </span>
                        </div>
                      )
                      return (
                        <li key={a.id}>
                          {href ? <Link href={href}>{row}</Link> : row}
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
            <Link
              href="/activity"
              className="block pt-1 text-xs font-medium text-primary hover:underline"
            >
              View all activity →
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
