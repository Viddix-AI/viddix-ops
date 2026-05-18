// Database typing — kept in sync with src/supabase/migrations/001_init.sql
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
export type EventType = "call" | "meeting" | "deadline" | "internal"
export type LeadTemperature = "hot" | "warm" | "cold"

export type Profile = {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  role: string
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
  | "demo_reset"

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
  created_at: string
  updated_at: string
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
  created_at: string
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
      profiles:        Row<Profile>
      clients:         Row<Client>
      leads:           Row<Lead>
      tasks:           Row<Task>
      events:          Row<Event>
      notes:           Row<Note>
      partners:        Row<Partner>
      client_partners: Row<ClientPartner>
      activities:      Row<Activity>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      lead_stage: LeadStage
      task_status: TaskStatus
      task_priority: TaskPriority
      event_type: EventType
      lead_temperature: LeadTemperature
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

