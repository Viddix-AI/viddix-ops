-- Contract dates on clients.
--
-- `started_at` already exists (from 001_init.sql) and represents the first
-- engagement date. The new columns capture the formal contract window and the
-- next renewal/review milestone:
--   contract_start_date  — when the current contract took effect
--   contract_end_date    — when it expires (informational; renewal is the trigger)
--   renewal_date         — the next renewal/review checkpoint, surfaced on the
--                          dashboard as "Upcoming renewals" within a 60-day window
--
-- All three are nullable so existing rows keep working and the data-store
-- healer can default them to null without forcing a v-bump.

alter table public.clients
  add column if not exists contract_start_date date,
  add column if not exists contract_end_date   date,
  add column if not exists renewal_date        date;

-- Renewals widget reads `renewal_date between today and today + 60d`.
create index if not exists clients_renewal_idx
  on public.clients(renewal_date)
  where renewal_date is not null;

create index if not exists clients_contract_end_idx
  on public.clients(contract_end_date)
  where contract_end_date is not null;
