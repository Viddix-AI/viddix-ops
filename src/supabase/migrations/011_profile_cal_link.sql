-- Each Pablo can paste their personal Cal.com booking URL here. The lead /
-- client detail sheets read this column to expose a "Send booking link"
-- action that copies the link to the clipboard.
--
-- Validation is done client-side at write time (must start with https://cal.com
-- or https://app.cal.com). No CHECK constraint — keeps room for self-hosted
-- Cal instances later.

alter table public.profiles
  add column if not exists cal_link text;
