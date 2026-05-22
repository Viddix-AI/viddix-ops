// Data layer with two interchangeable backends:
//   - localStorage (default — no Supabase env, demo-friendly)
//   - Supabase (auto-engaged when NEXT_PUBLIC_SUPABASE_URL + ANON_KEY are set)
// React Query hooks all wrap calls in `async () => store.X()`, so the await
// unwraps either a sync value (local) or a Promise (Supabase).
"use client"

import {
  SEED_ACTIVITIES,
  SEED_CLIENTS,
  SEED_CLIENT_PARTNERS,
  SEED_EVENTS,
  SEED_LEADS,
  SEED_NOTES,
  SEED_PARTNERS,
  SEED_PROFILES,
  SEED_TASKS,
} from "@/lib/seed-data"
import { SUPABASE_CONFIGURED } from "@/lib/backend"
import { supabaseBackend } from "@/lib/supabase-backend"
import type {
  Activity,
  ActivityKind,
  Client,
  ClientPartner,
  Event,
  Lead,
  Note,
  Partner,
  Profile,
  Task,
} from "@/lib/types"

// Bump when the DB shape changes — old localStorage payloads under previous
// keys are abandoned (the user's data on disk stays under the older key, but
// a fresh seed is written here). Increment whenever a new required field is
// added so refresh doesn't render with a half-shaped record.
const KEY = "viddix-ops:v6"

type DB = {
  profiles: Profile[]
  clients: Client[]
  leads: Lead[]
  tasks: Task[]
  events: Event[]
  notes: Note[]
  partners: Partner[]
  client_partners: ClientPartner[]
  activities: Activity[]
}

const seed = (): DB => ({
  profiles: structuredClone(SEED_PROFILES),
  clients: structuredClone(SEED_CLIENTS),
  leads: structuredClone(SEED_LEADS),
  tasks: structuredClone(SEED_TASKS),
  events: structuredClone(SEED_EVENTS),
  notes: structuredClone(SEED_NOTES),
  partners: structuredClone(SEED_PARTNERS),
  client_partners: structuredClone(SEED_CLIENT_PARTNERS),
  activities: structuredClone(SEED_ACTIVITIES),
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
    const parsed = JSON.parse(raw) as Partial<DB>
    // Heal payloads written before a field was introduced so the UI never
    // crashes on a missing key. New fields default; existing rows are kept.
    const fresh = seed()
    const healed: DB = {
      // Pin profiles to fresh seed data so newly added fields (role
      // tweaks) reach existing installs without forcing a hard reset.
      profiles:        fresh.profiles,
      clients:         parsed.clients         ?? fresh.clients,
      leads:           (parsed.leads ?? fresh.leads).map((l) => ({
        ...l,
        temperature: l.temperature ?? "warm",
        website: l.website ?? null,
        partner_id: l.partner_id ?? null,
        partner_split_pct: l.partner_split_pct ?? 0,
        converted_client_id: l.converted_client_id ?? null,
      })),
      tasks:           (parsed.tasks ?? fresh.tasks).map((t) => {
        // Migrate legacy single-assignee rows to the new array shape. We
        // accept either `assignee_ids` (new) or `assignee_id` (legacy) and
        // emit a normalized array so consumers don't need a fallback.
        const legacy = (t as Task & { assignee_id?: string | null })
          .assignee_id
        const ids = Array.isArray(t.assignee_ids)
          ? t.assignee_ids
          : legacy
          ? [legacy]
          : []
        return {
          ...t,
          assignee_ids: ids,
          link: t.link ?? null,
          due_time: t.due_time ?? null,
        }
      }),
      events:          (parsed.events ?? fresh.events).map((e) => ({
        ...e,
        cal_booking_id: e.cal_booking_id ?? null,
      })),
      notes:           parsed.notes           ?? fresh.notes,
      partners:        parsed.partners        ?? fresh.partners,
      client_partners: parsed.client_partners ?? fresh.client_partners,
      activities:      parsed.activities      ?? fresh.activities,
    }
    return healed
  } catch {
    return seed()
  }
}

