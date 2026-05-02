// Tiny in-memory data layer. It seeds from src/lib/seed-data and persists
// changes to localStorage so refresh doesn't wipe state. The React Query
// hooks call into this — easy swap for real Supabase later without touching
// the UI.
"use client"

import {
  SEED_CLIENTS,
  SEED_EVENTS,
  SEED_LEADS,
  SEED_NOTES,
  SEED_PROFILES,
  SEED_TASKS,
} from "@/lib/seed-data"
import type {
  Client,
  Event,
  Lead,
  Note,
  Profile,
  Task,
} from "@/lib/types"

const KEY = "viddix-ops:v1"

type DB = {
  profiles: Profile[]
  clients: Client[]
  leads: Lead[]
  tasks: Task[]
  events: Event[]
  notes: Note[]
}

const seed = (): DB => ({
  profiles: structuredClone(SEED_PROFILES),
  clients: structuredClone(SEED_CLIENTS),
  leads: structuredClone(SEED_LEADS),
  tasks: structuredClone(SEED_TASKS),
  events: structuredClone(SEED_EVENTS),
  notes: structuredClone(SEED_NOTES),
})

function read(): DB {
  if (typeof window === "undefined") return seed()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      const fresh = seed()
      localStorage.setItem(KEY, JSON.stringify(fresh))
      return fresh
    }
    return JSON.parse(raw) as DB
  } catch {
    return seed()
  }
}

function write(db: DB) {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY, JSON.stringify(db))
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
const now = () => new Date().toISOString()

