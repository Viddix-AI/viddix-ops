-- Viddix Ops — server-side activities feed.
--
-- Previously the activity log lived in localStorage so it was per-browser and
-- never shared between the team. Now lives in Postgres with the same RLS
-- as the rest of the tables: every authenticated user sees everything.
--
-- `kind` stays as plain text (no Postgres enum) so the TS ActivityKind union
-- can evolve without a migration every time. The CHECK keeps a sanity gate.

create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in (
    'lead_created','lead_updated','lead_deleted','lead_converted','lead_moved',
    'client_created','client_updated','client_deleted',
    'task_created','task_updated','task_deleted',
    'partner_created','partner_updated','partner_deleted',
    'partner_attached','partner_detached',
    'note_created','event_created','demo_reset'
  )),
  message     text not null,
  lead_id     uuid references public.leads(id)    on delete set null,
  client_id   uuid references public.clients(id)  on delete set null,
  partner_id  uuid references public.partners(id) on delete set null,
  task_id     uuid references public.tasks(id)    on delete set null,
  actor_id    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Feed is read latest-first; this index supports `order by created_at desc
-- limit N` without a sort.
create index if not exists activities_created_idx
  on public.activities (created_at desc);

create index if not exists activities_actor_idx
  on public.activities (actor_id);

create index if not exists activities_kind_idx
  on public.activities (kind);

-- RLS: same team-wide read/write policy as the rest of the schema.
alter table public.activities enable row level security;

drop policy if exists "team read"  on public.activities;
drop policy if exists "team write" on public.activities;

create policy "team read"  on public.activities
  for select to authenticated using (true);

create policy "team write" on public.activities
  for all    to authenticated using (true) with check (true);
