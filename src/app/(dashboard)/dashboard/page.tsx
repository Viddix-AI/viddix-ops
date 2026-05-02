"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight, CheckCircle2, Clock, TrendingUp, Users } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { PriorityBadge } from "@/components/dashboard/priority-badge"
import { UserAvatar } from "@/components/dashboard/user-avatar"
import { useClients } from "@/hooks/use-clients"
import { useEvents } from "@/hooks/use-events"
import { useLeads } from "@/hooks/use-leads"
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

  const activeClients = clients.filter((c) => c.status === "active")
  const mrr = activeClients.reduce((s, c) => s + Number(c.mrr || 0), 0)
  const openLeads = leads.filter((l) => l.stage !== "won" && l.stage !== "lost")
  const todayISO = new Date().toISOString().slice(0, 10)
  const todayTasks = tasks.filter(
    (t) => t.status !== "done" && t.due_date && t.due_date <= todayISO
  )

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
            sub={`${activeClients.length} active clients`}
            icon={<TrendingUp className="size-4" />}
          />
          <StatCard
            label="Active clients"
            value={String(activeClients.length)}
            sub={`${clients.length} total`}
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
            <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
