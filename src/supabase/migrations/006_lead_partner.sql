-- Viddix Ops — single-partner attachment on leads.
-- A lead can be pre-allocated to one partner with a split_pct so revenue is
-- already decided when the deal closes. On lead conversion, the (partner_id,
-- partner_split_pct) pair is upserted into client_partners and these columns
-- can be ignored afterwards (they're a "staging area").

alter table public.leads
  add column if not exists partner_id uuid
    references public.partners(id) on delete set null;

alter table public.leads
  add column if not exists partner_split_pct numeric(5,2) not null default 0
    check (partner_split_pct between 0 and 100);

create index if not exists leads_partner_idx on public.leads(partner_id);
