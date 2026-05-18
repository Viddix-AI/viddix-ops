-- Optional due_time on tasks. due_date stays as the canonical "what day".
-- When due_time is set, the task gets positioned in the calendar's hour grid;
-- when it's null, the task lives in the all-day lane.
--
-- Stored as plain `time` (no zone). The UI inputs HH:MM and combines with
-- due_date at render time. Tasks without a due_date can't have a time —
-- nothing to anchor it to — but we don't enforce that here; the UI guards.

alter table public.tasks
  add column if not exists due_time time;
