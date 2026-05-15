"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  CalendarPlus,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
} from "lucide-react"

import { googleCalendarUrl } from "@/lib/ics"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { PriorityBadge } from "@/components/dashboard/priority-badge"
import { UserAvatar } from "@/components/dashboard/user-avatar"
import { useClients } from "@/hooks/use-clients"
import { useEvents } from "@/hooks/use-events"
import { useLeads } from "@/hooks/use-leads"
import { useClientPartners, usePartners } from "@/hooks/use-partners"
import { useCurrentProfile, useProfiles } from "@/hooks/use-profile"
import { useTasks } from "@/hooks/use-tasks"
import { money, relativeDay } from "@/lib/format"
import { LEAD_STAGES } from "@/lib/types"
import { cn } from "@/lib/utils"

export default function DashboardHome() {
  const me = useCurrentProfile()
  const { data: profiles = [] } = useProfiles()
  const { data: clients = [] } = useClients()
  const { data: leads = [] } = useLeads()
  const { data: tasks = [] } = useTasks()
  const { data: events = [] } = useEvents()
  const { data: partners = [] } = usePartners()
  const { data: clientPartners = [] } = useClientPartners()

  const mrr = clients.reduce((s, c) => s + Number(c.mrr || 0), 0)
  const openLeads = leads.filter((l) => l.stage !== "won" && l.stage !== "lost")
  const todayISO = new Date().toISOString().slice(0, 10)
  const todayTasks = tasks.filter(
    (t) => t.status !== "done" && t.due_date && t.due_date <= todayISO
  )

  // Partner earnings: per partner, sum (client.mrr * split_pct / 100) across
  // every active retainer they're attached to. The "house share" is whatever
  // is left after every split on that client. Derives `activeClients` inline
  // so React Compiler can preserve memoization across re-renders.
  const partnerEarnings = React.useMemo(() => {
    const byPartner = new Map<string, number>()
    let totalToPartners = 0
    let houseShare = 0
    for (const c of clients) {
      const links = clientPartners.filter((cp) => cp.client_id === c.id)
      const allocated = links.reduce((s, l) => s + l.split_pct, 0)
      houseShare += (Number(c.mrr || 0) * Math.max(0, 100 - allocated)) / 100
      for (const l of links) {
        const earned = (Number(c.mrr || 0) * l.split_pct) / 100
        byPartner.set(l.partner_id, (byPartner.get(l.partner_id) ?? 0) + earned)
        totalToPartners += earned
      }
    }
    const rows = partners
      .map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        earned: byPartner.get(p.id) ?? 0,
      }))
      .sort((a, b) => b.earned - a.earned)
    return { rows, totalToPartners, houseShare }
  }, [clients, clientPartners, partners])

  // Conversion-by-source: per known source string, count leads + how many
  // ended in `won`. Skips empty sources to keep the table clean.
  const sourceConversion = React.useMemo(() => {
    const map = new Map<string, { total: number; won: number; pipelineValue: number }>()
    for (const l of leads) {
      const key = (l.source ?? "").trim()
      if (!key) continue
      const cur = map.get(key) ?? { total: 0, won: 0, pipelineValue: 0 }
      cur.total += 1
      cur.pipelineValue += Number(l.value || 0)
      if (l.stage === "won") cur.won += 1
      map.set(key, cur)
    }
    return Array.from(map.entries())
      .map(([source, stats]) => ({
        source,
        ...stats,
        rate: stats.total === 0 ? 0 : (stats.won / stats.total) * 100,
      }))
      .sort((a, b) => b.total - a.total)
  }, [leads])

  const upcoming = [...events]
    .filter((e) => new Date(e.start_at) >= new Date())
    .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at))
    .slice(0, 5)

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return "Good morning"
    if (h < 18) return "Good afternoon"
    return "Good evening"
  })()
  const firstName = me.full_name.split(" ")[0]

  const recent = [
    ...leads.slice(-3).map((l) => ({
      kind: "lead" as const,
      id: l.id,
      title: `${l.name} — ${l.company ?? "lead"}`,
      meta: `Stage · ${LEAD_STAGES.find((s) => s.id === l.stage)?.label}`,
      ts: l.updated_at,
    })),
    ...tasks.slice(-3).map((t) => ({
      kind: "task" as const,
      id: t.id,
      title: t.title,
      meta: t.status === "done" ? "Completed" : "Updated",
      ts: t.updated_at,
    })),
  ]
    .sort((a, b) => +new Date(b.ts) - +new Date(a.ts))
    .slice(0, 6)

  return (
    <>
      <PageHeader
        title={`${greeting}, ${firstName}`}
        description="Here's what's moving across the agency today."
      />

      <div className="space-y-6 px-4 py-6 lg:px-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Monthly recurring revenue"
            value={money(mrr)}
            sub={`${clients.length} clients`}
            icon={<TrendingUp className="size-4" />}
          />
          <StatCard
            label="Clients"
            value={String(clients.length)}
            sub={`${money(mrr)}/mo total`}
            icon={<Users className="size-4" />}
          />
          <StatCard
            label="Open leads"
            value={String(openLeads.length)}
            sub={`${money(openLeads.reduce((s, l) => s + Number(l.value || 0), 0))} potential`}
            icon={<ArrowUpRight className="size-4" />}
          />
          <StatCard
            label="Tasks due today"
            value={String(todayTasks.length)}
            sub={tasks.filter((t) => t.status === "done").length + " done · all-time"}
            icon={<CheckCircle2 className="size-4" />}
            tone={todayTasks.some((t) => t.priority === "urgent") ? "warn" : "ok"}
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <StatCard
            label="House share"
            value={money(partnerEarnings.houseShare)}
            sub={`${money(partnerEarnings.totalToPartners)}/mo to partners`}
            icon={<TrendingUp className="size-4" />}
          />
          <StatCard
            label="Total partners"
            value={String(partners.length)}
            sub={`${clientPartners.length} client links`}
            icon={<Users className="size-4" />}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {LEAD_STAGES.map((stage) => {
                  const count = leads.filter((l) => l.stage === stage.id).length
                  const total = leads.length || 1
                  const pct = (count / total) * 100
                  return (
                    <div key={stage.id} className="space-y-1">
                      <div className="h-20 rounded-md bg-muted/60">
                        <div
                          className="h-full w-full rounded-md transition-all"
                          style={{
                            background:
                              "linear-gradient(180deg, rgba(79,142,247,.18) 0%, rgba(79,142,247,.5) 100%)",
                            transform: `scaleY(${Math.max(pct / 100, 0.06)})`,
                            transformOrigin: "bottom",
                          }}
                        />
                      </div>
                      <p className="text-[10px] font-medium text-muted-foreground">
                        {stage.label}
                      </p>
                      <p className="text-sm font-semibold tabular-nums">
                        {count}
                      </p>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span>{leads.length} total leads</span>
                <Link
                  href="/leads"
                  className="font-medium text-primary hover:underline"
                >
                  Open pipeline →
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tasks due today</CardTitle>
            </CardHeader>
            <CardContent>
              {todayTasks.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="size-4" />}
                  title="All clear"
                  description="No tasks due today. Nice."
                  className="py-6"
                />
              ) : (
                <ul className="space-y-2.5">
                  {todayTasks.slice(0, 6).map((t) => {
                    const owner = profiles.find((p) => p.id === t.assignee_id)
                    return (
                      <li
                        key={t.id}
                        className="flex items-start gap-2.5 rounded-md p-2 -mx-2 hover:bg-muted/60"
                      >
                        <UserAvatar profile={owner} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{t.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {relativeDay(t.due_date)}
                          </p>
                        </div>
                        <PriorityBadge priority={t.priority} />
                      </li>
                    )
                  })}
                </ul>
              )}
              <Link
                href="/tasks"
                className="mt-3 block text-xs font-medium text-primary hover:underline"
              >
                View all tasks →
              </Link>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Partner earnings (this month)</CardTitle>
            </CardHeader>
            <CardContent>
              {partnerEarnings.rows.length === 0 ? (
                <EmptyState
                  title="No partners"
                  description="Add a partner to start tracking splits."
                  className="py-6"
                />
              ) : (
                <ul className="space-y-2">
                  {partnerEarnings.rows.map((r) => {
                    const max = partnerEarnings.rows[0]?.earned || 1
                    const pct = (r.earned / max) * 100
                    return (
                      <li key={r.id} className="space-y-1">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate font-medium">{r.name}</span>
                          <span className="shrink-0 tabular-nums">
                            {money(r.earned)}
                            <span className="ml-0.5 text-[10px] text-muted-foreground">/mo</span>
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-blue-500/80"
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              <Link
                href="/partners"
                className="mt-4 block text-xs font-medium text-primary hover:underline"
              >
                Manage partners →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Conversion by source</CardTitle>
            </CardHeader>
            <CardContent>
              {sourceConversion.length === 0 ? (
                <EmptyState
                  title="No source data"
                  description="Add leads with a source to see conversion rates."
                  className="py-6"
                />
              ) : (
                <ul className="divide-y divide-border">
                  {sourceConversion.map((s) => (
                    <li
                      key={s.source}
                      className="flex items-center justify-between gap-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.source}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {s.total} lead{s.total === 1 ? "" : "s"} ·{" "}
                          {money(s.pipelineValue)} pipeline
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-heading text-sm font-semibold tabular-nums">
                          {s.rate.toFixed(0)}%
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {s.won}/{s.total} won
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming events</CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={<Clock className="size-4" />}
                  title="No upcoming events"
                  className="py-6"
                />
              ) : (
                <ul className="space-y-3">
                  {upcoming.map((e) => {
                    const dt = new Date(e.start_at)
                    return (
                      <li key={e.id} className="flex items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
                          <span className="text-[10px] font-medium uppercase">
                            {dt.toLocaleDateString("en-US", { month: "short" })}
                          </span>
                          <span className="-mt-0.5 text-sm font-semibold">
                            {dt.getDate()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {e.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {dt.toLocaleString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}{" "}
                            · {e.event_type}
                          </p>
                        </div>
                        <a
                          href={googleCalendarUrl({
                            title: e.title,
                            startISO: e.start_at,
                            endISO: e.end_at,
                            description: e.description,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Add to Google Calendar"
                          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <CalendarPlus className="size-3.5" />
                        </a>
                      </li>
                    )
                  })}
                </ul>
              )}
              <Link
                href="/calendar"
                className="mt-4 block text-xs font-medium text-primary hover:underline"
              >
                Open calendar →
              </Link>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <EmptyState title="Nothing yet" className="py-6" />
              ) : (
                <ul className="space-y-3">
                  {recent.map((r) => (
                    <li
                      key={`${r.kind}-${r.id}`}
                      className="flex items-start gap-3 rounded-md border border-border bg-background p-3"
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-7 place-items-center rounded-md text-[10px] font-semibold uppercase ring-1",
                          r.kind === "lead"
                            ? "bg-blue-50 text-blue-700 ring-blue-100"
                            : "bg-emerald-50 text-emerald-700 ring-emerald-100"
                        )}
                      >
                        {r.kind === "lead" ? "L" : "T"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.meta} · {relativeDay(r.ts)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  )
}

function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "default",
}: {
  label: string
  value: string
  sub?: string
  icon?: React.ReactNode
  tone?: "default" | "warn" | "ok"
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <span
            className={cn(
              "grid size-7 place-items-center rounded-md ring-1",
              tone === "warn"
                ? "bg-amber-50 text-amber-700 ring-amber-100"
                : tone === "ok"
                ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                : "bg-accent text-accent-foreground ring-blue-100"
            )}
          >
            {icon}
          </span>
        </div>
        <div>
          <p className="font-heading text-2xl font-semibold tabular-nums tracking-tight">
            {value}
          </p>
          {sub && (
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">{sub}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
