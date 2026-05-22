# Calendar: meeting↔task auto-pair + calendar UX fixes

**Status:** design approved, not yet implemented
**Owner:** psanz
**Date:** 2026-05-22

## Background

Two bugs and one feature request, surfaced together because they share the same code path:

1. **Timezone bug.** Events booked for a Friday evening (Cal.com or in-app) sometimes appear on Saturday in the month/agenda views. Root cause: `src/app/(dashboard)/calendar/calendar-view.tsx:82-84` defines a local `isoDay` using `d.toISOString().slice(0, 10)`, which buckets by UTC day. A correct local-time `isoDay` already exists in `src/lib/time-grid-math.ts:66`; the calendar view is using the wrong one.
2. **Wrong click target.** Clicking an event block in the calendar navigates to `/clients/:id` or `/leads` (the pipeline). The user expects the meeting to open as a task, since meetings are work-to-do, not pipeline rows.
3. **"Every meeting should be a task."** Today, events (calendar rows) and tasks (workflow rows) are unrelated tables. Meetings should also appear in the task workflow.

## Decisions

- **Auto-pair** events with tasks via a new `events.task_id` FK. Event is the schedule, task is the workflow shadow.
- **Auto-pair scope:** `event_type IN ('meeting', 'call')`. `deadline` and `internal` events remain task-less.
- **Backfill** every existing meeting/call event with a paired task in the migration.
- **Click target:** calendar block click opens the existing task detail sheet inline (no navigation).
- **Cal.com sync:** **webhook-only for now.** In-app edits do not push back to Cal.com. The "two-way sync" feedback (see memory `feedback-calendar-seamless-with-cal`) is deliberately deferred — it requires per-user Cal.com API keys and we don't want that surface area yet.
- **Delete behavior:**
  - In-app event (no `cal_booking_id`): cascade — deleting the event deletes the paired task.
  - Cal.com-origin event (`cal_booking_id IS NOT NULL`): delete is blocked. Detail sheet shows a "Cancel in Cal.com" link instead. Reason: webhook-only, so a local delete doesn't propagate; the customer still has the booking, and the next Cal.com webhook would re-create the row anyway.
  - Paired task deleted from `/tasks`: just clears the FK (`events.task_id = null`); event survives.
- **Mirror direction:** event → task only. Tasks paired with events have their `due_date` / `due_time` / `title` inputs disabled — schedule changes belong to the calendar (and Cal.com-origin events have their schedule controlled by Cal.com).

## Data model

New nullable column:

```sql
ALTER TABLE events
  ADD COLUMN task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;
```

`ON DELETE SET NULL` ensures Cal.com-origin events survive a paired-task deletion.

Type addition in `src/lib/types.ts`:

```ts
export type Event = {
  // ...existing fields...
  task_id: string | null
}
```

### Backfill (in the same migration)

Use a plpgsql `DO` block that iterates row-by-row so each new task is paired back unambiguously by id (not by content match). The CTE-with-rejoin approach is rejected because two events with the same title and timestamp would misjoin.

```sql
DO $$
DECLARE
  e RECORD;
  new_task_id uuid;
BEGIN
  FOR e IN
    SELECT id, title, event_type, start_at, client_id, lead_id
    FROM events
    WHERE event_type IN ('meeting','call') AND task_id IS NULL
  LOOP
    INSERT INTO tasks (title, due_date, due_time, status, priority, client_id, lead_id)
    VALUES (
      COALESCE(NULLIF(e.title, ''), INITCAP(e.event_type::text)),
      (e.start_at AT TIME ZONE 'Europe/Madrid')::date,
      to_char((e.start_at AT TIME ZONE 'Europe/Madrid'), 'HH24:MI'),
      'todo',
      'medium',
      e.client_id,
      e.lead_id
    )
    RETURNING id INTO new_task_id;

    UPDATE events SET task_id = new_task_id WHERE id = e.id;
  END LOOP;
END $$;
```

Idempotent (gated on `task_id IS NULL`). Timezone hardcoded to `Europe/Madrid` for the backfill — the production runtime will use the local-time helpers in JS, not this constant.

## Sync rules

| Trigger | Effect on paired task |
|---|---|
| Create event in-app, type ∈ (meeting, call) | Create task; set `events.task_id` |
| Create event in-app, other types | No task |
| Update event title / time (in-app) | Mirror to task title / `due_date` / `due_time` |
| Webhook `BOOKING_CREATED` | Upsert event + create task if not paired |
| Webhook `BOOKING_RESCHEDULED` | Update event start/end + mirror to task |
| Webhook `BOOKING_CANCELLED` | Detach task, then delete event |
| Delete in-app event (no `cal_booking_id`) | Cascade: delete linked task |
| Delete in-app event (with `cal_booking_id`) | Blocked — UI shows "Cancel in Cal.com" link |
| Delete paired task from `/tasks` | FK clears `events.task_id`; event survives |
| Mark task `done` | No effect on event |

Atomicity: the Supabase JS client doesn't expose multi-statement transactions. We accept best-effort sequencing in JS; orphan tasks (no event references them) are detectable with a periodic query and the user has approved this trade-off over an `rpc()` function.

## UI changes

### `src/app/(dashboard)/calendar/calendar-view.tsx`

- Delete the local `isoDay` (lines 82-84). Import the local-time `isoDay` from `src/lib/time-grid-math.ts`. **This fixes the Friday→Saturday bug.**
- `ItemRow`: stop wrapping in `<Link href={item.href}>`. Replace with a button that opens the task detail sheet for `event.task_id`. Fallback to old link behavior only for unpaired events.
- Wire a `<TaskDetailSheet>` at the page level, controlled by `selectedTaskId` state.

