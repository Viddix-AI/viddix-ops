"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/**
 * Global keyboard shortcuts + cheatsheet modal.
 *
 * Mounted once at the dashboard layout level so the bindings work from
 * every authenticated route. Plays nicely with the CommandPalette ⌘K
 * binding — that one is wired in `Topbar` and isn't duplicated here.
 *
 * Bindings:
 *   • `?` — open the cheatsheet modal.
 *   • `G` then a navigation letter — jump to a route. The chord head
 *     ("g") expires after 1 s if not followed up, so the user can type
 *     into search fields again without leaking into the chord state.
 *
 * Inputs / textareas / selects opt out of single-letter shortcuts so
 * typing a "g" inside a form doesn't navigate.
 */
type ShortcutEntry = {
  keys: string[]
  label: string
  desc?: string
}

const NAV_SHORTCUTS: { key: string; path: string; label: string }[] = [
  { key: "d", path: "/dashboard", label: "Dashboard" },
  { key: "l", path: "/leads",     label: "Pipeline" },
  { key: "c", path: "/clients",   label: "Clients" },
  { key: "p", path: "/partners",  label: "Partners" },
  { key: "t", path: "/tasks",     label: "Tasks" },
  { key: "k", path: "/calendar",  label: "Calendar" },
  { key: "a", path: "/activity",  label: "Activity" },
]

const CHORD_TTL_MS = 1000

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if (el.isContentEditable) return true
  // base-ui SelectTrigger, DropdownTrigger etc. set role="combobox" /
  // role="menuitem"; if the user is interacting with one of those we don't
  // hijack their key.
  if (el.getAttribute("role") === "combobox") return true
  return false
}

export function KeyboardShortcutsClient() {
  const router = useRouter()
  const [cheatsheetOpen, setCheatsheetOpen] = React.useState(false)
  const chordRef = React.useRef<{ key: string; expires: number } | null>(null)

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return

      const now = Date.now()
      const chord = chordRef.current
      if (chord && chord.expires < now) chordRef.current = null

      // Chord follow-up (G + X)
      if (chordRef.current?.key === "g") {
        const target = NAV_SHORTCUTS.find(
          (s) => s.key === e.key.toLowerCase()
        )
        chordRef.current = null
        if (target) {
          e.preventDefault()
          router.push(target.path)
        }
        return
      }

      // ? opens the cheatsheet. shift+/ on US layouts produces "?" so
      // matching on the key string is the cleanest cross-keyboard path.
      if (e.key === "?") {
        e.preventDefault()
        setCheatsheetOpen(true)
        return
      }

      // Chord head — "g". Wait up to 1 s for the follow-up.
      if (e.key.toLowerCase() === "g") {
        chordRef.current = { key: "g", expires: now + CHORD_TTL_MS }
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [router])

  return (
    <Cheatsheet open={cheatsheetOpen} onOpenChange={setCheatsheetOpen} />
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Cheatsheet modal
// ─────────────────────────────────────────────────────────────────────────

function Cheatsheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const sections: { title: string; entries: ShortcutEntry[] }[] = [
    {
      title: "Search",
      entries: [
        { keys: ["⌘", "K"], label: "Open command palette", desc: "Or Ctrl+K on Win/Linux" },
        { keys: ["?"], label: "Show this cheatsheet" },
      ],
    },
    {
      title: "Navigation (press G, then…)",
      entries: NAV_SHORTCUTS.map((s) => ({
        keys: ["G", s.key.toUpperCase()],
        label: `Go to ${s.label}`,
      })),
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {sections.map((s) => (
            <section key={s.title}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {s.title}
              </p>
              <ul className="space-y-1.5">
                {s.entries.map((entry) => (
                  <li
                    key={entry.keys.join("+")}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{entry.label}</p>
                      {entry.desc && (
                        <p className="truncate text-[11px] text-muted-foreground">
                          {entry.desc}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {entry.keys.map((k, i) => (
                        <React.Fragment key={`${k}-${i}`}>
                          {i > 0 && (
                            <span
                              aria-hidden
                              className="text-[10px] text-muted-foreground"
                            >
                              then
                            </span>
                          )}
                          <Kbd>{k}</Kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-background px-1 font-mono text-[10px] font-medium text-text-secondary shadow-sm"
      )}
    >
      {children}
    </kbd>
  )
}
