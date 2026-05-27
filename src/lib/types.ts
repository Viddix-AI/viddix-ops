// Database typing — kept in sync with src/supabase/migrations/001_init.sql
// onwards. Recent additions: 015 (client contract/renewal dates), 016
// (multi-contact per client), 017 (contact activity kinds), 018 (tasks plus:
// subtasks/recurrence/time tracking), 019 (task-plus activity kinds), 020
// (tags + task_tags many-to-many).
export type LeadStage =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost"

export type TaskStatus = "todo" | "in_progress" | "done"
export type TaskPriority = "low" | "medium" | "high" | "urgent"
export type TaskRecurrence =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
export type EventType = "call" | "meeting" | "deadline" | "internal"
export type LeadTemperature = "hot" | "warm" | "cold"

export type Profile = {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  role: string
  // Personal Cal.com booking URL. Pasted manually in /settings, then surfaced
  // as a "Send booking link" action on lead/client detail sheets.
  cal_link: string | null
  created_at: string
}

export type Client = {
  id: string
  name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  mrr: number
  industry: string | null
  website: string | null
  notes: string | null
  started_at: string | null
  // Contract window. `contract_start_date` is the formal contract start (may
  // post-date `started_at` if there was a free trial); `contract_end_date` is
  // when the current contract expires. `renewal_date` is the next renewal
  // checkpoint — surfaced on the dashboard "Upcoming renewals" widget and
  // highlighted in the clients table when within 30 days or overdue.
  contract_start_date: string | null
  contract_end_date:   string | null
  renewal_date:        string | null
  owner_id: string | null
  created_at: string
  updated_at: string
}

export type Lead = {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  website: string | null
  source: string | null
  stage: LeadStage
  temperature: LeadTemperature
  value: number
  position: number
  owner_id: string | null
  notes: string | null
  // Pre-allocation of a single partner for the deal. On convertLeadToClient
  // these become a client_partners row; afterwards they're ignored.
  partner_id: string | null
  partner_split_pct: number
  // Set when convertLeadToClient succeeds. Lets the UI prevent double
  // conversions and link back from the lead to the resulting client row.
  converted_client_id: string | null
  created_at: string
  updated_at: string
}

export type Partner = {
  id: string
  name: string
  email: string | null
  role: string | null
  default_split_pct: number
  notes: string | null
  created_at: string
  updated_at: string
}

// Many-to-many between clients and partners with a per-client split override
export type ClientPartner = {
  id: string
  client_id: string
  partner_id: string
  split_pct: number
  created_at: string
}

export type ActivityKind =
  | "lead_created"
  | "lead_updated"
  | "lead_deleted"
  | "lead_converted"
  | "lead_moved"
  | "client_created"
  | "client_updated"
  | "client_deleted"
  | "task_created"
  | "task_updated"
  | "task_deleted"
  | "partner_created"
  | "partner_updated"
  | "partner_deleted"
  | "partner_attached"
  | "partner_detached"
  | "note_created"
  | "event_created"
  | "event_updated"
  | "demo_reset"
  | "contact_created"
  | "contact_updated"
  | "contact_deleted"
  | "contact_set_primary"
  | "task_subtask_added"
  | "task_timer_started"
  | "task_timer_stopped"
  | "task_recurrence_generated"

export type Activity = {
  id: string
  kind: ActivityKind
  // Free-form description, e.g. "Aisha Kahn moved to negotiation"
  message: string
  // Optional foreign-key references for deep-linking from the feed
  lead_id: string | null
  client_id: string | null
  partner_id: string | null
  task_id: string | null
  actor_id: string | null
  created_at: string
}

export type Task = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  // Optional clock-time for the due date, "HH:MM" (24h). When set, the task
  // shows as a positioned block in the calendar hour grid; when null it lives
  // in the all-day lane. Storing date and time separately lets users keep the
  // "due someday this day" semantics that a single timestamptz would lose.
  due_time: string | null
  priority: TaskPriority
  status: TaskStatus
  // Multi-assignee: a task can be shared by several people on the team.
  // The data-store healer maps legacy single-assignee rows to a one-element
  // array on read, so existing payloads keep working without a migration.
  assignee_ids: string[]
  // Optional reference URL — Notion page, GDoc, Linear ticket, anything the
  // task points at. Saved verbatim, validation only happens at the input.
  link: string | null
  client_id: string | null
  lead_id: string | null
  // Subtasks (migration 018). When set, this task is a child of `parent_id`
  // and is hidden from the tasks-view root listing — it appears only under
  // its parent when expanded. Tasks paired with Cal.com events MUST keep
  // parent_id = null.
  parent_id: string | null
  // Recurrence (migration 018). When non-'none', completing this task spawns
  // a new copy with the next due_date and the rest of the fields cloned.
  // `recurrence_parent_id` points back at the chain's first task. Cal.com-
  // paired tasks MUST keep recurrence='none' — Cal.com owns recurrence.
  recurrence: TaskRecurrence
  recurrence_until: string | null
  recurrence_parent_id: string | null
  // Time tracking (migration 018). `tracked_minutes` is the denormalised sum
  // of task_time_entries.duration_seconds (rounded to minutes) so we don't
  // SUM on every render.
  estimate_minutes: number | null
  tracked_minutes: number
  created_at: string
  updated_at: string
}

