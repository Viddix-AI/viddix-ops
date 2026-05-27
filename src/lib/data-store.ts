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
  SEED_CONTACTS,
  SEED_EVENTS,
  SEED_LEADS,
  SEED_NOTES,
  SEED_PARTNERS,
  SEED_PROFILES,
  SEED_TASKS,
} from "@/lib/seed-data"
import { SUPABASE_CONFIGURED } from "@/lib/backend"
import { buildTaskFromEvent } from "@/lib/build-task-from-event"
import { supabaseBackend } from "@/lib/supabase-backend"
import { addDays, addMonths, addWeeks, addYears } from "date-fns"

import type {
  Activity,
  ActivityKind,
  Client,
  ClientPartner,
  Contact,
  Event,
  Lead,
  Note,
  Partner,
  Profile,
  Tag,
  Task,
  TaskRecurrence,
  TaskTag,
  TaskTimeEntry,
} from "@/lib/types"

// Bump when the DB shape changes — old localStorage payloads under previous
// keys are abandoned (the user's data on disk stays under the older key, but
// a fresh seed is written here). Increment whenever a new required field is
// added so refresh doesn't render with a half-shaped record.
const KEY = "viddix-ops:v7"

type DB = {
  profiles: Profile[]
  clients: Client[]
  contacts: Contact[]
  leads: Lead[]
  tasks: Task[]
  time_entries: TaskTimeEntry[]
  events: Event[]
  notes: Note[]
  partners: Partner[]
  client_partners: ClientPartner[]
  activities: Activity[]
  tags: Tag[]
  task_tags: TaskTag[]
}

const seed = (): DB => ({
  profiles: structuredClone(SEED_PROFILES),
  clients: structuredClone(SEED_CLIENTS),
  contacts: structuredClone(SEED_CONTACTS),
  leads: structuredClone(SEED_LEADS),
  tasks: structuredClone(SEED_TASKS),
  time_entries: [],
  events: structuredClone(SEED_EVENTS),
  notes: structuredClone(SEED_NOTES),
  partners: structuredClone(SEED_PARTNERS),
  client_partners: structuredClone(SEED_CLIENT_PARTNERS),
  activities: structuredClone(SEED_ACTIVITIES),
  tags: [],
  task_tags: [],
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
      clients:         (parsed.clients ?? fresh.clients).map((c) => ({
        ...c,
        // Migration 015 fields — default to null for legacy payloads.
        contract_start_date: c.contract_start_date ?? null,
        contract_end_date:   c.contract_end_date   ?? null,
        renewal_date:        c.renewal_date        ?? null,
      })),
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
          // Migration 018 fields — default for legacy localStorage payloads.
          parent_id: t.parent_id ?? null,
          recurrence: t.recurrence ?? "none",
          recurrence_until: t.recurrence_until ?? null,
          recurrence_parent_id: t.recurrence_parent_id ?? null,
          estimate_minutes: t.estimate_minutes ?? null,
          tracked_minutes: t.tracked_minutes ?? 0,
        }
      }),
      time_entries:    parsed.time_entries    ?? fresh.time_entries,
      events:          (parsed.events ?? fresh.events).map((e) => ({
        ...e,
        cal_booking_id: e.cal_booking_id ?? null,
        task_id: e.task_id ?? null,
      })),
      notes:           parsed.notes           ?? fresh.notes,
      contacts:        parsed.contacts        ?? fresh.contacts,
      partners:        parsed.partners        ?? fresh.partners,
      client_partners: parsed.client_partners ?? fresh.client_partners,
      activities:      parsed.activities      ?? fresh.activities,
      tags:            parsed.tags            ?? fresh.tags,
      task_tags:       parsed.task_tags       ?? fresh.task_tags,
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

// ── Event<->Task pairing helpers ─────────────────────────────────────────────

/** Thrown by deleteEvent when the row originated from Cal.com. The calendar UI
 *  catches this and shows a "Cancel in Cal.com" hint instead. */
