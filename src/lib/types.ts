// Database typing — kept in sync with src/supabase/migrations/001_init.sql
export type LeadStage =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost"

export type ClientStatus = "active" | "paused" | "churned" | "prospect"
export type TaskStatus = "todo" | "in_progress" | "done"
export type TaskPriority = "low" | "medium" | "high" | "urgent"
export type EventType = "call" | "meeting" | "deadline" | "internal"

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
  status: ClientStatus
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
  source: string | null
  stage: LeadStage
  value: number
  position: number
  owner_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type Task = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  priority: TaskPriority
  status: TaskStatus
  assignee_id: string | null
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

type Row<T, I = Insert<T>, U = Update<T>> = { Row: T; Insert: I; Update: U }

export type Database = {
  public: {
    Tables: {
      profiles: Row<Profile>
      clients:  Row<Client>
      leads:    Row<Lead>
      tasks:    Row<Task>
      events:   Row<Event>
      notes:    Row<Note>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      lead_stage: LeadStage
      client_status: ClientStatus
      task_status: TaskStatus
      task_priority: TaskPriority
      event_type: EventType
    }
  }
}

export const LEAD_STAGES: { id: LeadStage; label: string; tone: string }[] = [
  { id: "new",         label: "New",         tone: "bg-slate-100 text-slate-700" },
  { id: "contacted",   label: "Contacted",   tone: "bg-blue-100 text-blue-700" },
  { id: "qualified",   label: "Qualified",   tone: "bg-indigo-100 text-indigo-700" },
  { id: "proposal",    label: "Proposal",    tone: "bg-violet-100 text-violet-700" },
  { id: "negotiation", label: "Negotiation", tone: "bg-amber-100 text-amber-800" },
  { id: "won",         label: "Won",         tone: "bg-emerald-100 text-emerald-700" },
  { id: "lost",        label: "Lost",        tone: "bg-rose-100 text-rose-700" },
]