export type TaskTimeEntry = {
  id: string
  task_id: string
  user_id: string | null
  started_at: string
  // Null while the entry is open. Closing the entry stamps `ended_at` +
  // `duration_seconds` and bumps tasks.tracked_minutes accordingly.
  ended_at: string | null
  duration_seconds: number | null
  note: string | null
  created_at: string
}

export type Event = {
  id: string
  title: string
  description: string | null
  start_at: string
  end_at: string | null
  event_type: EventType
  client_id: string | null
  lead_id: string | null
  attendees: string[]
  // Set when an event originated from a Cal.com booking. Used by the webhook
  // handler as an idempotency key so retries don't insert duplicates.
  cal_booking_id: string | null
  // Paired tasks row for meeting/call events. Auto-created by the data-store
  // and webhook handler; ON DELETE SET NULL means a task delete just detaches.
  task_id: string | null
  created_at: string
}

export type ContactRole =
  | "primary"
  | "champion"
  | "decision_maker"
  | "influencer"
  | "blocker"
  | "other"

export type Contact = {
  id: string
  client_id: string
  full_name: string
  email: string | null
  phone: string | null
  role: ContactRole
  title: string | null
  is_primary: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

// Tags + task_tags (migration 020). The `tags` table is entity-agnostic so
// future lead_tags / client_tags additions can reuse it without a rename.
export type Tag = {
  id: string
  name: string
  // Pill tone key (slate / blue / sky / indigo / violet / emerald / amber / rose).
  color: string
  created_at: string
}

export type TaskTag = {
  task_id: string
  tag_id: string
}

export type Note = {
  id: string
  content: string
  client_id: string | null
  lead_id: string | null
  author_id: string | null
  created_at: string
}

type Insert<T> = Omit<T, "id" | "created_at" | "updated_at"> & {
  id?: string
  created_at?: string
  updated_at?: string
}
type Update<T> = Partial<Insert<T>>

// Supabase v2.105+ requires `Relationships` on every table descriptor. We
// don't generate join types statically — we'd rather keep the schema file
// hand-written — so this is intentionally `unknown[]`.
type Row<T, I = Insert<T>, U = Update<T>> = {
  Row: T
  Insert: I
  Update: U
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      profiles:           Row<Profile>
      clients:            Row<Client>
      contacts:           Row<Contact>
      leads:              Row<Lead>
      // tasks: the migration-018 columns (tracked_minutes, recurrence, parent_id,
      // recurrence_until, recurrence_parent_id, estimate_minutes) have DB defaults
      // or are nullable, so they're optional on Insert. Without this override the
      // strict Row<T> generic would force every call site to pass tracked_minutes: 0.
      tasks: Row<
        Task,
        Omit<Insert<Task>, "tracked_minutes" | "recurrence" | "parent_id"
          | "recurrence_until" | "recurrence_parent_id" | "estimate_minutes"> & {
          tracked_minutes?: number
          recurrence?: TaskRecurrence
          parent_id?: string | null
          recurrence_until?: string | null
          recurrence_parent_id?: string | null
          estimate_minutes?: number | null
        }
      >
      // task_time_entries: started_at has a DB default, the rest are nullable
      // closing fields populated by stopTimer.
      task_time_entries: Row<
        TaskTimeEntry,
        Omit<Insert<TaskTimeEntry>, "started_at" | "ended_at" | "duration_seconds" | "note"> & {
          started_at?: string
          ended_at?: string | null
          duration_seconds?: number | null
          note?: string | null
        }
      >
      events:             Row<Event>
      notes:              Row<Note>
      partners:           Row<Partner>
      client_partners:    Row<ClientPartner>
      activities:         Row<Activity>
      tags:               Row<Tag>
      // task_tags has no auto-managed columns — both task_id and tag_id are
      // required on insert.
      task_tags: {
        Row: TaskTag
        Insert: TaskTag
        Update: Partial<TaskTag>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      lead_stage: LeadStage
      task_status: TaskStatus
      task_priority: TaskPriority
      task_recurrence: TaskRecurrence
      event_type: EventType
      lead_temperature: LeadTemperature
      contact_role: ContactRole
    }
  }
}

// PillTone strings (kept as plain string literals so this file stays
// import-free — the Pill primitive re-exports the same union via PillTone).
type DataTone =
  | "blue"
  | "sky"
  | "indigo"
  | "violet"
  | "emerald"
  | "amber"
  | "rose"
  | "slate"

export const LEAD_STAGES: {
  id: LeadStage
  label: string
  pillTone: DataTone
}[] = [
  { id: "new",         label: "New",         pillTone: "slate" },
  { id: "contacted",   label: "Contacted",   pillTone: "blue" },
  { id: "qualified",   label: "Qualified",   pillTone: "indigo" },
  { id: "proposal",    label: "Proposal",    pillTone: "violet" },
  { id: "negotiation", label: "Negotiation", pillTone: "amber" },
  { id: "won",         label: "Won",         pillTone: "emerald" },
  { id: "lost",        label: "Lost",        pillTone: "rose" },
]

export const LEAD_TEMPERATURES: {
  id: LeadTemperature
  label: string
  pillTone: DataTone
  /** Bare colour class for the small status dot used in filter chips. */
  dot: string
}[] = [
  { id: "hot",  label: "Hot",  pillTone: "rose",  dot: "bg-rose-500" },
  { id: "warm", label: "Warm", pillTone: "amber", dot: "bg-amber-500" },
  { id: "cold", label: "Cold", pillTone: "sky",   dot: "bg-sky-500" },
]

