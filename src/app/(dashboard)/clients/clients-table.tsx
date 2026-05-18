"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowUpDown,
  Briefcase,
  Download,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { TeamBadge } from "@/components/dashboard/team-badge"
import { UserAvatar } from "@/components/dashboard/user-avatar"
import {
  useClients,
  useCreateClient,
  useDeleteClient,
  useUpdateClient,
} from "@/hooks/use-clients"
import { useProfiles } from "@/hooks/use-profile"
import { downloadCsv, parseCsv, pickCsvFile, toCsv } from "@/lib/csv"
import { money } from "@/lib/format"
import { TEAMS, type Client, type Profile, type Team } from "@/lib/types"
import { cn } from "@/lib/utils"
import { AddClientDialog } from "./add-client-dialog"

type SortKey = "name" | "mrr" | "started_at"
type Density = "comfortable" | "compact"

const DENSITY_KEY = "viddix:clients-density"

export function ClientsTable() {
  const router = useRouter()
  const { data: clients = [], isFetching, isSuccess } = useClients()
  const { data: profiles = [] } = useProfiles()
  const create = useCreateClient()
  const update = useUpdateClient()
  const remove = useDeleteClient()
  // First-ever fetch in flight — true once on mount until the first real
  // result lands. `placeholderData: SEED_CLIENTS` keeps `data` non-undefined
  // through the wait so the table chrome can paint immediately.
  const isInitialLoad = isFetching && !isSuccess && clients.length === 0

  const [q, setQ] = React.useState("")
  const [team, setTeam] = React.useState<Team | "all">("all")
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>(
    { key: "mrr", dir: "desc" }
  )
  const [openAdd, setOpenAdd] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set())

  // Density preference — read once from localStorage on first client render.
  // Uses the "store-info-from-previous-renders" pattern (Sidebar's
  // StorageStatus, SplitInput) so we don't call setState inside an effect.
  const [density, setDensityState] = React.useState<Density>("comfortable")
  const [hydratedDensity, setHydratedDensity] = React.useState(false)
  if (!hydratedDensity && typeof window !== "undefined") {
    setHydratedDensity(true)
    const saved = window.localStorage.getItem(DENSITY_KEY)
    if (saved === "compact" || saved === "comfortable") setDensityState(saved)
  }
  function setDensity(v: Density) {
    setDensityState(v)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DENSITY_KEY, v)
    }
  }

  const teamForClient = React.useCallback(
    (c: Client): Team | null =>
      profiles.find((p) => p.id === c.owner_id)?.team ?? null,
    [profiles]
  )

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase()
    return clients
      .filter((c) => (team === "all" ? true : teamForClient(c) === team))
      .filter((c) =>
        !needle
          ? true
          : c.name.toLowerCase().includes(needle) ||
            c.contact_name?.toLowerCase().includes(needle) ||
            c.contact_email?.toLowerCase().includes(needle)
      )
      .sort((a, b) => {
        const dir = sort.dir === "asc" ? 1 : -1
        if (sort.key === "name") return a.name.localeCompare(b.name) * dir
        if (sort.key === "mrr") return (Number(a.mrr) - Number(b.mrr)) * dir
        return (a.started_at ?? "").localeCompare(b.started_at ?? "") * dir
      })
  }, [clients, q, team, teamForClient, sort])

  const totalMRR = clients.reduce((s, c) => s + Number(c.mrr || 0), 0)

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    )

  // ── Selection helpers ────────────────────────────────────────────────────
  // Selection is keyed by client id and constrained to the visible (filtered)
  // set: if a client falls out of the filter while selected, it doesn't count
  // for bulk actions. Prevents "I deleted 12 things and 4 of them I forgot
  // were filtered out" surprises.
  const visibleIds = React.useMemo(
    () => new Set(filtered.map((c) => c.id)),
    [filtered]
  )
  const visibleSelectedCount = React.useMemo(
    () => Array.from(selected).filter((id) => visibleIds.has(id)).length,
    [selected, visibleIds]
  )
  const allVisibleSelected =
    filtered.length > 0 && visibleSelectedCount === filtered.length

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleAllVisible() {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev)
        for (const id of visibleIds) next.delete(id)
        return next
      }
      return new Set([...prev, ...visibleIds])
    })
  }
  function clearSelection() {
    setSelected(new Set())
  }

  // ── Bulk actions ────────────────────────────────────────────────────────
  async function bulkAssignOwner(ownerId: string | null) {
    const ids = Array.from(selected).filter((id) => visibleIds.has(id))
    if (ids.length === 0) return
    // Fire mutations in parallel — TanStack Query coalesces invalidations.
    await Promise.all(
      ids.map((id) => update.mutateAsync({ id, patch: { owner_id: ownerId } }))
    )
    toast.success(
      `${ids.length} client${ids.length === 1 ? "" : "s"} ${
        ownerId ? "reassigned" : "unassigned"
      }`
    )
  }
  async function bulkDelete() {
    const ids = Array.from(selected).filter((id) => visibleIds.has(id))
    if (ids.length === 0) return
    if (
      !confirm(
        `Delete ${ids.length} client${ids.length === 1 ? "" : "s"}? Cascade also removes attached partner splits and notes; tasks/events keep their data without a client link.`
      )
    ) {
      return
    }
    await Promise.all(ids.map((id) => remove.mutateAsync(id)))
    clearSelection()
    toast.success(
      `${ids.length} client${ids.length === 1 ? "" : "s"} deleted`
    )
  }
  function bulkExport() {
    const ids = Array.from(selected).filter((id) => visibleIds.has(id))
    const subset = clients.filter((c) => ids.includes(c.id))
    if (subset.length === 0) return
    exportClientsToCsv(subset)
  }

  return (
    <>
      <PageHeader
        eyebrow="HOLDING · ACCOUNTS"
        title="Clients"
        description={`${clients.length} clients · ${money(totalMRR)} MRR`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportClientsToCsv(clients)}
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
                importClientsFromCsv(text, (input) => create.mutateAsync(input))
                  .then((n) => toast.success(`${n} clients imported`))
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
              New client
            </Button>
          </div>
        }
      />

      <div className="space-y-4 px-4 py-5 lg:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-tertiary" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search clients…"
              className="h-9 pl-8"
            />
          </div>
          <Select value={team} onValueChange={(v) => setTeam(v as Team | "all")}>
            <SelectTrigger size="default" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {TEAMS.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={density}
            onValueChange={(v) => setDensity(v as Density)}
          >
            <SelectTrigger size="default" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comfortable">Comfortable</SelectItem>
              <SelectItem value="compact">Compact</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {visibleSelectedCount > 0 && (
          <BulkActionBar
            count={visibleSelectedCount}
            profiles={profiles}
            onAssignOwner={bulkAssignOwner}
            onExport={bulkExport}
            onDelete={bulkDelete}
            onClear={clearSelection}
            isBusy={update.isPending || remove.isPending}
          />
        )}

        {isInitialLoad ? (
          <ClientsTableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="size-4" />}
            title="No clients found"
            description="Adjust the filters or add your first client."
            action={
              <Button onClick={() => setOpenAdd(true)}>
                <Plus />
                New client
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-lg)] bg-card ring-1 ring-border-subtle shadow-[var(--shadow-paper-sm)]">
            <table className="w-full text-sm">
              <thead
                className={cn(
                  // Header stays at the top of the table card. The previous
                  // `sticky top-14` placed it 56px into the scroll container,
                  // which (because the wrapper has overflow-x-auto and creates
                  // its own sticky context) ended up shoving the thead over the
                  // first body row and visually hiding it.
                  "border-b border-border-subtle bg-surface-3 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-text-tertiary",
                  "[&_tr]:rounded-t-[var(--radius-lg)]"
                )}
              >
                <tr>
                  <Th className="w-10 pl-4 pr-0">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      ref={(el) => {
                        if (el)
                          el.indeterminate =
                            visibleSelectedCount > 0 && !allVisibleSelected
                      }}
                      onChange={toggleAllVisible}
                      aria-label="Select all visible"
                      className="size-4 cursor-pointer accent-primary"
                    />
                  </Th>
                  <Th
                    onClick={() => toggleSort("name")}
                    active={sort.key === "name"}
                    dir={sort.dir}
                  >
                    Client
                  </Th>
                  <Th>Contact</Th>
                  <Th>Owner</Th>
                  <Th
                    onClick={() => toggleSort("mrr")}
                    active={sort.key === "mrr"}
                    dir={sort.dir}
                    align="right"
                  >
                    MRR
                  </Th>
                  <Th
                    onClick={() => toggleSort("started_at")}
                    active={sort.key === "started_at"}
                    dir={sort.dir}
                  >
                    Started
                  </Th>
                  <Th className="w-10 pr-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => (
                  <ClientRow
                    key={c.id}
                    client={c}
                    profiles={profiles}
                    density={density}
                    selected={selected.has(c.id)}
                    onToggleSelect={() => toggleOne(c.id)}
                    onAssignOwner={(ownerId) =>
                      update.mutate({ id: c.id, patch: { owner_id: ownerId } })
                    }
                    onDelete={() => {
                      if (
                        !confirm(
                          `Delete ${c.name}? Cascade also removes attached partner splits and notes.`
                        )
                      ) {
                        return
                      }
                      remove.mutate(c.id, {
                        onSuccess: () => toast.success(`${c.name} deleted`),
                      })
                    }}
                    onOpen={() => router.push(`/clients/${c.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddClientDialog open={openAdd} onOpenChange={setOpenAdd} />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Row
// ─────────────────────────────────────────────────────────────────────────

function ClientRow({
  client,
  profiles,
  density,
  selected,
  onToggleSelect,
  onAssignOwner,
  onDelete,
  onOpen,
}: {
  client: Client
  profiles: Profile[]
  density: Density
  selected: boolean
  onToggleSelect: () => void
  onAssignOwner: (ownerId: string | null) => void
  onDelete: () => void
  onOpen: () => void
}) {
  const owner = profiles.find((p) => p.id === client.owner_id) ?? null
  const compact = density === "compact"
  const rowPad = compact ? "py-1.5" : "py-2.5"

  return (
    <tr
      className={cn(
        "group border-b border-border-subtle transition-colors hover:bg-surface-3/60",
        selected && "bg-accent/50"
      )}
    >
      <Td className={cn("w-10 pl-4 pr-0", rowPad)}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${client.name}`}
          onClick={(e) => e.stopPropagation()}
          className="size-4 cursor-pointer accent-primary"
        />
      </Td>
      <Td className={rowPad}>
        <Link href={`/clients/${client.id}`} className="block">
          <p className={cn("font-medium text-text-primary", compact && "text-[13px]")}>
            {client.name}
          </p>
          {!compact && (
            <p className="text-xs font-medium text-text-tertiary">
              {client.industry ?? "—"}
            </p>
          )}
        </Link>
      </Td>
      <Td className={rowPad}>
        <Link href={`/clients/${client.id}`} className="block">
          <p className={cn("text-text-primary", compact && "text-[13px]")}>
            {client.contact_name ?? "—"}
          </p>
          {!compact && client.contact_email && (
            <p className="text-xs font-medium text-text-tertiary">
              {client.contact_email}
            </p>
          )}
        </Link>
      </Td>
      <Td className={rowPad}>
        <OwnerCell
          owner={owner}
          profiles={profiles}
          onAssign={onAssignOwner}
          compact={compact}
        />
      </Td>
      <Td className={rowPad} align="right">
        <Link href={`/clients/${client.id}`} className="block">
          <span className="font-mono tabular-nums text-text-primary">
            {money(Number(client.mrr || 0))}
          </span>
          <span className="ml-0.5 text-[10px] font-medium text-text-tertiary">
            /mo
          </span>
        </Link>
      </Td>
      <Td className={rowPad}>
        <Link
          href={`/clients/${client.id}`}
          className="block font-mono text-[12px] tabular-nums text-text-tertiary"
        >
          {client.started_at ?? "—"}
        </Link>
      </Td>
      <Td className={cn("w-10 pr-2", rowPad)}>
        <RowActions onOpen={onOpen} onDelete={onDelete} />
      </Td>
    </tr>
  )
}

