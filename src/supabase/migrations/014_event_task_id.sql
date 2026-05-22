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
    -- start_at is stored as UTC. AT TIME ZONE 'Europe/Madrid' converts to
    -- local wall-clock for this team — fine for a one-off backfill. The
    -- runtime uses JS local time via Date.getFullYear/etc.
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
