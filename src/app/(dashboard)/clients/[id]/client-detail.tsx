"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Mail, Phone, Globe, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EditableTaskRow } from "@/components/dashboard/editable-task-row"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { UserAvatar } from "@/components/dashboard/user-avatar"
import { useClient, useUpdateClient } from "@/hooks/use-clients"
import { useEvents } from "@/hooks/use-events"
import { useCreateNote, useNotesFor } from "@/hooks/use-notes"
import {
  useAttachPartner,
  useDetachPartner,
  usePartners,
  usePartnersForClient,
  useUpdateClientPartner,
} from "@/hooks/use-partners"
import { useCurrentProfile, useProfiles } from "@/hooks/use-profile"
import { useCreateTask, useTasks } from "@/hooks/use-tasks"
import { money, relativeDay } from "@/lib/format"

export function ClientDetail({ id }: { id: string }) {
  const { data: client } = useClient(id)
  const update = useUpdateClient()
  const { data: profiles = [] } = useProfiles()
  const me = useCurrentProfile()
  const { data: tasks = [] } = useTasks()
  const { data: events = [] } = useEvents()
  const { data: notes = [] } = useNotesFor({ clientId: id })

  if (!client) {
    return (
      <div className="px-4 py-6 lg:px-6">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Clients
        </Link>
        <EmptyState
          title="Client not found"
          description="This client may have been deleted."
          className="mt-6"
        />
      </div>
    )
  }

  const owner = profiles.find((p) => p.id === client.owner_id)
  const clientTasks = tasks.filter((t) => t.client_id === client.id)
  const clientEvents = events
    .filter((e) => e.client_id === client.id)
    .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at))

  return (
    <>
      <PageHeader
        title={client.name}
        description={
          <Link
            href="/clients"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Back to clients
          </Link>
        }
      />

      <div className="space-y-6 px-4 py-5 lg:px-6">
        <section className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <ContactRow icon={<Mail className="size-3.5" />} label="Email" value={client.contact_email} />
                <ContactRow icon={<Phone className="size-3.5" />} label="Phone" value={client.contact_phone} />
                <ContactRow icon={<Globe className="size-3.5" />} label="Website" value={client.website} />
                <ContactRow label="Industry" value={client.industry} />
                <ContactRow label="Started" value={client.started_at} />
                <ContactRow label="Contact" value={client.contact_name} />
              </div>
              {client.notes && (
                <p className="mt-4 rounded-md bg-muted/50 p-3 text-sm text-foreground/80">
                  {client.notes}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">MRR</p>
                <p className="font-heading text-2xl font-semibold tabular-nums">
                  {money(Number(client.mrr || 0))}
                </p>
              </div>
              <Field label="Owner">
                <Select
                  value={client.owner_id ?? ""}
                  onValueChange={(v) =>
                    update.mutate({ id: client.id, patch: { owner_id: v || null } })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="MRR">
                <Input
                  type="number"
                  defaultValue={String(client.mrr ?? 0)}
                  onBlur={(e) =>
                    update.mutate({
                      id: client.id,
                      patch: { mrr: Number(e.target.value) || 0 },
                    })
                  }
                />
              </Field>
              {owner && (
                <div className="flex items-center gap-2 rounded-md border border-border p-2">
                  <UserAvatar profile={owner} size="sm" />
                  <div>
                    <p className="text-xs font-medium">{owner.full_name}</p>
                    <p className="text-[10px] text-muted-foreground">{owner.email}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <Tabs defaultValue="tasks">
          <TabsList className="bg-muted">
            <TabsTrigger value="tasks">Tasks · {clientTasks.length}</TabsTrigger>
            <TabsTrigger value="notes">Notes · {notes.length}</TabsTrigger>
            <TabsTrigger value="events">Events · {clientEvents.length}</TabsTrigger>
            <TabsTrigger value="partners">Partners</TabsTrigger>
          </TabsList>

          <TabsPrimitive.Panel value="tasks" className="mt-4">
            <TasksTab
              clientId={client.id}
              tasks={clientTasks}
              ownerId={client.owner_id ?? me.id}
            />
          </TabsPrimitive.Panel>
          <TabsPrimitive.Panel value="notes" className="mt-4">
            <NotesTab clientId={client.id} />
          </TabsPrimitive.Panel>
          <TabsPrimitive.Panel value="events" className="mt-4">
            <EventsTab events={clientEvents} />
          </TabsPrimitive.Panel>
          <TabsPrimitive.Panel value="partners" className="mt-4">
            <PartnersTab clientId={client.id} mrr={Number(client.mrr || 0)} />
          </TabsPrimitive.Panel>
        </Tabs>
      </div>
    </>
  )
}

function ContactRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode
  label: string
  value: string | null | undefined
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {icon && <span className="mt-0.5 text-muted-foreground">{icon}</span>}
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="truncate">{value ?? "—"}</p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-foreground/80">{label}</span>
      {children}
    </label>
  )
}

function TasksTab({
  clientId,
  tasks,
  ownerId,
}: {
  clientId: string
  tasks: ReturnType<typeof useTasks>["data"]
  ownerId: string | null
}) {
  const create = useCreateTask()
  const [title, setTitle] = React.useState("")
  const [due, setDue] = React.useState("")
  return (
    <Card>
      <CardContent className="space-y-3 py-2">
        <div className="space-y-2 rounded-md border border-border bg-background p-2.5">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New task — what needs to happen?"
            className="h-9"
          />
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="h-9 flex-1"
            />
            <Button
              disabled={!title.trim()}
              onClick={() =>
                create.mutate(
                  {
                    title: title.trim(),
                    client_id: clientId,
                    assignee_id: ownerId,
                    due_date: due || null,
                  },
                  {
                    onSuccess: () => {
                      setTitle("")
                      setDue("")
                      toast.success("Task added")
                    },
                  }
                )
              }
            >
              <Plus />
              Add
            </Button>
          </div>
        </div>
        {tasks && tasks.length > 0 ? (
          <ul className="space-y-2">
            {tasks.map((t) => (
              <EditableTaskRow key={t.id} task={t} />
            ))}
          </ul>
        ) : (
          <EmptyState title="No tasks" description="Add the first task for this client." />
        )}
      </CardContent>
    </Card>
  )
}

function NotesTab({ clientId }: { clientId: string }) {
  const me = useCurrentProfile()
  const { data: profiles = [] } = useProfiles()
  const { data: notes = [] } = useNotesFor({ clientId })
  const create = useCreateNote()
  const [text, setText] = React.useState("")

  return (
    <Card>
      <CardContent className="space-y-3 py-2">
        <div className="rounded-md border border-border bg-background p-2.5">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Log a note for this client…"
            className="border-0 bg-transparent p-0 focus-visible:ring-0"
          />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm"
              disabled={!text.trim() || create.isPending}
              onClick={() =>
                create.mutate(
                  { content: text.trim(), client_id: clientId, author_id: me.id },
                  {
                    onSuccess: () => {
                      setText("")
                      toast.success("Note saved")
                    },
                  }
                )
              }
            >
              Save note
            </Button>
          </div>
        </div>
        {notes.length === 0 ? (
          <EmptyState title="No notes yet" />
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => {
              const author = profiles.find((p) => p.id === n.author_id)
              return (
                <li key={n.id} className="rounded-md border border-border bg-background p-3 text-sm">
                  <p>{n.content}</p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {author?.full_name ?? "—"} · {relativeDay(n.created_at)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function PartnersTab({ clientId, mrr }: { clientId: string; mrr: number }) {
  const { data: allPartners = [] } = usePartners()
  const { data: links = [] } = usePartnersForClient(clientId)
  const attach = useAttachPartner()
  const updateLink = useUpdateClientPartner()
  const detach = useDetachPartner()

  const linkedIds = new Set(links.map((l) => l.partner_id))
  const available = allPartners.filter((p) => !linkedIds.has(p.id))

  const totalSplit = links.reduce((s, l) => s + l.split_pct, 0)
  const totalAllocated = links.reduce((s, l) => s + (mrr * l.split_pct) / 100, 0)
  const remaining = Math.max(0, 100 - totalSplit)
  const houseShare = (mrr * remaining) / 100

  return (
    <Card>
      <CardContent className="space-y-4 py-3">
        <div className="grid grid-cols-3 gap-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Allocated</p>
            <p className="font-heading text-base font-semibold tabular-nums">{totalSplit}%</p>
            <p className="text-xs text-muted-foreground">{money(totalAllocated)}/mo</p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">House share</p>
            <p className="font-heading text-base font-semibold tabular-nums">{remaining}%</p>
            <p className="text-xs text-muted-foreground">{money(houseShare)}/mo</p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Client MRR</p>
            <p className="font-heading text-base font-semibold tabular-nums">{money(mrr)}</p>
            <p className="text-xs text-muted-foreground">/mo</p>
          </div>
        </div>

        {totalSplit > 100 && (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            Splits exceed 100% — adjust before paying out.
          </p>
        )}

        <div className="flex items-center gap-2">
          <Select
            value=""
            onValueChange={(v) => {
              if (!v) return
              attach.mutate(
                { client_id: clientId, partner_id: v },
                { onSuccess: () => toast.success("Partner attached") }
              )
            }}
            disabled={available.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  available.length === 0
                    ? "All partners already attached"
                    : "Attach partner…"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {available.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} · {p.default_split_pct}% default
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link
            href="/partners"
            className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Manage
          </Link>
        </div>

        {links.length === 0 ? (
          <EmptyState
            title="No partners attached"
            description="Attach a partner to allocate a share of this client's MRR."
          />
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {links.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.partner?.name ?? "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.partner?.role ?? "Partner"}
                  </p>
                </div>
                <SplitInput
                  value={l.split_pct}
                  onSave={(pct) =>
                    updateLink.mutate({ id: l.id, patch: { split_pct: pct } })
                  }
                />
                <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {money((mrr * l.split_pct) / 100)}/mo
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Detach"
                  onClick={() =>
                    detach.mutate(l.id, {
                      onSuccess: () => toast.success("Partner detached"),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function SplitInput({
  value,
  onSave,
}: {
  value: number
  onSave: (pct: number) => void
}) {
  // Re-sync local edit buffer when the upstream `value` changes (after a save
  // round-trips through the store). The "store-info-from-previous-renders"
  // pattern avoids the cascading-render warning from setting state in effect.
  const [prev, setPrev] = React.useState(value)
  const [v, setV] = React.useState(String(value))
  if (prev !== value) {
    setPrev(value)
    setV(String(value))
  }
  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        min="0"
        max="100"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const n = Math.max(0, Math.min(100, Number(v) || 0))
          if (n !== value) onSave(n)
          setV(String(n))
        }}
        className="h-8 w-20"
      />
      <span className="text-xs text-muted-foreground">%</span>
    </div>
  )
}

function EventsTab({
  events,
}: {
  events: ReturnType<typeof useEvents>["data"]
}) {
  if (!events || events.length === 0) {
    return <EmptyState title="No events" description="Schedule a meeting from the calendar page." />
  }
  return (
    <Card>
      <CardContent className="py-2">
        <ul className="divide-y divide-border">
          {events.map((e) => {
            const dt = new Date(e.start_at)
            return (
              <li key={e.id} className="flex items-start gap-3 py-2.5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
                  <span className="text-[10px] font-medium uppercase">
                    {dt.toLocaleDateString("en-US", { month: "short" })}
                  </span>
                  <span className="-mt-0.5 text-sm font-semibold">
                    {dt.getDate()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {dt.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })}{" "}
                    · {e.event_type}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
