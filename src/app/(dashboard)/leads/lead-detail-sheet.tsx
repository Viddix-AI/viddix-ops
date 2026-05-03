"use client"

import * as React from "react"
import { Trash2, ArrowRight, Plus } from "lucide-react"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { EditableTaskRow } from "@/components/dashboard/editable-task-row"
import { TeamBadge } from "@/components/dashboard/team-badge"
import { useCreateNote, useNotesFor } from "@/hooks/use-notes"
import { useCreateTask, useTasks } from "@/hooks/use-tasks"
import { useProfiles, useCurrentProfile } from "@/hooks/use-profile"
import { money, relativeDay } from "@/lib/format"
import {
  LEAD_STAGES,
  LEAD_TEMPERATURES,
  type Lead,
  type LeadStage,
  type LeadTemperature,
} from "@/lib/types"
import { cn } from "@/lib/utils"

export function LeadDetailSheet({
  lead,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  onConvert,
}: {
  lead: Lead | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onUpdate: (patch: Partial<Lead>) => void
  onDelete: () => void
  onConvert: () => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        {lead && <Inner lead={lead} onUpdate={onUpdate} onDelete={onDelete} onConvert={onConvert} />}
      </SheetContent>
    </Sheet>
  )
}

function Inner({
  lead,
  onUpdate,
  onDelete,
  onConvert,
}: {
  lead: Lead
  onUpdate: (patch: Partial<Lead>) => void
  onDelete: () => void
  onConvert: () => void
}) {
  const { data: profiles = [] } = useProfiles()
  const me = useCurrentProfile()
  const { data: notes = [] } = useNotesFor({ leadId: lead.id })
  const createNote = useCreateNote()
  const { data: tasks = [] } = useTasks()
  const createTask = useCreateTask()

  const leadTasks = tasks.filter((t) => t.lead_id === lead.id)
  const [noteText, setNoteText] = React.useState("")
  const [taskTitle, setTaskTitle] = React.useState("")
  const [taskDue, setTaskDue] = React.useState("")

  return (
    <>
      <SheetHeader className="border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <SheetTitle>{lead.name}</SheetTitle>
            {lead.company && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {lead.company}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={onConvert}
              disabled={!!lead.converted_client_id}
              title={
                lead.converted_client_id
                  ? "Already converted to a client"
                  : "Convert this lead to a client"
              }
            >
              <ArrowRight />
              {lead.converted_client_id ? "Converted" : "Convert"}
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={onDelete} aria-label="Delete">
              <Trash2 />
            </Button>
          </div>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stage">
            <Select
              value={lead.stage}
              onValueChange={(v) => onUpdate({ stage: v as LeadStage })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STAGES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Owner">
            <Select
              value={lead.owner_id ?? ""}
              onValueChange={(v) => onUpdate({ owner_id: v || null })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="inline-flex items-center gap-1.5">
                      {p.full_name}
                      <TeamBadge team={p.team} />
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Email">
            <Input
              defaultValue={lead.email ?? ""}
              onBlur={(e) => onUpdate({ email: e.target.value || null })}
            />
          </Field>
          <Field label="Value (MRR)">
            <Input
              type="number"
              defaultValue={String(lead.value ?? 0)}
              onBlur={(e) => onUpdate({ value: Number(e.target.value) || 0 })}
            />
          </Field>
        </div>

        <div className="mt-3 space-y-3">
          <Field label="Temperature">
            <div className="flex gap-1.5">
              {LEAD_TEMPERATURES.map((t) => {
                const active = lead.temperature === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onUpdate({ temperature: t.id as LeadTemperature })}
                    className={cn(
                      "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className={cn("size-2 rounded-full", t.dot)} />
                    {t.label}
                  </button>
                )
              })}
            </div>
          </Field>
          <Field label="Lead notes">
            <Textarea
              defaultValue={lead.notes ?? ""}
              onBlur={(e) => onUpdate({ notes: e.target.value || null })}
              rows={2}
              placeholder="Anything to remember about this lead…"
            />
          </Field>
        </div>

        <div className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Pipeline value</span>{" "}
          {money(Number(lead.value || 0))}/mo · Source {lead.source ?? "—"} ·
          Updated {relativeDay(lead.updated_at)}
        </div>

        <Tabs defaultValue="notes" className="mt-5">
          <TabsList className="w-full justify-start gap-2 bg-transparent p-0">
            <TabsTrigger value="notes" className="flex-none data-[selected]:bg-muted">Notes</TabsTrigger>
            <TabsTrigger value="tasks" className="flex-none data-[selected]:bg-muted">
              Tasks · {leadTasks.length}
            </TabsTrigger>
          </TabsList>

          <TabsPrimitive.Panel value="notes" className="mt-3 space-y-3">
            <div className="rounded-md border border-border bg-background p-2.5">
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={2}
                placeholder="Log a note…"
                className="border-0 bg-transparent p-0 focus-visible:ring-0"
              />
              <div className="mt-2 flex justify-end">
                <Button
                  size="sm"
                  disabled={!noteText.trim() || createNote.isPending}
                  onClick={() =>
                    createNote.mutate(
                      { content: noteText.trim(), lead_id: lead.id, author_id: me.id },
                      {
                        onSuccess: () => {
                          setNoteText("")
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
              <p className="py-4 text-center text-xs text-muted-foreground">No notes yet</p>
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
          </TabsPrimitive.Panel>

          <TabsPrimitive.Panel value="tasks" className="mt-3 space-y-3">
            <div className="space-y-2 rounded-md border border-border bg-background p-2.5">
              <Input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="New task — e.g. send proposal"
                className="h-8"
              />
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                  className="h-8 flex-1"
                />
                <Button
                  size="sm"
                  disabled={!taskTitle.trim()}
                  onClick={() =>
                    createTask.mutate(
                      {
                        title: taskTitle.trim(),
                        lead_id: lead.id,
                        assignee_id: lead.owner_id ?? me.id,
                        due_date: taskDue || null,
                      },
                      {
                        onSuccess: () => {
                          setTaskTitle("")
                          setTaskDue("")
                          toast.success("Task added")
                        },
                      }
                    )
                  }
                >
                  <Plus /> Add
                </Button>
              </div>
            </div>
            {leadTasks.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No tasks yet</p>
            ) : (
              <ul className="space-y-2">
                {leadTasks.map((t) => (
                  <EditableTaskRow key={t.id} task={t} />
                ))}
              </ul>
            )}
          </TabsPrimitive.Panel>
        </Tabs>
      </div>
    </>
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
