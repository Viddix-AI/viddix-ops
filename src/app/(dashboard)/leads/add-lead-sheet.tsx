"use client"

import * as React from "react"

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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useCreateLead } from "@/hooks/use-leads"
import { usePartners } from "@/hooks/use-partners"
import { useProfiles } from "@/hooks/use-profile"
import {
  LEAD_STAGES,
  LEAD_TEMPERATURES,
  type LeadStage,
  type LeadTemperature,
} from "@/lib/types"
import { cn } from "@/lib/utils"

const SOURCES = [
  { value: "referral", label: "Referral" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "website", label: "Website" },
  { value: "cold", label: "Cold outreach" },
  { value: "event", label: "Event" },
]

// Sentinel for "no selection" on the Select primitives, since base-ui's Select
// can't take "" as a real item value.
const NONE = "__none__"

type Form = {
  name: string
  company: string
  email: string
  phone: string
  website: string
  source: string
  stage: LeadStage
  temperature: LeadTemperature
  value: string
  notes: string
  owner_id: string
  partner_id: string
  partner_split_pct: number
}

const EMPTY: Form = {
  name: "",
  company: "",
  email: "",
  phone: "",
  website: "",
  source: "",
  stage: "new",
  temperature: "warm",
  value: "",
  notes: "",
  owner_id: "",
  partner_id: "",
  partner_split_pct: 0,
}

export function AddLeadSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [form, setForm] = React.useState<Form>(EMPTY)
  const create = useCreateLead()
  const { data: profiles = [] } = useProfiles()
  const { data: partners = [] } = usePartners()

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleOpenChange(o: boolean) {
    if (!o) setForm(EMPTY)
    onOpenChange(o)
  }

  function handlePartnerChange(partnerId: string | null) {
    if (!partnerId || partnerId === NONE) {
      setForm((f) => ({ ...f, partner_id: "", partner_split_pct: 0 }))
      return
    }
    const partner = partners.find((p) => p.id === partnerId)
    setForm((f) => ({
      ...f,
      partner_id: partnerId,
      partner_split_pct: partner?.default_split_pct ?? f.partner_split_pct,
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    create.mutate(
      {
        name: form.name.trim(),
        company: form.company.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        website: form.website.trim() || null,
        source: form.source || null,
        stage: form.stage,
        temperature: form.temperature,
        value: Number(form.value) || 0,
        notes: form.notes.trim() || null,
        owner_id: form.owner_id || null,
        partner_id: form.partner_id || null,
        partner_split_pct: form.partner_id
          ? Math.max(0, Math.min(100, Number(form.partner_split_pct) || 0))
          : 0,
      },
      {
        onSuccess: () => {
          setForm(EMPTY)
          onOpenChange(false)
        },
      }
    )
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Add lead</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <form id="add-lead" onSubmit={handleSubmit} className="grid gap-3">
            <Field label="Name *">
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Contact name"
                autoFocus
              />
            </Field>
            <Field label="Company">
              <Input
                value={form.company}
                onChange={(e) => set("company", e.target.value)}
                placeholder="Company"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="email@example.com"
                />
              </Field>
              <Field label="Phone">
                <Input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+1 555 000 0000"
                />
              </Field>
            </div>
            <Field label="Website">
              <Input
                type="url"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://example.com"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Source">
                <Select
                  value={form.source}
                  onValueChange={(v) => set("source", v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Stage">
                <Select
                  value={form.stage}
                  onValueChange={(v) => set("stage", (v ?? "new") as LeadStage)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STAGES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Owner">
              <Select
                value={form.owner_id || NONE}
                onValueChange={(v) => set("owner_id", v === NONE ? "" : (v ?? ""))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>
                    <span className="text-text-tertiary">Unassigned</span>
                  </SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Field label="Partner">
                <Select
                  value={form.partner_id || NONE}
                  onValueChange={handlePartnerChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>
                      <span className="text-text-tertiary">None</span>
                    </SelectItem>
                    {partners.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Split %">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={form.partner_split_pct}
                  onChange={(e) =>
                    set("partner_split_pct", Number(e.target.value) || 0)
                  }
                  disabled={!form.partner_id}
                  className="w-20"
                />
              </Field>
            </div>
            <Field label="Temperature">
              <div className="flex gap-1.5">
                {LEAD_TEMPERATURES.map((t) => {
                  const active = form.temperature === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => set("temperature", t.id)}
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
            <Field label="Value ($)">
              <Input
                type="number"
                min="0"
                value={form.value}
                onChange={(e) => set("value", e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="Notes">
              <Textarea
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Any notes…"
                rows={3}
              />
            </Field>
          </form>
        </div>
        <SheetFooter>
          <Button
            type="submit"
            form="add-lead"
            className="w-full"
            disabled={!form.name.trim() || create.isPending}
          >
            {create.isPending ? "Adding…" : "Add lead"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  )
}
