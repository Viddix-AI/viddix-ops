"use client"

import * as React from "react"
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd"
import { Plus, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import { money } from "@/lib/format"
import { LEAD_STAGES, type Lead, type LeadStage } from "@/lib/types"
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

  const [openAdd, setOpenAdd] = React.useState(false)
  const [activeLeadId, setActiveLeadId] = React.useState<string | null>(null)
  const activeLead = leads.find((l) => l.id === activeLeadId) ?? null

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
    for (const l of leads) map[l.stage].push(l)
    for (const k of Object.keys(map) as LeadStage[]) {
      map[k].sort((a, b) => a.position - b.position)
    }
    return map
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
          <Button onClick={() => setOpenAdd(true)}>
            <Plus />
            New lead
          </Button>
        }
      />

      <div className="px-4 py-5 lg:px-6">
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
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          stage.tone
                        )}
                      >
                        {stage.label}
                      </span>
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
                                <p className="font-medium leading-snug truncate">
                                  {lead.name}
                                </p>
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
            onSuccess: (client) => {
              toast.success(`${activeLead.name} → client created`)
              setActiveLeadId(null)
            },
          })
        }}
      />
    </>
  )
}
