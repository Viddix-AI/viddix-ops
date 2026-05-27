-- Tags + task ↔ tag many-to-many.
--
-- Tags ship task-scoped first because that's the feature shipping with this
-- migration, but the `tags` table itself is intentionally entity-agnostic so
-- adding lead_tags / client_tags later doesn't require a second tags table.
--
-- `color` is a Pill tone key (slate/blue/sky/indigo/violet/emerald/amber/rose)
-- — we keep it as plain text rather than a Postgres enum so the design
-- system can rename tones without a migration.

create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text not null default 'slate',
  created_at timestamptz not null default now(),
  unique (name)
);

create table if not exists public.task_tags (
  task_id  uuid not null references public.tasks(id) on delete cascade,
  tag_id   uuid not null references public.tags(id)  on delete cascade,
  primary key (task_id, tag_id)
);

create index if not exists task_tags_tag_idx on public.task_tags(tag_id);

alter table public.tags      enable row level security;
alter table public.task_tags enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tags','task_tags']
  loop
    execute format('drop policy if exists "team read"  on public.%I', t);
    execute format('drop policy if exists "team write" on public.%I', t);
    execute format(
      'create policy "team read"  on public.%I for select to authenticated using (true)', t);
    execute format(
      'create policy "team write" on public.%I for all    to authenticated using (true) with check (true)', t);
  end loop;
end $$;
