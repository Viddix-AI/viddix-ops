# UI_CHANGELOG — Editorial Operations Console

Branch: `feat/ui-editorial`. Direction: paper surfaces, graphite text, single
jade accent, plum/ochre/terracota supporting tones. Sidebar in warm graphite
(not slate). Display serif for headlines and KPI values, narrow sans for UI,
mono for tabular numerics. No purple→blue gradients, no Inter classic, no
shadow-2xl-for-decoration. See `docs/UI_REDESIGN_PROMPT.md` for the brief.

## Typography

| Slot | Before | After |
|---|---|---|
| `--font-sans` (UI body) | `Inter` | `Inter Tight` |
| `--font-display` (H1/H2/KPI) | — *(reused sans)* | `Fraunces` with SOFT/WONK/opsz axes |
| `--font-mono` (numerics, captions) | `JetBrains Mono` (var renamed) | `JetBrains Mono` |
| `--font-heading` | `var(--font-sans)` | `var(--font-display)` |

H1/H2 globally render in Fraunces with `font-feature-settings: "ss01", "ss02"`
and `letter-spacing: -0.02em`. `.tabular` / `.num` utility classes enable
`font-variant-numeric: tabular-nums`.

## Palette — before / after

| Token | Before | After | Note |
|---|---|---|---|
| `--background` | `#f8fafc` slate | `#FAF7F2` paper warm | page surface |
| `--foreground` | `#0f172a` slate-900 | `#16161A` graphite | body text |
| `--primary` | `#4f8ef7` blue (AI cliché) | `#0E7C66` jade-700 | single accent |
| `--secondary` / `--muted` | `#f1f5f9` slate-100 | `#EFE9DF` paper sunken | resting surfaces |
| `--muted-foreground` | `#475569` slate-600 | `#5A5A63` graphite-500 | secondary text |
| `--accent` | `#eef4ff` blue tint | `#E8F1EE` jade-50 | hover / row select |
| `--destructive` | `#dc2626` red-600 | `#B23A1F` terracota | editorial error |
| `--border` | `#e2e8f0` slate-200 | `#E5DED1` paper-300 | dividers |
| `--ring` | `#4f8ef7` | `#0E7C66` jade | focus outline |
| `--chart-1..5` | rainbow (blue/green/amber/violet/rose) | jade · plum · ochre · graphite · terracota | tonal palette |
| `--sidebar` | `#0f172a` slate-900 | `#1A1A1D` graphite warm | sidebar shell |
| `--sidebar-primary` | `#4f8ef7` blue | `#0E7C66` jade | active item bar |

Dark mode mirrors the same tokens with a lifted jade (`#2CAE94`) for
better contrast on dark surfaces, terracota → `#E07A5F`, ochre → `#D4A256`,
plum → `#8C7CA6`.

## Spacing + shadows + radii

- New: `--spacing-page-x` (32px), `--spacing-section` (64px), `--spacing-card-y` (20px).
- New: `--shadow-paper-sm`, `--shadow-paper-md`, `--shadow-paper-lg` — low,
  warm, layered shadows that replace shadow-sm/md/lg in cards, popovers,
  drag previews, command palette.
- Radius scale unchanged (6/10/14/18 px) but enforced across all surfaces
  via `var(--radius-*)`.

## Files modified

**Tokens / global**
- `src/app/globals.css` — palette swap, new spacing/shadow tokens, h1/h2
  display rules, stagger keyframes gated by `prefers-reduced-motion`.
- `src/app/layout.tsx` — fonts switched to Fraunces + Inter Tight + JetBrains
  Mono; renamed `--font-geist-mono` → `--font-mono`; `--font-display` added.

**UI primitives**
- `src/components/ui/button.tsx` — outline-editorial secondary, paper-sm
  shadow on default, jade on default, terracota on destructive, ghost via
  text-text-secondary, added `xs` size.
- `src/components/ui/card.tsx` — paper-sm shadow, border-subtle, serif
  `CardTitle` 18px, `tone="raised"` variant for hero cards.
- `src/components/ui/kpi-stat.tsx` — display serif 44px value, color-mix
  delta pill, full-width sparkline at bottom.
- `src/components/ui/sparkline.tsx` — line-only by default, `fill` prop
  optional, viewBox stretches to 100% via `preserveAspectRatio="none"`.
- `src/components/ui/badge.tsx` — color-mix backgrounds tied to semantic
  tokens (primary/destructive); pill-style for status.
- `src/components/ui/pill.tsx` — tone keys preserved for backwards compat
  but mapped to the editorial palette (no Tailwind rainbow); semantic
  variants now use `color-mix`.

**Chrome**
- `src/components/dashboard/sidebar.tsx` — serif `V` mark, mono workspace
  caption, jade 2px active bar, presence block (avatar + name + email)
  above StorageStatus, width 64.
