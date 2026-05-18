"use client"

// Copy the current user's Cal.com booking link to the clipboard, so it can be
// pasted into an email/Slack to the lead or client. Falls back to a toast
// nudging the user to set their link in /settings when nothing is configured.

import Link from "next/link"
import { CalendarClock } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

export function SendBookingLinkButton({ calLink }: { calLink: string | null }) {
  function copy() {
    if (!calLink) {
      toast.error(
        "Set your Cal.com link first",
        { description: "Add it in Settings to enable this action." }
      )
      return
    }
    void navigator.clipboard.writeText(calLink).then(
      () =>
        toast.success("Cal.com link copied", {
          description: "Paste it into an email or Slack to schedule.",
        }),
      () => toast.error("Couldn't copy to clipboard")
    )
  }
  if (!calLink) {
    return (
      <Link
        href="/settings"
        title="Configure your Cal.com link in Settings"
        className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-sm)] border border-border-default bg-card px-2.5 text-[12px] font-medium tracking-[-0.005em] text-text-primary transition-colors hover:bg-surface-3"
      >
        <CalendarClock className="size-3.5" />
        Cal.com
      </Link>
    )
  }
  return (
    <Button size="sm" variant="outline" onClick={copy} title="Copy your Cal.com link">
      <CalendarClock />
      Send link
    </Button>
  )
}
