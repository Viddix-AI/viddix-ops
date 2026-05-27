-- Multi-contact per client.
--
-- The existing `clients.contact_name / contact_email / contact_phone` columns
-- stay in place as a denormalised shortcut to the *primary* contact so the
-- rest of the app (CSV import/export, lead conversion, command palette) keeps
-- working unchanged. The new `public.contacts` table is the source of truth
-- for multi-contact workflows; the legacy columns are read-only mirrors.
--
-- Idempotency:
--   - `contact_role` enum guarded by duplicate_object handler.
--   - `contacts` table + indexes + RLS policies use `if not exists` / `drop +
--     create` patterns so a second run is a no-op.
--   - The backfill only inserts a primary contact when no row already exists
--     for the client (`not exists` subquery).

do $$ begin
  create type contact_role as enum (
    'primary','champion','decision_maker','influencer','blocker','other'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  full_name   text not null,
  email       text,
  phone       text,
  role        contact_role not null default 'other',
  title       text,
  is_primary  boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists contacts_client_idx on public.contacts(client_id);
create index if not exists contacts_email_idx  on public.contacts(email);

-- At most one primary contact per client. Partial unique index lets the rest
-- of the contacts coexist freely while still enforcing the invariant.
create unique index if not exists contacts_one_primary_per_client
  on public.contacts(client_id) where is_primary;

drop trigger if exists trg_contacts_updated on public.contacts;
create trigger trg_contacts_updated before update on public.contacts
  for each row execute function public.set_updated_at();

-- Backfill: materialise every existing `clients.contact_name` as a primary
-- contact row. Idempotent — skips clients that already have any contact.
insert into public.contacts (client_id, full_name, email, phone, role, is_primary)
select
  c.id,
  coalesce(nullif(c.contact_name, ''), c.name),
  c.contact_email,
  c.contact_phone,
  'primary'::contact_role,
  true
from public.clients c
where c.contact_name is not null
  and not exists (
    select 1 from public.contacts ct where ct.client_id = c.id
  );

alter table public.contacts enable row level security;

do $$ begin
  drop policy if exists "team read"  on public.contacts;
  drop policy if exists "team write" on public.contacts;
  create policy "team read"  on public.contacts
    for select to authenticated using (true);
  create policy "team write" on public.contacts
    for all    to authenticated using (true) with check (true);
end $$;
