"use client"

import * as React from "react"
import { Plus, X } from "lucide-react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { TeamBadge } from "@/components/dashboard/team-badge"
import { UserAvatar } from "@/components/dashboard/user-avatar"
import { AvatarStack } from "@/components/dashboard/avatar-stack"
import { cn } from "@/lib/utils"
import type { Profile } from "@/lib/types"

/**
 * AssigneeMultiSelect — chip-style multi-picker for task assignees.
 *
 * Trigger shows the current avatars (AvatarStack) + "+ Assign". Popover
 * has a search input and a checkbox-style list. The parent owns the
 * `assignee_ids` array; toggling a row calls `onChange` with the next
 * array, so wiring to a mutation is just one onSuccess callback.
 */
export function AssigneeMultiSelect({
  profiles,
  value,
  onChange,
  className,
}: {
  profiles: Profile[]
  value: string[]
  onChange: (next: string[]) => void
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q)
    )
  }, [profiles, query])

  const selectedProfiles = profiles.filter((p) => value.includes(p.id))

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 rounded-md border border-border-subtle bg-card px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              className
            )}
            aria-label="Edit assignees"
          />
        }
      >
        {selectedProfiles.length > 0 ? (
          <>
            <AvatarStack profiles={selectedProfiles} max={3} size="sm" />
            <span className="text-text-tertiary">
              {selectedProfiles.length} assigned
            </span>
          </>
        ) : (
          <>
            <Plus className="size-3" />
            Assign
          </>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 gap-0 p-0">
        <div className="border-b border-border-subtle p-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search team…"
            className="h-8"
            autoFocus
          />
        </div>
        <ul className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <li className="px-2 py-2 text-xs text-text-tertiary">
              No matches.
            </li>
          ) : (
            filtered.map((p) => {
              const checked = value.includes(p.id)
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
                      checked
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-surface-3"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      readOnly
                      tabIndex={-1}
                      className="size-4 accent-primary"
                    />
                    <UserAvatar profile={p} size="sm" />
                    <span className="flex-1 truncate">{p.full_name}</span>
                    <TeamBadge team={p.team} />
                  </button>
                </li>
              )
            })
          )}
        </ul>
        {selectedProfiles.length > 0 && (
          <div className="flex items-center justify-between border-t border-border-subtle px-2 py-1.5 text-[11px] text-text-tertiary">
            <span>
              {selectedProfiles.length} selected
            </span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 hover:bg-surface-3 hover:text-text-primary"
            >
              <X className="size-3" />
              Clear
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
