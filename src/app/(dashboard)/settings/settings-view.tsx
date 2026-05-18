"use client"

// Per-user preferences. Currently surfaces a single section — Cal.com booking
// link — because that's what unlocks the "Send booking link" actions on lead
// and client detail sheets. Add more sections inline as new prefs land.

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/dashboard/page-header"
import { useCurrentProfile, useUpdateProfile } from "@/hooks/use-profile"

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
      </div>
    </>
  )
}
