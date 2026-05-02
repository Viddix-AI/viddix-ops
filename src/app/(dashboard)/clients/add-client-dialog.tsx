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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCreateClient } from "@/hooks/use-clients"
import type { ClientStatus } from "@/lib/types"

const STATUSES: { value: ClientStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "prospect", label: "Prospect" },
  { value: "paused", label: "Paused" },
  { value: "churned", label: "Churned" },
]

type Form = {
  name: string
  company: string
  email: string
  phone: string
  status: ClientStatus
  mrr: string
  contract_start: string
  contract_end: string
  notes: string
}

const EMPTY: Form = {
  name: "",
  company: "",
  email: "",
  phone: "",
  status: "prospect",
  mrr: "",
  contract_start: "",
  contract_end: "",
  notes: "",
}

export function AddClientDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [form, setForm] = React.useState<Form>(EMPTY)
  const create = useCreateClient()

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
        contact_name: form.company.trim() || null,
        contact_email: form.email.trim() || null,
        contact_phone: form.phone.trim() || null,
        status: form.status,
        mrr: Number(form.mrr) || 0,
        started_at: form.contract_start || null,
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add client</DialogTitle>
        </DialogHeader>
        <form id="add-client" onSubmit={handleSubmit} className="grid gap-3">
          <Field label="Name *">
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Client name"
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
            <Field label="Status">
              <Select
                value={form.status}
                onValueChange={(v) => set("status", (v ?? "prospect") as ClientStatus)}
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
            <Field label="MRR ($)">
              <Input
                type="number"
                min="0"
                value={form.mrr}
                onChange={(e) => set("mrr", e.target.value)}
                placeholder="0"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contract start">
              <Input
                type="date"
                value={form.contract_start}
                onChange={(e) => set("contract_start", e.target.value)}
              />
            </Field>
            <Field label="Contract end">
              <Input
                type="date"
                value={form.contract_end}
                onChange={(e) => set("contract_end", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Any notes…"
              rows={3}
            />
          </Field>
        </form>
        <DialogFooter showCloseButton>
          <Button
            type="submit"
            form="add-client"
            disabled={!form.name.trim() || create.isPending}
          >
            {create.isPending ? "Adding…" : "Add client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
