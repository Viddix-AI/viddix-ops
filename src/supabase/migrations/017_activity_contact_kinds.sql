-- Extend activities.kind CHECK to cover contact lifecycle events. Emitted by
-- supabase-backend.createContact / updateContact / deleteContact /
-- setPrimaryContact. Drop + recreate is the only way to extend the whitelist
-- declared in 008_activities.sql; this pattern matches 013_activity_event_updated.

alter table public.activities drop constraint if exists activities_kind_check;

alter table public.activities
  add constraint activities_kind_check check (kind in (
    'lead_created','lead_updated','lead_deleted','lead_converted','lead_moved',
    'client_created','client_updated','client_deleted',
    'task_created','task_updated','task_deleted',
    'partner_created','partner_updated','partner_deleted',
    'partner_attached','partner_detached',
    'note_created','event_created','event_updated','demo_reset',
    'contact_created','contact_updated','contact_deleted','contact_set_primary'
  ));
