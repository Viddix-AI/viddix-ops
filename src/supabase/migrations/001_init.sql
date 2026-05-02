-- Viddix Ops — initial schema
-- Internal CRM for a 3-person AI agency.
-- Convention: every table has id (uuid pk), created_at, updated_at where mutable.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  create type lead_stage as enum (
    'new','contacted','qualified','proposal','negotiation','won','lost'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type client_status as enum ('active','paused','churned','prospect');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('todo','in_progress','done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('low','medium','high','urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type event_type as enum ('call','meeting','deadline','internal');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- profiles — one row per auth.users entry
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null unique,
  avatar_url  text,
  role        text not null default 'member',
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- clients
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_name  text,
  contact_email text,
  contact_phone text,
  mrr           numeric(12,2) not null default 0,
  status        client_status not null default 'active',
  industry      text,
  website       text,
  notes         text,
  started_at    date,
  owner_id      uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists clients_status_idx on public.clients(status);
create index if not exists clients_owner_idx  on public.clients(owner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- leads — kanban pipeline
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  company     text,
  email       text,
  phone       text,
  source      text,
  stage       lead_stage not null default 'new',
  value       numeric(12,2) not null default 0,
  position    integer not null default 0,
  owner_id    uuid references public.profiles(id) on delete set null,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists leads_stage_position_idx on public.leads(stage, position);

-- ─────────────────────────────────────────────────────────────────────────────
-- tasks
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  due_date    date,
  priority    task_priority not null default 'medium',
  status      task_status not null default 'todo',
  assignee_id uuid references public.profiles(id) on delete set null,
  client_id   uuid references public.clients(id)  on delete set null,
  lead_id     uuid references public.leads(id)    on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists tasks_due_idx       on public.tasks(due_date);
create index if not exists tasks_assignee_idx  on public.tasks(assignee_id);
create index if not exists tasks_status_idx    on public.tasks(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- events — calendar
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  start_at    timestamptz not null,
  end_at      timestamptz,
  event_type  event_type not null default 'meeting',
  client_id   uuid references public.clients(id) on delete set null,
  lead_id     uuid references public.leads(id)   on delete set null,
  attendees   uuid[] not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists events_start_idx on public.events(start_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- notes — polymorphic (client_id OR lead_id)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  content     text not null,
  client_id   uuid references public.clients(id) on delete cascade,
  lead_id     uuid references public.leads(id)   on delete cascade,
  author_id   uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (client_id is not null or lead_id is not null)
);

create index if not exists notes_client_idx on public.notes(client_id);
create index if not exists notes_lead_idx   on public.notes(lead_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_clients_updated on public.clients;
create trigger trg_clients_updated before update on public.clients
  for each row execute function public.set_updated_at();

drop trigger if exists trg_leads_updated on public.leads;
create trigger trg_leads_updated before update on public.leads
  for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_updated on public.tasks;
create trigger trg_tasks_updated before update on public.tasks
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- handle_new_user — auto-insert profile when a user signs up
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security — every authenticated user (the 3 Pablos) sees everything.
-- Anon gets nothing.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.clients  enable row level security;
alter table public.leads    enable row level security;
alter table public.tasks    enable row level security;
alter table public.events   enable row level security;
alter table public.notes    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['profiles','clients','leads','tasks','events','notes']
  loop
    execute format('drop policy if exists "team read" on public.%I', t);
    execute format('drop policy if exists "team write" on public.%I', t);
    execute format(
      'create policy "team read"  on public.%I for select to authenticated using (true)', t);
    execute format(
      'create policy "team write" on public.%I for all    to authenticated using (true) with check (true)', t);
  end loop;
end $$;
