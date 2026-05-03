"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useClients } from "@/hooks/use-clients"
import { useCreateEvent } from "@/hooks/use-events"
import { useLeads } from "@/hooks/use-leads"
import type { EventType } from "@/lib/types"

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: "meeting",  label: "Meeting" },
  { value: "call",     label: "Call" },
  { value: "deadline", label: "Deadline" },
  { value: "internal", label: "Internal" },
]

type Form = {
  title: string
  date: string
  startTime: string
  endTime: string
  type: EventType
  clientId: string
  leadId: string
  description: string
}

function emptyForm(date: string): Form {
  return {
    title: "",
    date,
    startTime: "10:00",
    endTime: "11:00",
    type: "meeting",
    clientId: "",
    leadId: "",
    description: "",
  }
}

export function AddEventDialog({
  open,
  onOpenChange,
  defaultDate,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  /** ISO date (YYYY-MM-DD) the dialog should pre-fill. Falls back to today. */
  defaultDate?: string | null
}) {
  const today = new Date().toISOString().slice(0, 10)
  const initialDate = defaultDate ?? today

  const [form, setForm] = React.useState<Form>(() => emptyForm(initialDate))
  // Re-prime the form whenever the dialog re-opens with a different date.
  // Using the "store-info-from-previous-renders" pattern so we don't trip the
  // set-state-in-effect lint warning.
  const [prevKey, setPrevKey] = React.useState(`${open}|${initialDate}`)
  const key = `${open}|${initialDate}`
  if (key !== prevKey) {
    setPrevKey(key)
    if (open) setForm(emptyForm(initialDate))
  }

  const { data: clients = [] } = useClients()
  const { data: leads = [] } = useLeads()
  const create = useCreateEvent()

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.date) return
    // Compose ISO timestamps from the date + time inputs in the user's
    // local zone, then let JS convert to UTC on .toISOString().
    const start = new Date(`${form.date}T${form.startTime || "10:00"}:00`).toISOString()
    const end = form.endTime
      ? new Date(`${form.date}T${form.endTime}:00`).toISOString()
      : null
    create.mutate(
      {
        title: form.title.trim(),
        start_at: start,
        end_at: end,
        event_type: form.type,
        client_id: form.clientId || null,
        lead_id: form.leadId || null,
        description: form.description.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Event scheduled")
          onOpenChange(false)
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to create event"),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New event</DialogTitle>
        </DialogHeader>
        <form id="add-event" onSubmit={handleSubmit} className="grid gap-3">
          <Field label="Title *">
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Meeting with…"
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date">
              <Input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                required
              />
            </Field>
            <Field label="Start">
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) => set("startTime", e.target.value)}
              />
            </Field>
            <Field label="End">
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) => set("endTime", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Type">
            <Select
              value={form.type}
              onValueChange={(v) => set("type", (v ?? "meeting") as EventType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client (optional)">
              <Select
                value={form.clientId}
                onValueChange={(v) => set("clientId", v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Lead (optional)">
              <Select
                value={form.leadId}
                onValueChange={(v) => set("leadId", v ?? "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                      {l.company ? ` · ${l.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Notes">
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              placeholder="Optional details"
            />
          </Field>
        </form>
        <DialogFooter showCloseButton>
          <Button
            type="submit"
            form="add-event"
            disabled={!form.title.trim() || !form.date || create.isPending}
          >
            {create.isPending ? "Saving…" : "Schedule event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
