# Calendar meeting↔task auto-pair + bug fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the spec at `docs/superpowers/specs/2026-05-22-calendar-meeting-task-pair-design.md` — auto-pair events of type `meeting`/`call` with tasks via a new FK, fix the UTC `isoDay` timezone bug, route calendar clicks to the task detail sheet, and block in-app deletion of Cal.com-origin events.

**Architecture:** New nullable `events.task_id` FK with `ON DELETE SET NULL`. Both backends (`localStore` in `data-store.ts` and `supabaseBackend` in `supabase-backend.ts`) get matching mutation logic. Cal.com webhook handler creates paired tasks on `BOOKING_CREATED`/`RESCHEDULED` and detaches on `CANCELLED`. UI changes are confined to `src/app/(dashboard)/calendar/` and `src/app/(dashboard)/tasks/task-detail-sheet.tsx`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (Postgres), TanStack Query, Base UI, Tailwind v4, lucide-react icons.

**Important context for the implementer:**
- The codebase has **no test framework installed** (no Vitest/Jest in `package.json`). Verification at each task is via the dev server (`npm run dev`) + browser, per the project's CLAUDE.md guidance. Do not introduce a new test framework.
- The data layer has **two backends**: `localStore` (localStorage, demo) and `supabaseBackend` (production). Every mutation change must be applied to both.
- Migrations live at `src/supabase/migrations/0XX_*.sql`. The next number is `014`.
- Commit after every task. Use the project's existing commit-message style (see `git log` for examples).

---

## File map

| File | Change |
|---|---|
| `src/supabase/migrations/014_event_task_id.sql` | **CREATE** — add `events.task_id` FK + backfill |
| `src/lib/types.ts` | **MODIFY** — add `task_id: string \| null` to `Event` |
| `src/lib/data-store.ts` | **MODIFY** — `buildTaskFromEvent` helper, `createEvent`/`updateEvent`/`deleteEvent`/`deleteTask` logic, heal block, KEY bump, `EventBlockedByCalCom` export |
| `src/lib/seed-data.ts` | **MODIFY** — `task_id` on meeting/call entries; matching tasks |
| `src/lib/supabase-backend.ts` | **MODIFY** — mirror data-store mutation logic against Supabase |
| `src/app/api/webhooks/cal/route.ts` | **MODIFY** — pair task on create/reschedule, detach + delete on cancel, remove diagnostic `console.log` |
| `src/app/(dashboard)/calendar/calendar-view.tsx` | **MODIFY** — remove duplicate UTC `isoDay`, wire `<TaskDetailSheet>` at page level, route `ItemRow` clicks to it |
| `src/app/(dashboard)/calendar/time-grid.tsx` | **MODIFY** — wire `onSelectItem`, disable drag/resize on Cal-origin events, lock icon |
| `src/app/(dashboard)/tasks/task-detail-sheet.tsx` | **MODIFY** — paired-event pill, disable `due_date`/`due_time`, "Cancel in Cal.com" button |
| `src/app/(dashboard)/tasks/tasks-view.tsx` | **MODIFY** — clock icon next to title for paired tasks |

---

## Task 1: Database migration — add `events.task_id` + backfill

**Files:**
- Create: `src/supabase/migrations/014_event_task_id.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Auto-pair calendar events of type 'meeting' or 'call' with a tasks row.
-- The FK lives on events so a single lookup tells the UI which task to open.
-- ON DELETE SET NULL: deleting a paired task should NOT cascade to the event
-- (Cal.com-origin events must survive task deletion).

alter table public.events
  add column if not exists task_id uuid
    references public.tasks(id) on delete set null;

create index if not exists events_task_id_idx
  on public.events(task_id)
  where task_id is not null;

-- One-off backfill: every existing meeting/call event without a task gets a
-- paired task. plpgsql loop so each new task is paired back unambiguously by
-- id (a CTE-with-rejoin would misjoin if two events share title + time).
do $$
declare
  e record;
  new_task_id uuid;
begin
  for e in
    select id, title, event_type, start_at, client_id, lead_id
    from public.events
    where event_type in ('meeting', 'call') and task_id is null
  loop
    insert into public.tasks (
      title, due_date, due_time, status, priority, client_id, lead_id
    )
    values (
      coalesce(nullif(e.title, ''), initcap(e.event_type::text)),
      (e.start_at at time zone 'Europe/Madrid')::date,
      to_char((e.start_at at time zone 'Europe/Madrid'), 'HH24:MI'),
      'todo',
      'medium',
      e.client_id,
      e.lead_id
    )
    returning id into new_task_id;

    update public.events set task_id = new_task_id where id = e.id;
  end loop;
end $$;
```

- [ ] **Step 2: Apply the migration via the Supabase MCP**

Use the `mcp__claude_ai_Supabase__apply_migration` tool with name `014_event_task_id` and the file's contents. If the user prefers running the SQL manually in the Supabase SQL editor, paste the file there instead.

- [ ] **Step 3: Verify with the Supabase MCP**

Run via `mcp__claude_ai_Supabase__execute_sql`:

```sql
select count(*) as total,
       count(task_id) as paired,
       count(*) filter (where event_type in ('meeting','call') and task_id is null) as unpaired_meetings
from public.events;
```

Expected: `unpaired_meetings = 0`. `paired` ≥ count of pre-existing meeting/call rows.

- [ ] **Step 4: Commit**

```bash
git add src/supabase/migrations/014_event_task_id.sql
git commit -m "feat(db): add events.task_id + backfill paired tasks"
```

---

## Task 2: TypeScript types — add `task_id` to `Event`

**Files:**
- Modify: `src/lib/types.ts:150-164`

- [ ] **Step 1: Add the field**

In `src/lib/types.ts`, find the `Event` type (around line 150) and add `task_id` right above `created_at`:

