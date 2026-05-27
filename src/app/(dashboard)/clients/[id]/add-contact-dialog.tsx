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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCreateContact, useUpdateContact } from "@/hooks/use-contacts"
import type { Contact, ContactRole } from "@/lib/types"

const ROLES: { id: ContactRole; label: string }[] = [
  { id: "primary",        label: "Primary" },
  { id: "champion",       label: "Champion" },
  { id: "decision_maker", label: "Decision maker" },
  { id: "influencer",     label: "Influencer" },
  { id: "blocker",        label: "Blocker" },
  { id: "other",          label: "Other" },
]

type Form = {
  full_name: string
  email: string
  phone: string
  role: ContactRole
  title: string
  notes: string
  is_primary: boolean
}

const empty = (): Form => ({
  full_name: "",
  email: "",
  phone: "",
  role: "other",
  title: "",
  notes: "",
  is_primary: false,
})

const fromContact = (c: Contact): Form => ({
  full_name: c.full_name,
  email: c.email ?? "",
  phone: c.phone ?? "",
  role: c.role,
  title: c.title ?? "",
  notes: c.notes ?? "",
  is_primary: c.is_primary,
})

export function AddContactDialog({
  open,
  onOpenChange,
  clientId,
  contact,
  hasExistingPrimary,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  /** When provided, the dialog is in edit mode and patches this contact. */
  contact?: Contact | null
  /** Used to warn the user that ticking is_primary will demote another row. */
  hasExistingPrimary: boolean
}) {
  const create = useCreateContact()
  const update = useUpdateContact()
  const [form, setForm] = React.useState<Form>(() =>
    contact ? fromContact(contact) : empty()
  )
  // Re-sync the edit buffer when the dialog opens for a different contact.
  // store-info-from-previous-renders pattern: no useEffect.
  const [prevContactId, setPrevContactId] = React.useState<string | null>(
    contact?.id ?? null
  )
  if ((contact?.id ?? null) !== prevContactId) {
    setPrevContactId(contact?.id ?? null)
    setForm(contact ? fromContact(contact) : empty())
  }

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleOpenChange(o: boolean) {
    if (!o && !contact) setForm(empty())
    onOpenChange(o)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) return
    const payload = {
      client_id: clientId,
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      role: form.role,
      title: form.title.trim() || null,
      notes: form.notes.trim() || null,
      is_primary: form.is_primary,
    }
    if (contact) {
      update.mutate(
        { id: contact.id, clientId, patch: payload },
        { onSuccess: () => onOpenChange(false) }
      )
    } else {
      create.mutate(payload, {
        onSuccess: () => {
          setForm(empty())
          onOpenChange(false)
        },
      })
    }
  }

  const pending = create.isPending || update.isPending
  const willDemote =
    form.is_primary && hasExistingPrimary && !(contact?.is_primary ?? false)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "Add contact"}</DialogTitle>
        </DialogHeader>
        <form id="contact-form" onSubmit={handleSubmit} className="grid gap-3">
          <Field label="Full name *">
            <Input
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              placeholder="Jane Doe"
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="jane@example.com"
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
            <Field label="Role">
              <Select
                value={form.role}
                onValueChange={(v) => set("role", v as ContactRole)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Title">
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Head of Operations"
              />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes about this contact…"
              rows={3}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_primary}
              onChange={(e) => set("is_primary", e.target.checked)}
              className="size-4 cursor-pointer accent-primary"
            />
            <span className="text-foreground/80">Primary contact</span>
          </label>
          {willDemote && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              The current primary contact will be demoted automatically.
            </p>
          )}
        </form>
        <DialogFooter showCloseButton>
          <Button
            type="submit"
            form="contact-form"
            disabled={!form.full_name.trim() || pending}
          >
            {pending
              ? "Saving…"
              : contact
              ? "Save changes"
              : "Add contact"}
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
