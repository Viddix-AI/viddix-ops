-- Extend activities.kind CHECK with Tasks Plus events (migration 018):
--   task_subtask_added         — a child task was attached to a parent
--   task_timer_started         — a time entry was opened
--   task_timer_stopped         — a time entry was closed + tracked_minutes incremented
--   task_recurrence_generated  — completing a recurring task created the next instance
--
-- Drop + recreate is the only way to extend the whitelist defined in
-- 008_activities.sql; this matches the pattern of 013 and 017.

alter table public.activities drop constraint if exists activities_kind_check;

alter table public.activities
  add constraint activities_kind_check check (kind in (
    'lead_created','lead_updated','lead_deleted','lead_converted','lead_moved',
    'client_created','client_updated','client_deleted',
    'task_created','task_updated','task_deleted',
    'partner_created','partner_updated','partner_deleted',
    'partner_attached','partner_detached',
    'note_created','event_created','event_updated','demo_reset',
    'contact_created','contact_updated','contact_deleted','contact_set_primary',
    'task_subtask_added','task_timer_started','task_timer_stopped',
    'task_recurrence_generated'
  ));
