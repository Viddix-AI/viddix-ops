# UI debt log

Out-of-scope nits that surfaced during the UI/UX refactor. Each entry
lists where it was found, why it's debt, and which future phase should
absorb it. **Don't fix here silently** — file the work where it belongs.

## Pending

### Hard-coded `#4F8EF7` brand colour inline

- `src/app/(auth)/login/page.tsx` — V-logo background + radial-gradient hero.
- `src/components/dashboard/sidebar.tsx` — V-logo background.

**Fix**: replace with `bg-primary` / use a CSS var. Fase 6 polish.

### Activity feed icon tones — non-semantic

- `src/app/(dashboard)/activity/activity-view.tsx:29-48` — the `ICONS`
  table hardcodes `bg-blue-100 text-blue-700` etc. per `ActivityKind`.

**Fix**: feed each icon through a `Pill tone={...}` mapping that lives in
the same table. Fase 6 polish.

### Inline filter-chip dot colors in leads-board

- `src/app/(dashboard)/leads/leads-board.tsx:244` —
  `t.id === "madrid" ? "bg-blue-500" : "bg-emerald-500"`.

**Fix**: derive from `TEAMS[].pillTone` via a small helper. Fase 4.

### Overdue group label colour

- `src/app/(dashboard)/tasks/tasks-view.tsx:151` —
  `group === "overdue" ? "text-rose-600" : "text-muted-foreground"`.

**Fix**: `text-destructive` is the semantic equivalent now that
`--destructive` carries AA contrast. Fase 6 polish.

### `--radius` legacy variable

`globals.css` still defines `--radius: 0.625rem` for shadcn compat (some
3rd-party shadcn snippets reference it). Once we audit that nothing in
the codebase reads `var(--radius)` directly, we can drop it.

**Fix**: Fase 6 cleanup.

## Resolved (kept for reference)

- ✅ `LEAD_STAGES.tone` → `pillTone` (Fase 0)
- ✅ `LEAD_TEMPERATURES.tone` → `pillTone` (Fase 0)
- ✅ `TEAMS.badge` → `pillTone` (Fase 0)
- ✅ `tasks-view.tsx` bare `<p>No tasks</p>` → `EmptyState` (Fase 0)
- ✅ Sidebar "WORKSPACE" label contrast (Fase 0)
- ✅ Sidebar active link clarity (Fase 0)
- ✅ `--muted-foreground` AA lift (Fase 0)
- ✅ `--destructive` AA lift (Fase 0)
- ✅ Global `:focus-visible` outline (Fase 0)
- ✅ Lead-detail-sheet in-tab empty states → `EmptyState size="sm"` (Fase 1)
- ✅ Topbar global search → `CommandPalette` via ⌘K (Fase 1)
- ✅ Small uppercase labels (`text-[10px]`) gained `font-medium` weight (Fase 1)
- ✅ Pipeline bars → horizontal `PipelineFunnel` with conversion % (Fase 2)
- ✅ Dashboard `StatCard` inline → `KPIStat` primitive with deltas + sparklines (Fase 2)
- ✅ Hand-rolled recent activity → `RecentActivity` from `useActivities()`, grouped by day (Fase 2)
- ✅ Clients table: density toggle, sticky header, sort polish, multi-select + bulk actions, inline owner edit, per-row menu (Fase 3)
- ✅ `useDeleteClient` + cascade semantics on localStorage backend (Fase 3)
