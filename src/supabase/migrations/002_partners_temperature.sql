-- Viddix Ops — partners + lead temperature + lead.converted_client_id
-- Adds revenue-split partners (with per-client overrides) and a hot/warm/cold
-- classifier on leads. Also tracks the resulting client when a lead is
-- converted so we can prevent duplicate conversions.

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  create type lead_temperature as enum ('hot','warm','cold');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- leads — add temperature + back-pointer to converted client
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.leads
  add column if not exists temperature lead_temperature not null default 'warm';

create index if not exists leads_temperature_idx on public.leads(temperature);

alter table public.leads
  add column if not exists converted_client_id uuid
    references public.clients(id) on delete set null;

create index if not exists leads_converted_client_idx
  on public.leads(converted_client_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- partners — agency partners with revenue splits
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.partners (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  email             text,
  role              text,
  default_split_pct numeric(5,2) not null default 0
    check (default_split_pct between 0 and 100),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists trg_partners_updated on public.partners;
create trigger trg_partners_updated before update on public.partners
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- client_partners — per-client split overrides (many-to-many)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.client_partners (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id)  on delete cascade,
  partner_id  uuid not null references public.partners(id) on delete cascade,
  split_pct   numeric(5,2) not null default 0
    check (split_pct between 0 and 100),
  created_at  timestamptz not null default now(),
  unique (client_id, partner_id)
);

create index if not exists client_partners_client_idx  on public.client_partners(client_id);
create index if not exists client_partners_partner_idx on public.client_partners(partner_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — same "team read/write" policy as the rest of the schema
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.partners        enable row level security;
alter table public.client_partners enable row level security;

do $$
declare t text;
begin
  foreach t in array array['partners','client_partners']
  loop
    execute format('drop policy if exists "team read"  on public.%I', t);
    execute format('drop policy if exists "team write" on public.%I', t);
    execute format(
      'create policy "team read"  on public.%I for select to authenticated using (true)', t);
    execute format(
      'create policy "team write" on public.%I for all    to authenticated using (true) with check (true)', t);
  end loop;
end $$;