- `src/components/dashboard/topbar.tsx` — editorial breadcrumb
  (Holding · *Leaf in serif italic*), kbd-style ⌘K search trigger, vertical
  separator before the avatar.
- `src/components/dashboard/page-header.tsx` — accepts `eyebrow` prop,
  display H1 32–36px, prose subtitle, removed `font-heading text-2xl`.
- `src/components/dashboard/command-palette.tsx` — paper-lg shadow,
  border-subtle, 16px input, jade left-border on active items, mono group
  headings.

**Dashboard**
- `src/app/(dashboard)/dashboard/page.tsx` — `PageHeader` with eyebrow
  (`HOLDING · Q{n} {year}`), `stagger-rise` wrapper for first-mount entry,
  asymmetric 1.6fr/1fr grid for funnel + recent activity.
- `src/app/(dashboard)/dashboard/pipeline-funnel.tsx` — display value
  per stage, paper tokens, border-subtle separators.
- `src/app/(dashboard)/dashboard/recent-activity.tsx` — mono day headings.

**Leads**
- `src/app/(dashboard)/leads/leads-board.tsx` — kanban column header in
  editorial caption + jade outline count pill + display total, refined
  lead card (text-[14px] title, mono value, drag-preview rotates 1.5°
  with paper-lg shadow), narrowed edge gradients.

**Clients table**
- `src/app/(dashboard)/clients/clients-table.tsx` — mono uppercase header,
  no zebra, hover bg-surface-3/60, mono tabular value cells, paper-sm
  shadow on table wrapper, surface-3 bulk-action bar.

**Other routes**
- `src/app/(dashboard)/partners/partners-view.tsx`, `calendar/calendar-view.tsx`,
  `activity/activity-view.tsx`, `clients/[id]/client-detail.tsx` — eyebrow
  added to PageHeader.

**Login**
- `src/app/(auth)/login/page.tsx` — split 60/40, serif V logo + sans
  wordmark, eyebrow + display H1, 11px-height inputs, jade primary CTA;
  right canvas is paper gradient + SVG turbulence grain + serif italic
  quote, "VIDDIX HOLDING" caption.

**Atmosphere + motion**
- `src/components/ui/grain.tsx` (new) — fixed full-viewport SVG turbulence
  at 3.5% opacity (2.5% in dark), `mix-blend-multiply`. Injected into
  `(dashboard)/layout.tsx` over the main grid.
- `src/lib/motion.ts` (new) — `easeOutEditorial` and `dur` presets for
  consistent timings across CSS transitions.

## Features — Renewals & Multi-contact (branch `feat/renewals-contacts`)

**Tranche 1 — Client contract dates + dashboard renewals widget**
- Migration `015_client_contract_dates.sql` — `contract_start_date`,
  `contract_end_date`, `renewal_date` columns on `clients` + partial indexes.
- `src/lib/types.ts`, `src/lib/data-store.ts` healer + `createClient` +
  `convertLeadToClient`, `src/lib/supabase-backend.ts` (`createClient`,
  `ensureClientForWonLead`), `src/lib/seed-data.ts` (3 demo clients with
  varied renewal dates).
- `src/app/(dashboard)/clients/add-client-dialog.tsx` — three date inputs
  wired to the new columns (previously `contract_start` overloaded `started_at`).
- `src/app/(dashboard)/clients/[id]/client-detail.tsx` — `DateField` inline
  editor in the Overview card.
- `src/app/(dashboard)/clients/clients-table.tsx` — sortable Renewal column
  with `text-destructive` for overdue and `text-warning` for ≤30d.
- `src/app/(dashboard)/dashboard/page.tsx` — `Upcoming renewals` Card listing
  clients with `renewal_date BETWEEN today AND today+60d` (top 5, oldest first).

**Tranche 2 — Multi-contact per client**
- Migration `016_client_contacts.sql` — `contacts` table + `contact_role` enum +
  partial unique index for one primary per client + backfill from
  `clients.contact_*`.
- Migration `017_activity_contact_kinds.sql` — extends `activities.kind` CHECK
  with `contact_created / contact_updated / contact_deleted / contact_set_primary`.
- `src/lib/types.ts` (`Contact`, `ContactRole`, `ActivityKind` extension,
  `Database.Tables.contacts`, `Database.Enums.contact_role`).
- `src/lib/backend.ts` — `contacts() / contactsFor / createContact /
  updateContact / deleteContact / setPrimaryContact`.
- `src/lib/data-store.ts` — full dual-backend impl with single-primary
  invariant enforced at write-time.
- `src/lib/supabase-backend.ts` — same surface; `setPrimaryContact` is a
  demote-then-promote pair (two statements; UI retries on partial failure).
- `src/lib/seed-data.ts` — `SEED_CONTACTS` materialises primary contacts for
  the two demo clients with contact info.
- New hook `src/hooks/use-contacts.ts` (`useContacts`, `useContactsFor`,
  `useCreateContact`, `useUpdateContact`, `useDeleteContact`,
  `useSetPrimaryContact`).
