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
import { LEAD_STAGES, type LeadStage } from "@/lib/types"

const SOURCES = [
  { value: "referral", label: "Referral" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "website", label: "Website" },
  { value: "cold", label: "Cold outreach" },
  { value: "event", label: "Event" },
]

type Form = {
  name: string
  company: string
  email: string
  phone: string
  source: string
  stage: LeadStage
  value: string
  notes: string
}

const EMPTY: Form = {
  name: "",
  company: "",
  email: "",
  phone: "",
  source: "",
  stage: "new",
  value: "",
  notes: "",
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

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleOpenChange(o: boolean) {
    if (!o) setForm(EMPTY)
    onOpenChange(o)
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
        source: form.source || null,
        stage: form.stage,
        value: Number(form.value) || 0,
        notes: form.notes.trim() || null,
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
      <span className="text-xs font-medium text-foreground/80">{label}</span>
      {children}
    </label>
  )
}
