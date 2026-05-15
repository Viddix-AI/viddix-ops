"use client"

import * as React from "react"
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd"
import { Download, Plus, Search, Sparkles, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pill } from "@/components/ui/pill"
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
import { downloadCsv, parseCsv, pickCsvFile, toCsv } from "@/lib/csv"
import { money } from "@/lib/format"
import {
  LEAD_STAGES,
  LEAD_TEMPERATURES,
  TEAMS,
  type Lead,
  type LeadStage,
  type LeadTemperature,
  type Team,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import { LeadDetailSheet } from "./lead-detail-sheet"
import { AddLeadSheet } from "./add-lead-sheet"

export function LeadsBoard() {
  const { data: leads = [] } = useLeads()
  const { data: profiles = [] } = useProfiles()
  const move = useMoveLead()
  const remove = useDeleteLead()
  const update = useUpdateLead()
  const convert = useConvertLead()
  const create = useCreateLead()

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
        title="Leads"
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
        <div className="mb-3 relative max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads by name, company, email…"
            className="h-9 pl-8"
          />
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Temperature
          </span>
          <button
            type="button"
            onClick={() => setTempFilter("all")}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              tempFilter === "all"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            All · {leads.length}
          </button>
          {LEAD_TEMPERATURES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTempFilter(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                tempFilter === t.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              <span className={cn("size-2 rounded-full", t.dot)} />
              {t.label} · {tempCounts[t.id]}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Team
          </span>
          <button
            type="button"
            onClick={() => setTeamFilter("all")}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              teamFilter === "all"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            All · {leads.length}
          </button>
          {TEAMS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTeamFilter(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                teamFilter === t.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              <span className={cn("size-2 rounded-full", t.id === "madrid" ? "bg-blue-500" : "bg-emerald-500")} />
              {t.label} · {teamCounts[t.id]}
            </button>
          ))}
        </div>
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {LEAD_STAGES.map((stage) => {
              const items = byStage[stage.id]
              const total = items.reduce(
                (s, l) => s + Number(l.value || 0),
                0
              )
              return (
                <div
                  key={stage.id}
                  className="flex w-[280px] shrink-0 flex-col rounded-xl bg-muted/40 ring-1 ring-border"
                >
                  <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Pill tone={stage.pillTone} size="sm" uppercase>
                        {stage.label}
                      </Pill>
                      <span className="text-xs text-muted-foreground">
                        {items.length}
                      </span>
                    </div>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {money(total)}
                    </span>
                  </div>

                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "flex-1 space-y-2 p-2 transition-colors",
                          snapshot.isDraggingOver && "bg-accent/40"
                        )}
                      >
                        {items.length === 0 && !snapshot.isDraggingOver && (
                          <div className="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
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
                              <article
                                ref={p.innerRef}
                                {...p.draggableProps}
                                {...p.dragHandleProps}
                                onClick={() => setActiveLeadId(lead.id)}
                                className={cn(
                                  "cursor-pointer rounded-lg border border-border bg-background p-3 text-left shadow-sm transition-shadow hover:shadow-md",
                                  s.isDragging && "shadow-lg ring-1 ring-primary/30"
                                )}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={cn(
                                      "size-2 shrink-0 rounded-full",
                                      LEAD_TEMPERATURES.find(
                                        (t) => t.id === lead.temperature
                                      )?.dot ?? "bg-slate-300"
                                    )}
                                    title={`${lead.temperature} lead`}
                                  />
                                  <p className="font-medium leading-snug truncate">
                                    {lead.name}
                                  </p>
                                </div>
                                {lead.company && (
                                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                    {lead.company}
                                  </p>
                                )}
                                <div className="mt-2.5 flex items-center justify-between">
                                  <span className="text-xs font-semibold tabular-nums text-foreground">
                                    {money(Number(lead.value || 0))}
                                    <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">
                                      /mo
                                    </span>
                                  </span>
                                  <UserAvatar
                                    profile={
                                      profiles.find(
                                        (p) => p.id === lead.owner_id
                                      ) ?? null
                                    }
                                    size="sm"
                                  />
                                </div>
                              </article>
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
        </DragDropContext>

        {leads.length === 0 && (
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
        className="m-2 mt-0 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
      >
        <Plus className="size-3.5" />
        Add lead
      </button>
    )
  }

  return (
    <div className="m-2 mt-0 space-y-1.5 rounded-md border border-border bg-background p-2">
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
