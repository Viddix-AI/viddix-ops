-- Viddix Ops — drop client.status entirely.
-- Every row in /clients is, by definition, a client. The "prospect" overlap
-- with the leads pipeline caused real confusion (dashboard MRR was filtering
-- on status='active' and silently excluding prospects), so we're removing
-- the concept rather than papering over it.

drop index if exists clients_status_idx;

alter table public.clients
  drop column if exists status;

drop type if exists client_status;
