"use client"

import * as React from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDeleteTask, useUpdateTask } from "@/hooks/use-tasks"
import { relativeDay } from "@/lib/format"
import type { Task, TaskPriority, TaskStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

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

/**
 * One task as a row of inline-editable controls. Used inside lead + client
 * detail panels. Updates fan out via React Query so all views refresh after
 * each mutation. The row is collapsible: title + done-checkbox + due date
 * always visible; priority/status/full date editor in the expanded section.
 */
export function EditableTaskRow({ task }: { task: Task }) {
  const update = useUpdateTask()
  const remove = useDeleteTask()
  const [open, setOpen] = React.useState(false)

  const due = task.due_date ?? ""

  function patch(p: Partial<Task>) {
    update.mutate({ id: task.id, patch: p })
  }

  return (
    <li className="rounded-md border border-border bg-background">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <input
          type="checkbox"
          checked={task.status === "done"}
          onChange={() =>
            patch({ status: task.status === "done" ? "todo" : "done" })
          }
          className="size-4 shrink-0 cursor-pointer accent-primary"
          aria-label="Toggle done"
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="min-w-0 flex-1 text-left"
        >
          <p
            className={cn(
              "truncate text-sm font-medium",
              task.status === "done" && "text-muted-foreground line-through"
            )}
          >
            {task.title}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {STATUSES.find((s) => s.value === task.status)?.label} ·{" "}
            {PRIORITIES.find((p) => p.value === task.priority)?.label} ·{" "}
            {relativeDay(task.due_date)}
            {task.due_time && ` · ${task.due_time}`}
          </p>
        </button>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Delete task"
          onClick={() =>
            remove.mutate(task.id, {
              onSuccess: () => toast.success("Task deleted"),
            })
          }
        >
          <Trash2 />
        </Button>
      </div>
      {open && (
        <div className="grid grid-cols-1 gap-2 border-t border-border bg-muted/30 px-3 py-3 sm:grid-cols-3">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Status
            </span>
            <Select
              value={task.status}
              onValueChange={(v) => patch({ status: v as TaskStatus })}
            >
              <SelectTrigger size="sm" className="w-full">
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
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Priority
            </span>
            <Select
              value={task.priority}
              onValueChange={(v) => patch({ priority: v as TaskPriority })}
            >
              <SelectTrigger size="sm" className="w-full">
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
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Due date
            </span>
            <Input
              type="date"
              defaultValue={due}
              onBlur={(e) => {
                const v = e.target.value || null
                if (v !== (task.due_date ?? null)) {
                  // Clearing the date drops the time — no anchor.
                  patch({ due_date: v, due_time: v ? task.due_time : null })
                }
              }}
              className="h-8"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Due time
            </span>
            <Input
              type="time"
              defaultValue={task.due_time ?? ""}
              disabled={!task.due_date}
              onBlur={(e) => {
                const v = e.target.value || null
                if (v !== (task.due_time ?? null)) patch({ due_time: v })
              }}
              className="h-8"
            />
          </label>
        </div>
      )}
    </li>
  )
}
