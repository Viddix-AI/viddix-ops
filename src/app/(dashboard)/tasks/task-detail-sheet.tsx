"use client"

import * as React from "react"
import { ExternalLink, Trash2 } from "lucide-react"
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { AssigneeMultiSelect } from "@/components/dashboard/assignee-multi-select"
import { useClients } from "@/hooks/use-clients"
import { useLeads } from "@/hooks/use-leads"
import { useProfiles } from "@/hooks/use-profile"
import { useDeleteTask, useUpdateTask } from "@/hooks/use-tasks"
import type { Task, TaskPriority, TaskStatus } from "@/lib/types"

// base-ui's Select can't use "" as a real item value; this sentinel maps to
// "unlinked" so the user can clear a relation without a separate button.
const NONE = "__none__"

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
]

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
]

export function TaskDetailSheet({
  task,
  open,
  onOpenChange,
}: {
  task: Task | null
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const { data: profiles = [] } = useProfiles()
  const { data: leads = [] } = useLeads()
  const { data: clients = [] } = useClients()
  const update = useUpdateTask()
  const remove = useDeleteTask()

  // Patch helper — fires the mutation immediately on every edit so the field
  // saves on blur (input/textarea) or selection (Select/MultiSelect).
  function patch(p: Partial<Task>) {
    if (!task) return
    update.mutate({ id: task.id, patch: p })
  }

  if (!task) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" />
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Task</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
          <Field label="Title">
            <Input
              defaultValue={task.title}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== task.title) patch({ title: v })
              }}
            />
          </Field>

          <Field label="Description">
            <Textarea
              defaultValue={task.description ?? ""}
              rows={4}
              onBlur={(e) => {
                const v = e.target.value
                if (v !== (task.description ?? "")) {
                  patch({ description: v.trim() || null })
                }
              }}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date">
              <Input
                type="date"
                defaultValue={task.due_date ?? ""}
                onBlur={(e) => {
                  const v = e.target.value
                  if (v !== (task.due_date ?? "")) {
                    patch({ due_date: v || null })
                  }
                }}
              />
            </Field>
            <Field label="Status">
              <Select
                value={task.status}
                onValueChange={(v) => patch({ status: v as TaskStatus })}
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
          </div>

          <Field label="Priority">
            <Select
              value={task.priority}
              onValueChange={(v) => patch({ priority: v as TaskPriority })}
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

          <Field label="Assignees">
            <AssigneeMultiSelect
              profiles={profiles}
              value={task.assignee_ids}
              onChange={(next) => patch({ assignee_ids: next })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Lead">
              <Select
                value={task.lead_id ?? NONE}
                onValueChange={(v) =>
                  patch({ lead_id: !v || v === NONE ? null : v })
                }
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
            <Field label="Client">
              <Select
                value={task.client_id ?? NONE}
                onValueChange={(v) =>
                  patch({ client_id: !v || v === NONE ? null : v })
                }
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
          </div>

          <Field label="Link">
            <div className="flex gap-2">
              <Input
                type="url"
                defaultValue={task.link ?? ""}
                placeholder="https://…"
                onBlur={(e) => {
                  const v = e.target.value.trim()
                  if (v !== (task.link ?? "")) {
                    patch({ link: v || null })
                  }
                }}
              />
              {task.link && (
                <a
                  href={task.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] border border-border-subtle bg-card text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  title="Open link in a new tab"
                  aria-label="Open link in a new tab"
                >
                  <ExternalLink className="size-4" />
                </a>
              )}
            </div>
          </Field>

          <div className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (!confirm("Delete this task? This cannot be undone.")) return
                remove.mutate(task.id, {
                  onSuccess: () => {
                    toast.success("Task deleted")
                    onOpenChange(false)
                  },
                })
              }}
            >
              <Trash2 />
              Delete task
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  )
}
