"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpDown, Briefcase, Download, Plus, Search, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { ClientStatusBadge } from "@/components/dashboard/status-badge"
import { UserAvatar } from "@/components/dashboard/user-avatar"
import { useClients, useCreateClient } from "@/hooks/use-clients"
import { useProfiles } from "@/hooks/use-profile"
import { downloadCsv, parseCsv, pickCsvFile, toCsv } from "@/lib/csv"
import { money } from "@/lib/format"
import { TEAMS, type Client, type ClientStatus, type Team } from "@/lib/types"
import { cn } from "@/lib/utils"
import { AddClientDialog } from "./add-client-dialog"
import { TeamBadge } from "@/components/dashboard/team-badge"

type SortKey = "name" | "mrr" | "started_at"

export function ClientsTable() {
  const { data: clients = [] } = useClients()
  const { data: profiles = [] } = useProfiles()
  const create = useCreateClient()
  const [q, setQ] = React.useState("")
  const [status, setStatus] = React.useState<ClientStatus | "all">("all")
  const [team, setTeam] = React.useState<Team | "all">("all")
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>(
    { key: "mrr", dir: "desc" }
  )
  const [openAdd, setOpenAdd] = React.useState(false)

  const teamForClient = React.useCallback(
    (c: Client): Team | null =>
      profiles.find((p) => p.id === c.owner_id)?.team ?? null,
    [profiles]
  )

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase()
    return clients
      .filter((c) => (status === "all" ? true : c.status === status))
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
        return ((a.started_at ?? "").localeCompare(b.started_at ?? "")) * dir
      })
  }, [clients, q, status, team, teamForClient, sort])

  const totalMRR = clients
    .filter((c) => c.status === "active")
    .reduce((s, c) => s + Number(c.mrr || 0), 0)

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    )

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${clients.length} clients · ${money(totalMRR)} MRR active`}
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
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search clients…"
              className="h-9 pl-8"
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as ClientStatus | "all")}>
            <SelectTrigger size="default" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="prospect">Prospect</SelectItem>
              <SelectItem value="churned">Churned</SelectItem>
            </SelectContent>
          </Select>
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
        </div>

        {filtered.length === 0 ? (
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
          <div className="overflow-hidden rounded-xl bg-card ring-1 ring-border shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <Th onClick={() => toggleSort("name")} active={sort.key === "name"} dir={sort.dir}>
                    Client
                  </Th>
                  <Th>Contact</Th>
                  <Th>Owner</Th>
                  <Th>Status</Th>
                  <Th onClick={() => toggleSort("mrr")} active={sort.key === "mrr"} dir={sort.dir} align="right">
                    MRR
                  </Th>
                  <Th onClick={() => toggleSort("started_at")} active={sort.key === "started_at"} dir={sort.dir}>
                    Started
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => {
                  const owner = profiles.find((p) => p.id === c.owner_id)
                  return (
                    <tr
                      key={c.id}
                      className="group cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      <Td>
                        <Link href={`/clients/${c.id}`} className="block">
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.industry ?? "—"}
                          </p>
                        </Link>
                      </Td>
                      <Td>
                        <Link href={`/clients/${c.id}`} className="block">
                          <p>{c.contact_name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.contact_email ?? ""}
                          </p>
                        </Link>
                      </Td>
                      <Td>
                        <Link
                          href={`/clients/${c.id}`}
                          className="flex items-center gap-2"
                        >
                          <UserAvatar profile={owner ?? null} size="sm" />
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            {owner?.full_name ?? "Unassigned"}
                            {owner?.team && <TeamBadge team={owner.team} />}
                          </span>
                        </Link>
                      </Td>
                      <Td>
                        <Link href={`/clients/${c.id}`} className="block">
                          <ClientStatusBadge status={c.status} />
                        </Link>
                      </Td>
                      <Td align="right">
                        <Link href={`/clients/${c.id}`} className="block">
                          <span className="font-semibold tabular-nums">
                            {money(Number(c.mrr || 0))}
                          </span>
                          <span className="ml-0.5 text-[10px] text-muted-foreground">
                            /mo
                          </span>
                        </Link>
                      </Td>
                      <Td>
                        <Link
                          href={`/clients/${c.id}`}
                          className="block text-xs text-muted-foreground"
                        >
                          {c.started_at ?? "—"}
                        </Link>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddClientDialog open={openAdd} onOpenChange={setOpenAdd} />
    </>
  )
}

function Th({
  children,
  onClick,
  active,
  dir,
  align,
}: {
  children: React.ReactNode
  onClick?: () => void
  active?: boolean
  dir?: "asc" | "desc"
  align?: "left" | "right"
}) {
  return (
    <th
      scope="col"
      className={cn(
        "select-none px-4 py-2.5 text-left font-medium",
        align === "right" && "text-right"
      )}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "inline-flex items-center gap-1 rounded px-1 -mx-1 hover:bg-background hover:text-foreground transition-colors",
            active && "text-foreground"
          )}
        >
          {children}
          <ArrowUpDown className={cn("size-3", active && (dir === "asc" ? "rotate-180" : ""))} />
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
}: {
  children: React.ReactNode
  align?: "left" | "right"
}) {
  return (
    <td className={cn("px-4 py-2.5 align-middle", align === "right" && "text-right")}>
      {children}
    </td>
  )
}

const CLIENT_CSV_HEADERS = [
  "name",
  "contact_name",
  "contact_email",
  "contact_phone",
  "industry",
  "website",
  "status",
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
    c.status,
    c.mrr,
    c.started_at,
    c.notes,
  ])
  const csv = toCsv([...CLIENT_CSV_HEADERS], rows)
  downloadCsv(`viddix-clients-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  toast.success(`${clients.length} clients exported`)
}

const VALID_STATUSES: ClientStatus[] = ["active", "paused", "churned", "prospect"]

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
    const statusRaw = (r.status ?? "").toLowerCase().trim()
    await create({
      name,
      contact_name: r.contact_name?.trim() || null,
      contact_email: r.contact_email?.trim() || null,
      contact_phone: r.contact_phone?.trim() || null,
      industry: r.industry?.trim() || null,
      website: r.website?.trim() || null,
      status: VALID_STATUSES.includes(statusRaw as ClientStatus)
        ? (statusRaw as ClientStatus)
        : "prospect",
      mrr: Number(r.mrr || 0) || 0,
      started_at: r.started_at?.trim() || null,
      notes: r.notes?.trim() || null,
    })
    imported++
  }
  if (imported === 0) throw new Error('No valid rows (need at least a "name" column)')
  return imported
}