### `src/app/(dashboard)/calendar/time-grid.tsx`

- Wire the existing `onSelectItem` callback: clicking a block opens the detail sheet for the paired task (event blocks) or directly for task blocks.
- Disable drag/resize on events with `cal_booking_id IS NOT NULL`. Show a small lock icon on those blocks. Reason: we can't push the change to Cal.com under webhook-only mode, and the next webhook would clobber the local edit anyway.

### `src/app/(dashboard)/calendar/add-event-dialog.tsx`

- After successful event create where `event_type IN ('meeting','call')`, the data-store layer auto-creates the paired task (no client-side coordination — see §"Data-store layer").

### `src/app/(dashboard)/tasks/task-detail-sheet.tsx`

- Look up paired event by reverse query (`events.task_id = thisTaskId`).
- If paired:
  - Show an "Event" pill with the time range. Add a "From Cal.com" badge when `cal_booking_id` is set.
  - Disable `due_date` and `due_time` inputs (tooltip: "Controlled by the calendar event").
  - If `cal_booking_id` is set: replace the in-app delete button with a **"Cancel in Cal.com"** button linking to `https://app.cal.com/booking/{cal_booking_id}` (new tab).
  - If no `cal_booking_id`: in-app delete behaves normally and cascades to the event.

### `src/app/(dashboard)/tasks/tasks-view.tsx`

- For task rows with a paired event, show a tiny clock icon next to the title. No other behavior change.

## Data-store layer (`src/lib/data-store.ts`)

New private helper `buildTaskFromEvent(event)` constructs a task insert from an event (timezone-safe due_date / due_time extraction from `start_at`).

- `createEvent`: if `event_type IN ('meeting','call')`, insert task first, then insert event with `task_id` set.
- `updateEvent`: after the event update, if `task_id` is set AND the patch touches `title` / `start_at`, write a mirror patch to the task.
- `deleteEvent`: load the row first; if `cal_booking_id IS NOT NULL`, throw a typed `EventBlockedByCalCom` error. Otherwise delete the event (`ON DELETE SET NULL` clears `events.task_id` on the row that's about to vanish — moot — then explicitly delete the task by id after).
- `deleteTask`: just delete the task; FK clears `events.task_id` automatically.

## Webhook handler (`src/app/api/webhooks/cal/route.ts`)

- `BOOKING_CREATED` / `BOOKING_RESCHEDULED`: existing upsert, then "if task_id null, create paired task; otherwise mirror title/time to task".
- `BOOKING_CANCELLED`: clear `events.task_id` (so the task survives any user notes), then delete the event. **The webhook bypasses the `deleteEvent` guard** — it performs the row delete directly against Supabase. The guard exists to protect against *user* deletes, not authoritative Cal.com cancellations.
- **Remove** the diagnostic `console.log` at lines 59-62 from commit `c2640b0` once the auto-pair lands and we've confirmed the trigger names work.

## Error handling

- `deleteEvent` on Cal.com-origin row throws → UI catches → toast: *"Cancel this booking in Cal.com — we can't delete it from here."* The detail sheet swaps the button unconditionally so the throw is a defensive guard.
- Webhook task-insert / mirror failures: log loudly, return 200, do not fail the booking ack. The next webhook re-attempts the pairing because of the "if task_id null, pair now" path.
- Event → task mirror failures during in-app updates: log and continue. Never fail a user operation because the shadow couldn't be updated.

## Edge cases

- **Event with no client and no lead:** paired task gets `null` for both. Already supported by `tasks` schema.
- **Event near local midnight:** `due_date` / `due_time` extraction must use local time, not UTC. Same root cause as the `isoDay` bug.
- **Cal.com attendee email matches both a lead and a client:** existing webhook precedence (client wins) is unchanged.
- **Backfill on event with empty title:** fallback to `event_type` capitalized ("Meeting", "Call").

## Testing

### Unit (Vitest)

- `buildTaskFromEvent`: title fallback, client/lead pass-through, local-time `due_date` / `due_time` extraction across DST boundaries.
- Grep guard: a test that fails if `toISOString().slice(0, 10)` appears anywhere under `src/app/(dashboard)/calendar/`. Prevents the duplicate-`isoDay` bug from coming back.

### Integration (data-store, dev Supabase)

- Create in-app meeting → both rows exist and are linked, with mirrored title/time.
- Update event title/time → task `title` / `due_date` / `due_time` updated.
- Delete in-app event → both rows gone.
- Delete Cal.com-origin event → throws; both rows survive.
- Delete paired task from `/tasks` → task gone, event survives with `task_id = null`.
- Webhook `BOOKING_CANCELLED` → event gone, task survives with no `task_id` back-reference.

### Manual (required before claiming done)

- `npm run dev`. Book via Cal.com staging → row appears with the correct **local** time and a paired task on `/tasks`.
- Click a calendar block → task detail sheet slides in.
- Try to delete a Cal.com-origin event → blocked; "Cancel in Cal.com" link present and opens the right URL.
- Create an in-app meeting → appears on `/calendar` and `/tasks`.
- Drag a Cal.com-origin block → blocked (lock icon visible).
- Drag an in-app event block → moves; task `due_date` / `due_time` updates.

## Out of scope

- Per-user Cal.com API keys / OAuth (deferred per user decision; see `feedback-calendar-seamless-with-cal` memory for the longer-term direction).
- Two-way sync (in-app edits pushing to Cal.com).
- A "Reschedule in Cal.com" button on the detail sheet (only "Cancel" for now).
- Recurring events / multi-attendee task duplication.
- The `WhatsApp Image 2026-05-17 at 8.58.14 PM.jpeg` sitting in the working tree (unrelated).
