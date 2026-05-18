-- Multi-assignee tasks + optional reference URL.
--
-- Two changes:
--   1. Drop the single-assignee column and its index, replace with an array
--      column of profile UUIDs so a task can be co-owned by several people
--      on the team. Mirrors the TypeScript change Task.assignee_id →
--      Task.assignee_ids[]. The localStorage backend heals legacy rows on
--      read; SQL has no legacy rows to heal because this migration runs on
--      a fresh tasks table where assignee_id has only ever been NULL.
--
--   2. Add an optional `link` field for attaching a reference URL (Notion
--      page, GDoc, Linear ticket, anything the task points at). Stored
--      verbatim, the input layer validates format.

alter table public.tasks drop column if exists assignee_id;
drop index if exists tasks_assignee_idx;

alter table public.tasks
  add column if not exists assignee_ids uuid[] not null default '{}'::uuid[];

alter table public.tasks
  add column if not exists link text;

-- GIN index over the array so `where ? = any(assignee_ids)` and the
-- containment operator (`assignee_ids @> array[uuid]`) stay fast as the
-- task volume grows.
create index if not exists tasks_assignee_ids_idx
  on public.tasks using gin (assignee_ids);
