"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import {
  ArrowRight,
  Briefcase,
  Calendar as CalendarIcon,
  CheckSquare,
  Handshake,
  Search,
  Sparkles,
} from "lucide-react"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { NAV_ITEMS } from "@/components/dashboard/sidebar"
import { useClients } from "@/hooks/use-clients"
import { useLeads } from "@/hooks/use-leads"
import { usePartners } from "@/hooks/use-partners"
import { useTasks } from "@/hooks/use-tasks"
import { cn } from "@/lib/utils"

/**
 * CommandPalette — global ⌘K palette.
 *
 * Renders inside the shared Dialog wrapper so it picks up the project's
 * overlay/portal/animation conventions. cmdk handles search, filtering,
 * keyboard navigation (↑/↓/⏎); we provide the data + nav targets.
 *
 * Sections:
 *   • Pages       — same set as the sidebar.
 *   • Actions     — quick jumps to "create X" entry points.
 *   • Leads       — fuzzy match across name / company / email.
 *   • Clients     — fuzzy match across name / contact / email.
 *   • Partners    — fuzzy match across name / role / email.
 *   • Tasks       — fuzzy match across title.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const router = useRouter()
  const { data: leads = [] } = useLeads()
  const { data: clients = [] } = useClients()
  const { data: partners = [] } = usePartners()
  const { data: tasks = [] } = useTasks()

  // Convenience: close palette then route. We can't compose hooks here so
  // we expose a tiny factory.
  const go = React.useCallback(
    (path: string) => () => {
      onOpenChange(false)
      router.push(path)
    },
    [onOpenChange, router]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-[var(--radius-xl)] border border-border-subtle bg-card p-0 shadow-[var(--shadow-paper-lg)] backdrop-blur sm:max-w-[640px]"
      >
        <Command label="Global search" className="flex flex-col">
          <div className="flex items-center gap-2 border-b border-border-subtle px-4">
            <Search className="size-4 shrink-0 text-text-tertiary" />
            <Command.Input
              placeholder="Type a command or search…"
              className="flex h-12 w-full bg-transparent text-[16px] tracking-[-0.01em] outline-none placeholder:text-text-tertiary disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <Command.List className="max-h-[24rem] overflow-y-auto p-1.5">
            <Command.Empty className="py-8 text-center text-sm text-text-tertiary">
              No results found.
            </Command.Empty>

            <Group heading="Pages">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <PaletteItem
                    key={item.href}
                    value={`page ${item.label}`}
                    onSelect={go(item.href)}
                    icon={<Icon className="size-4" />}
                    label={item.label}
                  />
                )
              })}
            </Group>

            <Group heading="Actions">
              <PaletteItem
                value="action new lead"
                onSelect={go("/leads")}
                icon={<Sparkles className="size-4" />}
                label="New lead…"
                hint="Go to Leads"
              />
              <PaletteItem
                value="action new client"
                onSelect={go("/clients")}
                icon={<Briefcase className="size-4" />}
                label="New client…"
                hint="Go to Clients"
              />
              <PaletteItem
                value="action new partner"
                onSelect={go("/partners")}
                icon={<Handshake className="size-4" />}
                label="New partner…"
                hint="Go to Partners"
              />
              <PaletteItem
                value="action new task"
                onSelect={go("/tasks")}
                icon={<CheckSquare className="size-4" />}
                label="New task…"
                hint="Go to Tasks"
              />
              <PaletteItem
                value="action new event schedule"
                onSelect={go("/calendar")}
                icon={<CalendarIcon className="size-4" />}
                label="New event…"
                hint="Go to Calendar"
              />
            </Group>

            {leads.length > 0 && (
              <Group heading="Pipeline">
                {leads.slice(0, 8).map((l) => (
                  <PaletteItem
                    key={l.id}
                    value={`lead ${l.name} ${l.company ?? ""} ${l.email ?? ""}`}
                    onSelect={go("/leads")}
                    icon={<Sparkles className="size-4" />}
                    label={l.name}
                    sub={l.company ?? undefined}
                  />
                ))}
              </Group>
            )}

            {clients.length > 0 && (
              <Group heading="Clients">
                {clients.slice(0, 8).map((c) => (
                  <PaletteItem
                    key={c.id}
                    value={`client ${c.name} ${c.contact_name ?? ""} ${c.contact_email ?? ""}`}
                    onSelect={go(`/clients/${c.id}`)}
                    icon={<Briefcase className="size-4" />}
                    label={c.name}
                    sub={c.contact_name ?? undefined}
                  />
                ))}
              </Group>
            )}

            {partners.length > 0 && (
              <Group heading="Partners">
                {partners.slice(0, 8).map((p) => (
                  <PaletteItem
                    key={p.id}
                    value={`partner ${p.name} ${p.role ?? ""} ${p.email ?? ""}`}
                    onSelect={go("/partners")}
                    icon={<Handshake className="size-4" />}
                    label={p.name}
                    sub={p.role ?? undefined}
                  />
                ))}
              </Group>
            )}

            {tasks.length > 0 && (
              <Group heading="Tasks">
                {tasks.slice(0, 8).map((t) => (
                  <PaletteItem
                    key={t.id}
                    value={`task ${t.title}`}
                    onSelect={go("/tasks")}
                    icon={<CheckSquare className="size-4" />}
                    label={t.title}
                  />
                ))}
              </Group>
            )}
          </Command.List>

          <div className="flex items-center justify-between border-t border-border-subtle bg-surface-3/40 px-4 py-2 text-[11px] text-text-tertiary">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              <span>Navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd>
              <span>Select</span>
            </span>
            <span className="flex items-center gap-1">
              <Kbd>Esc</Kbd>
              <span>Close</span>
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  )
}

function Group({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <Command.Group
      heading={heading}
      className={cn(
        "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1",
        "[&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-text-tertiary [&_[cmdk-group-heading]]:uppercase"
      )}
    >
      {children}
    </Command.Group>
  )
}

function PaletteItem({
  value,
  onSelect,
  icon,
  label,
  sub,
  hint,
}: {
  value: string
  onSelect: () => void
  icon: React.ReactNode
  label: string
  sub?: string
  hint?: string
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md border-l-2 border-transparent px-3 py-1.5 text-sm transition-colors",
        "data-[selected=true]:border-primary data-[selected=true]:bg-surface-3 data-[selected=true]:pl-[14px]",
        "aria-disabled:pointer-events-none aria-disabled:opacity-50"
      )}
    >
      <span className="grid size-6 shrink-0 place-items-center rounded-sm bg-surface-3 text-text-secondary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-text-primary">{label}</p>
        {sub && (
          <p className="truncate text-[11px] text-text-tertiary">{sub}</p>
        )}
      </div>
      {hint && (
        <span className="shrink-0 text-[11px] text-text-tertiary">
          {hint} <ArrowRight className="inline size-3" />
        </span>
      )}
    </Command.Item>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border-subtle bg-card px-1 font-mono text-[10px] text-text-tertiary">
      {children}
    </kbd>
  )
}
