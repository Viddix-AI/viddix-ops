"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCreatePartner } from "@/hooks/use-partners"

type Form = {
  name: string
  email: string
  role: string
  default_split_pct: string
  notes: string
}

const EMPTY: Form = {
  name: "",
  email: "",
  role: "",
  default_split_pct: "",
  notes: "",
}

export function AddPartnerDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [form, setForm] = React.useState<Form>(EMPTY)
  const create = useCreatePartner()

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
    const pct = Math.max(0, Math.min(100, Number(form.default_split_pct) || 0))
    create.mutate(
      {
        name: form.name.trim(),
        email: form.email.trim() || null,
        role: form.role.trim() || null,
        default_split_pct: pct,
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
          <DialogTitle>Add partner</DialogTitle>
        </DialogHeader>
        <form id="add-partner" onSubmit={handleSubmit} className="grid gap-3">
          <Field label="Name *">
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Partner name"
              autoFocus
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
            <Field label="Role">
              <Input
                value={form.role}
                onChange={(e) => set("role", e.target.value)}
                placeholder="Co-founder, referral…"
              />
            </Field>
          </div>
          <Field label="Default split (%)">
            <Input
              type="number"
              min="0"
              max="100"
              value={form.default_split_pct}
              onChange={(e) => set("default_split_pct", e.target.value)}
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
        <DialogFooter showCloseButton>
          <Button
            type="submit"
            form="add-partner"
            disabled={!form.name.trim() || create.isPending}
          >
            {create.isPending ? "Adding…" : "Add partner"}
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
