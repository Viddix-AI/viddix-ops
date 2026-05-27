"use client"

import * as React from "react"
import { ExternalLink, Play, Plus, Square, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pill } from "@/components/ui/pill"
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
import { useEvents } from "@/hooks/use-events"
import { useLeads } from "@/hooks/use-leads"
import { useCurrentProfile, useProfiles } from "@/hooks/use-profile"
import {
  useAttachTag,
  useCreateTag,
  useDetachTag,
  useTags,
  useTagsFor,
} from "@/hooks/use-tags"
import { useCreateTask, useDeleteTask, useTasks, useUpdateTask } from "@/hooks/use-tasks"
import {
  useOpenTimerFor,
  useStartTimer,
  useStopTimer,
  useTimeEntriesFor,
} from "@/hooks/use-time-entries"
import type { PillTone } from "@/components/ui/pill"
import type { Tag, Task, TaskPriority, TaskRecurrence, TaskStatus } from "@/lib/types"

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

const RECURRENCES: { value: TaskRecurrence; label: string }[] = [
  { value: "none",    label: "No recurrence" },
  { value: "daily",   label: "Daily" },
  { value: "weekly",  label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly",  label: "Yearly" },
]

function formatMinutes(mins: number): string {
  if (mins <= 0) return "0m"
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function formatSeconds(sec: number): string {
  return formatMinutes(Math.round(sec / 60))
}

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
  const { data: events = [] } = useEvents()
  const { data: tasks = [] } = useTasks()
  const pairedEvent = task ? events.find((e) => e.task_id === task.id) ?? null : null
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
        {pairedEvent && (
          <div className="mx-4 mt-2 flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-xs">
            <span className="font-semibold text-primary">Event</span>
            <span className="text-muted-foreground">
              {new Date(pairedEvent.start_at).toLocaleString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
              {pairedEvent.end_at &&
                ` – ${new Date(pairedEvent.end_at).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}`}
            </span>
            {pairedEvent.cal_booking_id && (
              <span className="ml-auto rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                From Cal.com
              </span>
            )}
          </div>
        )}
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

          <div className="grid grid-cols-3 gap-3">
            <Field label="Due date">
              {pairedEvent && (
                <p className="text-[10px] text-muted-foreground">
                  Controlled by the calendar event.
                </p>
              )}
              <Input
                type="date"
                defaultValue={task.due_date ?? ""}
                disabled={pairedEvent !== null}
                onBlur={(e) => {
                  const v = e.target.value
                  if (v !== (task.due_date ?? "")) {
                    // Clearing the date also clears the time — a time without
                    // a date can't anchor anywhere.
                    patch({ due_date: v || null, due_time: v ? task.due_time : null })
                  }
                }}
              />
            </Field>
            <Field label="Due time">
              {pairedEvent && (
                <p className="text-[10px] text-muted-foreground">
                  Controlled by the calendar event.
                </p>
              )}
              <Input
                type="time"
                defaultValue={task.due_time ?? ""}
                disabled={pairedEvent !== null || !task.due_date}
                onBlur={(e) => {
                  const v = e.target.value
                  if (v !== (task.due_time ?? "")) {
                    patch({ due_time: v || null })
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

          {!pairedEvent && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Recurrence">
                <Select
                  value={task.recurrence}
                  onValueChange={(v) =>
                    patch({ recurrence: v as TaskRecurrence })
                  }
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
                  defaultValue={task.recurrence_until ?? ""}
                  disabled={task.recurrence === "none"}
                  onBlur={(e) => {
                    const v = e.target.value || null
                    if (v !== (task.recurrence_until ?? null)) {
                      patch({ recurrence_until: v })
                    }
                  }}
                />
              </Field>
            </div>
          )}

          {!pairedEvent && (
            <Field label="Parent task">
              <ParentTaskSelect
                tasks={tasks}
                current={task}
                onChange={(parent_id) => patch({ parent_id })}
              />
            </Field>
          )}

          <Field label="Estimate (min)">
            <Input
              type="number"
              min="0"
              defaultValue={
                task.estimate_minutes === null ? "" : String(task.estimate_minutes)
              }
              placeholder="—"
              onBlur={(e) => {
                const raw = e.target.value.trim()
                const v = raw === "" ? null : Math.max(0, Number(raw) || 0)
                if (v !== task.estimate_minutes) patch({ estimate_minutes: v })
              }}
            />
          </Field>

          <SubtasksSection task={task} subtasks={tasks.filter((t) => t.parent_id === task.id)} />

          <TagsSection task={task} />

          <TimeSection task={task} />

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
            {pairedEvent?.cal_booking_id ? (
              <a
                href={`https://app.cal.com/booking/${pairedEvent.cal_booking_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-500/20 dark:text-rose-300"
              >
                <ExternalLink className="size-3" />
                Cancel in Cal.com
              </a>
            ) : (
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
            )}
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

/**
 * Select a parent task for the current row. Filters out:
 *   - The current task (no self-parenting).
 *   - The current task's descendants (no cycles).
 *   - Tasks paired with Cal.com events (must stay root).
 * Limits choices to tasks sharing the same client_id / lead_id since cross-
 * client subtasks would be confusing — open to relaxing later.
 */
function ParentTaskSelect({
  tasks,
  current,
  onChange,
}: {
  tasks: Task[]
  current: Task
  onChange: (parent_id: string | null) => void
}) {
  const descendants = React.useMemo(() => {
    const set = new Set<string>()
    const walk = (id: string) => {
      for (const t of tasks) {
        if (t.parent_id === id && !set.has(t.id)) {
          set.add(t.id)
          walk(t.id)
        }
      }
    }
    walk(current.id)
    return set
  }, [tasks, current.id])

  const candidates = tasks.filter(
    (t) =>
      t.id !== current.id &&
      !descendants.has(t.id) &&
      // Same scope: matches when at least one of client_id/lead_id agrees and
      // neither side conflicts.
      (current.client_id ? t.client_id === current.client_id : true) &&
      (current.lead_id ? t.lead_id === current.lead_id : true)
  )

  return (
    <Select
      value={current.parent_id ?? "__none__"}
      onValueChange={(v) => onChange(v === "__none__" ? null : v)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="No parent" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">
          <span className="text-text-tertiary">No parent (root task)</span>
        </SelectItem>
        {candidates.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            <span className="truncate">{t.title}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function SubtasksSection({
  task,
  subtasks,
}: {
  task: Task
  subtasks: Task[]
}) {
  const create = useCreateTask()
  const update = useUpdateTask()
  const remove = useDeleteTask()
  const [title, setTitle] = React.useState("")

  function addSubtask() {
    const v = title.trim()
    if (!v) return
    create.mutate(
      {
        title: v,
        parent_id: task.id,
        client_id: task.client_id,
        lead_id: task.lead_id,
        assignee_ids: task.assignee_ids,
      },
      {
        onSuccess: () => {
          setTitle("")
          toast.success("Subtask added")
        },
      }
    )
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
      <p className="text-xs font-medium text-text-secondary">
        Subtasks · {subtasks.length}
      </p>
      <ul className="space-y-1.5">
        {subtasks.map((s) => (
          <li key={s.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={s.status === "done"}
              onChange={() =>
                update.mutate({
                  id: s.id,
                  patch: { status: s.status === "done" ? "todo" : "done" },
                })
              }
              className="size-4 cursor-pointer accent-primary"
              aria-label="Toggle subtask done"
            />
            <Input
              defaultValue={s.title}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v && v !== s.title) update.mutate({ id: s.id, patch: { title: v } })
              }}
              className={
                s.status === "done"
                  ? "h-7 text-sm text-text-tertiary line-through"
                  : "h-7 text-sm"
              }
            />
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Delete subtask"
              onClick={() => remove.mutate(s.id)}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addSubtask()
            }
          }}
          placeholder="Add a subtask…"
          className="h-8 flex-1"
        />
        <Button size="sm" disabled={!title.trim()} onClick={addSubtask}>
          <Plus />
          Add
        </Button>
      </div>
    </div>
  )
}

const TAG_TONES: PillTone[] = ["slate", "blue", "sky", "indigo", "violet", "emerald", "amber", "rose"]
const TAG_TONE_SET = new Set<string>(TAG_TONES)
function toneOf(t: Tag): PillTone {
  return (TAG_TONE_SET.has(t.color) ? t.color : "slate") as PillTone
}

function TagsSection({ task }: { task: Task }) {
  const { data: allTags = [] } = useTags()
  const { data: attached = [] } = useTagsFor(task.id)
  const attach = useAttachTag()
  const detach = useDetachTag()
  const create = useCreateTag()

  const [input, setInput] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const matches = React.useMemo(() => {
    const attachedIds = new Set(attached.map((t) => t.id))
    const needle = input.trim().toLowerCase()
    return allTags
      .filter((t) => !attachedIds.has(t.id))
      .filter((t) => !needle || t.name.toLowerCase().includes(needle))
      .slice(0, 8)
  }, [allTags, attached, input])
  const exactMatch = allTags.find(
    (t) => t.name.toLowerCase() === input.trim().toLowerCase()
  )
  const canCreate = input.trim().length > 0 && !exactMatch

  function pick(tagId: string) {
    attach.mutate({ task_id: task.id, tag_id: tagId })
    setInput("")
    setOpen(false)
  }

  function createAndAttach() {
    if (!canCreate) return
    create.mutate(
      { name: input.trim() },
      {
        onSuccess: (tag) => {
          attach.mutate({ task_id: task.id, tag_id: tag.id })
          setInput("")
          setOpen(false)
        },
      }
    )
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
      <p className="text-xs font-medium text-text-secondary">Tags</p>
      <div className="flex flex-wrap gap-1.5">
        {attached.length === 0 && (
          <span className="text-[11px] text-text-tertiary">No tags yet.</span>
        )}
        {attached.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => detach.mutate({ task_id: task.id, tag_id: t.id })}
            className="group inline-flex items-center"
            aria-label={`Remove tag ${t.name}`}
            title={`Remove "${t.name}"`}
          >
            <Pill tone={toneOf(t)} size="sm">
              {t.name}
              <span className="ml-1 text-current opacity-50 group-hover:opacity-100">
                ×
              </span>
            </Pill>
          </button>
        ))}
      </div>
      <div className="relative">
        <Input
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // delay so clicking a result still registers
            window.setTimeout(() => setOpen(false), 120)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              if (matches[0]) pick(matches[0].id)
              else if (canCreate) createAndAttach()
            }
            if (e.key === "Escape") {
              setOpen(false)
              setInput("")
            }
          }}
          placeholder="+ Add tag…"
          className="h-8 text-sm"
        />
        {open && (matches.length > 0 || canCreate) && (
          <ul className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-[var(--shadow-paper-md)]">
            {matches.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(t.id)}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-surface-3"
                >
                  <Pill tone={toneOf(t)} size="sm">
                    {t.name}
                  </Pill>
                </button>
              </li>
            ))}
            {canCreate && (
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={createAndAttach}
                  className="flex w-full items-center gap-2 border-t border-border-subtle px-2.5 py-1.5 text-left text-sm text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                >
                  <Plus className="size-3.5" />
                  Create tag &ldquo;{input.trim()}&rdquo;
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}

function TimeSection({ task }: { task: Task }) {
  const me = useCurrentProfile()
  const { data: openEntry } = useOpenTimerFor(me.id)
  const { data: entries = [] } = useTimeEntriesFor(task.id)
  const start = useStartTimer()
  const stop = useStopTimer()

  const ownTimer = openEntry && openEntry.task_id === task.id ? openEntry : null
  const blockingTimer =
    openEntry && openEntry.task_id !== task.id ? openEntry : null

  const tracked = task.tracked_minutes ?? 0
  const estimate = task.estimate_minutes ?? null
  const overEstimate = estimate !== null && tracked > estimate

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-text-secondary">Time</p>
        <p className="text-xs text-text-tertiary">
          <span className="font-mono tabular-nums text-text-primary">
            {formatMinutes(tracked)}
          </span>
          {estimate !== null && (
            <>
              <span className="mx-1">/</span>
              <span className="font-mono tabular-nums">
                {formatMinutes(estimate)}
              </span>
            </>
          )}
          {overEstimate && (
            <Pill variant="warning" size="sm" uppercase className="ml-2">
              Over estimate
            </Pill>
          )}
        </p>
      </div>

      {ownTimer ? (
        <Button
          variant="destructive"
          size="sm"
          onClick={() =>
            stop.mutate(
              { entryId: ownTimer.id },
              { onSuccess: () => toast.success("Timer stopped") }
            )
          }
          disabled={stop.isPending}
        >
          <Square />
          Stop timer
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={() =>
            start.mutate(
              { taskId: task.id, userId: me.id },
              {
                onSuccess: () => toast.success("Timer started"),
                onError: (e) =>
                  toast.error(
                    e instanceof Error ? e.message : "Could not start timer"
                  ),
              }
            )
          }
          disabled={start.isPending || !!blockingTimer}
        >
          <Play />
          Start timer
        </Button>
      )}
      {blockingTimer && (
        <p className="text-xs text-warning">
          Timer is running on another task — stop it first.
        </p>
      )}

      {entries.length > 0 && (
        <ul className="divide-y divide-border-subtle border-t border-border-subtle pt-1.5">
          {entries.slice(0, 8).map((e) => {
            const started = new Date(e.started_at)
            return (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 py-1 text-[11px] text-text-tertiary"
              >
                <span>
                  {started.toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {e.note && (
                    <span className="ml-1.5 text-text-secondary">· {e.note}</span>
                  )}
                </span>
                <span className="font-mono tabular-nums text-text-primary">
                  {e.duration_seconds === null
                    ? "running…"
                    : formatSeconds(e.duration_seconds)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
