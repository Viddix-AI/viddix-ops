"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowUpRight,
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
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { UserAvatar } from "@/components/dashboard/user-avatar"
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
  const { todayISO, monthStart, nowMs } = React.useMemo(() => {
    const d = new Date()
    return {
      todayISO: d.toISOString().slice(0, 10),
      monthStart: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
      nowMs: d.getTime(),
    }
  }, [])

  // ── Aggregates ────────────────────────────────────────────────────────────
  const mrr = clients.reduce((s, c) => s + Number(c.mrr || 0), 0)
  const openLeads = leads.filter((l) => l.stage !== "won" && l.stage !== "lost")
  const pipelineValue = openLeads.reduce((s, l) => s + Number(l.value || 0), 0)
  const todayTasks = tasks.filter(
    (t) => t.status !== "done" && t.due_date && t.due_date <= todayISO
  )
  const urgentToday = todayTasks.filter((t) => t.priority === "urgent")

  // Won-this-month: leads in `won` whose updated_at falls in the calendar
  // month-to-date. We use updated_at because that's the conversion stamp.
  const wonThisMonth = leads.filter(
    (l) => l.stage === "won" && new Date(l.updated_at).getTime() >= monthStart
  )
  const wonThisMonthValue = wonThisMonth.reduce(
    (s, l) => s + Number(l.value || 0),
    0
  )

  // Tasks completed in the last 7 days (looser bucket than "this calendar
  // week" so the metric doesn't reset on Monday morning).
  const doneThisWeek = tasks.filter(
    (t) =>
      t.status === "done" &&
      nowMs - new Date(t.updated_at).getTime() <= WEEK_MS
  ).length

  // Partner earnings: per-partner sum of (client.mrr * split_pct / 100)
  // across every retainer. House share = whatever's left.
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

  // ── Time series for sparklines ───────────────────────────────────────────
  const series = React.useMemo(
    () => ({
      mrr: mrrSeries(clients),
      activeClients: activeClientsSeries(clients),
      openLeads: openLeadsSeries(leads),
      tasksDone: tasksDoneSeries(tasks),
    }),
    [clients, leads, tasks]
  )

  // ── Conversion by source ─────────────────────────────────────────────────
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
        title={`${greeting}, ${firstName}`}
        description="Here's what's moving across the agency today."
      />

      <div className="space-y-6 px-4 py-6 lg:px-6">
        {/* ── Revenue row ────────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Revenue</SectionLabel>
          <div className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KPIStat
              label="Monthly recurring revenue"
              value={money(mrr)}
              sub={`${clients.length} clients`}
              icon={<TrendingUp className="size-4" />}
              trend={deltaFromSeries(series.mrr) ?? undefined}
              sparkline={
                <Sparkline data={series.mrr} className="text-primary" />
              }
            />
            <KPIStat
              label="Active clients"
              value={String(clients.length)}
              sub={`${money(mrr)}/mo total`}
              icon={<Users className="size-4" />}
              trend={deltaFromSeries(series.activeClients) ?? undefined}
              sparkline={
                <Sparkline
                  data={series.activeClients}
                  className="text-primary"
                />
              }
            />
            <KPIStat
              label="House share"
              value={money(partnerEarnings.houseShare)}
              sub={`${money(partnerEarnings.totalToPartners)}/mo to partners`}
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

        {/* ── Operations row ─────────────────────────────────────────────── */}
        <section>
          <SectionLabel>Operations</SectionLabel>
          <div className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KPIStat
              label="Open leads"
              value={String(openLeads.length)}
              sub={`${money(pipelineValue)} pipeline`}
              icon={<ArrowUpRight className="size-4" />}
              trend={deltaFromSeries(series.openLeads) ?? undefined}
              sparkline={
                <Sparkline data={series.openLeads} className="text-primary" />
              }
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
              sparkline={
                <Sparkline data={series.tasksDone} className="text-primary" />
              }
            />
          </div>
        </section>

        {/* ── Pipeline funnel ────────────────────────────────────────────── */}
        <PipelineFunnel leads={leads} />

        {/* ── Partner earnings + Conversion by source ────────────────────── */}
        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Partner earnings (this month)</CardTitle>
            </CardHeader>
            <CardContent>
              {partnerEarnings.rows.length === 0 ? (
                <EmptyState
                  size="sm"
                  title="No partners"
                  description="Add a partner to start tracking splits."
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
                            <span className="ml-0.5 text-[10px] font-medium text-muted-foreground">
                              /mo
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
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
                  size="sm"
                  title="No source data"
                  description="Add leads with a source to see conversion rates."
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
                        <p className="text-[11px] font-medium text-muted-foreground">
                          {s.total} lead{s.total === 1 ? "" : "s"} ·{" "}
                          {money(s.pipelineValue)} pipeline
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-heading text-sm font-semibold tabular-nums">
                          {s.rate.toFixed(0)}%
                        </p>
                        <p className="text-[11px] font-medium text-muted-foreground">
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

        {/* ── Recent activity + Upcoming events ──────────────────────────── */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentActivity />
          </div>
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
                          <p className="text-xs font-medium text-muted-foreground">
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
                          className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
        </section>

        {/* ── Today's tasks (compact list, kept from previous layout) ────── */}
        {todayTasks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Tasks due today</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {todayTasks.slice(0, 6).map((t) => {
                  const owner = profiles.find((p) => p.id === t.assignee_id)
                  return (
                    <li
                      key={t.id}
                      className="flex items-start gap-2.5 rounded-md p-2 -mx-2 transition-colors hover:bg-muted/60"
                    >
                      <UserAvatar profile={owner} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{t.title}</p>
                        <p className="text-xs font-medium text-muted-foreground">
                          {relativeDay(t.due_date)}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <Link
                href="/tasks"
                className="mt-3 block text-xs font-medium text-primary hover:underline"
              >
                View all tasks →
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

/**
 * Small uppercase section label that headers each KPI row. Pulls the same
 * 10px font-medium uppercase tracking pattern used elsewhere in the app
 * for visual consistency.
 */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
      {children}
    </p>
  )
}
