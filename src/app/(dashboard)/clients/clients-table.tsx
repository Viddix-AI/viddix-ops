"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpDown, Briefcase, Plus, Search } from "lucide-react"

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
import { useClients } from "@/hooks/use-clients"
import { useProfiles } from "@/hooks/use-profile"
import { money } from "@/lib/format"
import type { Client, ClientStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { AddClientDialog } from "./add-client-dialog"

type SortKey = "name" | "mrr" | "started_at"

export function ClientsTable() {
  const { data: clients = [] } = useClients()
  const { data: profiles = [] } = useProfiles()
  const [q, setQ] = React.useState("")
  const [status, setStatus] = React.useState<ClientStatus | "all">("all")
  const [sort, setSort] = React.useState<{ key: SortKey; dir: "asc" | "desc" }>(
    { key: "mrr", dir: "desc" }
  )
  const [openAdd, setOpenAdd] = React.useState(false)

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase()
    return clients
      .filter((c) =>
        status === "all" ? true : c.status === status
      )
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
  }, [clients, q, status, sort])

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
          <Button onClick={() => setOpenAdd(true)}>
            <Plus />
            New client
          </Button>
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
                          <span className="text-xs">
                            {owner?.full_name ?? "Unassigned"}
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