export const store = {
  reset() { write(seed()) },

  // ── reads ────────────────────────────────────────────────────────────────
  profiles: () => read().profiles,
  clients:  () => read().clients,
  leads:    () => read().leads,
  tasks:    () => read().tasks,
  events:   () => read().events,
  notes:    () => read().notes,

  client(id: string)  { return read().clients.find((c) => c.id === id) ?? null },
  lead(id: string)    { return read().leads.find((l)   => l.id === id) ?? null },

  notesFor(opts: { clientId?: string; leadId?: string }) {
    const all = read().notes
    return all.filter((n) =>
      (opts.clientId && n.client_id === opts.clientId) ||
      (opts.leadId   && n.lead_id   === opts.leadId)
    )
  },

  tasksFor(opts: { clientId?: string; leadId?: string }) {
    const all = read().tasks
    return all.filter((t) =>
      (opts.clientId && t.client_id === opts.clientId) ||
      (opts.leadId   && t.lead_id   === opts.leadId)
    )
  },

  eventsFor(opts: { clientId?: string; leadId?: string }) {
    const all = read().events
    return all.filter((e) =>
      (opts.clientId && e.client_id === opts.clientId) ||
      (opts.leadId   && e.lead_id   === opts.leadId)
    )
  },

  // ── leads ────────────────────────────────────────────────────────────────
  createLead(input: Partial<Lead> & { name: string }): Lead {
    const db = read()
    const stage = input.stage ?? "new"
    const position = db.leads.filter((l) => l.stage === stage).length
    const lead: Lead = {
      id: uid(),
      name: input.name,
      company: input.company ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      source: input.source ?? null,
      stage,
      value: input.value ?? 0,
      position,
      owner_id: input.owner_id ?? null,
      notes: input.notes ?? null,
      created_at: now(),
      updated_at: now(),
    }
    db.leads.push(lead)
    write(db)
    return lead
  },

  updateLead(id: string, patch: Partial<Lead>): Lead | null {
    const db = read()
    const lead = db.leads.find((l) => l.id === id)
    if (!lead) return null
    Object.assign(lead, patch, { updated_at: now() })
    write(db)
    return lead
  },

  moveLead(id: string, toStage: Lead["stage"], toIndex: number) {
    const db = read()
    const lead = db.leads.find((l) => l.id === id)
    if (!lead) return
    const fromStage = lead.stage
    lead.stage = toStage
    lead.updated_at = now()

    // Re-index both source + destination columns
    const stages: Lead["stage"][] = Array.from(new Set([fromStage, toStage]))
    for (const s of stages) {
      const col = db.leads
        .filter((l) => l.stage === s && l.id !== id)
        .sort((a, b) => a.position - b.position)
      if (s === toStage) col.splice(toIndex, 0, lead)
      col.forEach((l, i) => (l.position = i))
    }
    write(db)
  },

  deleteLead(id: string) {
    const db = read()
    db.leads = db.leads.filter((l) => l.id !== id)
    write(db)
  },

  convertLeadToClient(id: string): Client | null {
    const db = read()
    const lead = db.leads.find((l) => l.id === id)
    if (!lead) return null
    const client: Client = {
      id: uid(),
      name: lead.company ?? lead.name,
      contact_name: lead.name,
      contact_email: lead.email,
      contact_phone: lead.phone,
      mrr: lead.value,
      status: "active",
      industry: null,
      website: null,
      notes: lead.notes,
      started_at: new Date().toISOString().slice(0, 10),
      owner_id: lead.owner_id,
      created_at: now(),
      updated_at: now(),
    }
    db.clients.push(client)
    lead.stage = "won"
    lead.updated_at = now()
    write(db)
    return client
  },

  // ── clients ──────────────────────────────────────────────────────────────
  createClient(input: Partial<Client> & { name: string }): Client {
    const db = read()
    const c: Client = {
      id: uid(),
      name: input.name,
      contact_name: input.contact_name ?? null,
      contact_email: input.contact_email ?? null,
      contact_phone: input.contact_phone ?? null,
      mrr: input.mrr ?? 0,
      status: input.status ?? "active",
      industry: input.industry ?? null,
      website: input.website ?? null,
      notes: input.notes ?? null,
      started_at: input.started_at ?? new Date().toISOString().slice(0, 10),
      owner_id: input.owner_id ?? null,
      created_at: now(),
      updated_at: now(),
    }
    db.clients.push(c)
    write(db)
    return c
  },

  updateClient(id: string, patch: Partial<Client>): Client | null {
    const db = read()
    const c = db.clients.find((x) => x.id === id)
    if (!c) return null
    Object.assign(c, patch, { updated_at: now() })
    write(db)
    return c
  },

  // ── tasks ────────────────────────────────────────────────────────────────
  createTask(input: Partial<Task> & { title: string }): Task {
    const db = read()
    const t: Task = {
      id: uid(),
      title: input.title,
      description: input.description ?? null,
      due_date: input.due_date ?? null,
      priority: input.priority ?? "medium",
      status: input.status ?? "todo",
      assignee_id: input.assignee_id ?? null,
      client_id: input.client_id ?? null,
      lead_id: input.lead_id ?? null,
      created_at: now(),
      updated_at: now(),
    }
    db.tasks.push(t)
    write(db)
    return t
  },

  updateTask(id: string, patch: Partial<Task>): Task | null {
    const db = read()
    const t = db.tasks.find((x) => x.id === id)
    if (!t) return null
    Object.assign(t, patch, { updated_at: now() })
    write(db)
    return t
  },

  deleteTask(id: string) {
    const db = read()
    db.tasks = db.tasks.filter((t) => t.id !== id)
    write(db)
  },

  // ── events ───────────────────────────────────────────────────────────────
  createEvent(input: Partial<Event> & { title: string; start_at: string }): Event {
    const db = read()
    const e: Event = {
      id: uid(),
      title: input.title,
      description: input.description ?? null,
      start_at: input.start_at,
      end_at: input.end_at ?? null,
      event_type: input.event_type ?? "meeting",
      client_id: input.client_id ?? null,
      lead_id: input.lead_id ?? null,
      attendees: input.attendees ?? [],
      created_at: now(),
    }
    db.events.push(e)
    write(db)
    return e
  },

  deleteEvent(id: string) {
    const db = read()
    db.events = db.events.filter((e) => e.id !== id)
    write(db)
  },

  // ── notes ────────────────────────────────────────────────────────────────
  createNote(input: { content: string; client_id?: string; lead_id?: string; author_id?: string }): Note {
    const db = read()
    const n: Note = {
      id: uid(),
      content: input.content,
      client_id: input.client_id ?? null,
      lead_id: input.lead_id ?? null,
      author_id: input.author_id ?? null,
      created_at: now(),
    }
    db.notes.push(n)
    write(db)
    return n
  },

  deleteNote(id: string) {
    const db = read()
    db.notes = db.notes.filter((n) => n.id !== id)
    write(db)
  },
}