```ts
export type Event = {
  id: string
  title: string
  description: string | null
  start_at: string
  end_at: string | null
  event_type: EventType
  client_id: string | null
  lead_id: string | null
  attendees: string[]
  cal_booking_id: string | null
  // Paired tasks row for meeting/call events. Auto-created by the data-store
  // and webhook handler; ON DELETE SET NULL means a task delete just detaches.
  task_id: string | null
  created_at: string
}
```

- [ ] **Step 2: Verify the build still compiles**

```bash
npm run build
```

Expected: build succeeds. (Existing callers don't read `task_id` yet, so the new field is purely additive.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add Event.task_id for meeting<->task pairing"
```

---

## Task 3: Update seed data — paired tasks for meeting/call events

**Files:**
- Modify: `src/lib/seed-data.ts`

- [ ] **Step 1: Inspect the existing seed events**

```bash
grep -n "SEED_EVENTS\|event_type" src/lib/seed-data.ts | head -50
```

Look at every entry in `SEED_EVENTS`. For each one with `event_type: "meeting"` or `event_type: "call"`, you'll need to add `task_id` pointing at a real (and new) `SEED_TASKS` entry.

- [ ] **Step 2: For each meeting/call seed event, add a paired task to SEED_TASKS**

For each meeting/call event, create a matching task entry in `SEED_TASKS`. Pattern (replace `<…>` with values from the event):

```ts
{
  id: "<unique-task-id>",
  title: "<event title>",
  description: null,
  due_date: "<YYYY-MM-DD from event.start_at, local time>",
  due_time: "<HH:MM from event.start_at, local time>",
  priority: "medium",
  status: "todo",
  assignee_ids: [],
  link: null,
  client_id: <event.client_id>,
  lead_id: <event.lead_id>,
  created_at: "<copy event.created_at or use a placeholder ISO>",
  updated_at: "<same>",
},
```

Then on the matching event entry, add `task_id: "<unique-task-id>"`. Non-meeting/call events get `task_id: null`.

- [ ] **Step 3: Update the data-store heal block**

In `src/lib/data-store.ts` find the events heal block (around line 108):

```ts
events:          (parsed.events ?? fresh.events).map((e) => ({
  ...e,
  cal_booking_id: e.cal_booking_id ?? null,
})),
```

Add the new default:

```ts
events:          (parsed.events ?? fresh.events).map((e) => ({
  ...e,
  cal_booking_id: e.cal_booking_id ?? null,
  task_id: e.task_id ?? null,
})),
```

- [ ] **Step 4: Bump the localStorage KEY so existing demo data gets reseeded**

In `src/lib/data-store.ts:38`:

```ts
const KEY = "viddix-ops:v6"
```

Change to:

```ts
const KEY = "viddix-ops:v7"
```

- [ ] **Step 5: Manually verify in the browser**

```bash
npm run dev
```

Open the app. Navigate to `/calendar` and `/tasks`. Confirm:
- Calendar still renders without errors.
- Tasks page shows the new paired tasks alongside the existing tasks.
- Browser devtools → Application → localStorage → key is now `viddix-ops:v7`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/seed-data.ts src/lib/data-store.ts
git commit -m "feat(seed): pair meeting/call seed events with tasks, bump KEY to v7"
```

---

## Task 4: `buildTaskFromEvent` helper + `EventBlockedByCalCom` error

**Files:**
- Modify: `src/lib/data-store.ts` (add helper + exported error class near the top, below the imports)

- [ ] **Step 1: Add the helper and error class**

Just above the `localStore` object declaration (around line 162), add:

```ts
// ── Event<->Task pairing helpers ─────────────────────────────────────────────

/** Thrown by deleteEvent when the row originated from Cal.com. The calendar UI
 *  catches this and shows a "Cancel in Cal.com" hint instead. */
export class EventBlockedByCalCom extends Error {
  readonly cal_booking_id: string
  constructor(cal_booking_id: string) {
    super("This event came from Cal.com. Cancel it in Cal.com to remove it.")
    this.name = "EventBlockedByCalCom"
    this.cal_booking_id = cal_booking_id
  }
}

/** Build a `tasks` insert payload from an event. Used by createEvent
 *  auto-pairing and the Cal.com webhook handler. Title falls back to the
 *  capitalized event type when blank. Date/time are extracted in the local
 *  timezone so a 23:30 booking in Madrid lands on the same day in the tasks
 *  list, not the UTC-next day. */
export function buildTaskFromEvent(e: {
  title: string
  start_at: string
  event_type: string
  client_id: string | null
  lead_id: string | null
}): {
  title: string
  due_date: string
  due_time: string
  status: "todo"
  priority: "medium"
  client_id: string | null
  lead_id: string | null
} {
  const d = new Date(e.start_at)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return {
    title: e.title.trim() || (e.event_type.charAt(0).toUpperCase() + e.event_type.slice(1)),
    due_date: `${y}-${m}-${day}`,
    due_time: `${hh}:${mm}`,
    status: "todo",
    priority: "medium",
    client_id: e.client_id,
    lead_id: e.lead_id,
  }
}
```

- [ ] **Step 2: Manually verify in a browser devtools console**

```bash
npm run dev
```

Open the dev server, then in the browser console paste:

```js
const { buildTaskFromEvent } = await import("/src/lib/data-store.ts")
buildTaskFromEvent({
  title: "Demo",
  start_at: new Date("2026-05-22T20:30:00").toISOString(),
  event_type: "meeting",
  client_id: null,
  lead_id: null,
})
```

Expected: a task payload whose `due_date` matches today (local) and `due_time` is `"20:30"`. **If you're in a `UTC-` zone**, that result still matches the local clock — that's the whole point of the helper.

(If the dynamic import doesn't work in your environment, skip this step — Task 5's end-to-end verification will exercise the helper.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/data-store.ts
git commit -m "feat(data-store): add buildTaskFromEvent + EventBlockedByCalCom"
```

---

## Task 5: `localStore` — auto-pair on create, mirror on update, guard on delete

**Files:**
- Modify: `src/lib/data-store.ts` — `createEvent` (line 473), `updateEvent` (line 518), `deleteEvent` (line 531), `deleteTask` (line 458)

- [ ] **Step 1: Auto-pair in `createEvent`**

Replace the existing `createEvent` (lines 473-516) with:

```ts
  createEvent(input: Partial<Event> & { title: string; start_at: string }): Event {
    const db = read()
    // Upsert by cal_booking_id so Cal.com webhook retries don't create
    // duplicates. Internal events pass cal_booking_id=null and always insert.
    if (input.cal_booking_id) {
      const existing = db.events.find(
        (e) => e.cal_booking_id === input.cal_booking_id
      )
      if (existing) {
        Object.assign(existing, {
          title: input.title,
          description: input.description ?? existing.description,
          start_at: input.start_at,
          end_at: input.end_at ?? existing.end_at,
          event_type: input.event_type ?? existing.event_type,
          client_id: input.client_id ?? existing.client_id,
          lead_id: input.lead_id ?? existing.lead_id,
          attendees: input.attendees ?? existing.attendees,
        })
        // Auto-pair if a meeting/call upsert came back without a task.
        if (
          !existing.task_id &&
          (existing.event_type === "meeting" || existing.event_type === "call")
        ) {
          const taskPayload = buildTaskFromEvent(existing)
          const t: Task = {
            id: uid(),
            ...taskPayload,
            description: null,
            assignee_ids: [],
            link: null,
            created_at: now(),
            updated_at: now(),
          }
          db.tasks.push(t)
          existing.task_id = t.id
        }
        write(db)
        return existing
      }
    }
    const wantsTask =
      (input.event_type ?? "meeting") === "meeting" ||
      input.event_type === "call"
    let task_id: string | null = null
    if (wantsTask) {
      const taskPayload = buildTaskFromEvent({
        title: input.title,
        start_at: input.start_at,
        event_type: input.event_type ?? "meeting",
        client_id: input.client_id ?? null,
        lead_id: input.lead_id ?? null,
      })
      const t: Task = {
        id: uid(),
        ...taskPayload,
        description: null,
        assignee_ids: [],
        link: null,
        created_at: now(),
        updated_at: now(),
      }
      db.tasks.push(t)
      task_id = t.id
    }
    const e: Event = {
      id: uid(),
      title: input.title,
      description: input.description ?? null,
      start_at: input.start_at,
      end_at: input.end_at ?? null,
      event_type: input.event_type ?? "meeting",
      client_id: input.client_id ?? null,
      lead_id: input.lead_id ?? null,
      attendees: input.attendees ?? [],
      cal_booking_id: input.cal_booking_id ?? null,
      task_id,
      created_at: now(),
    }
    db.events.push(e)
    record(db, "event_created", `Event scheduled — ${e.title}`, {
      lead_id: e.lead_id,
      client_id: e.client_id,
    })
    write(db)
    return e
  },
```

- [ ] **Step 2: Mirror title / start_at in `updateEvent`**

Replace `updateEvent` (lines 518-529):

```ts
  updateEvent(id: string, patch: Partial<Event>): Event | null {
    const db = read()
    const e = db.events.find((x) => x.id === id)
    if (!e) return null
    Object.assign(e, patch)
    // Mirror title/time to the paired task. One-directional (event -> task).
    if (e.task_id && (patch.title !== undefined || patch.start_at !== undefined)) {
      const t = db.tasks.find((x) => x.id === e.task_id)
      if (t) {
        const mirror = buildTaskFromEvent(e)
        t.title = mirror.title
        t.due_date = mirror.due_date
        t.due_time = mirror.due_time
        t.updated_at = now()
      }
    }
    record(db, "event_updated", `Event updated — ${e.title}`, {
      lead_id: e.lead_id,
      client_id: e.client_id,
    })
    write(db)
    return e
  },
```

- [ ] **Step 3: Guard Cal-origin in `deleteEvent`, cascade for in-app**

Replace `deleteEvent` (lines 531-535):

```ts
  deleteEvent(id: string) {
    const db = read()
    const e = db.events.find((x) => x.id === id)
    if (!e) return
    if (e.cal_booking_id) {
      throw new EventBlockedByCalCom(e.cal_booking_id)
    }
    // In-app event: cascade-delete the paired task too.
    if (e.task_id) {
      db.tasks = db.tasks.filter((t) => t.id !== e.task_id)
    }
    db.events = db.events.filter((x) => x.id !== id)
    write(db)
  },
```

- [ ] **Step 4: Detach paired event in `deleteTask`**

Replace `deleteTask` (lines 458-470):

```ts
  deleteTask(id: string) {
    const db = read()
    const t = db.tasks.find((x) => x.id === id)
    // Detach any paired event so it survives with a null task_id. The event
    // row remains because Cal-origin events MUST survive task deletion.
    db.events = db.events.map((e) =>
      e.task_id === id ? { ...e, task_id: null } : e
    )
    db.tasks = db.tasks.filter((x) => x.id !== id)
    if (t) {
      record(db, "task_deleted", `Task deleted — ${t.title}`, {
        task_id: t.id,
        lead_id: t.lead_id,
        client_id: t.client_id,
      })
    }
    write(db)
  },
```

- [ ] **Step 5: Manually verify in the browser**

```bash
npm run dev
```

Walk through:
1. `/calendar` → click "New event" → fill title, save with default type=meeting. Check `/tasks` — a matching task appears with the right due date/time.
2. From `/calendar`, drag the new block to a different time slot. Refresh `/tasks` — the task's due time mirrors the drag.
3. From `/tasks`, click the new task and delete it. Refresh `/calendar` — the event row is gone (in-app create has no cal_booking_id, so cascade kicks in — wait, the spec says deleting the task detaches and the event stays; **double-check** this. The cascade is on the EVENT side: deleting an in-app event deletes the task. Deleting the task just detaches.) — so the event should still be present, now without a paired task.

If behavior #3 doesn't match the spec, re-read Step 4 carefully — the bug will be in `deleteTask` not properly detaching.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data-store.ts
git commit -m "feat(data-store): auto-pair meeting/call events with tasks (localStore)"
```

---

## Task 6: `supabaseBackend` — mirror the same logic against Supabase

**Files:**
- Modify: `src/lib/supabase-backend.ts` — `createEvent` (line 377), `updateEvent` (line 409), `deleteEvent` (line 423), `deleteTask` (line 371)

- [ ] **Step 1: Import the helpers**

At the top of `src/lib/supabase-backend.ts`, add to the existing import from `@/lib/data-store` (or create the import if it doesn't exist):

```ts
import { buildTaskFromEvent, EventBlockedByCalCom } from "@/lib/data-store"
```

Note: `data-store.ts` is already marked `"use client"`. `supabase-backend.ts` is too. They can import freely.

- [ ] **Step 2: Auto-pair in `createEvent`**

Replace `createEvent` (lines 377-408):

```ts
  async createEvent(input) {
    const wantsTask =
      (input.event_type ?? "meeting") === "meeting" ||
      input.event_type === "call"
    let task_id: string | null = null
    if (wantsTask) {
      const taskPayload = buildTaskFromEvent({
        title: input.title,
        start_at: input.start_at,
        event_type: input.event_type ?? "meeting",
        client_id: input.client_id ?? null,
        lead_id: input.lead_id ?? null,
      })
      const tr = await db()
        .from("tasks")
        .insert({
          title: taskPayload.title,
          description: null,
          due_date: taskPayload.due_date,
          due_time: taskPayload.due_time,
          priority: taskPayload.priority,
          status: taskPayload.status,
          assignee_ids: [],
          link: null,
          client_id: taskPayload.client_id,
          lead_id: taskPayload.lead_id,
        })
        .select("id")
        .single()
      if (tr.error) throw new Error(`Supabase: createEvent.task — ${tr.error.message}`)
      task_id = tr.data.id as string
    }
    const payload = {
      title: input.title,
      description: input.description ?? null,
      start_at: input.start_at,
      end_at: input.end_at ?? null,
      event_type: input.event_type ?? "meeting",
      client_id: input.client_id ?? null,
      lead_id: input.lead_id ?? null,
      attendees: input.attendees ?? [],
      cal_booking_id: input.cal_booking_id ?? null,
      task_id,
    }
    const r = input.cal_booking_id
      ? await db()
          .from("events")
          .upsert(payload, { onConflict: "cal_booking_id" })
          .select()
          .single()
      : await db().from("events").insert(payload).select().single()
    if (r.error && task_id) {
      // Best-effort cleanup of the orphan task if the event insert failed.
      await db().from("tasks").delete().eq("id", task_id)
    }
    const event = unwrap(r, "createEvent") as Event
    logActivity({
      kind: "event_created",
      message: `Event scheduled — ${event.title}`,
      lead_id: event.lead_id,
      client_id: event.client_id,
      partner_id: null,
      task_id: null,
    })
    return event
  },
```

- [ ] **Step 3: Mirror title/time in `updateEvent`**

Replace `updateEvent` (lines 409-422):

```ts
  async updateEvent(id, patch) {
    const r = await db().from("events").update(patch).eq("id", id).select().single()
    if (r.error) throw new Error(`Supabase: updateEvent — ${r.error.message}`)
    const event = r.data as Event
    if (
      event.task_id &&
      (patch.title !== undefined || patch.start_at !== undefined)
    ) {
      const mirror = buildTaskFromEvent(event)
      const tu = await db()
        .from("tasks")
        .update({
          title: mirror.title,
          due_date: mirror.due_date,
          due_time: mirror.due_time,
        })
        .eq("id", event.task_id)
      if (tu.error) {
        // Non-fatal — log and continue. The event update already succeeded.
        console.warn(`updateEvent.mirror failed: ${tu.error.message}`)
      }
    }
    logActivity({
      kind: "event_updated",
      message: `Event updated — ${event.title}`,
      lead_id: event.lead_id,
      client_id: event.client_id,
      partner_id: null,
      task_id: null,
    })
    return event
  },
```

- [ ] **Step 4: Guard + cascade in `deleteEvent`**

Replace `deleteEvent` (lines 423-426):

```ts
  async deleteEvent(id) {
    // Load the row first to decide guard/cascade behavior.
    const lookup = await db()
      .from("events")
      .select("cal_booking_id, task_id")
      .eq("id", id)
      .maybeSingle()
    if (lookup.error) throw new Error(`Supabase: deleteEvent.lookup — ${lookup.error.message}`)
    if (!lookup.data) return
    if (lookup.data.cal_booking_id) {
      throw new EventBlockedByCalCom(lookup.data.cal_booking_id)
    }
    const r = await db().from("events").delete().eq("id", id)
    if (r.error) throw new Error(`Supabase: deleteEvent — ${r.error.message}`)
    if (lookup.data.task_id) {
      const tr = await db().from("tasks").delete().eq("id", lookup.data.task_id)
      if (tr.error) {
        console.warn(`deleteEvent.task cascade failed: ${tr.error.message}`)
      }
    }
  },
```

- [ ] **Step 5: `deleteTask` — let Postgres detach the FK**

`deleteTask` doesn't need code changes because the FK has `ON DELETE SET NULL`. But add a comment so the next reader doesn't wonder. Replace `deleteTask` (lines 371-374):

```ts
  async deleteTask(id) {
    // events.task_id has ON DELETE SET NULL (migration 014), so any paired
    // event survives with task_id cleared automatically.
    const r = await db().from("tasks").delete().eq("id", id)
    if (r.error) throw new Error(`Supabase: deleteTask — ${r.error.message}`)
  },
```

- [ ] **Step 6: Verify with the Supabase MCP**

If you have a Supabase project configured, set the env vars and run `npm run dev`. From the calendar:
1. Create an event → confirm a row appears in `events` AND `tasks`, linked via `task_id`.
2. Verify with the MCP: `mcp__claude_ai_Supabase__execute_sql` →

```sql
select e.id, e.title, e.task_id, t.id as task_id_check, t.title as task_title, t.due_date, t.due_time
from public.events e left join public.tasks t on t.id = e.task_id
order by e.created_at desc
limit 5;
```

Expected: latest event has matching `task_id_check` and a `task_title` that equals the event title.

If running localStorage-only (no Supabase configured), skip this step — Task 5's verification already covers the same logic.

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase-backend.ts
git commit -m "feat(supabase-backend): auto-pair meeting/call events with tasks"
```

---

## Task 7: Cal.com webhook — pair on create/reschedule, detach + delete on cancel

**Files:**
- Modify: `src/app/api/webhooks/cal/route.ts`

- [ ] **Step 1: Add the pairing helper inside the webhook handler**

Open `src/app/api/webhooks/cal/route.ts`. At the bottom of the "Handlers" section (before "Mapping helpers"), add:

```ts
async function ensurePairedTask(
  supabase: SupabaseClient,
  event: { id: string; title: string; start_at: string; event_type: string; client_id: string | null; lead_id: string | null; task_id: string | null }
): Promise<void> {
  // The webhook only sends meeting bookings, but be defensive.
  if (event.event_type !== "meeting" && event.event_type !== "call") return

  const payload = buildTaskFromEvent(event)

  if (event.task_id) {
    // Mirror title/time to existing task.
    const { error } = await supabase
      .from("tasks")
      .update({
        title: payload.title,
        due_date: payload.due_date,
        due_time: payload.due_time,
      })
      .eq("id", event.task_id)
    if (error) console.warn(`webhook task mirror failed: ${error.message}`)
    return
  }

  // No paired task yet — create one and link.
  const { data: task, error: te } = await supabase
    .from("tasks")
    .insert({
      title: payload.title,
      description: null,
      due_date: payload.due_date,
      due_time: payload.due_time,
      priority: payload.priority,
      status: payload.status,
      assignee_ids: [],
      link: null,
      client_id: payload.client_id,
      lead_id: payload.lead_id,
    })
    .select("id")
    .single()
  if (te || !task) {
    console.warn(`webhook task create failed: ${te?.message ?? "no data"}`)
    return
  }
  const { error: ue } = await supabase
    .from("events")
    .update({ task_id: task.id })
    .eq("id", event.id)
  if (ue) console.warn(`webhook event link failed: ${ue.message}`)
}
```

At the top of the file, import the helper:

```ts
import { buildTaskFromEvent } from "@/lib/data-store"
```

- [ ] **Step 2: Call `ensurePairedTask` after `upsertBooking`**

In `upsertBooking` (around line 92), after the `.upsert(...)` call succeeds, fetch the event back and call the pairing helper. Replace the entire function:

```ts
async function upsertBooking(supabase: SupabaseClient, p: CalPayload["payload"]) {
  const inviteeEmail = p.attendees?.[0]?.email ?? null
  const ownerEmail = p.organizer?.email ?? null

  const ownerId = ownerEmail ? await profileIdByEmail(supabase, ownerEmail) : null
  const { leadId, clientId } = inviteeEmail
    ? await leadOrClientByEmail(supabase, inviteeEmail)
    : { leadId: null, clientId: null }

  const row = {
    title: p.title ?? "Cal.com booking",
    description: null,
    start_at: p.startTime,
    end_at: p.endTime,
    event_type: "meeting" as const,
    client_id: clientId,
    lead_id: leadId,
    attendees: ownerId ? [ownerId] : [],
    cal_booking_id: p.uid,
  }

  const { data: event, error } = await supabase
    .from("events")
    .upsert(row, { onConflict: "cal_booking_id" })
    .select("id, title, start_at, event_type, client_id, lead_id, task_id")
    .single()
  if (error || !event) throw new Error(`upsert events: ${error?.message ?? "no row"}`)

  await ensurePairedTask(supabase, event)
}
```

- [ ] **Step 3: Detach + delete on `BOOKING_CANCELLED`**

Replace `cancelBooking` (around line 120):

```ts
async function cancelBooking(supabase: SupabaseClient, uid: string) {
  // Look up the row first so we can clear the FK before deleting. The webhook
  // bypasses the EventBlockedByCalCom guard intentionally — Cal.com IS the
  // authoritative deleter here.
  const { data: event } = await supabase
    .from("events")
    .select("id, task_id")
    .eq("cal_booking_id", uid)
    .maybeSingle()
  if (!event) return  // already gone

  if (event.task_id) {
    const { error: ue } = await supabase
      .from("events")
      .update({ task_id: null })
      .eq("id", event.id)
    if (ue) console.warn(`cancel: detach task failed: ${ue.message}`)
  }

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", event.id)
  if (error) throw new Error(`delete events: ${error.message}`)
}
```

- [ ] **Step 4: Remove yesterday's diagnostic `console.log`**

In `src/app/api/webhooks/cal/route.ts` around line 59-62, delete:

```ts
  console.log("cal webhook received", {
    triggerEvent: body.triggerEvent,
    payload: body.payload,
  })
```

- [ ] **Step 5: Manually verify with a Cal.com test booking**

Run dev server:

```bash
npm run dev
```

If you have a Cal.com staging account and webhook pointed at this dev server (via a tunnel — ngrok or similar), book a meeting. Confirm:
1. The event appears in `/calendar` at the **correct local time** (not UTC-shifted).
2. A paired task appears in `/tasks` with the same title and the local due_date/due_time.
3. Reschedule the booking in Cal.com → the event time updates AND the task's due_date/due_time mirror.
4. Cancel the booking in Cal.com → the event disappears from `/calendar`. The task remains in `/tasks` (now with no back-reference).

If no Cal.com tunnel is available, simulate via `curl`:

```bash
curl -X POST http://localhost:3000/api/webhooks/cal \
  -H 'Content-Type: application/json' \
  -d '{
    "triggerEvent": "BOOKING_CREATED",
    "payload": {
      "uid": "manual-test-001",
      "title": "Manual test",
      "startTime": "2026-05-23T18:00:00.000Z",
      "endTime": "2026-05-23T19:00:00.000Z",
      "organizer": { "email": "owner@example.com" },
      "attendees": [{ "email": "guest@example.com" }]
    }
  }'
```

Check the Supabase MCP query from Task 6 Step 6 — the new event should have a non-null `task_id`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/webhooks/cal/route.ts
git commit -m "feat(cal-webhook): pair tasks on booking events, remove debug log"
```

---

## Task 8: Fix duplicate UTC `isoDay` in calendar-view

**Files:**
- Modify: `src/app/(dashboard)/calendar/calendar-view.tsx`

- [ ] **Step 1: Remove the local UTC `isoDay`**

In `src/app/(dashboard)/calendar/calendar-view.tsx`, delete the local definition (lines 82-84):

```ts
function isoDay(d: Date) {
  return d.toISOString().slice(0, 10)
}
```

- [ ] **Step 2: Import the local-time `isoDay`**

Find the existing import from `@/lib/time-grid-math` — none exists yet in calendar-view, so add a new import at the top with the other `@/lib/...` imports:

```ts
import { isoDay } from "@/lib/time-grid-math"
```

- [ ] **Step 3: Verify the build**

```bash
npm run build
```

Expected: builds cleanly. No unused-import warnings.

- [ ] **Step 4: Manually verify the bug is fixed**

```bash
npm run dev
```

Open `/calendar`. Create an event at a time near local midnight (e.g., 23:30 today). Verify:
- The event shows on **today**, not tomorrow.
- The "Today's agenda" sidebar lists the event under today's date.

(If running in a timezone where local-midnight matches UTC-midnight, this won't reproduce the original bug. Try 03:00 the next day or pick a date on the boundary.)

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/calendar/calendar-view.tsx
git commit -m "fix(calendar): use local-time isoDay so late events stay on the right day"
```

---

## Task 9: Calendar — wire clicks to open the task detail sheet

**Files:**
- Modify: `src/app/(dashboard)/calendar/calendar-view.tsx`
- Modify: `src/app/(dashboard)/calendar/time-grid.tsx`

- [ ] **Step 1: Add `<TaskDetailSheet>` state in `CalendarView`**

In `calendar-view.tsx`, near the top of the `CalendarView` component (around line 102, with the other `useState`s):

```ts
const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null)
```

Add the import at the top of the file:

```ts
import { TaskDetailSheet } from "../tasks/task-detail-sheet"
```

At the end of `<CalendarView>`'s JSX (right above the closing `</>` for the fragment), render the sheet:

```tsx
<TaskDetailSheet
  task={tasks.find((t) => t.id === selectedTaskId) ?? null}
  open={selectedTaskId !== null}
  onOpenChange={(o) => { if (!o) setSelectedTaskId(null) }}
/>
```

- [ ] **Step 2: Route `ItemRow` clicks through `task_id`**

In the same file, find the `ItemRow` component (around line 681). Currently it wraps `inner` in a `<Link href={item.href}>`. Change it so events with a `task_id` open the detail sheet instead. First, extend the `Item` type's `event` variant (lines 34-44) to include `task_id`:

```ts
type Item =
  | {
      kind: "event"
      id: string
      title: string
      time: string
      sub: string
      tone: string
      href: string | null
      gcalUrl: string
      task_id: string | null   // NEW
    }
  | { /* task variant unchanged */ }
```

Populate it inside the bucket loop where events are pushed (around line 130):

```ts
push(key, {
  kind: "event",
  id: e.id,
  title: e.title,
  time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  sub: client?.name ?? lead?.name ?? e.event_type,
  tone: TONE_EVENT,
  href: client ? `/clients/${client.id}` : lead ? `/leads` : null,
  gcalUrl: googleCalendarUrl({ /* unchanged */ }),
  task_id: e.task_id,   // NEW
})
```

Then modify `ItemRow`'s wrapper. Find (around line 739-748):

```tsx
return (
  <li>
    {item.href ? (
      <Link href={item.href} className="block">
        {inner}
      </Link>
    ) : (
      <div>{inner}</div>
    )}
  </li>
)
```

Replace with a button that opens the sheet when the event has a `task_id`:

```tsx
return (
  <li>
    {item.kind === "event" && item.task_id ? (
      <button
        type="button"
        className="block w-full text-left"
        onClick={() => onOpenTask(item.task_id!)}
      >
        {inner}
      </button>
    ) : item.href ? (
      <Link href={item.href} className="block">
        {inner}
      </Link>
    ) : (
      <div>{inner}</div>
    )}
  </li>
)
```

Add `onOpenTask` to `ItemRow`'s prop type and thread it through:

```ts
function ItemRow({
  item,
  compact,
  expanded,
  onOpenTask,
}: {
  item: Item
  compact?: boolean
  expanded?: boolean
  onOpenTask: (taskId: string) => void
}) { /* ... */ }
```

Wire `onOpenTask={setSelectedTaskId}` everywhere `ItemRow` is rendered (`MonthView`, `AgendaView`, `TodayAgenda`). Each of those subcomponents will need an `onOpenTask` prop too — thread it down from `CalendarView`. Search the file for `<ItemRow` to find all call sites (there are three).

- [ ] **Step 3: Wire `time-grid.tsx`'s existing `onSelectItem`**

In `calendar-view.tsx`, find the two `<TimeGrid ... />` renders (for week and day views, around lines 341-369). Add `onSelectItem`:

```tsx
<TimeGrid
  days={...}
  events={events}
  tasks={tasks}
  onCreateAt={openCreate}
  onUpdateEvent={...}
  onUpdateTask={...}
  onSelectItem={(it) => {
    if (it.kind === "event" && it.event.task_id) {
      setSelectedTaskId(it.event.task_id)
    } else if (it.kind === "task") {
      setSelectedTaskId(it.task.id)
    }
  }}
/>
```

(`onSelectItem` is already wired in `time-grid.tsx`; we're just supplying it.)

- [ ] **Step 4: Manually verify**

```bash
npm run dev
```

On `/calendar`:
1. Month view: click an event with a paired task → the task detail sheet slides in.
2. Week / Day view: click an event block → same sheet opens.
3. Click an unpaired event (e.g., type=internal) → old behavior (link to client/lead/nothing).

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/calendar/calendar-view.tsx
git commit -m "feat(calendar): clicking an event opens the paired task detail sheet"
```

---

## Task 10: TimeGrid — disable drag/resize on Cal.com-origin events + lock icon

**Files:**
- Modify: `src/app/(dashboard)/calendar/time-grid.tsx`

- [ ] **Step 1: Gate `beginDrag` on Cal-origin events**

In `time-grid.tsx`, find `beginDrag` (around line 161):

```ts
function beginDrag(mode: Drag["mode"], item: GridItem, e: React.PointerEvent) {
  e.preventDefault()
  e.stopPropagation()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  setDrag({ /* ... */ })
}
```

Replace with:

```ts
function beginDrag(mode: Drag["mode"], item: GridItem, e: React.PointerEvent) {
  // Cal.com-origin events are read-only in the UI under webhook-only sync:
  // we can't propagate the move back to Cal.com, and the next webhook would
  // clobber the local change anyway. Treat the pointerdown as a select-click.
  if (item.kind === "event" && item.event.cal_booking_id) {
    onSelectItem?.(item)
    return
  }
  e.preventDefault()
  e.stopPropagation()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  setDrag({
    mode,
    item,
    startClientX: e.clientX,
    startClientY: e.clientY,
    deltaMin: 0,
    targetDayIdx: item.dayIdx,
  })
}
```

- [ ] **Step 2: Show a lock icon on Cal-origin blocks**

In the same file, find the `Block` component (around line 434). Import the icon at the top:

```ts
import { Lock } from "lucide-react"
```

Inside the block JSX, just inside the `<div>` (around line 482), add the lock badge for Cal-origin events:

```tsx
<div /* existing block div */>
  {item.kind === "event" && item.event.cal_booking_id && (
    <Lock className="absolute right-1 top-1 size-2.5 opacity-70" aria-label="From Cal.com" />
  )}
  <div className="flex min-w-0 items-baseline gap-1.5 leading-tight">
    {/* existing inner content */}
  </div>
  {/* existing resize handle */}
</div>
```

Also disable the resize handle for Cal-origin events. Find (around line 489):

```tsx
{item.kind === "event" && (
  <div
    className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
    onPointerDown={onResizePointerDown}
  />
)}
```

Replace with:

```tsx
{item.kind === "event" && !item.event.cal_booking_id && (
  <div
    className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
    onPointerDown={onResizePointerDown}
  />
)}
```

- [ ] **Step 3: Manually verify**

```bash
npm run dev
```

You'll need a Cal-origin event to test against. Either book one via Cal.com (if your tunnel is set up) or seed one manually:

```bash
curl -X POST http://localhost:3000/api/webhooks/cal \
  -H 'Content-Type: application/json' \
  -d '{
    "triggerEvent": "BOOKING_CREATED",
    "payload": {
      "uid": "drag-test-001",
      "title": "Lock-test",
      "startTime": "2026-05-23T14:00:00.000Z",
      "endTime": "2026-05-23T15:00:00.000Z"
    }
  }'
```

Then on the day/week view:
1. Try to drag the locked block → it stays put, but a click opens the task sheet.
2. Lock icon visible in the corner.
3. Drag an in-app block → moves normally.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/calendar/time-grid.tsx
git commit -m "feat(calendar): lock Cal.com-origin events from drag/resize"
```

---

## Task 11: TaskDetailSheet — paired event pill + lock + "Cancel in Cal.com"

**Files:**
- Modify: `src/app/(dashboard)/tasks/task-detail-sheet.tsx`

- [ ] **Step 1: Look up the paired event for the open task**

At the top of the `TaskDetailSheet` component (just below `const { data: clients = [] } = useClients()`), add:

```ts
const { data: events = [] } = useEvents()
const pairedEvent = task ? events.find((e) => e.task_id === task.id) ?? null : null
```

Add the import at the top of the file:

```ts
import { useEvents } from "@/hooks/use-events"
```

- [ ] **Step 2: Show an "Event" pill at the top of the sheet body**

Just after the `<SheetHeader>` block, before the existing `<Field label="Title">`, add:

```tsx
{pairedEvent && (
  <div className="mx-4 mt-2 flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-xs">
    <span className="font-semibold text-primary">Event</span>
    <span className="text-muted-foreground">
      {new Date(pairedEvent.start_at).toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}
      {pairedEvent.end_at &&
        ` – ${new Date(pairedEvent.end_at).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })}`}
    </span>
    {pairedEvent.cal_booking_id && (
      <span className="ml-auto rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
        From Cal.com
      </span>
    )}
  </div>
)}
```

- [ ] **Step 3: Disable `due_date` / `due_time` inputs when paired**

Find the inputs for `due_date` and `due_time` in the file (search for `due_date` and `due_time`). Add `disabled={pairedEvent !== null}` to each:

```tsx
<Input
  type="date"
  defaultValue={task.due_date ?? ""}
  disabled={pairedEvent !== null}
  /* ... */
/>
```

Above each disabled input, when paired, show a small tooltip-like helper:

```tsx
{pairedEvent && (
  <p className="text-[10px] text-muted-foreground">
    Controlled by the calendar event.
  </p>
)}
```

- [ ] **Step 4: Swap delete for "Cancel in Cal.com" when applicable**

Find the existing delete button (search for `useDeleteTask` and `<Trash2`). Replace its rendering block with:

```tsx
{pairedEvent?.cal_booking_id ? (
  <a
    href={`https://app.cal.com/booking/${pairedEvent.cal_booking_id}`}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-500/20 dark:text-rose-300"
  >
    <ExternalLink className="size-3" />
    Cancel in Cal.com
  </a>
) : (
  <Button
    variant="outline"
    size="sm"
    onClick={() => {
      if (!task) return
      remove.mutate(task.id, {
        onSuccess: () => {
          toast.success("Task deleted")
          onOpenChange(false)
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to delete"),
      })
    }}
  >
    <Trash2 className="size-3" />
    Delete
  </Button>
)}
```

`ExternalLink` is already imported (it's used elsewhere in the sheet for the `link` field — verify and add if missing).

- [ ] **Step 5: Manually verify**

```bash
npm run dev
```

1. Open a task that's paired with an in-app event → "Event" pill at top, due_date/due_time disabled with helper text, normal "Delete" button.
2. Open a task paired with a Cal.com event (use the curl from Task 7 to seed one) → "From Cal.com" badge in the pill, "Cancel in Cal.com" link replacing the delete button. Click it → opens `https://app.cal.com/booking/<uid>` in a new tab.
3. Open a task with no paired event → no pill, all fields editable, normal delete.

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/tasks/task-detail-sheet.tsx
git commit -m "feat(tasks): paired-event pill + Cancel-in-Cal.com on detail sheet"
```

---

## Task 12: Tasks list — clock icon for paired tasks

**Files:**
- Modify: `src/app/(dashboard)/tasks/tasks-view.tsx`

- [ ] **Step 1: Find where each task row's title is rendered**

```bash
grep -n "task.title\|\.title" src/app/(dashboard)/tasks/tasks-view.tsx | head -20
```

You're looking for the JSX that renders a row's title text. Read the surrounding 5 lines for context.

- [ ] **Step 2: Look up events and add a clock icon**

At the top of `tasks-view.tsx`, add the import:

```ts
import { Clock } from "lucide-react"
import { useEvents } from "@/hooks/use-events"
```

In the component body (or at module top, whichever is closer to existing data fetches in the file), add:

```ts
const { data: events = [] } = useEvents()
const pairedTaskIds = React.useMemo(
  () => new Set(events.filter((e) => e.task_id).map((e) => e.task_id!)),
  [events]
)
```

Where each task title is rendered, prepend an inline icon when the task is paired:

```tsx
{pairedTaskIds.has(task.id) && (
  <Clock className="mr-1 inline size-3 align-text-bottom text-muted-foreground" aria-label="From the calendar" />
)}
{task.title}
```

- [ ] **Step 3: Manually verify**

```bash
npm run dev
```

Open `/tasks`. Confirm:
- Paired tasks (those created from a meeting/call event) show the clock icon before the title.
- Unpaired tasks don't.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/tasks/tasks-view.tsx
git commit -m "feat(tasks): clock icon marks tasks paired with a calendar event"
```

---

## Task 13: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the dev server and walk through every spec requirement**

```bash
npm run dev
```

Open `/calendar` and `/tasks` side-by-side in two browser tabs.

- [ ] **Step 2: Verify each scenario**

For each row below, perform the action and verify the expected result:

| Scenario | Action | Expected |
|---|---|---|
| In-app event creation auto-pairs | `/calendar` → "New event" → save with type=meeting | `/tasks` shows a matching task (clock icon, right time) |
| Calendar click → task sheet | `/calendar` → click the new block | Task detail sheet opens inline |
| Drag mirrors time | Drag the block to a new slot | Task's due_date/due_time updates after page refresh |
| Title mirrors | Edit the event title via add-event dialog (or repeat-create) | Task title updates |
| In-app delete cascades | `/calendar` → delete the event (via detail UI, or task detail with delete) | Both event and task gone |
| Paired task deletion detaches | `/tasks` → delete a paired task | Task gone; event stays with `task_id = null` (check Supabase MCP or localStorage) |
| `isoDay` fix | Create an event at 23:30 local | Shows on today, not tomorrow |
| Cal-origin block locks | Seed a Cal-origin event via curl from Task 7 Step 5 | Drag does nothing; lock icon visible; click opens task sheet |
| "Cancel in Cal.com" button | Open the paired task for a Cal-origin event | Cancel-in-Cal.com link replaces delete; opens correct URL |
| `BOOKING_CANCELLED` detaches | curl a BOOKING_CANCELLED for an existing UID | Event disappears; task remains in `/tasks` |
| Non-meeting events stay unpaired | Create an event with type=deadline | No task is created; clicking the block still routes to old destination |

- [ ] **Step 3: Sweep for stray debug output**

```bash
grep -rn "console.log\|TODO\|XXX\|FIXME" src/app/(dashboard)/calendar src/app/(dashboard)/tasks src/app/api/webhooks src/lib/data-store.ts src/lib/supabase-backend.ts
```

Remove anything you added during implementation.

- [ ] **Step 4: Final build check**

```bash
npm run build && npm run lint
```

Expected: both clean.

- [ ] **Step 5: If anything is dirty, commit the cleanup**

```bash
git status
# If anything is uncommitted from earlier tasks:
git add <files>
git commit -m "chore: tidy up debug output and unused imports"
```

---

## What this plan does NOT cover (out of scope, per the spec)

- Per-user Cal.com API keys / OAuth (deferred — see `feedback-calendar-seamless-with-cal` memory).
- Two-way Cal.com sync (in-app edits pushing to Cal.com).
- A "Reschedule in Cal.com" button (only "Cancel" for now).
- Recurring events.
- Unit-test infrastructure setup (the project has none; per CLAUDE.md, UI changes are verified in a browser).
