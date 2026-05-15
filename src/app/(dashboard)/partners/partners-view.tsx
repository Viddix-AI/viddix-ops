"use client"

import * as React from "react"
import { Handshake, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { useClients } from "@/hooks/use-clients"
import {
  useClientPartners,
  useDeletePartner,
  usePartners,
  useUpdatePartner,
} from "@/hooks/use-partners"
import { money } from "@/lib/format"
import type { Partner } from "@/lib/types"
import { cn } from "@/lib/utils"
import { AddPartnerDialog } from "./add-partner-dialog"
import { EditPartnerDialog } from "./edit-partner-dialog"

export function PartnersView() {
  const { data: partners = [] } = usePartners()
  const { data: links = [] } = useClientPartners()
  const { data: clients = [] } = useClients()
  const update = useUpdatePartner()
  const remove = useDeletePartner()

  const [openAdd, setOpenAdd] = React.useState(false)
  const [editId, setEditId] = React.useState<string | null>(null)
  const editingPartner = partners.find((p) => p.id === editId) ?? null

  // Per-partner: list of (client, splitPct) pairs and projected $ from MRR
  const projections = React.useMemo(() => {
    const byPartner = new Map<
      string,
      { clientId: string; clientName: string; mrr: number; splitPct: number; expected: number }[]
    >()
    for (const cp of links) {
      const client = clients.find((c) => c.id === cp.client_id)
      if (!client) continue
      const expected = (Number(client.mrr || 0) * cp.split_pct) / 100
      const list = byPartner.get(cp.partner_id) ?? []
      list.push({
        clientId: client.id,
        clientName: client.name,
        mrr: Number(client.mrr || 0),
        splitPct: cp.split_pct,
        expected,
      })
      byPartner.set(cp.partner_id, list)
    }
    return byPartner
  }, [links, clients])

  const totalMRRSplit = React.useMemo(() => {
    let total = 0
    for (const list of projections.values()) {
      for (const row of list) total += row.expected
    }
    return total
  }, [projections])

  return (
    <>
      <PageHeader
        title="Partners"
        description={`${partners.length} partners · ${money(totalMRRSplit)}/mo allocated across active retainers`}
        actions={
          <Button onClick={() => setOpenAdd(true)}>
            <Plus />
            New partner
          </Button>
        }
      />

      <div className="space-y-4 px-4 py-5 lg:px-6">
        {partners.length === 0 ? (
          <EmptyState
            icon={<Handshake className="size-4" />}
            title="No partners yet"
            description="Add a partner to start tracking revenue splits across clients."
            action={
              <Button onClick={() => setOpenAdd(true)}>
                <Plus />
                New partner
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {partners.map((p) => {
              const rows = projections.get(p.id) ?? []
              const partnerTotal = rows.reduce((s, r) => s + r.expected, 0)
              return (
                <li
                  key={p.id}
                  className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-border shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-heading text-sm font-semibold truncate">{p.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {p.role ?? "—"} · {p.email ?? "no email"}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Edit partner"
                      onClick={() => setEditId(p.id)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Remove partner"
                      onClick={() => {
                        if (
                          rows.length > 0 &&
                          !confirm(
                            `${p.name} is attached to ${rows.length} client${rows.length === 1 ? "" : "s"}. Remove anyway?`
                          )
                        ) {
                          return
                        }
                        remove.mutate(p.id, {
                          onSuccess: () => toast.success("Partner removed"),
                        })
                      }}
                    >
                      <Trash2 />
                    </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 rounded-md border border-border bg-muted/30 p-3">
                    <Stat label="Default split">{p.default_split_pct}%</Stat>
                    <Stat label="Clients">{rows.length}</Stat>
                    <Stat label="Earned/mo">{money(partnerTotal)}</Stat>
                  </div>

                  <DefaultSplitRow
                    partner={p}
                    onSave={(pct) => update.mutate({ id: p.id, patch: { default_split_pct: pct } })}
                  />

                  {p.notes && (
                    <p className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                      {p.notes}
                    </p>
                  )}

                  {rows.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Not attached to any client yet. Open a client to attach this partner with a custom split.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {rows.map((r) => (
                        <li
                          key={r.clientId}
                          className="flex items-center justify-between px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 truncate font-medium">{r.clientName}</span>
                          <span className="ml-3 shrink-0 tabular-nums text-xs text-muted-foreground">
                            {r.splitPct}% of {money(r.mrr)} ={" "}
                            <span className="font-semibold text-foreground">
                              {money(r.expected)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <AddPartnerDialog open={openAdd} onOpenChange={setOpenAdd} />
      <EditPartnerDialog
        partner={editingPartner}
        open={!!editId}
        onOpenChange={(o) => !o && setEditId(null)}
      />
    </>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("font-heading text-base font-semibold tabular-nums")}>{children}</p>
    </div>
  )
}

function DefaultSplitRow({
  partner,
  onSave,
}: {
  partner: Partner
  onSave: (pct: number) => void
}) {
  // Re-sync the local edit buffer when the upstream value changes (after a
  // save round-trips). Using the "store-info-from-previous-renders" pattern
  // avoids the cascading-render warning from setting state inside an effect.
  const [prev, setPrev] = React.useState(partner.default_split_pct)
  const [val, setVal] = React.useState(String(partner.default_split_pct))
  if (prev !== partner.default_split_pct) {
    setPrev(partner.default_split_pct)
    setVal(String(partner.default_split_pct))
  }
  return (
    <label className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">Default split %</span>
      <Input
        type="number"
        min="0"
        max="100"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          const n = Math.max(0, Math.min(100, Number(val) || 0))
          if (n !== partner.default_split_pct) onSave(n)
          setVal(String(n))
        }}
        className="h-8 w-24"
      />
    </label>
  )
}