- New `src/app/(dashboard)/clients/[id]/add-contact-dialog.tsx` (create + edit).
- `src/app/(dashboard)/clients/[id]/client-detail.tsx` — Contacts tab between
  Tasks and Notes, Overview rewires Contact/Email/Phone to primary contact,
  reads `?tab=contacts&contact=<id>` URL params for deep-linking.
- `src/components/dashboard/command-palette.tsx` — Contacts group matching
  `full_name / email / title`, deep-links to the Contacts tab on the client.
- `src/app/(dashboard)/activity/activity-view.tsx` +
  `src/app/(dashboard)/dashboard/recent-activity.tsx` — ICON map extended with
  the new activity kinds.

**Tranche 3 — Refactor buildTaskFromEvent**
- New `src/lib/build-task-from-event.ts` (no `"use client"`) — shared by
  `data-store.ts`, `supabase-backend.ts`, and `app/api/webhooks/cal/route.ts`
  so the Cal.com server route no longer carries an inline duplicate to
  avoid the server/client boundary.

**Tranche 4 — Subtasks, recurrence, time tracking**
- Migration `018_tasks_plus.sql` — `tasks.parent_id` (cascade),
  `task_recurrence` enum + recurrence/recurrence_until/recurrence_parent_id
  + estimate_minutes + tracked_minutes; new `task_time_entries` table with
  partial unique index enforcing one open timer per user.
- Migration `019_activity_task_plus_kinds.sql` — extend CHECK with
  `task_subtask_added / task_timer_started / task_timer_stopped /
  task_recurrence_generated`.
- `src/lib/types.ts` — `Task` gains the migration-018 fields; new
  `TaskRecurrence` + `TaskTimeEntry`; per-table `Insert` overrides make
  DB-default columns optional so call sites don't have to spell out
  `tracked_minutes: 0` etc.
- `src/lib/data-store.ts` + `src/lib/supabase-backend.ts` — recurrence
  generation in `updateTask` (date-fns advances daily/weekly/monthly/yearly,
  honours `recurrence_until`); cascade-cleans subtasks and time entries on
  delete in the localStorage impl (Postgres handles it via FKs).
- New hook `src/hooks/use-time-entries.ts`.
- New `src/components/dashboard/active-timer-banner.tsx` — sticky pill
  surfaced from `(dashboard)/layout.tsx`, elapsed time in state to satisfy
  React 19 strict purity.
- `src/app/(dashboard)/tasks/task-detail-sheet.tsx` — Estimate, Recurrence,
  Recurrence until, Parent task (cycle-safe + scope-filtered), Subtasks
  list, Time section (Start/Stop + per-entry log).
- `src/app/(dashboard)/tasks/tasks-view.tsx` — subtasks excluded from root
  listing, expand chevron when children exist, recurrence badge,
  tracked-minutes display next to the title.

**Tranche 5 — Tags + rich tasks-view filters**
- Migration `020_tags.sql` — entity-agnostic `tags` table + `task_tags`
  M:N + RLS.
- `src/lib/types.ts` — `Tag`, `TaskTag`, `Database.Tables.tags` /
  `task_tags`.
- `src/lib/backend.ts` + both backends — `tags / tagsFor / taskTags /
  createTag / deleteTag / attachTag / detachTag`. Supabase uses upserts on
  the unique name / `(task_id, tag_id)` PK so duplicates no-op.
- New hook `src/hooks/use-tags.ts` — invalidates `["tasks"]` on attach/
  detach so the inline chips refresh.
- `task-detail-sheet.tsx` — new `TagsSection` with autocomplete input,
  "Create tag '{x}'" inline action, click-to-remove chips.
- `tasks-view.tsx` — rich filter toolbar (search, status incl. Open/
  Overdue, assignee, priority, client, lead, tag chips OR-match) with
  filters round-tripped through URL params and backed up to
  `localStorage["viddix:tasks-filters"]`; Reset button when any filter is
  active. Inline tag chips on each row (max 3 + "+N" overflow). The
  /tasks page is wrapped in a `<Suspense>` boundary so `useSearchParams`
  doesn't bail out of static prerender.

## What we did NOT change

- No business logic, hooks, queries, mutations, or `lib/metrics.ts`.
- No schema or Supabase migrations.
- No new heavy libraries — fonts are loaded via `next/font/google`,
  everything else uses existing deps.
- `framer-motion` not introduced. All motion is CSS-driven.
- Routing unchanged.

## Decision summary

The site previously read as "tasteful default AI demo": blue primary,
slate neutrals, sans-only display, decorative gradients. The redesign
trades all of that for a single-accent editorial system — Fraunces over
Inter Tight, paper over slate, jade as the lone vivid colour, plum / ochre
/ terracota as supporting tones for charts and status. Motion stays
restrained and silent. The aim is to make Viddix Ops look like the
internal portal of a private bank, not a startup template.
