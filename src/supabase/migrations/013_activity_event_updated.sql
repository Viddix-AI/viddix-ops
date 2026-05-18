-- Add 'event_updated' to the activities.kind CHECK constraint. Emitted by
-- updateEvent() now that the calendar supports drag-to-move and resize.
--
-- Migrations are immutable, so drop + recreate is the only way to extend the
-- whitelist defined in 008_activities.sql.

alter table public.activities drop constraint if exists activities_kind_check;

alter table public.activities
  add constraint activities_kind_check check (kind in (
    'lead_created','lead_updated','lead_deleted','lead_converted','lead_moved',
    'client_created','client_updated','client_deleted',
    'task_created','task_updated','task_deleted',
    'partner_created','partner_updated','partner_deleted',
    'partner_attached','partner_detached',
    'note_created','event_created','event_updated','demo_reset'
  ));
