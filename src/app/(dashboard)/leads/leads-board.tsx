"use client"

import * as React from "react"
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DraggableProvided,
  type DraggableStateSnapshot,
  type DropResult,
} from "@hello-pangea/dnd"
import {
  CalendarClock,
  Download,
  GripVertical,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Thermometer,
  Upload,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pill } from "@/components/ui/pill"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { UserAvatar } from "@/components/dashboard/user-avatar"
import {
  useConvertLead,
  useCreateLead,
  useDeleteLead,
  useLeads,
  useMoveLead,
  useUpdateLead,
} from "@/hooks/use-leads"
import { useProfiles } from "@/hooks/use-profile"
import { useTasks } from "@/hooks/use-tasks"
import { downloadCsv, parseCsv, pickCsvFile, toCsv } from "@/lib/csv"
import { money, relativeDay } from "@/lib/format"
import {
  LEAD_STAGES,
  LEAD_TEMPERATURES,
  TEAMS,
  type Lead,
  type LeadStage,
  type LeadTemperature,
  type Profile,
  type Team,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import { LeadDetailSheet } from "./lead-detail-sheet"
import { AddLeadSheet } from "./add-lead-sheet"

export function LeadsBoard() {
  const { data: leads = [], isFetching, isSuccess } = useLeads()
  const isInitialLoad = isFetching && !isSuccess && leads.length === 0
  const { data: profiles = [] } = useProfiles()
  const { data: tasks = [] } = useTasks()
  const move = useMoveLead()
  const remove = useDeleteLead()
  const update = useUpdateLead()
  const convert = useConvertLead()
  const create = useCreateLead()

  // Earliest open due-date per lead, surfaced as a small pill on the card.
  // Memoized so we don't iterate tasks N times during the kanban render.
  const leadDueMap = React.useMemo(() => {
    const out = new Map<string, string>()
    for (const t of tasks) {
      if (!t.lead_id || t.status === "done" || !t.due_date) continue
      const cur = out.get(t.lead_id)
      if (!cur || t.due_date < cur) out.set(t.lead_id, t.due_date)
    }
    return out
  }, [tasks])

  const [openAdd, setOpenAdd] = React.useState(false)
  const [activeLeadId, setActiveLeadId] = React.useState<string | null>(null)
  const [tempFilter, setTempFilter] = React.useState<LeadTemperature | "all">("all")
  const [teamFilter, setTeamFilter] = React.useState<Team | "all">("all")
  const [search, setSearch] = React.useState("")
  const activeLead = leads.find((l) => l.id === activeLeadId) ?? null

  // Team-of-owner lookup: profiles power the badge / filter, leads only
  // store owner_id so we resolve through the profile list each render.
  const teamForLead = React.useCallback(
    (l: Lead): Team | null =>
      profiles.find((p) => p.id === l.owner_id)?.team ?? null,
    [profiles]
  )

  const visibleLeads = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    return leads.filter((l) => {
      if (tempFilter !== "all" && l.temperature !== tempFilter) return false
      if (teamFilter !== "all" && teamForLead(l) !== teamFilter) return false
      if (!needle) return true
      return (
        l.name.toLowerCase().includes(needle) ||
        (l.company ?? "").toLowerCase().includes(needle) ||
        (l.email ?? "").toLowerCase().includes(needle)
      )
    })
  }, [leads, tempFilter, teamFilter, teamForLead, search])

  const teamCounts = React.useMemo(() => {
    const c: Record<Team, number> = { madrid: 0, us: 0 }
    for (const l of leads) {
      const t = teamForLead(l)
      if (t) c[t] += 1
    }
    return c
  }, [leads, teamForLead])

  // Group + sort by position so the kanban order is stable
  const byStage = React.useMemo(() => {
    const map: Record<LeadStage, Lead[]> = {
      new: [],
      contacted: [],
      qualified: [],
      proposal: [],
      negotiation: [],
      won: [],
      lost: [],
    }
    for (const l of visibleLeads) map[l.stage].push(l)
    for (const k of Object.keys(map) as LeadStage[]) {
      map[k].sort((a, b) => a.position - b.position)
    }
    return map
  }, [visibleLeads])

  const tempCounts = React.useMemo(() => {
    const c: Record<LeadTemperature, number> = { hot: 0, warm: 0, cold: 0 }
    for (const l of leads) c[l.temperature] = (c[l.temperature] ?? 0) + 1
    return c
  }, [leads])

  const onDragEnd = (r: DropResult) => {
    if (!r.destination) return
    const fromStage = r.source.droppableId as LeadStage
    const toStage = r.destination.droppableId as LeadStage
    if (
      fromStage === toStage &&
      r.source.index === r.destination.index
    ) return
    move.mutate({
      id: r.draggableId,
      toStage,
      toIndex: r.destination.index,
    })
  }

  return (
    <>
      <PageHeader
        eyebrow="HOLDING · PIPELINE"
        title="Pipeline"
        description="Drag cards to move leads through the pipeline."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportLeadsToCsv(leads)}
            >
              <Download />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const text = await pickCsvFile()
                if (!text) return
                const result = importLeadsFromCsv(text, (input) =>
                  create.mutateAsync(input)
                )
                result
                  .then((n) => toast.success(`${n} leads imported`))
                  .catch((err) =>
                    toast.error(
                      err instanceof Error ? err.message : "Import failed"
                    )
                  )
              }}
            >
              <Upload />
              Import CSV
            </Button>
            <Button onClick={() => setOpenAdd(true)}>
              <Plus />
              New lead
            </Button>
          </div>
        }
      />

      <div className="px-4 py-5 lg:px-6">
        <FilterBar
          search={search}
          onSearch={setSearch}
          tempFilter={tempFilter}
          onTempFilter={setTempFilter}
          tempCounts={tempCounts}
          teamFilter={teamFilter}
          onTeamFilter={setTeamFilter}
          teamCounts={teamCounts}
          totalLeads={leads.length}
        />
        {isInitialLoad && <LeadsBoardSkeleton />}
        {!isInitialLoad && (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="relative">
            {/* Edge fades so the user spots there's more pipeline beyond the
              * viewport. pointer-events-none so they don't intercept drags. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-background to-transparent"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-background to-transparent"
            />
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-4 sm:snap-none">
              {LEAD_STAGES.map((stage) => {
                const items = byStage[stage.id]
                const total = items.reduce(
                  (s, l) => s + Number(l.value || 0),
                  0
                )
                return (
                  <div
                    key={stage.id}
                    className="flex w-[284px] shrink-0 snap-start flex-col rounded-[var(--radius-lg)] bg-surface-3/40 ring-1 ring-border-subtle"
                  >
                    <div className="flex flex-col gap-1.5 border-b border-border-subtle px-3 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-text-tertiary">
                          {stage.label}
                        </p>
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-primary/30 px-1.5 font-mono text-[10px] tabular-nums text-primary">
                          {items.length}
                        </span>
                      </div>
                      <p className="font-display text-[22px] leading-none tracking-[-0.02em] tabular-nums text-text-primary">
                        {money(total)}
                        <span className="ml-0.5 font-sans text-[10px] font-medium text-text-tertiary">
                          /mo
                        </span>
                      </p>
                    </div>

                    <Droppable droppableId={stage.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={cn(
                            "flex-1 space-y-2 p-2 transition-colors",
                            snapshot.isDraggingOver && "bg-accent/50"
                          )}
                        >
                          {items.length === 0 && !snapshot.isDraggingOver && (
                            <div className="rounded-md border border-dashed border-border-subtle p-3 text-center text-[11px] font-medium text-text-tertiary">
                              Drop leads here
                            </div>
                          )}
                          {items.map((lead, i) => (
                            <Draggable
                              key={lead.id}
                              draggableId={lead.id}
                              index={i}
                            >
                              {(p, s) => (
                                <LeadCard
                                  innerRef={p.innerRef}
                                  draggableProps={p.draggableProps}
                                  dragHandleProps={p.dragHandleProps}
                                  isDragging={s.isDragging}
                                  lead={lead}
                                  owner={
                                    profiles.find(
                                      (p) => p.id === lead.owner_id
                                    ) ?? null
                                  }
                                  dueDate={leadDueMap.get(lead.id) ?? null}
                                  onOpen={() => setActiveLeadId(lead.id)}
                                />
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>

                    <QuickAddLead stage={stage.id} />
                  </div>
                )
              })}
            </div>
          </div>
        </DragDropContext>
        )}

        {!isInitialLoad && leads.length === 0 && (
          <EmptyState
            icon={<Sparkles className="size-4" />}
            title="No leads yet"
            description="Add your first lead to start tracking the pipeline."
            action={
              <Button onClick={() => setOpenAdd(true)}>
                <Plus />
                New lead
              </Button>
            }
            className="mt-6"
          />
        )}
      </div>

      <AddLeadSheet open={openAdd} onOpenChange={setOpenAdd} />

      <LeadDetailSheet
        lead={activeLead}
        open={!!activeLeadId}
        onOpenChange={(o) => !o && setActiveLeadId(null)}
        onUpdate={(patch) =>
          activeLead && update.mutate({ id: activeLead.id, patch })
        }
        onDelete={() => {
          if (!activeLead) return
          remove.mutate(activeLead.id)
          toast.success("Lead deleted")
          setActiveLeadId(null)
        }}
        onConvert={() => {
          if (!activeLead) return
          convert.mutate(activeLead.id, {
            onSuccess: () => {
              toast.success(`${activeLead.name} → client created`)
              setActiveLeadId(null)
            },
          })
        }}
      />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// FilterBar — unified Search + Temperature + Team + Reset
// ─────────────────────────────────────────────────────────────────────────

function FilterBar({
  search,
  onSearch,
  tempFilter,
  onTempFilter,
  tempCounts,
  teamFilter,
  onTeamFilter,
  teamCounts,
  totalLeads,
}: {
  search: string
  onSearch: (v: string) => void
  tempFilter: LeadTemperature | "all"
  onTempFilter: (v: LeadTemperature | "all") => void
  tempCounts: Record<LeadTemperature, number>
  teamFilter: Team | "all"
  onTeamFilter: (v: Team | "all") => void
  teamCounts: Record<Team, number>
  totalLeads: number
}) {
  const anyActive =
    tempFilter !== "all" || teamFilter !== "all" || search.trim().length > 0

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative max-w-sm flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-tertiary" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search leads by name, company, email…"
          className="h-9 pl-8"
        />
      </div>

      <Select
        value={tempFilter}
        onValueChange={(v) => onTempFilter(v as LeadTemperature | "all")}
      >
        <SelectTrigger size="sm" className="w-44">
          <Thermometer className="size-3.5 text-muted-foreground" />
          <SelectValue placeholder="All temperatures" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All temperatures · {totalLeads}</SelectItem>
          {LEAD_TEMPERATURES.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              <span className="inline-flex items-center gap-2">
                <span className={cn("size-2 rounded-full", t.dot)} />
                {t.label}
                <span className="text-text-tertiary">·</span>
                <span className="text-text-secondary">{tempCounts[t.id]}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={teamFilter}
        onValueChange={(v) => onTeamFilter(v as Team | "all")}
      >
        <SelectTrigger size="sm" className="w-40">
          <Users className="size-3.5 text-muted-foreground" />
          <SelectValue placeholder="All teams" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All teams · {totalLeads}</SelectItem>
          {TEAMS.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              <span className="inline-flex items-center gap-2">
                <span className={cn("size-2 rounded-full", t.dot)} />
                {t.label}
                <span className="text-text-tertiary">·</span>
                <span className="text-text-secondary">{teamCounts[t.id]}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {anyActive && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onSearch("")
            onTempFilter("all")
            onTeamFilter("all")
          }}
        >
          <RotateCcw />
          Reset
        </Button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// LeadCard — single draggable card with temperature pill, due-date, grip
// ─────────────────────────────────────────────────────────────────────────

function LeadCard({
  innerRef,
  draggableProps,
  dragHandleProps,
  isDragging,
  lead,
  owner,
  dueDate,
  onOpen,
}: {
  innerRef: DraggableProvided["innerRef"]
  draggableProps: DraggableProvided["draggableProps"]
  dragHandleProps: DraggableProvided["dragHandleProps"]
  isDragging: DraggableStateSnapshot["isDragging"]
  lead: Lead
  owner: Profile | null
  dueDate: string | null
  onOpen: () => void
}) {
  const temp = LEAD_TEMPERATURES.find((t) => t.id === lead.temperature)
  // Overdue gets a danger tone; due today/tomorrow is warning; everything
  // else is neutral. Matches the convention in the priority badge family.
  const dueTone: "danger" | "warning" | "neutral" = React.useMemo(() => {
    if (!dueDate) return "neutral"
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const d = new Date(dueDate)
    d.setHours(0, 0, 0, 0)
    const diffDays = Math.round((d.getTime() - today.getTime()) / 86_400_000)
    if (diffDays < 0) return "danger"
    if (diffDays <= 1) return "warning"
    return "neutral"
  }, [dueDate])

  return (
    <article
      ref={innerRef}
      {...draggableProps}
      {...dragHandleProps}
      onClick={onOpen}
      className={cn(
        "group/lead relative cursor-pointer rounded-[var(--radius-md)] border border-border-subtle bg-card p-3 pl-5 text-left shadow-[var(--shadow-paper-sm)] transition-[transform,box-shadow] duration-150 ease-[cubic-bezier(.2,.6,.2,1)] hover:-translate-y-px hover:shadow-[var(--shadow-paper-md)]",
        isDragging && "rotate-[1.5deg] shadow-[var(--shadow-paper-lg)] ring-1 ring-primary/30"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-2 left-1 text-text-tertiary transition-opacity",
          isDragging
            ? "opacity-100"
            : "opacity-0 group-hover/lead:opacity-100"
        )}
      >
        <GripVertical className="size-3.5" />
      </span>

      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-[14px] font-medium leading-snug text-text-primary">
          {lead.name}
        </p>
        {temp && (
          <Pill tone={temp.pillTone} size="sm" dot className="shrink-0">
            {temp.label}
          </Pill>
        )}
      </div>
      {lead.company && (
        <p className="mt-0.5 truncate text-xs font-medium text-text-tertiary">
          {lead.company}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="font-mono text-[12px] tabular-nums text-text-primary">
          {money(Number(lead.value || 0))}
          <span className="ml-0.5 font-sans text-[10px] font-medium text-text-tertiary">
            /mo
          </span>
        </span>
        <UserAvatar profile={owner} size="sm" />
      </div>

      {dueDate && (
        <div className="mt-2 -mb-0.5 flex items-center gap-1.5">
          <Pill
            variant={dueTone === "neutral" ? "neutral" : dueTone}
            size="sm"
            className="gap-1"
          >
            <CalendarClock className="size-3" />
            {relativeDay(dueDate)}
          </Pill>
        </div>
      )}
    </article>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Skeleton — shown while the very first leads fetch is in flight
// ─────────────────────────────────────────────────────────────────────────

function LeadsBoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden px-1 pb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex w-[284px] shrink-0 flex-col rounded-[var(--radius-lg)] bg-surface-3/40 ring-1 ring-border-subtle"
        >
          <div className="flex flex-col gap-1.5 border-b border-border-subtle px-3 py-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="space-y-2 p-2">
            {Array.from({ length: 3 - (i % 2) }).map((_, j) => (
              <div
                key={j}
                className="space-y-2 rounded-[var(--radius-md)] border border-border-subtle bg-card p-3"
              >
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2.5 w-20" />
                <div className="flex items-center justify-between pt-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="size-6 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function QuickAddLead({ stage }: { stage: LeadStage }) {
  // Per-column inline composer. Just a name field — everything else gets
  // sensible defaults so capturing a lead is one keystroke + Enter. Open the
  // detail sheet afterwards to flesh out company / value / temperature.
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const create = useCreateLead()
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  function submit() {
    const v = name.trim()
    if (!v) {
      setOpen(false)
      return
    }
    create.mutate(
      { name: v, stage },
      {
        onSuccess: () => {
          setName("")
          setOpen(false)
          toast.success("Lead added — open it to add details")
        },
      }
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          // Focus on next paint when the input mounts.
          requestAnimationFrame(() => inputRef.current?.focus())
        }}
        className="m-2 mt-0 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border-default px-2 py-1.5 text-xs text-text-tertiary transition-colors hover:border-text-secondary hover:text-text-secondary"
      >
        <Plus className="size-3.5" />
        Add lead
      </button>
    )
  }

  return (
    <div className="m-2 mt-0 space-y-1.5 rounded-md border border-border-subtle bg-card p-2">
      <Input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            submit()
          } else if (e.key === "Escape") {
            setName("")
            setOpen(false)
          }
        }}
        placeholder="Lead name…"
        className="h-8 text-sm"
      />
      <div className="flex gap-1">
        <Button
          size="sm"
          className="h-7 flex-1 text-xs"
          onClick={submit}
          disabled={!name.trim() || create.isPending}
        >
          Add
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => {
            setName("")
            setOpen(false)
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

const LEAD_CSV_HEADERS = [
  "name",
  "company",
  "email",
  "phone",
  "source",
  "stage",
  "temperature",
  "value",
  "notes",
] as const

function exportLeadsToCsv(leads: Lead[]) {
  const rows = leads.map((l) => [
    l.name,
    l.company,
    l.email,
    l.phone,
    l.source,
    l.stage,
    l.temperature,
    l.value,
    l.notes,
  ])
  const csv = toCsv([...LEAD_CSV_HEADERS], rows)
  downloadCsv(`viddix-leads-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  toast.success(`${leads.length} leads exported`)
}

const VALID_STAGES: LeadStage[] = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
]
const VALID_TEMPS: LeadTemperature[] = ["hot", "warm", "cold"]

async function importLeadsFromCsv(
  text: string,
  create: (input: Partial<Lead> & { name: string }) => Promise<unknown>
): Promise<number> {
  const { rows } = parseCsv(text)
  if (rows.length === 0) throw new Error("CSV is empty")

  // We accept extra columns and missing optional ones, but `name` is required.
  let imported = 0
  for (const r of rows) {
    const name = r.name?.trim()
    if (!name) continue
    const stageRaw = (r.stage ?? "").toLowerCase().trim()
    const tempRaw = (r.temperature ?? "").toLowerCase().trim()
    await create({
      name,
      company: r.company?.trim() || null,
      email: r.email?.trim() || null,
      phone: r.phone?.trim() || null,
      source: r.source?.trim() || null,
      stage: (VALID_STAGES.includes(stageRaw as LeadStage)
        ? (stageRaw as LeadStage)
        : "new"),
      temperature: (VALID_TEMPS.includes(tempRaw as LeadTemperature)
        ? (tempRaw as LeadTemperature)
        : "warm"),
      value: Number(r.value || 0) || 0,
      notes: r.notes?.trim() || null,
    })
    imported++
  }
  if (imported === 0) throw new Error('No valid rows (need at least a "name" column)')
  return imported
}
