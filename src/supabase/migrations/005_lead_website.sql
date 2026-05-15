-- Viddix Ops — add website on leads.
-- Already exists on clients (`clients.website`). Carries over on
-- convertLeadToClient so a signed lead doesn't lose the URL.

alter table public.leads
  add column if not exists website text;
