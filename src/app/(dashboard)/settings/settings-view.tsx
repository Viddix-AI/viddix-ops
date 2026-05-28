"use client"

// Per-user preferences. Currently surfaces a single section — Cal.com booking
// link — because that's what unlocks the "Send booking link" actions on lead
// and client detail sheets. Add more sections inline as new prefs land.

import * as React from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { Pill, type PillTone } from "@/components/ui/pill"
import { useCurrentProfile, useUpdateProfile } from "@/hooks/use-profile"
import {
  useCreateTag,
  useDeleteTag,
  useTags,
  useTaskTags,
} from "@/hooks/use-tags"
import type { Tag } from "@/lib/types"

const CAL_HOSTS = ["https://cal.com/", "https://app.cal.com/"]

function validCalLink(v: string): boolean {
  if (!v) return true
  return CAL_HOSTS.some((host) => v.startsWith(host))
}

export function SettingsView() {
  const me = useCurrentProfile()
  const update = useUpdateProfile()
  const initial = me.cal_link ?? ""
  const [link, setLink] = React.useState(initial)
  // Re-prime from server when the profile loads after first render. Stored in
  // the same normalized shape so the comparison can't loop.
  const [prevInitial, setPrevInitial] = React.useState(initial)
  if (initial !== prevInitial) {
    setPrevInitial(initial)
    setLink(initial)
  }

  const dirty = (link.trim() || null) !== (me.cal_link ?? null)
  const valid = validCalLink(link.trim())

  function save() {
    if (!valid) {
      toast.error("Link must start with https://cal.com/ or https://app.cal.com/")
      return
    }
    update.mutate(
      { id: me.id, patch: { cal_link: link.trim() || null } },
      {
        onSuccess: () => toast.success("Settings saved"),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to save"),
      }
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="HOLDING · ACCOUNT"
        title="Settings"
        description={me.full_name}
      />
      <div className="space-y-6 px-4 py-5 lg:px-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Cal.com</CardTitle>
            <CardDescription>
              Paste your personal Cal.com booking URL. It powers the
              &ldquo;Send booking link&rdquo; action on lead and client detail
              sheets, and is the destination Cal.com bookings will arrive from
              once the webhook is wired.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-foreground/80">
                Your Cal.com link
              </span>
              <Input
                type="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://cal.com/your-handle/intro"
              />
              {!valid && link.trim() && (
                <span className="text-xs text-destructive">
                  Must start with https://cal.com/ or https://app.cal.com/
                </span>
              )}
            </label>
            <div className="flex justify-end">
              <Button onClick={save} disabled={!dirty || !valid || update.isPending}>
                {update.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <TagsCard />
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Tags management — list all tags with usage count + delete + add-new.
// ─────────────────────────────────────────────────────────────────────────

const TAG_TONES: PillTone[] = ["slate", "blue", "sky", "indigo", "violet", "emerald", "amber", "rose"]
const TAG_TONE_SET = new Set<string>(TAG_TONES)
function toneOf(t: Tag): PillTone {
  return (TAG_TONE_SET.has(t.color) ? t.color : "slate") as PillTone
}

function TagsCard() {
  const { data: tags = [] } = useTags()
  const { data: taskTags = [] } = useTaskTags()
  const create = useCreateTag()
  const remove = useDeleteTag()

  const [name, setName] = React.useState("")
  const [color, setColor] = React.useState<PillTone>("slate")

  // Usage count per tag — single pass over task_tags so the card stays O(n).
  const usage = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const tt of taskTags) m.set(tt.tag_id, (m.get(tt.tag_id) ?? 0) + 1)
    return m
  }, [taskTags])

  function addTag() {
    const v = name.trim()
    if (!v) return
    create.mutate(
      { name: v, color },
      {
        onSuccess: () => {
          setName("")
          setColor("slate")
          toast.success("Tag created")
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Could not create tag"),
      }
    )
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Tags</CardTitle>
        <CardDescription>
          Tags attached to tasks. Deleting a tag here removes it from every
          task that carried it (the cascade is enforced at the SQL level).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 space-y-1.5">
            <span className="text-xs font-medium text-foreground/80">
              New tag name
            </span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addTag()
                }
              }}
              placeholder="urgent-client / blocked / waiting-on…"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-foreground/80">Color</span>
            <div className="flex h-9 items-center gap-1 rounded-md border border-border-subtle bg-card px-2">
              {TAG_TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setColor(t)}
                  aria-label={`Pick ${t}`}
                  aria-pressed={color === t}
                  className={
                    color === t
                      ? "rounded-full ring-2 ring-ring/60 ring-offset-1 ring-offset-card"
                      : "rounded-full opacity-60 hover:opacity-100"
                  }
                >
                  <Pill tone={t} size="sm">
                    {t}
                  </Pill>
                </button>
              ))}
            </div>
          </label>
          <Button onClick={addTag} disabled={!name.trim() || create.isPending}>
            {create.isPending ? "Adding…" : "Add tag"}
          </Button>
        </div>

        {tags.length === 0 ? (
          <EmptyState
            size="sm"
            title="No tags yet"
            description="Add the first tag above, or create one on the fly from a task."
          />
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {tags.map((t) => {
              const count = usage.get(t.id) ?? 0
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm"
                >
                  <Pill tone={toneOf(t)} size="sm">
                    {t.name}
                  </Pill>
                  <span className="text-xs text-text-tertiary">
                    {count} task{count === 1 ? "" : "s"}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete tag ${t.name}`}
                    onClick={() => {
                      if (
                        count > 0 &&
                        !confirm(
                          `Delete "${t.name}"? It is attached to ${count} task${
                            count === 1 ? "" : "s"
                          }; the link will be removed.`
                        )
                      ) {
                        return
                      }
                      remove.mutate(t.id, {
                        onSuccess: () => toast.success(`"${t.name}" deleted`),
                      })
                    }}
                    className="ml-auto"
                  >
                    <Trash2 />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
