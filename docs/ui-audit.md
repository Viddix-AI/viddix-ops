# UI audit — pre-Fase 0 snapshot

Captured at the start of the UI/UX refactoring effort. Use this as the
baseline to measure progress against the design principles laid out in the
multi-phase plan.

## Stack

- **Next.js 16.2.4** (app router, Turbopack, `proxy.ts` replaces middleware).
- **React 19.2.4**.
- **Tailwind v4** — tokens defined via `@theme inline` directly in
  `src/app/globals.css`. No `tailwind.config.js`.
- **UI primitives**: `@base-ui/react` (the underlying lib that powers the
  `shadcn` "base-nova" style, configured in `components.json`).
- **State**: TanStack Query over a two-backend data layer (localStorage by
  default, Supabase auto-engaged when env vars are set). No zustand.
- **Other UI deps already installed**: `lucide-react`, `sonner`,
  `class-variance-authority`, `tailwind-merge`, `clsx`, `date-fns`,
  `@hello-pangea/dnd` (kanban DnD), `react-day-picker`, `tw-animate-css`.

## Tokens (before Fase 0)

| Category | Status |
|---|---|
| Background / foreground / card / popover / primary / secondary / muted / accent / destructive / border / input / ring | ✅ defined for light + `.dark` |
| `--sidebar*` family | ✅ |
| `--chart-1..5` | ✅ |
| `--radius-*` (sm/md/lg/xl/2xl/3xl/4xl) | ⚠️ Derived via `calc(var(--radius) * factor)` from a 0.625rem base. Produced 6/8/10/14 — spec calls for 6/10/14. |
| `--text-primary` / `--text-secondary` / `--text-tertiary` | ❌ missing |
| `--surface-1/2/3` | ❌ missing |
| `--success` / `--warning` / `--info` | ❌ missing — only `--destructive` |
| `--border-subtle` / `--border-default` | ❌ missing |

## Typography

- Inter sans + JetBrains Mono. `--font-heading` aliases to sans.
- PageHeader H1: `text-xl font-semibold` (~20px). **Spec target: 28–32px.**
- Body 14px, captions 12px, line-heights default ≈ 1.4–1.5. Already on-spec.

## Accessibility

- `focus-visible` is wired through shadcn primitives (Button, Input, Badge).
- Raw `<a>` / `<button>` (sidebar links, login fallbacks) had **no global
  outline** — fixed in Fase 0 with a `@layer base :focus-visible` rule.
- Sidebar "WORKSPACE" label at `text-sidebar-foreground/50` over `#0f172a`
  → ~4.0:1 contrast (fails AA narrowly). Fase 0 lifts to /70.
- Sidebar active link uses `bg-white/[0.06] text-white` — barely
  distinguishable from hover state. Fase 0 adds a 2px accent bar + bumps
  the background to `bg-sidebar-accent`.
- `--muted-foreground` was slate-500 (`#64748b`) on white = 4.6:1 — AA but
  marginal. Fase 0 lifts to slate-600 (`#475569`) = 7.4:1.
- `--destructive` was red-500 (`#ef4444`) = 3.8:1 (fails AA for normal
  text). Fase 0 darkens to red-600 (`#dc2626`) = 5.3:1.

## Components

### Primitives (`src/components/ui/`) before Fase 0

Avatar, Badge, Button, Calendar, Card, Dialog, Dropdown, Input, Popover,
Select, Sheet, Tabs, Textarea — all shadcn/base-ui.

**Missing primitives** per the design plan:

- `Pill` semantic ✅ added in Fase 0
- `KPIStat` (re-usable dashboard stat tile) ✅ added in Fase 0
- `Tooltip` ✅ added in Fase 0
- `Skeleton` ✅ added in Fase 0
- `CommandPalette` ✅ added in Fase 1 (lives in `components/dashboard/`)
- `Table` opinionated wrapper — Fase 3
- `KanbanColumn` opinionated wrapper — Fase 4

### Dashboard helpers (`src/components/dashboard/`)

PageHeader, EmptyState, StatusBadge, PriorityBadge, TeamBadge, UserAvatar,
EditableTaskRow, Sidebar, Topbar, MobileNav.

**Refactored in Fase 0**: StatusBadge / PriorityBadge / TeamBadge now
delegate to `Pill`. `leads-board` column header chip too.

## Hard-coded styling found

| File | Pattern | Action |
|---|---|---|
| `app/(auth)/login/page.tsx` | `style={{ background: "#4F8EF7" }}` for the V logo + gradient hex inline | TODO — Fase 6 polish |
| `components/dashboard/sidebar.tsx` | Same `#4F8EF7` inline for the V logo | TODO — Fase 6 polish |
| `app/(dashboard)/dashboard/page.tsx` | Inline `linear-gradient(rgba(79,142,247,...))` on pipeline bars | Fase 2 (funnel rebuild) |
| `lib/types.ts` `LEAD_STAGES.tone` strings | Tailwind class strings | ✅ Replaced with `pillTone` in Fase 0 |
| `lib/types.ts` `LEAD_TEMPERATURES.tone` | Tailwind class strings | ✅ Replaced with `pillTone` |
| `lib/types.ts` `TEAMS.badge` | Tailwind class strings | ✅ Replaced with `pillTone` |
| `lib/types.ts` `TEAMS.avatarTone` / `.ringTone` | Tailwind classes for the avatar specifically | Keep — avatar is not a Pill |
| `app/(dashboard)/activity/activity-view.tsx` `ICONS` table | Per-event tonal classes | TODO — refactor to use Pill tones in Fase 6 polish |
| `app/(dashboard)/leads/leads-board.tsx` line 244 | Inline `t.id === "madrid" ? "bg-blue-500" : "bg-emerald-500"` for filter chip dots | TODO — Fase 4 |
| `app/(dashboard)/tasks/tasks-view.tsx` line 151 | Inline `text-rose-600` for overdue group header | TODO — Fase 6 polish (use `text-destructive`) |

## Empty states

- `clients-table`, `leads-board`, `partners-view`, `activity-view`,
  `client-detail` (4 tabs) → already use the shared `EmptyState`. ✅
- `tasks-view` had a bare `<p>No tasks</p>` → ✅ fixed in Fase 0.
- `lead-detail-sheet` has bare `<p>No notes yet</p>` / `<p>No tasks yet</p>`
  inside narrow tab panels — intentionally left compact; tracked in
  `ui-debt.md`.
