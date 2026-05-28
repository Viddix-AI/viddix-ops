"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AssigneeMultiSelect } from "@/components/dashboard/assignee-multi-select"
import { useClients } from "@/hooks/use-clients"
import { useLeads } from "@/hooks/use-leads"
import { useProfiles } from "@/hooks/use-profile"
import { useCreateTask } from "@/hooks/use-tasks"
import type {
  TaskPriority,
  TaskRecurrence,
  TaskStatus,
} from "@/lib/types"

const NONE = "__none__"

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low",    label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high",   label: "High" },
  { value: "urgent", label: "Urgent" },
]

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo",        label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done",        label: "Done" },
]

const RECURRENCES: { value: TaskRecurrence; label: string }[] = [
  { value: "none",    label: "No recurrence" },
  { value: "daily",   label: "Daily" },
  { value: "weekly",  label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly",  label: "Yearly" },
]

type Form = {
  title: string
  description: string
  due_date: string
  due_time: string
  priority: TaskPriority
  status: TaskStatus
  assignee_ids: string[]
  client_id: string
  lead_id: string
  link: string
  estimate: string
  recurrence: TaskRecurrence
  recurrence_until: string
}

const EMPTY: Form = {
  title: "",
  description: "",
  due_date: "",
  due_time: "",
  priority: "medium",
  status: "todo",
  assignee_ids: [],
  client_id: "",
  lead_id: "",
  link: "",
  estimate: "",
  recurrence: "none",
  recurrence_until: "",
}

/**
 * Standalone "+ New task" dialog. Lives on the /tasks page (the inline
 * composers on lead/client detail are still the fastest path for scoped
 * tasks). Covers every Task field except parent_id, which is set from the
 * Subtasks section of `task-detail-sheet` and would be confusing here since
 * the root listing already excludes subtasks.
 */
export function AddTaskDialog({
  open,
  onOpenChange,
  defaultClientId,
  defaultLeadId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultClientId?: string | null
  defaultLeadId?: string | null
}) {
  const create = useCreateTask()
  const { data: profiles = [] } = useProfiles()
  const { data: clients = [] } = useClients()
  const { data: leads = [] } = useLeads()

  const [form, setForm] = React.useState<Form>(() => ({
    ...EMPTY,
    client_id: defaultClientId ?? "",
    lead_id: defaultLeadId ?? "",
  }))

  // Re-seed defaults when the dialog opens for a different scope (e.g. user
  // opened from a client detail with that client preselected, then closes
  // and reopens from the global page). store-info-from-previous-renders.
  const [prevDefaults, setPrevDefaults] = React.useState({
    c: defaultClientId ?? "",
    l: defaultLeadId ?? "",
  })
  if (prevDefaults.c !== (defaultClientId ?? "") || prevDefaults.l !== (defaultLeadId ?? "")) {
    setPrevDefaults({ c: defaultClientId ?? "", l: defaultLeadId ?? "" })
    setForm((f) => ({
      ...f,
      client_id: defaultClientId ?? "",
      lead_id: defaultLeadId ?? "",
    }))
  }

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleOpenChange(o: boolean) {
    if (!o) {
      setForm({
        ...EMPTY,
        client_id: defaultClientId ?? "",
        lead_id: defaultLeadId ?? "",
      })
    }
    onOpenChange(o)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const title = form.title.trim()
    if (!title) return
    create.mutate(
      {
        title,
        description: form.description.trim() || null,
        due_date: form.due_date || null,
        due_time: form.due_date && form.due_time ? form.due_time : null,
        priority: form.priority,
        status: form.status,
        assignee_ids: form.assignee_ids,
        client_id: form.client_id || null,
        lead_id: form.lead_id || null,
        link: form.link.trim() || null,
        estimate_minutes:
          form.estimate.trim() === "" ? null : Math.max(0, Number(form.estimate) || 0),
        recurrence: form.recurrence,
        recurrence_until:
          form.recurrence !== "none" && form.recurrence_until
            ? form.recurrence_until
            : null,
      },
      {
        onSuccess: () => {
          toast.success("Task created")
          handleOpenChange(false)
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Could not create task"),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <form id="add-task" onSubmit={handleSubmit} className="grid gap-3">
          <Field label="Title *">
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="What needs to happen?"
              autoFocus
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Optional context…"
              rows={3}
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Due date">
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => set("due_date", e.target.value)}
              />
            </Field>
            <Field label="Time">
              <Input
                type="time"
                value={form.due_time}
                onChange={(e) => set("due_time", e.target.value)}
                disabled={!form.due_date}
              />
            </Field>
            <Field label="Estimate (min)">
              <Input
                type="number"
                min="0"
                value={form.estimate}
                onChange={(e) => set("estimate", e.target.value)}
                placeholder="—"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select
                value={form.status}
                onValueChange={(v) => set("status", v as TaskStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Priority">
              <Select
                value={form.priority}
                onValueChange={(v) => set("priority", v as TaskPriority)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Assignees">
            <AssigneeMultiSelect
              profiles={profiles}
              value={form.assignee_ids}
              onChange={(next) => set("assignee_ids", next)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Client">
              <Select
                value={form.client_id || NONE}
                onValueChange={(v) => set("client_id", !v || v === NONE ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>
                    <span className="text-text-tertiary">None</span>
                  </SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Lead">
              <Select
                value={form.lead_id || NONE}
                onValueChange={(v) => set("lead_id", !v || v === NONE ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>
                    <span className="text-text-tertiary">None</span>
                  </SelectItem>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      <span className="truncate">
                        {l.name}
                        {l.company && (
                          <span className="text-text-tertiary"> · {l.company}</span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Recurrence">
              <Select
                value={form.recurrence}
                onValueChange={(v) => set("recurrence", v as TaskRecurrence)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Recurrence until">
              <Input
                type="date"
                value={form.recurrence_until}
                onChange={(e) => set("recurrence_until", e.target.value)}
                disabled={form.recurrence === "none"}
              />
            </Field>
          </div>

          <Field label="Link">
            <Input
              type="url"
              value={form.link}
              onChange={(e) => set("link", e.target.value)}
              placeholder="https://…"
            />
          </Field>
        </form>
        <DialogFooter showCloseButton>
          <Button
            type="submit"
            form="add-task"
            disabled={!form.title.trim() || create.isPending}
          >
            {create.isPending ? "Creating…" : "Create task"}
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