function write(db: DB) {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY, JSON.stringify(db))
  // Tiny pub-sub so cross-cutting consumers (activity feed, notifications)
  // can react without each mutation explicitly invalidating their query.
  window.dispatchEvent(new CustomEvent("viddix:store-changed"))
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)
const now = () => new Date().toISOString()

// Append an activity directly to the in-flight DB before write(). Keeps the
// audit trail at most ACTIVITY_CAP entries so localStorage doesn't bloat.
const ACTIVITY_CAP = 500
function record(
  db: DB,
  kind: ActivityKind,
  message: string,
  refs: Partial<Pick<Activity, "lead_id" | "client_id" | "partner_id" | "task_id" | "actor_id">> = {}
) {
  db.activities.unshift({
    id: uid(),
    kind,
    message,
    lead_id: refs.lead_id ?? null,
    client_id: refs.client_id ?? null,
    partner_id: refs.partner_id ?? null,
    task_id: refs.task_id ?? null,
    actor_id: refs.actor_id ?? null,
    created_at: now(),
  })
  if (db.activities.length > ACTIVITY_CAP) {
    db.activities.length = ACTIVITY_CAP
  }
}

const localStore = {
  reset() {
    const fresh = seed()
    record(fresh, "demo_reset", "Demo data reset")
    write(fresh)
  },

  // ── reads ────────────────────────────────────────────────────────────────
  profiles:       () => read().profiles,
  clients:        () => read().clients,
  leads:          () => read().leads,
  tasks:          () => read().tasks,
  events:         () => read().events,
  notes:          () => read().notes,
  partners:       () => read().partners,
  clientPartners: () => read().client_partners,
  activities:     () => read().activities,

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
      website: input.website ?? null,
      source: input.source ?? null,
      stage,
      temperature: input.temperature ?? "warm",
      value: input.value ?? 0,
      position,
      owner_id: input.owner_id ?? null,
      notes: input.notes ?? null,
      partner_id: input.partner_id ?? null,
      partner_split_pct: input.partner_split_pct ?? 0,
      converted_client_id: null,
      created_at: now(),
      updated_at: now(),
    }
    db.leads.push(lead)
    record(db, "lead_created", `${lead.name} added to the pipeline`, {
      lead_id: lead.id,
    })
    write(db)
    return lead
  },

  updateLead(id: string, patch: Partial<Lead>): Lead | null {
    const db = read()
    const lead = db.leads.find((l) => l.id === id)
    if (!lead) return null
    Object.assign(lead, patch, { updated_at: now() })
    // Only log substantive edits — temperature, owner, value, stage, notes.
    // Cheap blur-fired changes (email/phone) skip the log to avoid noise.
    const interesting =
      patch.stage !== undefined ||
      patch.temperature !== undefined ||
      patch.owner_id !== undefined ||
      patch.value !== undefined
    if (interesting) {
      record(db, "lead_updated", `${lead.name} updated`, { lead_id: lead.id })
    }
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
    if (fromStage !== toStage) {
      record(db, "lead_moved", `${lead.name} moved to ${toStage}`, {
        lead_id: lead.id,
      })
    }
    write(db)
  },

  deleteLead(id: string) {
    const db = read()
    const lead = db.leads.find((l) => l.id === id)
    db.leads = db.leads.filter((l) => l.id !== id)
    if (lead) {
      record(db, "lead_deleted", `${lead.name} deleted`, { lead_id: lead.id })
    }
    write(db)
  },

  convertLeadToClient(id: string): Client | null {
    const db = read()
    const lead = db.leads.find((l) => l.id === id)
    if (!lead) return null
    // Idempotent — if this lead was already converted, return the existing
    // client instead of creating a duplicate.
    if (lead.converted_client_id) {
      const existing = db.clients.find((c) => c.id === lead.converted_client_id)
      if (existing) return existing
    }
    const client: Client = {
      id: uid(),
      name: lead.company ?? lead.name,
      contact_name: lead.name,
      contact_email: lead.email,
      contact_phone: lead.phone,
      mrr: lead.value,
      industry: null,
      website: lead.website,
      notes: lead.notes,
      started_at: new Date().toISOString().slice(0, 10),
      owner_id: lead.owner_id,
      created_at: now(),
      updated_at: now(),
    }
    db.clients.push(client)
    lead.stage = "won"
    lead.converted_client_id = client.id
    lead.updated_at = now()
    record(db, "lead_converted", `${lead.name} converted to client`, {
      lead_id: lead.id,
      client_id: client.id,
    })
    // If the lead had a partner pre-allocated, materialise it as a
    // client_partners row now so the split doesn't have to be re-entered.
    if (lead.partner_id) {
      const partner = db.partners.find((p) => p.id === lead.partner_id)
      db.client_partners.push({
        id: uid(),
        client_id: client.id,
        partner_id: lead.partner_id,
        split_pct: lead.partner_split_pct ?? 0,
        created_at: now(),
      })
      record(
        db,
        "partner_attached",
        `${partner?.name ?? "Partner"} attached to ${client.name}`,
        { partner_id: lead.partner_id, client_id: client.id }
      )
    }
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
      industry: input.industry ?? null,
      website: input.website ?? null,
      notes: input.notes ?? null,
      started_at: input.started_at ?? new Date().toISOString().slice(0, 10),
      owner_id: input.owner_id ?? null,
      created_at: now(),
      updated_at: now(),
    }
    db.clients.push(c)
    record(db, "client_created", `${c.name} added`, { client_id: c.id })
    write(db)
    return c
  },

  updateClient(id: string, patch: Partial<Client>): Client | null {
    const db = read()
    const c = db.clients.find((x) => x.id === id)
    if (!c) return null
    Object.assign(c, patch, { updated_at: now() })
    if (patch.mrr !== undefined || patch.owner_id !== undefined) {
      record(db, "client_updated", `${c.name} updated`, { client_id: c.id })
    }
    write(db)
    return c
  },

  deleteClient(id: string) {
    const db = read()
    const c = db.clients.find((x) => x.id === id)
    if (!c) return
    // Mirror the SQL cascades from 001_init.sql + 002_partners_temperature.sql:
    //   client_partners ON DELETE CASCADE      → remove links
    //   notes           ON DELETE CASCADE      → remove notes
    //   tasks.client_id ON DELETE SET NULL     → null out the FK
    //   events.client_id ON DELETE SET NULL    → null out the FK
    //   leads.converted_client_id ON DELETE SET NULL → null out
    db.clients = db.clients.filter((x) => x.id !== id)
    db.client_partners = db.client_partners.filter((cp) => cp.client_id !== id)
    db.notes = db.notes.filter((n) => n.client_id !== id)
    db.tasks = db.tasks.map((t) =>
      t.client_id === id ? { ...t, client_id: null } : t
    )
    db.events = db.events.map((e) =>
      e.client_id === id ? { ...e, client_id: null } : e
    )
    db.leads = db.leads.map((l) =>
      l.converted_client_id === id ? { ...l, converted_client_id: null } : l
    )
    record(db, "client_deleted", `${c.name} deleted`, { client_id: id })
    write(db)
  },

  // ── tasks ────────────────────────────────────────────────────────────────
  createTask(input: Partial<Task> & { title: string }): Task {
    const db = read()
    const t: Task = {
      id: uid(),
      title: input.title,
      description: input.description ?? null,
      due_date: input.due_date ?? null,
      due_time: input.due_time ?? null,
      priority: input.priority ?? "medium",
      status: input.status ?? "todo",
      assignee_ids: input.assignee_ids ?? [],
      link: input.link ?? null,
      client_id: input.client_id ?? null,
      lead_id: input.lead_id ?? null,
      created_at: now(),
      updated_at: now(),
    }
    db.tasks.push(t)
    record(db, "task_created", `Task created — ${t.title}`, {
      task_id: t.id,
      lead_id: t.lead_id,
      client_id: t.client_id,
    })
    write(db)
    return t
  },

  updateTask(id: string, patch: Partial<Task>): Task | null {
    const db = read()
    const t = db.tasks.find((x) => x.id === id)
    if (!t) return null
    Object.assign(t, patch, { updated_at: now() })
    if (patch.status !== undefined) {
      record(
        db,
        "task_updated",
        patch.status === "done"
          ? `Task done — ${t.title}`
          : `Task → ${patch.status} — ${t.title}`,
        { task_id: t.id, lead_id: t.lead_id, client_id: t.client_id }
      )
    }
    write(db)
    return t
  },

  deleteTask(id: string) {
    const db = read()
    const t = db.tasks.find((x) => x.id === id)
    db.tasks = db.tasks.filter((t) => t.id !== id)
    if (t) {
      record(db, "task_deleted", `Task deleted — ${t.title}`, {
        task_id: t.id,
        lead_id: t.lead_id,
        client_id: t.client_id,
      })
    }
    write(db)
  },

  // ── events ───────────────────────────────────────────────────────────────
  createEvent(input: Partial<Event> & { title: string; start_at: string }): Event {
    const db = read()
    // Upsert by cal_booking_id so Cal.com webhook retries don't create
    // duplicates. Internal events pass cal_booking_id=null and always insert.
    if (input.cal_booking_id) {
      const existing = db.events.find(
        (e) => e.cal_booking_id === input.cal_booking_id
      )
      if (existing) {
        Object.assign(existing, {
          title: input.title,
          description: input.description ?? existing.description,
          start_at: input.start_at,
          end_at: input.end_at ?? existing.end_at,
          event_type: input.event_type ?? existing.event_type,
          client_id: input.client_id ?? existing.client_id,
          lead_id: input.lead_id ?? existing.lead_id,
          attendees: input.attendees ?? existing.attendees,
        })
        write(db)
        return existing
      }
    }
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
      cal_booking_id: input.cal_booking_id ?? null,
      task_id: null,
      created_at: now(),
    }
    db.events.push(e)
    record(db, "event_created", `Event scheduled — ${e.title}`, {
      lead_id: e.lead_id,
      client_id: e.client_id,
    })
    write(db)
    return e
  },

  updateEvent(id: string, patch: Partial<Event>): Event | null {
    const db = read()
    const e = db.events.find((x) => x.id === id)
    if (!e) return null
    Object.assign(e, patch)
    record(db, "event_updated", `Event updated — ${e.title}`, {
      lead_id: e.lead_id,
      client_id: e.client_id,
    })
    write(db)
    return e
  },

  deleteEvent(id: string) {
    const db = read()
    db.events = db.events.filter((e) => e.id !== id)
    write(db)
  },

  // ── profiles ─────────────────────────────────────────────────────────────
  // Profile rows are mostly read-only (auth.users mirror), but cal_link is
  // user-editable from /settings. Kept minimal: no audit row, no triggers.
  updateProfile(id: string, patch: Partial<Profile>): Profile | null {
    const db = read()
    const p = db.profiles.find((x) => x.id === id)
    if (!p) return null
    Object.assign(p, patch)
    write(db)
    return p
  },

  // ── partners ─────────────────────────────────────────────────────────────
  partnersFor(clientId: string): (ClientPartner & { partner: Partner | null })[] {
    const db = read()
    return db.client_partners
      .filter((cp) => cp.client_id === clientId)
      .map((cp) => ({
        ...cp,
        partner: db.partners.find((p) => p.id === cp.partner_id) ?? null,
      }))
  },

  clientsForPartner(partnerId: string): (ClientPartner & { client: Client | null })[] {
    const db = read()
    return db.client_partners
      .filter((cp) => cp.partner_id === partnerId)
      .map((cp) => ({
        ...cp,
        client: db.clients.find((c) => c.id === cp.client_id) ?? null,
      }))
  },

  createPartner(input: Partial<Partner> & { name: string }): Partner {
    const db = read()
    const p: Partner = {
      id: uid(),
      name: input.name,
      email: input.email ?? null,
      role: input.role ?? null,
      default_split_pct: input.default_split_pct ?? 0,
      notes: input.notes ?? null,
      created_at: now(),
      updated_at: now(),
    }
    db.partners.push(p)
    record(db, "partner_created", `${p.name} added as partner`, {
      partner_id: p.id,
    })
    write(db)
    return p
  },

  updatePartner(id: string, patch: Partial<Partner>): Partner | null {
    const db = read()
    const p = db.partners.find((x) => x.id === id)
    if (!p) return null
    Object.assign(p, patch, { updated_at: now() })
    record(db, "partner_updated", `${p.name} updated`, { partner_id: p.id })
    write(db)
    return p
  },

  deletePartner(id: string) {
    const db = read()
    const p = db.partners.find((x) => x.id === id)
    db.partners = db.partners.filter((p) => p.id !== id)
    db.client_partners = db.client_partners.filter((cp) => cp.partner_id !== id)
    if (p) {
      record(db, "partner_deleted", `${p.name} removed`, { partner_id: p.id })
    }
    write(db)
  },

  attachPartner(input: { client_id: string; partner_id: string; split_pct?: number }): ClientPartner {
    const db = read()
    const partner = db.partners.find((p) => p.id === input.partner_id)
    const existing = db.client_partners.find(
      (cp) => cp.client_id === input.client_id && cp.partner_id === input.partner_id
    )
    if (existing) {
      if (typeof input.split_pct === "number") existing.split_pct = input.split_pct
      write(db)
      return existing
    }
    const cp: ClientPartner = {
      id: uid(),
      client_id: input.client_id,
      partner_id: input.partner_id,
      split_pct: input.split_pct ?? partner?.default_split_pct ?? 0,
      created_at: now(),
    }
    db.client_partners.push(cp)
    const client = db.clients.find((c) => c.id === input.client_id)
    record(
      db,
      "partner_attached",
      `${partner?.name ?? "Partner"} attached to ${client?.name ?? "client"}`,
      { partner_id: partner?.id ?? null, client_id: client?.id ?? null }
    )
    write(db)
    return cp
  },

  updateClientPartner(id: string, patch: Partial<Pick<ClientPartner, "split_pct">>): ClientPartner | null {
    const db = read()
    const cp = db.client_partners.find((x) => x.id === id)
    if (!cp) return null
    Object.assign(cp, patch)
    write(db)
    return cp
  },

  detachPartner(id: string) {
    const db = read()
    const cp = db.client_partners.find((x) => x.id === id)
    db.client_partners = db.client_partners.filter((cp) => cp.id !== id)
    if (cp) {
      const partner = db.partners.find((p) => p.id === cp.partner_id)
      const client = db.clients.find((c) => c.id === cp.client_id)
      record(
        db,
        "partner_detached",
        `${partner?.name ?? "Partner"} detached from ${client?.name ?? "client"}`,
        { partner_id: partner?.id ?? null, client_id: client?.id ?? null }
      )
    }
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
    record(db, "note_created", "Note added", {
      lead_id: n.lead_id,
      client_id: n.client_id,
      actor_id: n.author_id,
    })
    write(db)
    return n
  },

  deleteNote(id: string) {
    const db = read()
    db.notes = db.notes.filter((n) => n.id !== id)
    write(db)
  },
}

// Public store: pick a backend at module load. The localStore has sync return
// types (Lead[], etc.); supabaseBackend returns Promise<Lead[]>. Hooks use
// `async () => store.X()` so the await unwraps either shape transparently.
export const store: typeof localStore | typeof supabaseBackend = SUPABASE_CONFIGURED
  ? supabaseBackend
  : localStore
