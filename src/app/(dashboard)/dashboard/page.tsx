"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Handshake,
  TrendingUp,
  Users,
} from "lucide-react"

import { googleCalendarUrl } from "@/lib/ics"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { KPIStat } from "@/components/ui/kpi-stat"
import { Sparkline } from "@/components/ui/sparkline"
import { AvatarStack } from "@/components/dashboard/avatar-stack"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { useClients } from "@/hooks/use-clients"
import { useEvents } from "@/hooks/use-events"
import { useLeads } from "@/hooks/use-leads"
import { useClientPartners, usePartners } from "@/hooks/use-partners"
import { useCurrentProfile, useProfiles } from "@/hooks/use-profile"
import { useTasks } from "@/hooks/use-tasks"
import { money, relativeDay } from "@/lib/format"
import {
  activeClientsSeries,
  deltaFromSeries,
  mrrSeries,
  openLeadsSeries,
  tasksDoneSeries,
} from "@/lib/metrics"
import { PipelineFunnel } from "./pipeline-funnel"
import { RecentActivity } from "./recent-activity"

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export default function DashboardHome() {
  const me = useCurrentProfile()
  const { data: profiles = [] } = useProfiles()
  const { data: clients = [] } = useClients()
  const { data: leads = [] } = useLeads()
  const { data: tasks = [] } = useTasks()
  const { data: events = [] } = useEvents()
  const { data: partners = [] } = usePartners()
  const { data: clientPartners = [] } = useClientPartners()

  // ── Time anchors (impure — bake into a useMemo so render stays pure) ────
  const { todayISO, monthStart, nowMs, quarter, year } = React.useMemo(() => {
    const d = new Date()
    return {
      todayISO: d.toISOString().slice(0, 10),
      monthStart: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
      nowMs: d.getTime(),
      quarter: Math.floor(d.getMonth() / 3) + 1,
      year: d.getFullYear(),
    }
  }, [])

  const mrr = clients.reduce((s, c) => s + Number(c.mrr || 0), 0)
  const openLeads = leads.filter((l) => l.stage !== "won" && l.stage !== "lost")
  const pipelineValue = openLeads.reduce((s, l) => s + Number(l.value || 0), 0)
  const todayTasks = tasks.filter(
    (t) => t.status !== "done" && t.due_date && t.due_date <= todayISO
  )
  const urgentToday = todayTasks.filter((t) => t.priority === "urgent")

  const wonThisMonth = leads.filter(
    (l) => l.stage === "won" && new Date(l.updated_at).getTime() >= monthStart
  )
  const wonThisMonthValue = wonThisMonth.reduce(
    (s, l) => s + Number(l.value || 0),
    0
  )

  const doneThisWeek = tasks.filter(
    (t) =>
      t.status === "done" &&
      nowMs - new Date(t.updated_at).getTime() <= WEEK_MS
  ).length

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

  const series = React.useMemo(
    () => ({
      mrr: mrrSeries(clients),
      activeClients: activeClientsSeries(clients),
      openLeads: openLeadsSeries(leads),
      tasksDone: tasksDoneSeries(tasks),
    }),
    [clients, leads, tasks]
  )

  const sourceConversion = React.useMemo(() => {
    const map = new Map<
      string,
      { total: number; won: number; pipelineValue: number }
    >()
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

  const upcoming = React.useMemo(
    () =>
      [...events]
        .filter((e) => new Date(e.start_at).getTime() >= nowMs)
        .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at))
        .slice(0, 5),
    [events, nowMs]
  )

  // Renewals widget — clients with renewal_date inside a [today, today+60d]
  // window. Overdue renewals (date in the past) are intentionally excluded so
  // the widget stays forward-looking; the clients table is where you spot
  // stale renewals via the destructive-red cell.
  const upcomingRenewals = React.useMemo(() => {
    const today = todayISO
    const horizon = new Date()
    horizon.setDate(horizon.getDate() + 60)
    const horizonISO = horizon.toISOString().slice(0, 10)
    return clients
      .filter(
        (c) =>
          c.renewal_date &&
          c.renewal_date >= today &&
          c.renewal_date <= horizonISO
      )
      .sort((a, b) => (a.renewal_date ?? "").localeCompare(b.renewal_date ?? ""))
      .slice(0, 5)
  }, [clients, todayISO])

  const greeting = React.useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return "Good morning"
    if (h < 18) return "Good afternoon"
    return "Good evening"
  }, [])
  const firstName = me.full_name.split(" ")[0]

  return (
    <>
      <PageHeader
        eyebrow={`HOLDING · Q${quarter} ${year}`}
        title={`${greeting}, ${firstName}`}
        description="Here's what's moving across the agency today."
      />

      <div className="stagger-rise space-y-10 px-4 py-8 lg:px-8">
        {/* ── Revenue row ─────────────────────────────────────────────────── */}
        <section style={{ animationDelay: "0ms" }}>
          <SectionLabel>Revenue</SectionLabel>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KPIStat
              label="Recurring revenue"
              value={money(mrr)}
              sub={`${clients.length} clients`}
              icon={<TrendingUp className="size-4" />}
              trend={deltaFromSeries(series.mrr) ?? undefined}
              sparkline={<Sparkline data={series.mrr} />}
            />
            <KPIStat
              label="Active clients"
              value={String(clients.length)}
              sub={`${money(mrr)}/mo`}
              icon={<Users className="size-4" />}
              trend={deltaFromSeries(series.activeClients) ?? undefined}
              sparkline={<Sparkline data={series.activeClients} />}
            />
            <KPIStat
              label="House share"
              value={money(partnerEarnings.houseShare)}
              sub={`${money(partnerEarnings.totalToPartners)} to partners`}
              icon={<TrendingUp className="size-4" />}
              tone="ok"
            />
            <KPIStat
              label="Partners"
              value={String(partners.length)}
              sub={`${clientPartners.length} client links`}
              icon={<Handshake className="size-4" />}
            />
          </div>
        </section>

        {/* ── Operations row ──────────────────────────────────────────────── */}
        <section style={{ animationDelay: "60ms" }}>
          <SectionLabel>Operations</SectionLabel>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KPIStat
              label="Open pipeline"
              value={String(openLeads.length)}
              sub={`${money(pipelineValue)} pipeline`}
              icon={<ArrowUpRight className="size-4" />}
              trend={deltaFromSeries(series.openLeads) ?? undefined}
              sparkline={<Sparkline data={series.openLeads} />}
            />
            <KPIStat
              label="Won this month"
              value={String(wonThisMonth.length)}
              sub={
                wonThisMonth.length > 0
                  ? `${money(wonThisMonthValue)} closed`
                  : "Nothing yet"
              }
              icon={<CheckCircle2 className="size-4" />}
              tone="ok"
            />
            <KPIStat
              label="Tasks due today"
              value={String(todayTasks.length)}
              sub={
                urgentToday.length > 0
                  ? `${urgentToday.length} urgent`
                  : "No urgent tasks"
              }
              icon={<CheckCircle2 className="size-4" />}
              tone={urgentToday.length > 0 ? "warn" : "default"}
            />
            <KPIStat
              label="Tasks done this week"
              value={String(doneThisWeek)}
              sub={`${tasks.filter((t) => t.status === "done").length} all time`}
              icon={<CheckCircle2 className="size-4" />}
              trend={deltaFromSeries(series.tasksDone) ?? undefined}
              sparkline={<Sparkline data={series.tasksDone} />}
            />
          </div>
        </section>

        {/* ── Funnel + Recent activity (1.6fr / 1fr asymmetric) ───────────── */}
        <section
          className="grid gap-4 xl:grid-cols-[1.6fr_1fr]"
          style={{ animationDelay: "120ms" }}
        >
          <PipelineFunnel leads={leads} />
          <RecentActivity />
        </section>

        {/* ── Partner earnings + Conversion by source ─────────────────────── */}
        <section
          className="grid gap-4 lg:grid-cols-2"
          style={{ animationDelay: "180ms" }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Partner earnings — this month</CardTitle>
            </CardHeader>
            <CardContent>
              {partnerEarnings.rows.length === 0 ? (
                <EmptyState
                  size="sm"
                  title="No partners"
                  description="Add a partner to start tracking splits."
                />
              ) : (
                <ul className="space-y-2.5">
                  {partnerEarnings.rows.map((r) => {
                    const max = partnerEarnings.rows[0]?.earned || 1
                    const pct = (r.earned / max) * 100
                    return (
                      <li key={r.id} className="space-y-1">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate font-medium text-text-primary">
                            {r.name}
                          </span>
                          <span className="shrink-0 font-mono tabular-nums text-text-primary">
                            {money(r.earned)}
                            <span className="ml-0.5 text-[10px] font-medium text-text-tertiary">
                              /mo
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                          <div
                            className="h-full rounded-full bg-primary/80"
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
                className="mt-4 inline-block text-xs font-medium text-primary hover:underline"
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
                  size="sm"
                  title="No source data"
                  description="Add leads with a source to see conversion rates."
                />
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {sourceConversion.map((s) => (
                    <li
                      key={s.source}
                      className="flex items-center justify-between gap-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-text-primary">
                          {s.source}
                        </p>
                        <p className="text-[11px] font-medium text-text-tertiary">
                          {s.total} lead{s.total === 1 ? "" : "s"} ·{" "}
                          {money(s.pipelineValue)} pipeline
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-[18px] leading-none tracking-[-0.02em] tabular-nums text-text-primary">
                          {s.rate.toFixed(0)}%
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-text-tertiary">
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

        {/* ── Upcoming renewals ──────────────────────────────────────────── */}
        <section style={{ animationDelay: "210ms" }}>
          <Card>
            <CardHeader>
              <CardTitle>Upcoming renewals</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingRenewals.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={<CalendarClock className="size-4" />}
                  title="No renewals in the next 60 days"
                  description="Add a renewal date on a client to see them here."
                />
              ) : (
                <ul className="divide-y divide-border-subtle">
                  {upcomingRenewals.map((c) => {
                    const days = Math.round(
                      (new Date(c.renewal_date as string).getTime() - nowMs) /
                        (24 * 60 * 60 * 1000)
                    )
                    return (
                      <li key={c.id} className="py-2.5">
                        <Link
                          href={`/clients/${c.id}`}
                          className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1 transition-colors hover:bg-surface-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-text-primary">
                              {c.name}
                            </p>
                            <p className="text-[11px] font-medium text-text-tertiary">
                              {c.renewal_date} · in {days} day
                              {days === 1 ? "" : "s"}
                            </p>
                          </div>
                          <span className="shrink-0 font-mono tabular-nums text-text-primary">
                            {money(Number(c.mrr || 0))}
                            <span className="ml-0.5 text-[10px] font-medium text-text-tertiary">
                              /mo
                            </span>
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── Today's tasks + Upcoming events ─────────────────────────────── */}
        <section
          className="grid gap-4 lg:grid-cols-2"
          style={{ animationDelay: "240ms" }}
        >
          {todayTasks.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Tasks due today</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5">
                  {todayTasks.slice(0, 6).map((t) => {
                    const owners = t.assignee_ids
                      .map((id) => profiles.find((p) => p.id === id))
                      .filter((p): p is NonNullable<typeof p> => Boolean(p))
                    return (
                      <li
                        key={t.id}
                        className="-mx-2 flex items-start gap-2.5 rounded-md p-2 transition-colors hover:bg-surface-3"
                      >
                        <AvatarStack profiles={owners} max={3} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text-primary">
                            {t.title}
                          </p>
                          <p className="text-xs font-medium text-text-tertiary">
                            {relativeDay(t.due_date)}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <Link
                  href="/tasks"
                  className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
                >
                  View all tasks →
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Tasks due today</CardTitle>
              </CardHeader>
              <CardContent>
                <EmptyState
                  size="sm"
                  icon={<CheckCircle2 className="size-4" />}
                  title="Nothing due today"
                  description="A calm runway. Use it well."
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Upcoming events</CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={<Clock className="size-4" />}
                  size="sm"
                  title="No upcoming events"
                />
              ) : (
                <ul className="space-y-3">
                  {upcoming.map((e) => {
                    const dt = new Date(e.start_at)
                    return (
                      <li key={e.id} className="flex items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
                          <span className="font-mono text-[10px] uppercase tracking-[0.1em]">
                            {dt.toLocaleDateString("en-US", { month: "short" })}
                          </span>
                          <span className="-mt-0.5 font-display text-[16px] leading-none tracking-[-0.02em]">
                            {dt.getDate()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text-primary">
                            {e.title}
                          </p>
                          <p className="text-xs font-medium text-text-tertiary">
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
                          className="grid size-7 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-surface-3 hover:text-text-primary"
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
                className="mt-4 inline-block text-xs font-medium text-primary hover:underline"
              >
                Open calendar →
              </Link>
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-tertiary">
      {children}
    </p>
  )
}