export class EventBlockedByCalCom extends Error {
  readonly cal_booking_id: string
  constructor(cal_booking_id: string) {
    super("This event came from Cal.com. Cancel it in Cal.com to remove it.")
    this.name = "EventBlockedByCalCom"
    this.cal_booking_id = cal_booking_id
  }
}

// Step a `YYYY-MM-DD` due date forward by one unit of recurrence. Used by
// updateTask() when a recurring task is completed to spawn the next instance.
// date-fns handles month/leap-year edges; we re-slice back to YYYY-MM-DD so
// the local date stays the local date.
function advanceDueDate(due: string, rec: TaskRecurrence): string {
  const d = new Date(due + "T12:00:00")  // noon avoids DST midnight surprises
  let next: Date
  switch (rec) {
    case "daily":   next = addDays(d, 1);   break
    case "weekly":  next = addWeeks(d, 1);  break
    case "monthly": next = addMonths(d, 1); break
    case "yearly":  next = addYears(d, 1);  break
    default:        return due
  }
  return next.toISOString().slice(0, 10)
}

// `buildTaskFromEvent` lives in src/lib/build-task-from-event.ts now so the
// Cal.com webhook (server) and supabase-backend (client) can both import it
// without crossing the App Router "use client" boundary. Re-exported here
// for the pre-existing import sites that already pulled it from data-store.
export { buildTaskFromEvent }

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
      contract_start_date: null,
      contract_end_date:   null,
      renewal_date:        null,
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
      contract_start_date: input.contract_start_date ?? null,
      contract_end_date:   input.contract_end_date   ?? null,
      renewal_date:        input.renewal_date        ?? null,
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
    db.contacts = db.contacts.filter((ct) => ct.client_id !== id)
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

  // ── contacts ─────────────────────────────────────────────────────────────
  contacts(): Contact[] {
    return read().contacts
  },
  contactsFor(clientId: string): Contact[] {
    return read().contacts.filter((c) => c.client_id === clientId)
  },

  createContact(input: Partial<Contact> & { client_id: string; full_name: string }): Contact {
    const db = read()
    const c: Contact = {
      id: uid(),
      client_id: input.client_id,
      full_name: input.full_name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      role: input.role ?? "other",
      title: input.title ?? null,
      is_primary: input.is_primary ?? false,
      notes: input.notes ?? null,
      created_at: now(),
      updated_at: now(),
    }
    // Enforce the partial-unique-index invariant locally: at most one primary
    // per client. If the new contact is primary, demote the previous one.
    if (c.is_primary) {
      for (const other of db.contacts) {
        if (other.client_id === c.client_id && other.is_primary) {
          other.is_primary = false
          other.updated_at = now()
        }
      }
    }
    db.contacts.push(c)
    const client = db.clients.find((cl) => cl.id === c.client_id)
    record(
      db,
      "contact_created",
      `${c.full_name} added to ${client?.name ?? "client"}`,
      { client_id: c.client_id }
    )
    write(db)
    return c
  },

  updateContact(id: string, patch: Partial<Contact>): Contact | null {
    const db = read()
    const c = db.contacts.find((x) => x.id === id)
    if (!c) return null
    // If is_primary is being set to true, demote any current primary on the
    // same client before assigning. Mirrors the unique partial index in SQL.
    if (patch.is_primary === true && !c.is_primary) {
      for (const other of db.contacts) {
        if (other.client_id === c.client_id && other.id !== c.id && other.is_primary) {
          other.is_primary = false
          other.updated_at = now()
        }
      }
    }
    Object.assign(c, patch, { updated_at: now() })
    record(db, "contact_updated", `${c.full_name} updated`, { client_id: c.client_id })
    write(db)
    return c
  },

  deleteContact(id: string) {
    const db = read()
    const c = db.contacts.find((x) => x.id === id)
    db.contacts = db.contacts.filter((x) => x.id !== id)
    if (c) {
      record(db, "contact_deleted", `${c.full_name} removed`, { client_id: c.client_id })
    }
    write(db)
  },

  setPrimaryContact(clientId: string, contactId: string) {
    const db = read()
    const target = db.contacts.find((c) => c.id === contactId)
    if (!target || target.client_id !== clientId) return
    for (const c of db.contacts) {
      if (c.client_id !== clientId) continue
      const wantsPrimary = c.id === contactId
      if (c.is_primary !== wantsPrimary) {
        c.is_primary = wantsPrimary
        c.updated_at = now()
      }
    }
    record(
      db,
      "contact_set_primary",
      `${target.full_name} marked as primary`,
      { client_id: clientId }
    )
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
      parent_id: input.parent_id ?? null,
      recurrence: input.recurrence ?? "none",
      recurrence_until: input.recurrence_until ?? null,
      recurrence_parent_id: input.recurrence_parent_id ?? null,
      estimate_minutes: input.estimate_minutes ?? null,
      tracked_minutes: input.tracked_minutes ?? 0,
      created_at: now(),
      updated_at: now(),
    }
    db.tasks.push(t)
    if (t.parent_id) {
      record(db, "task_subtask_added", `Subtask added — ${t.title}`, {
        task_id: t.id,
        lead_id: t.lead_id,
        client_id: t.client_id,
      })
    } else {
      record(db, "task_created", `Task created — ${t.title}`, {
        task_id: t.id,
        lead_id: t.lead_id,
        client_id: t.client_id,
      })
    }
    write(db)
    return t
  },

  updateTask(id: string, patch: Partial<Task>): Task | null {
    const db = read()
    const t = db.tasks.find((x) => x.id === id)
    if (!t) return null
    const wasOpen = t.status !== "done"
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
    // Recurrence: when an open recurring task is completed, generate the next
    // instance as a brand-new root task (parent_id=null, tracked_minutes=0,
    // recurrence_parent_id chained back to the original root). Tasks paired
    // with Cal.com events have recurrence='none' enforced upstream so they
    // never trip this path.
    if (
      patch.status === "done" &&
      wasOpen &&
      t.recurrence !== "none" &&
      t.due_date
    ) {
      const nextDue = advanceDueDate(t.due_date, t.recurrence)
      if (!t.recurrence_until || nextDue <= t.recurrence_until) {
        const next: Task = {
          ...t,
          id: uid(),
          status: "todo",
          due_date: nextDue,
          parent_id: null,
          recurrence_parent_id: t.recurrence_parent_id ?? t.id,
          tracked_minutes: 0,
          estimate_minutes: t.estimate_minutes,
          created_at: now(),
          updated_at: now(),
        }
        db.tasks.push(next)
        record(
          db,
          "task_recurrence_generated",
          `Next instance scheduled — ${next.title} (${nextDue})`,
          { task_id: next.id, lead_id: next.lead_id, client_id: next.client_id }
        )
      }
    }
    write(db)
    return t
  },

  deleteTask(id: string) {
    const db = read()
    const t = db.tasks.find((x) => x.id === id)
    // Mirror the SQL cascades from migration 018:
    //   tasks.parent_id ON DELETE CASCADE        → recursively delete children
    //   task_time_entries.task_id ON DELETE CASCADE → drop sessions
    // Build the full set of doomed task ids first so we can clean entries
    // and events in one pass.
    const doomed = new Set<string>()
    const enqueue = (tid: string) => {
      if (doomed.has(tid)) return
      doomed.add(tid)
      for (const c of db.tasks) {
        if (c.parent_id === tid) enqueue(c.id)
      }
    }
    enqueue(id)
    db.events = db.events.map((e) =>
      e.task_id && doomed.has(e.task_id) ? { ...e, task_id: null } : e
    )
    db.time_entries = db.time_entries.filter((te) => !doomed.has(te.task_id))
    db.task_tags    = db.task_tags.filter((tt) => !doomed.has(tt.task_id))
    db.tasks = db.tasks.filter((x) => !doomed.has(x.id))
    if (t) {
      record(db, "task_deleted", `Task deleted — ${t.title}`, {
        task_id: t.id,
        lead_id: t.lead_id,
        client_id: t.client_id,
      })
    }
    write(db)
  },

  // ── time tracking ────────────────────────────────────────────────────────
  startTimer(input: { taskId: string; userId: string | null }): TaskTimeEntry {
    const db = read()
    const task = db.tasks.find((x) => x.id === input.taskId)
    if (!task) throw new Error("startTimer: task not found")
    // One-open-per-user invariant — mirrors the partial unique index in SQL.
    if (input.userId) {
      const existing = db.time_entries.find(
        (e) => e.user_id === input.userId && e.ended_at === null
      )
      if (existing) {
        const blockedOn = db.tasks.find((x) => x.id === existing.task_id)
        throw new Error(
          `Timer already running on "${blockedOn?.title ?? "another task"}". Stop it first.`
        )
      }
    }
    const entry: TaskTimeEntry = {
      id: uid(),
      task_id: input.taskId,
      user_id: input.userId,
      started_at: now(),
      ended_at: null,
      duration_seconds: null,
      note: null,
      created_at: now(),
    }
    db.time_entries.push(entry)
    record(db, "task_timer_started", `Timer started — ${task.title}`, {
      task_id: task.id,
      lead_id: task.lead_id,
      client_id: task.client_id,
      actor_id: input.userId,
    })
    write(db)
    return entry
  },

  stopTimer(input: { entryId: string; note?: string | null }): TaskTimeEntry {
    const db = read()
    const entry = db.time_entries.find((e) => e.id === input.entryId)
    if (!entry) throw new Error("stopTimer: entry not found")
    if (entry.ended_at) return entry
    const endedAtMs = Date.now()
    const startedAtMs = new Date(entry.started_at).getTime()
    const duration_seconds = Math.max(
      0,
      Math.floor((endedAtMs - startedAtMs) / 1000)
    )
    entry.ended_at = new Date(endedAtMs).toISOString()
    entry.duration_seconds = duration_seconds
    if (input.note !== undefined) entry.note = input.note
    // Bump the task's denormalised minutes counter. Round to minutes so the
    // UI never displays "0m" for a 35-second session.
    const task = db.tasks.find((t) => t.id === entry.task_id)
    if (task) {
      task.tracked_minutes = (task.tracked_minutes ?? 0) + Math.round(duration_seconds / 60)
      task.updated_at = now()
      record(db, "task_timer_stopped", `Timer stopped — ${task.title}`, {
        task_id: task.id,
        lead_id: task.lead_id,
        client_id: task.client_id,
        actor_id: entry.user_id,
      })
    }
    write(db)
    return entry
  },

  openTimerFor(userId: string): TaskTimeEntry | null {
    if (!userId) return null
    return read().time_entries.find(
      (e) => e.user_id === userId && e.ended_at === null
    ) ?? null
  },

  timeEntriesFor(taskId: string): TaskTimeEntry[] {
    return read()
      .time_entries.filter((e) => e.task_id === taskId)
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
  },

  // ── tags ─────────────────────────────────────────────────────────────────
  tags(): Tag[] {
    return read().tags.slice().sort((a, b) => a.name.localeCompare(b.name))
  },
  tagsFor(taskId: string): Tag[] {
    const db = read()
    const ids = new Set(
      db.task_tags.filter((tt) => tt.task_id === taskId).map((tt) => tt.tag_id)
    )
    return db.tags
      .filter((t) => ids.has(t.id))
      .sort((a, b) => a.name.localeCompare(b.name))
  },
  taskTags(): TaskTag[] {
    return read().task_tags
  },
  createTag(input: { name: string; color?: string }): Tag {
    const db = read()
    // Unique-by-name parity with the SQL constraint. Returns the existing
    // row if a tag with this name already exists so the autocomplete-create
    // path is idempotent.
    const name = input.name.trim()
    if (!name) throw new Error("createTag: name required")
    const existing = db.tags.find((t) => t.name.toLowerCase() === name.toLowerCase())
    if (existing) return existing
    const tag: Tag = {
      id: uid(),
      name,
      color: input.color ?? "slate",
      created_at: now(),
    }
    db.tags.push(tag)
    write(db)
    return tag
  },
  deleteTag(id: string) {
    const db = read()
    db.tags = db.tags.filter((t) => t.id !== id)
    db.task_tags = db.task_tags.filter((tt) => tt.tag_id !== id)
    write(db)
  },
  attachTag(input: { task_id: string; tag_id: string }) {
    const db = read()
    if (
      db.task_tags.some(
        (tt) => tt.task_id === input.task_id && tt.tag_id === input.tag_id
      )
    ) {
      return
    }
    db.task_tags.push({ task_id: input.task_id, tag_id: input.tag_id })
    write(db)
  },
  detachTag(input: { task_id: string; tag_id: string }) {
    const db = read()
    db.task_tags = db.task_tags.filter(
      (tt) => !(tt.task_id === input.task_id && tt.tag_id === input.tag_id)
    )
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
        // Auto-pair if a meeting/call upsert came back without a task.
        if (
          !existing.task_id &&
          (existing.event_type === "meeting" || existing.event_type === "call")
        ) {
          const taskPayload = buildTaskFromEvent(existing)
          // Cal.com-paired task invariants: parent_id=null (always root),
          // recurrence='none' (Cal.com owns recurrence), tracked_minutes=0.
          const t: Task = {
            id: uid(),
            ...taskPayload,
            description: null,
            assignee_ids: [],
            link: null,
            parent_id: null,
            recurrence: "none",
            recurrence_until: null,
            recurrence_parent_id: null,
            estimate_minutes: null,
            tracked_minutes: 0,
            created_at: now(),
            updated_at: now(),
          }
          db.tasks.push(t)
          existing.task_id = t.id
        }
        write(db)
        return existing
      }
    }
    const wantsTask =
      (input.event_type ?? "meeting") === "meeting" ||
      input.event_type === "call"
    let task_id: string | null = null
    if (wantsTask) {
      const taskPayload = buildTaskFromEvent({
        title: input.title,
        start_at: input.start_at,
        event_type: input.event_type ?? "meeting",
        client_id: input.client_id ?? null,
        lead_id: input.lead_id ?? null,
      })
      const t: Task = {
        id: uid(),
        ...taskPayload,
        description: null,
        assignee_ids: [],
        link: null,
        parent_id: null,
        recurrence: "none",
        recurrence_until: null,
        recurrence_parent_id: null,
        estimate_minutes: null,
        tracked_minutes: 0,
        created_at: now(),
        updated_at: now(),
      }
      db.tasks.push(t)
      task_id = t.id
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
      task_id,
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
    // Mirror title/time to the paired task. One-directional (event -> task).
    if (e.task_id && (patch.title !== undefined || patch.start_at !== undefined)) {
      const t = db.tasks.find((x) => x.id === e.task_id)
      if (t) {
        const mirror = buildTaskFromEvent(e)
        t.title = mirror.title
        t.due_date = mirror.due_date
        t.due_time = mirror.due_time
        t.updated_at = now()
      }
    }
    record(db, "event_updated", `Event updated — ${e.title}`, {
      lead_id: e.lead_id,
      client_id: e.client_id,
    })
    write(db)
    return e
  },

  deleteEvent(id: string) {
    const db = read()
    const e = db.events.find((x) => x.id === id)
    if (!e) return
    if (e.cal_booking_id) {
      throw new EventBlockedByCalCom(e.cal_booking_id)
    }
    // In-app event: cascade-delete the paired task too.
    if (e.task_id) {
      db.tasks = db.tasks.filter((t) => t.id !== e.task_id)
    }
    db.events = db.events.filter((x) => x.id !== id)
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
