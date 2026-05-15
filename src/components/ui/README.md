# UI primitives

This folder hosts the design-system primitives for Viddix Ops. Everything
here is **renderable in isolation**, has **no data-store dependency**, and
exposes a **stable className API**. Higher-level domain components (in
`src/components/dashboard/`) compose these.

## When to add something here

- It's reusable across ≥ 2 routes.
- It has clear visual variants you'd want to keep consistent.
- It has no awareness of `Lead`, `Client`, `Partner`, etc.

If it's domain-specific (e.g. `LeadCard`, `PartnersTab`), it does **not**
belong in this folder. Put it next to the route or under `components/dashboard/`.

## Primitives

| Component | What it's for | Source |
|---|---|---|
| `Avatar` | Circular profile image with fallback initials | shadcn (base-ui) |
| `Badge` | Generic small inline label (shadcn baseline — prefer `Pill` for new code) | shadcn |
| `Button` | Primary interactive element with `default`/`outline`/`secondary`/`ghost`/`destructive`/`link` variants and sizes `xs`/`sm`/`default`/`lg`/`icon*` | shadcn |
| `Calendar` | Date picker calendar (react-day-picker) | shadcn |
| `Card` + `CardHeader/Content/Footer/Title/Description` | Surface container; auto-handles size="sm" densification | shadcn |
| `Dialog` | Modal overlay (close on Esc, focus trap, portal-rendered) | shadcn (base-ui) |
| `DropdownMenu` | Trigger + menu items + separators | shadcn (base-ui) |
| `Input` | Single-line text input with focus-ring | shadcn |
| `KPIStat` | Fase 0 — dashboard KPI tile with label/value/sub/icon/trend/sparkline | viddix |
| `Pill` | Fase 0 — small label with semantic `variant` or tonal `tone` | viddix |
| `Popover` | Floating positioned content | shadcn (base-ui) |
| `Select` | Combobox-style picker | shadcn (base-ui) |
| `Sheet` | Side-drawer overlay | shadcn (base-ui) |
| `Skeleton` | Fase 0 — animate-pulse placeholder | viddix |
| `Tabs` | Tab list + panels | shadcn (base-ui) |
| `Textarea` | Multi-line text input | shadcn |
| `Tooltip` | Fase 0 — wrapper over base-ui tooltip with single-prop API | viddix |

## Domain components (in `components/dashboard/`)

A small set of route-aware components also lives next to the primitives in
spirit but in the `dashboard/` folder, because they pull data from hooks.

| Component | What it's for |
|---|---|
| `CommandPalette` | **Fase 1** — cmdk-powered ⌘K palette. Mounted in `Topbar`; open via Cmd/Ctrl+K. Groups: Pages, Actions, Leads, Clients, Partners, Tasks. |
| `EmptyState` | Standard "no data yet" surface. `size="default"` for routes, `size="sm"` for in-sheet/in-tab usage (Fase 1). |
| `PageHeader` | Title + description + actions; renders ~28-px H1. |
| `PriorityBadge` / `TaskStatusBadge` / `TeamBadge` | Thin wrappers over `Pill` with a domain enum → tone/variant mapping. |
| `UserAvatar` | `Avatar` with team-coloured background + ring. |

## Pill

Semantic vs. tonal. Pick one — not both.

```tsx
import { Pill } from "@/components/ui/pill"

// Semantic (preferred for state)
<Pill variant="success" dot>Active</Pill>
<Pill variant="warning">Pending review</Pill>
<Pill variant="danger" size="md">Overdue</Pill>

// Tonal (data-driven kanban-style chips)
<Pill tone="violet" uppercase>Proposal</Pill>
<Pill tone="emerald">Won</Pill>
<Pill tone="slate">New</Pill>
```

Available `variant`s: `info` `success` `warning` `danger` `neutral` `accent`.
Available `tone`s: `blue` `sky` `indigo` `violet` `emerald` `amber` `rose` `slate`.

