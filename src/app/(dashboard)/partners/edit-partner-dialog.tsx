"use client"

import * as React from "react"
import { toast } from "sonner"

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
import { useUpdatePartner } from "@/hooks/use-partners"
import type { Partner } from "@/lib/types"

type Form = {
  name: string
  email: string
  role: string
  default_split_pct: string
  notes: string
}

function fromPartner(p: Partner): Form {
  return {
    name: p.name,
    email: p.email ?? "",
    role: p.role ?? "",
    default_split_pct: String(p.default_split_pct),
    notes: p.notes ?? "",
  }
}

export function EditPartnerDialog({
  partner,
  open,
  onOpenChange,
}: {
  partner: Partner | null
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const [form, setForm] = React.useState<Form>(() =>
    partner ? fromPartner(partner) : {
      name: "",
      email: "",
      role: "",
      default_split_pct: "0",
      notes: "",
    }
  )
  // Re-sync the form whenever the dialog opens for a different partner.
  // Using the "store-info-from-previous-renders" pattern instead of an effect
  // avoids the cascading-render warning.
  const [prevId, setPrevId] = React.useState(partner?.id ?? null)
  if (partner && partner.id !== prevId) {
    setPrevId(partner.id)
    setForm(fromPartner(partner))
  }

  const update = useUpdatePartner()

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!partner || !form.name.trim()) return
    const pct = Math.max(0, Math.min(100, Number(form.default_split_pct) || 0))
    update.mutate(
      {
        id: partner.id,
        patch: {
          name: form.name.trim(),
          email: form.email.trim() || null,
          role: form.role.trim() || null,
          default_split_pct: pct,
          notes: form.notes.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Partner updated")
          onOpenChange(false)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit partner</DialogTitle>
        </DialogHeader>
        <form id="edit-partner" onSubmit={handleSubmit} className="grid gap-3">
          <Field label="Name *">
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
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
            />
          </Field>
          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
            />
          </Field>
        </form>
        <DialogFooter showCloseButton>
          <Button
            type="submit"
            form="edit-partner"
            disabled={!form.name.trim() || update.isPending}
          >
            {update.isPending ? "Saving…" : "Save changes"}
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