/**
 * Owner cell — inline editable. When `owner` is set, shows the avatar +
 * name + team badge and clicking opens a Select for re-assignment. When
 * `owner` is null, shows a "+ Assign" chip that opens the same picker.
 *
 * Wired around shadcn's Select so the dropdown is portal-rendered and
 * doesn't get clipped by the table's overflow. Clicking inside the
 * trigger stops propagation so the row's row-level link doesn't navigate.
 */
function OwnerCell({
  owner,
  profiles,
  onAssign,
  compact,
}: {
  owner: Profile | null
  profiles: Profile[]
  onAssign: (ownerId: string | null) => void
  compact: boolean
}) {
  return (
    <Select
      value={owner?.id ?? ""}
      onValueChange={(v) => onAssign(v === "__none__" ? null : v)}
    >
      <SelectTrigger
        size="sm"
        className={cn(
          "h-auto w-auto gap-1.5 border-transparent bg-transparent px-1.5 py-0.5 text-left transition-colors hover:bg-surface-3 hover:text-text-primary",
          !owner && "text-text-tertiary"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {owner ? (
          <span className="inline-flex items-center gap-2">
            <UserAvatar profile={owner} size="sm" />
            <span className={cn("text-xs font-medium", compact && "sr-only")}>
              {owner.full_name}
            </span>
            {!compact && <TeamBadge team={owner.team} />}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium">
            <UserPlus className="size-3" />
            Assign
          </span>
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">
          <span className="text-text-tertiary">Unassign</span>
        </SelectItem>
        {profiles.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <span className="inline-flex items-center gap-1.5">
              {p.full_name}
              <TeamBadge team={p.team} />
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function RowActions({
  onOpen,
  onDelete,
}: {
  onOpen: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Row actions"
            className="opacity-0 transition-opacity group-hover:opacity-100 data-[popup-open]:opacity-100"
            onClick={(e) => e.stopPropagation()}
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onOpen}>Open</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} variant="destructive">
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────

function ClientsTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] bg-card ring-1 ring-border-subtle shadow-[var(--shadow-paper-sm)]">
      <div className="border-b border-border-subtle bg-surface-3 px-4 py-2.5">
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="divide-y divide-border-subtle">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="size-4 rounded-sm" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-2.5 w-24" />
            </div>
            <Skeleton className="h-3 w-28" />
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Bulk action bar
// ─────────────────────────────────────────────────────────────────────────

function BulkActionBar({
  count,
  profiles,
  onAssignOwner,
  onExport,
  onDelete,
  onClear,
  isBusy,
}: {
  count: number
  profiles: Profile[]
  onAssignOwner: (ownerId: string | null) => void
  onExport: () => void
  onDelete: () => void
  onClear: () => void
  isBusy: boolean
}) {
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-md border border-border-subtle bg-card px-3 py-2 shadow-[var(--shadow-paper-sm)]"
    >
      <span className="text-sm font-medium text-text-primary">
        {count} selected
      </span>
      <span className="text-text-tertiary" aria-hidden>
        ·
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" disabled={isBusy}>
              <UserPlus />
              Assign owner
            </Button>
          }
        />
        <DropdownMenuContent>
          <DropdownMenuLabel>Set owner for {count} clients</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {profiles.map((p) => (
            <DropdownMenuItem key={p.id} onClick={() => onAssignOwner(p.id)}>
              <UserAvatar profile={p} size="sm" />
              {p.full_name}
              <TeamBadge team={p.team} />
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onAssignOwner(null)}>
            Unassign
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="outline"
        size="sm"
        onClick={onExport}
        disabled={isBusy}
      >
        <Download />
        Export
      </Button>
      <Button
        variant="destructive"
        size="sm"
        onClick={onDelete}
        disabled={isBusy}
      >
        <Trash2 />
        Delete
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        disabled={isBusy}
        className="ml-auto"
      >
        Clear
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Table cell helpers
// ─────────────────────────────────────────────────────────────────────────

function Th({
  children,
  onClick,
  active,
  dir,
  align,
  className,
}: {
  children?: React.ReactNode
  onClick?: () => void
  active?: boolean
  dir?: "asc" | "desc"
  align?: "left" | "right"
  className?: string
}) {
  return (
    <th
      scope="col"
      className={cn(
        "select-none px-4 py-2.5 text-left font-medium",
        align === "right" && "text-right",
        className
      )}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "group/sort inline-flex items-center gap-1 rounded px-1 -mx-1 transition-colors hover:bg-background hover:text-foreground",
            active && "text-foreground"
          )}
        >
          {children}
          <ArrowUpDown
            className={cn(
              "size-3 transition-opacity",
              // Hide the chevron unless the column is active or the header
              // is hovered/focused. Active state additionally rotates on
              // ascending direction.
              active
                ? cn("opacity-100", dir === "asc" && "rotate-180")
                : "opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60"
            )}
          />
        </button>
      ) : (
        children
      )}
    </th>
  )
}

function Td({
  children,
  align,
  className,
}: {
  children?: React.ReactNode
  align?: "left" | "right"
  className?: string
}) {
  return (
    <td
      className={cn(
        "px-4 align-middle",
        align === "right" && "text-right",
        className
      )}
    >
      {children}
    </td>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// CSV
// ─────────────────────────────────────────────────────────────────────────

const CLIENT_CSV_HEADERS = [
  "name",
  "contact_name",
  "contact_email",
  "contact_phone",
  "industry",
  "website",
  "mrr",
  "started_at",
  "notes",
] as const

function exportClientsToCsv(clients: Client[]) {
  const rows = clients.map((c) => [
    c.name,
    c.contact_name,
    c.contact_email,
    c.contact_phone,
    c.industry,
    c.website,
    c.mrr,
    c.started_at,
    c.notes,
  ])
  const csv = toCsv([...CLIENT_CSV_HEADERS], rows)
  downloadCsv(`viddix-clients-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  toast.success(`${clients.length} clients exported`)
}

async function importClientsFromCsv(
  text: string,
  create: (input: Partial<Client> & { name: string }) => Promise<unknown>
): Promise<number> {
  const { rows } = parseCsv(text)
  if (rows.length === 0) throw new Error("CSV is empty")
  let imported = 0
  for (const r of rows) {
    const name = r.name?.trim()
    if (!name) continue
    await create({
      name,
      contact_name: r.contact_name?.trim() || null,
      contact_email: r.contact_email?.trim() || null,
      contact_phone: r.contact_phone?.trim() || null,
      industry: r.industry?.trim() || null,
      website: r.website?.trim() || null,
      mrr: Number(r.mrr || 0) || 0,
      started_at: r.started_at?.trim() || null,
      notes: r.notes?.trim() || null,
    })
    imported++
  }
  if (imported === 0) throw new Error('No valid rows (need at least a "name" column)')
  return imported
}