Both flavours expose `size` (`sm`/`md`) and `uppercase` (boolean). The `dot`
prop adds a small status dot in the leading edge.

## KPIStat

```tsx
import { KPIStat } from "@/components/ui/kpi-stat"
import { TrendingUp } from "lucide-react"

<KPIStat
  label="Monthly recurring revenue"
  value={money(mrr)}
  sub={`${clients.length} clients`}
  icon={<TrendingUp className="size-4" />}
  trend={{ value: 12.3, direction: "up", label: "vs. last month" }}
  // sparkline={<Sparkline data={revenueSeries} />}   // wire up in Fase 2
/>
```

`trend.direction = "up"` is rendered as success-toned; `"down"` as
destructive-toned (it's a *direction*, not a value judgement — invert
manually if "down" is good for your metric).

## Tooltip

Single-prop API for the 90% case.

```tsx
import { Tooltip } from "@/components/ui/tooltip"

<Tooltip content="Copy link to clipboard" side="top">
  <Button variant="ghost" size="icon-sm">
    <LinkIcon />
  </Button>
</Tooltip>
```

For richer use (controlled `open`, multiple positioners), import
`TooltipPrimitive` from the same module.

## EmptyState

```tsx
import { EmptyState } from "@/components/dashboard/empty-state"
import { Briefcase } from "lucide-react"

// Default — page-level (in a route body)
<EmptyState
  icon={<Briefcase className="size-4" />}
  title="No clients yet"
  description="Add your first client to start tracking MRR and partners."
  action={<Button onClick={...}>Add client</Button>}
/>

// Compact — in a sheet tab, popover, narrow card
<EmptyState
  size="sm"
  title="No notes yet"
  description="Anything you log here stays on the lead."
/>
```

The compact variant skips the dashed border, halves the vertical padding,
and uses smaller icon + xs typography. Use it whenever a default empty
state would dwarf its container.

## CommandPalette

```tsx
import { CommandPalette } from "@/components/dashboard/command-palette"

const [open, setOpen] = React.useState(false)

// Mount once at the top of your layout — Topbar already does this.
<CommandPalette open={open} onOpenChange={setOpen} />
```

The palette is globally available via **⌘K** (Mac) / **Ctrl+K**
(Win/Linux). Implementation lives in `components/dashboard/` because it
pulls live data from `useLeads` / `useClients` / `usePartners` / `useTasks`.
It composes `Dialog` + `cmdk` and inherits the project's overlay system.

To add a new section, edit `command-palette.tsx` and follow the existing
pattern: wrap items in `<Group heading="…">` and render `<PaletteItem
value="…" onSelect={...} icon={...} label="…" sub="…" />`. The
`value` string drives cmdk's fuzzy match — include any aliases the user
might type (e.g. `"action new lead"` matches both "new" and "lead").

## Skeleton

```tsx
import { Skeleton } from "@/components/ui/skeleton"

<Skeleton className="h-4 w-32" />              // single line
<Skeleton className="h-9 w-9 rounded-full" />  // avatar
<div className="space-y-2">
  <Skeleton className="h-4 w-40" />
  <Skeleton className="h-3 w-24" />
</div>
```

Use freely while async data loads. The `bg-muted/60` already respects
the dark theme via the CSS var; no extra config needed.

## Tokens

All primitives consume CSS custom properties from `src/app/globals.css`.
The semantic palette added in Fase 0:

- `--text-primary` / `--text-secondary` / `--text-tertiary`
- `--surface-1` / `--surface-2` / `--surface-3`
- `--border-subtle` / `--border-default`
- `--success` / `--warning` / `--info` / `--destructive` (+ their `*-foreground`)

Tailwind v4 exposes these as `text-text-primary`, `bg-surface-2`,
`border-border-subtle`, `text-success`, etc.

Radius scale (Fase 0):

- `rounded-sm` → 6px
- `rounded-md` → 10px
- `rounded-lg` → 14px
- `rounded-xl` → 18px
