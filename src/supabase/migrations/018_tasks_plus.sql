-- Tasks Plus — subtasks, recurrence, time tracking.
--
-- Three orthogonal capabilities bundled into one migration because the UI
-- ships them together:
--   1. Subtasks  — self-reference on tasks(parent_id). Cascade-delete so a
--      parent removal also cleans its children.
--   2. Recurrence — enum + dates for daily / weekly / monthly / yearly
--      schedules. The "next instance" is generated when the previous one is
--      marked done, NOT via a cron job — see updateTask() in both backends.
--      Tasks paired with Cal.com events MUST keep recurrence='none' since
--      Cal.com itself owns recurrence for those.
--   3. Time tracking — estimate_minutes (target) + tracked_minutes
--      (running total) + task_time_entries (each timer session). The unique
--      partial index on task_time_entries enforces at most one OPEN entry
--      per user.

-- ── Subtasks ────────────────────────────────────────────────────────────────
alter table public.tasks
  add column if not exists parent_id uuid
    references public.tasks(id) on delete cascade;

create index if not exists tasks_parent_idx on public.tasks(parent_id);

-- ── Recurrence ──────────────────────────────────────────────────────────────
do $$ begin
  create type task_recurrence as enum (
    'none','daily','weekly','monthly','yearly'
  );
exception when duplicate_object then null; end $$;

alter table public.tasks
  add column if not exists recurrence task_recurrence not null default 'none',
  add column if not exists recurrence_until date,
  -- When a recurring task generates its next instance, the new row points
  -- back to the original via recurrence_parent_id. NULL on non-recurring
  -- tasks AND on the template (the first task in the chain).
  add column if not exists recurrence_parent_id uuid
    references public.tasks(id) on delete set null;

-- ── Estimation + tracking ───────────────────────────────────────────────────
alter table public.tasks
  add column if not exists estimate_minutes integer
    check (estimate_minutes is null or estimate_minutes >= 0),
  add column if not exists tracked_minutes integer not null default 0
    check (tracked_minutes >= 0);

-- ── task_time_entries ───────────────────────────────────────────────────────
create table if not exists public.task_time_entries (
  id               uuid primary key default gen_random_uuid(),
  task_id          uuid not null references public.tasks(id) on delete cascade,
  user_id          uuid references public.profiles(id) on delete set null,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds integer
    check (duration_seconds is null or duration_seconds >= 0),
  note             text,
  created_at       timestamptz not null default now()
);

create index if not exists time_entries_task_idx on public.task_time_entries(task_id);
create index if not exists time_entries_user_idx on public.task_time_entries(user_id);

-- A user can only have ONE open timer at a time. Without this, the user
-- starts five timers across five tasks and nothing ever closes cleanly.
create unique index if not exists time_entries_open_per_user
  on public.task_time_entries(user_id) where ended_at is null;

alter table public.task_time_entries enable row level security;

do $$ begin
  drop policy if exists "team read"  on public.task_time_entries;
  drop policy if exists "team write" on public.task_time_entries;
  create policy "team read"  on public.task_time_entries
    for select to authenticated using (true);
  create policy "team write" on public.task_time_entries
    for all    to authenticated using (true) with check (true);
end $$;
