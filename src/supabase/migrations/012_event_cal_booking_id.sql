-- Idempotency key for events that originate from a Cal.com booking. The
-- webhook handler upserts on this column so Cal.com's retries don't create
-- duplicates. Internal events (created from the dialog) leave it null.
--
-- The unique constraint applies only to non-null values in Postgres, which
-- is exactly what we want.

alter table public.events
  add column if not exists cal_booking_id text unique;

create index if not exists events_cal_booking_idx
  on public.events(cal_booking_id)
  where cal_booking_id is not null;
