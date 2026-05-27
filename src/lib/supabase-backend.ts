// Supabase implementation of the Backend interface. Engaged automatically
// when NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY are set;
// otherwise the localStorage backend in data-store.ts wins.
//
// Tables / columns mirror src/supabase/migrations/001_init.sql onwards.
"use client"

import { createClient } from "@/lib/supabase/client"
import type { Backend } from "@/lib/backend"
import { buildTaskFromEvent } from "@/lib/build-task-from-event"
import { EventBlockedByCalCom } from "@/lib/data-store"
import type {
  Activity,
  Client,
  ClientPartner,
  Contact,
  Event,
  Lead,
  Note,
  Partner,
  Profile,
  Task,
} from "@/lib/types"

function db() {
  return createClient()
}

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }, ctx: string): T {
  if (error) throw new Error(`Supabase: ${ctx} — ${error.message}`)
  if (data === null) throw new Error(`Supabase: ${ctx} — no data`)
  return data
}

// ── Activity feed ────────────────────────────────────────────────────────────
// Lives in Postgres now (migration 008) so it's shared across the team. The
// helper is fire-and-forget: a failed insert just means the audit log loses
// one row — never a user-visible error. The actor_id is resolved from the
// auth session so we don't have to thread the current user through every
// mutation site.
async function currentActorId(): Promise<string | null> {
  try {
    const { data } = await db().auth.getUser()
    return data.user?.id ?? null
  } catch {
    return null
  }
}

function logActivity(a: Omit<Activity, "id" | "created_at" | "actor_id"> & { actor_id?: string | null }) {
  void (async () => {
    const actor_id = a.actor_id ?? (await currentActorId())
    const { error } = await db()
      .from("activities")
      .insert({
        kind: a.kind,
        message: a.message,
        lead_id: a.lead_id,
        client_id: a.client_id,
        partner_id: a.partner_id,
        task_id: a.task_id,
        actor_id,
      })
    if (error) {
      console.warn(`activity log failed (${a.kind}): ${error.message}`)
      return
    }
    // useActivities() listens for this event and re-invalidates the feed
    // query, so the new entry surfaces without needing each mutation site
    // to invalidate ["activities"] explicitly.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("viddix:store-changed"))
    }
  })()
}

// Materialise a Client (and optional client_partners row) for a lead that is
// transitioning to stage="won". Idempotent: if the lead already has a
// `converted_client_id` pointing to an existing client, returns that client
// without inserting anything. Does NOT touch the leads row — the caller
// updates `converted_client_id` (and any other lead fields) as part of its
// own update so the operation stays a single round-trip per code path.
async function ensureClientForWonLead(lead: Lead): Promise<Client> {
  if (lead.converted_client_id) {
    const existing = await db()
      .from("clients")
      .select("*")
      .eq("id", lead.converted_client_id)
      .maybeSingle()
    if (existing.data) return existing.data as Client
  }
  const r = await db()
    .from("clients")
    .insert({
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
    })
    .select()
    .single()
  const client = unwrap(r, "ensureClientForWonLead") as Client
  if (lead.partner_id) {
    await db()
      .from("client_partners")
      .upsert(
        {
          client_id: client.id,
          partner_id: lead.partner_id,
          split_pct: lead.partner_split_pct ?? 0,
        },
        { onConflict: "client_id,partner_id" }
      )
    logActivity({
      kind: "partner_attached",
      message: `Partner attached to ${client.name}`,
      lead_id: lead.id,
      client_id: client.id,
      partner_id: lead.partner_id,
      task_id: null,
      actor_id: null,
    })
  }
  logActivity({
    kind: "lead_converted",
    message: `${lead.name} converted to client`,
    lead_id: lead.id,
    client_id: client.id,
    partner_id: null,
    task_id: null,
    actor_id: null,
  })
  return client
}

export const supabaseBackend: Backend = {
  async reset() {
    // No-op against Supabase — destroying real production data on a click is
    // not friendly. We only clear the activities log so the UI feels fresh
    // without losing leads / clients / tasks.
    const { error } = await db().from("activities").delete().not("id", "is", null)
    if (error) console.warn(`reset (activities): ${error.message}`)
  },

  // ── reads ────────────────────────────────────────────────────────────────
  async profiles() {
    const r = await db().from("profiles").select("*").order("full_name")
    return unwrap(r, "profiles")
  },
  async clients() {
    const r = await db().from("clients").select("*").order("name")
    return unwrap(r, "clients")
  },
  async leads() {
    const r = await db().from("leads").select("*").order("position")
    return unwrap(r, "leads")
  },
  async tasks() {
    const r = await db().from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false })
    return unwrap(r, "tasks")
  },
  async events() {
    const r = await db().from("events").select("*").order("start_at")
    return unwrap(r, "events")
  },
  async notes() {
    const r = await db().from("notes").select("*").order("created_at", { ascending: false })
    return unwrap(r, "notes")
  },
  async partners() {
    const r = await db().from("partners").select("*").order("name")
    return unwrap(r, "partners")
  },
  async clientPartners() {
    const r = await db().from("client_partners").select("*")
    return unwrap(r, "client_partners")
  },
  async activities() {
    const r = await db()
      .from("activities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500)
    return unwrap(r, "activities") as Activity[]
  },

  async client(id) {
    const r = await db().from("clients").select("*").eq("id", id).maybeSingle()
    if (r.error) throw new Error(`Supabase: client — ${r.error.message}`)
    return r.data
  },
  async lead(id) {
    const r = await db().from("leads").select("*").eq("id", id).maybeSingle()
    if (r.error) throw new Error(`Supabase: lead — ${r.error.message}`)
    return r.data
  },

  async notesFor(opts) {
    let q = db().from("notes").select("*")
    if (opts.clientId) q = q.eq("client_id", opts.clientId)
    if (opts.leadId) q = q.eq("lead_id", opts.leadId)
    const r = await q.order("created_at", { ascending: false })
    return unwrap(r, "notesFor")
  },
  async tasksFor(opts) {
    let q = db().from("tasks").select("*")
    if (opts.clientId) q = q.eq("client_id", opts.clientId)
    if (opts.leadId) q = q.eq("lead_id", opts.leadId)
    const r = await q.order("due_date", { ascending: true, nullsFirst: false })
    return unwrap(r, "tasksFor")
  },
  async eventsFor(opts) {
    let q = db().from("events").select("*")
    if (opts.clientId) q = q.eq("client_id", opts.clientId)
    if (opts.leadId) q = q.eq("lead_id", opts.leadId)
    const r = await q.order("start_at")
    return unwrap(r, "eventsFor")
  },

  // ── leads ────────────────────────────────────────────────────────────────
  async createLead(input) {
    // Pre-compute position (count of leads in the destination stage). Read
    // is cheap; race-conditions on position are tolerable inside a 3-person
    // workspace and the kanban renormalises on next move.
    const stage = input.stage ?? "new"
    const count = await db().from("leads").select("id", { count: "exact", head: true }).eq("stage", stage)
    const position = count.count ?? 0
    const r = await db()
      .from("leads")
      .insert({
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
      })
      .select()
      .single()
    const lead = unwrap(r, "createLead") as Lead
    logActivity({
      kind: "lead_created",
      message: `${lead.name} added to the pipeline`,
      lead_id: lead.id,
      client_id: null,
      partner_id: null,
      task_id: null,
      actor_id: null,
    })
    if (lead.stage === "won" && !lead.converted_client_id) {
      const client = await ensureClientForWonLead(lead)
      await db()
        .from("leads")
        .update({ converted_client_id: client.id })
        .eq("id", lead.id)
      return { ...lead, converted_client_id: client.id }
    }
    return lead
  },
  async updateLead(id, patch) {
    let effectivePatch = patch
    if (patch.stage !== undefined) {
      const lead = (await this.lead(id)) as Lead | null
      if (!lead) throw new Error(`Supabase: updateLead — lead ${id} not found`)
      if (lead.converted_client_id && patch.stage !== "won") {
        throw new Error("Cannot change stage of a converted lead")
      }
      if (patch.stage === "won" && !lead.converted_client_id) {
        const client = await ensureClientForWonLead(lead)
        effectivePatch = { ...patch, converted_client_id: client.id }
      }
    }
    const r = await db().from("leads").update(effectivePatch).eq("id", id).select().single()
    if (r.error) throw new Error(`Supabase: updateLead — ${r.error.message}`)
    return r.data as Lead
  },
  async moveLead(id, toStage, toIndex) {
    const lead = (await this.lead(id)) as Lead | null
    if (!lead) throw new Error(`Supabase: moveLead — lead ${id} not found`)
    if (lead.converted_client_id && toStage !== "won") {
      throw new Error("Cannot move a converted lead out of won")
    }
    const update: Partial<Lead> = { stage: toStage, position: toIndex }
    if (toStage === "won" && !lead.converted_client_id) {
      const client = await ensureClientForWonLead(lead)
      update.converted_client_id = client.id
    }
    const u = await db().from("leads").update(update).eq("id", id)
    if (u.error) throw new Error(`Supabase: moveLead — ${u.error.message}`)
    logActivity({
      kind: "lead_moved",
      message: `Lead moved to ${toStage}`,
      lead_id: id,
      client_id: null,
      partner_id: null,
      task_id: null,
      actor_id: null,
    })
  },
  async deleteLead(id) {
    const r = await db().from("leads").delete().eq("id", id)
    if (r.error) throw new Error(`Supabase: deleteLead — ${r.error.message}`)
    logActivity({
      kind: "lead_deleted",
      message: "Lead deleted",
      lead_id: id,
      client_id: null,
      partner_id: null,
      task_id: null,
      actor_id: null,
    })
  },
  async convertLeadToClient(id) {
    const lead = (await this.lead(id)) as Lead | null
    if (!lead) return null
    const client = await ensureClientForWonLead(lead)
    if (lead.stage !== "won" || lead.converted_client_id !== client.id) {
      await db()
        .from("leads")
        .update({ stage: "won", converted_client_id: client.id })
        .eq("id", lead.id)
    }
    return client
  },

  // ── clients ──────────────────────────────────────────────────────────────
  async createClient(input) {
    const r = await db()
      .from("clients")
      .insert({
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
      })
      .select()
      .single()
    const c = unwrap(r, "createClient") as Client
    logActivity({
      kind: "client_created",
      message: `${c.name} added`,
      lead_id: null,
      client_id: c.id,
      partner_id: null,
      task_id: null,
      actor_id: null,
    })
    return c
  },
  async updateClient(id, patch) {
    const r = await db().from("clients").update(patch).eq("id", id).select().single()
    if (r.error) throw new Error(`Supabase: updateClient — ${r.error.message}`)
    return r.data as Client
  },
  async deleteClient(id) {
    // Postgres handles the cascade rules declared in 001_init.sql /
    // 002_partners_temperature.sql; we just issue the delete + log it.
    const r = await db().from("clients").delete().eq("id", id)
    if (r.error) throw new Error(`Supabase: deleteClient — ${r.error.message}`)
    logActivity({
      kind: "client_deleted",
      message: "Client deleted",
      lead_id: null,
      client_id: id,
      partner_id: null,
      task_id: null,
      actor_id: null,
    })
  },

  // ── contacts ─────────────────────────────────────────────────────────────
  async contacts() {
    const r = await db()
      .from("contacts")
      .select("*")
      .order("is_primary", { ascending: false })
      .order("full_name")
    return unwrap(r, "contacts") as Contact[]
  },
  async contactsFor(clientId) {
    const r = await db()
      .from("contacts")
      .select("*")
      .eq("client_id", clientId)
      .order("is_primary", { ascending: false })
      .order("full_name")
    return unwrap(r, "contactsFor") as Contact[]
  },
  async createContact(input) {
    // If the caller asked for is_primary=true, demote any existing primary on
    // the same client first so the partial unique index doesn't conflict.
    if (input.is_primary) {
      const demote = await db()
        .from("contacts")
        .update({ is_primary: false })
        .eq("client_id", input.client_id)
        .eq("is_primary", true)
      if (demote.error) throw new Error(`Supabase: createContact.demote — ${demote.error.message}`)
    }
    const r = await db()
      .from("contacts")
      .insert({
        client_id: input.client_id,
        full_name: input.full_name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        role: input.role ?? "other",
        title: input.title ?? null,
        is_primary: input.is_primary ?? false,
        notes: input.notes ?? null,
      })
      .select()
      .single()
    const c = unwrap(r, "createContact") as Contact
    logActivity({
      kind: "contact_created",
      message: `${c.full_name} added`,
      lead_id: null,
      client_id: c.client_id,
      partner_id: null,
      task_id: null,
      actor_id: null,
    })
    return c
  },
  async updateContact(id, patch) {
    if (patch.is_primary === true) {
      // Look up the client_id so we can demote any other primary for that
      // client before the update lands.
      const lookup = await db()
        .from("contacts")
        .select("client_id, is_primary")
        .eq("id", id)
        .maybeSingle()
      if (lookup.error) throw new Error(`Supabase: updateContact.lookup — ${lookup.error.message}`)
      if (lookup.data && !lookup.data.is_primary) {
        const demote = await db()
          .from("contacts")
          .update({ is_primary: false })
          .eq("client_id", lookup.data.client_id)
          .eq("is_primary", true)
          .neq("id", id)
        if (demote.error) throw new Error(`Supabase: updateContact.demote — ${demote.error.message}`)
      }
    }
    const r = await db().from("contacts").update(patch).eq("id", id).select().single()
    if (r.error) throw new Error(`Supabase: updateContact — ${r.error.message}`)
    const c = r.data as Contact
    logActivity({
      kind: "contact_updated",
      message: `${c.full_name} updated`,
      lead_id: null,
      client_id: c.client_id,
      partner_id: null,
      task_id: null,
      actor_id: null,
    })
    return c
  },
  async deleteContact(id) {
    const lookup = await db()
      .from("contacts")
      .select("client_id, full_name")
      .eq("id", id)
      .maybeSingle()
    const r = await db().from("contacts").delete().eq("id", id)
    if (r.error) throw new Error(`Supabase: deleteContact — ${r.error.message}`)
    if (lookup.data) {
      logActivity({
        kind: "contact_deleted",
        message: `${lookup.data.full_name} removed`,
        lead_id: null,
        client_id: lookup.data.client_id,
        partner_id: null,
        task_id: null,
        actor_id: null,
      })
    }
  },
  async setPrimaryContact(clientId, contactId) {
    // Two-step: demote the current primary (if any), then promote the target.
    // Not transactional — if the second call fails we end up with zero
    // primaries on this client until the next attempt. Acceptable: the UI
    // surfaces "Set primary" again and the partial unique index would have
    // blocked any inconsistent intermediate state.
    const demote = await db()
      .from("contacts")
      .update({ is_primary: false })
      .eq("client_id", clientId)
      .eq("is_primary", true)
      .neq("id", contactId)
    if (demote.error) throw new Error(`Supabase: setPrimaryContact.demote — ${demote.error.message}`)
    const promote = await db()
      .from("contacts")
      .update({ is_primary: true })
      .eq("id", contactId)
      .eq("client_id", clientId)
      .select()
      .single()
    if (promote.error) throw new Error(`Supabase: setPrimaryContact.promote — ${promote.error.message}`)
    const c = promote.data as Contact
    logActivity({
      kind: "contact_set_primary",
      message: `${c.full_name} marked as primary`,
      lead_id: null,
      client_id: clientId,
      partner_id: null,
      task_id: null,
      actor_id: null,
    })
  },

  // ── tasks ────────────────────────────────────────────────────────────────
  async createTask(input) {
    const r = await db()
      .from("tasks")
      .insert({
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
      })
      .select()
      .single()
    return unwrap(r, "createTask") as Task
  },
  async updateTask(id, patch) {
    const r = await db().from("tasks").update(patch).eq("id", id).select().single()
    if (r.error) throw new Error(`Supabase: updateTask — ${r.error.message}`)
    return r.data as Task
  },
  async deleteTask(id) {
    // events.task_id has ON DELETE SET NULL (migration 014), so any paired
    // event survives with task_id cleared automatically.
    const r = await db().from("tasks").delete().eq("id", id)
    if (r.error) throw new Error(`Supabase: deleteTask — ${r.error.message}`)
  },

  // ── events ───────────────────────────────────────────────────────────────
  async createEvent(input) {
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
      const tr = await db()
        .from("tasks")
        .insert({
          title: taskPayload.title,
          description: null,
          due_date: taskPayload.due_date,
          due_time: taskPayload.due_time,
          priority: taskPayload.priority,
          status: taskPayload.status,
          assignee_ids: [],
          link: null,
          client_id: taskPayload.client_id,
          lead_id: taskPayload.lead_id,
        })
        .select("id")
        .single()
      if (tr.error) throw new Error(`Supabase: createEvent.task — ${tr.error.message}`)
      task_id = tr.data.id as string
    }
    const payload = {
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
    }
    const r = input.cal_booking_id
      ? await db()
          .from("events")
          .upsert(payload, { onConflict: "cal_booking_id" })
          .select()
          .single()
      : await db().from("events").insert(payload).select().single()
    if (r.error && task_id) {
      // Best-effort cleanup of the orphan task if the event insert failed.
      await db().from("tasks").delete().eq("id", task_id)
    }
    const event = unwrap(r, "createEvent") as Event
    logActivity({
      kind: "event_created",
      message: `Event scheduled — ${event.title}`,
      lead_id: event.lead_id,
      client_id: event.client_id,
      partner_id: null,
      task_id: null,
    })
    return event
  },
  async updateEvent(id, patch) {
    const r = await db().from("events").update(patch).eq("id", id).select().single()
    if (r.error) throw new Error(`Supabase: updateEvent — ${r.error.message}`)
    const event = r.data as Event
    if (
      event.task_id &&
      (patch.title !== undefined || patch.start_at !== undefined)
    ) {
      const mirror = buildTaskFromEvent(event)
      const tu = await db()
        .from("tasks")
        .update({
          title: mirror.title,
          due_date: mirror.due_date,
          due_time: mirror.due_time,
        })
        .eq("id", event.task_id)
      if (tu.error) {
        // Non-fatal — log and continue. The event update already succeeded.
        console.warn(`updateEvent.mirror failed: ${tu.error.message}`)
      }
    }
    logActivity({
      kind: "event_updated",
      message: `Event updated — ${event.title}`,
      lead_id: event.lead_id,
      client_id: event.client_id,
      partner_id: null,
      task_id: null,
    })
    return event
  },
  async deleteEvent(id) {
    // Load the row first to decide guard/cascade behavior.
    const lookup = await db()
      .from("events")
      .select("cal_booking_id, task_id")
      .eq("id", id)
      .maybeSingle()
    if (lookup.error) throw new Error(`Supabase: deleteEvent.lookup — ${lookup.error.message}`)
    if (!lookup.data) return
    if (lookup.data.cal_booking_id) {
      throw new EventBlockedByCalCom(lookup.data.cal_booking_id)
    }
    const r = await db().from("events").delete().eq("id", id)
    if (r.error) throw new Error(`Supabase: deleteEvent — ${r.error.message}`)
    if (lookup.data.task_id) {
      const tr = await db().from("tasks").delete().eq("id", lookup.data.task_id)
      if (tr.error) {
        console.warn(`deleteEvent.task cascade failed: ${tr.error.message}`)
      }
    }
  },

  // ── profiles ─────────────────────────────────────────────────────────────
  async updateProfile(id, patch) {
    const r = await db().from("profiles").update(patch).eq("id", id).select().single()
    if (r.error) throw new Error(`Supabase: updateProfile — ${r.error.message}`)
    return r.data as Profile
  },

  // ── partners ─────────────────────────────────────────────────────────────
  async partnersFor(clientId) {
    // We declare Relationships: [] in types.ts so the join type isn't
    // inferred — cast the response to a known shape and trust it.
    const r = await db()
      .from("client_partners")
      .select("*, partner:partners(*)")
      .eq("client_id", clientId)
    if (r.error) throw new Error(`Supabase: partnersFor — ${r.error.message}`)
    const rows = (r.data ?? []) as unknown as (ClientPartner & { partner: Partner | null })[]
    return rows.map((row) => ({
      id: row.id,
      client_id: row.client_id,
      partner_id: row.partner_id,
      split_pct: row.split_pct,
      created_at: row.created_at,
      partner: row.partner ?? null,
    }))
  },
  async clientsForPartner(partnerId) {
    const r = await db()
      .from("client_partners")
      .select("*, client:clients(*)")
      .eq("partner_id", partnerId)
    if (r.error) throw new Error(`Supabase: clientsForPartner — ${r.error.message}`)
    const rows = (r.data ?? []) as unknown as (ClientPartner & { client: Client | null })[]
    return rows.map((row) => ({
      id: row.id,
      client_id: row.client_id,
      partner_id: row.partner_id,
      split_pct: row.split_pct,
      created_at: row.created_at,
      client: row.client ?? null,
    }))
  },
  async createPartner(input) {
    const r = await db()
      .from("partners")
      .insert({
        name: input.name,
        email: input.email ?? null,
        role: input.role ?? null,
        default_split_pct: input.default_split_pct ?? 0,
        notes: input.notes ?? null,
      })
      .select()
      .single()
    return unwrap(r, "createPartner") as Partner
  },
  async updatePartner(id, patch) {
    const r = await db().from("partners").update(patch).eq("id", id).select().single()
    if (r.error) throw new Error(`Supabase: updatePartner — ${r.error.message}`)
    return r.data as Partner
  },
  async deletePartner(id) {
    const r = await db().from("partners").delete().eq("id", id)
    if (r.error) throw new Error(`Supabase: deletePartner — ${r.error.message}`)
  },
  async attachPartner(input) {
    // Use upsert against the unique (client_id, partner_id) constraint so
    // re-attaching doesn't blow up.
    const partner = await db().from("partners").select("default_split_pct").eq("id", input.partner_id).maybeSingle()
    const split = input.split_pct ?? partner.data?.default_split_pct ?? 0
    const r = await db()
      .from("client_partners")
      .upsert(
        {
          client_id: input.client_id,
          partner_id: input.partner_id,
          split_pct: split,
        },
        { onConflict: "client_id,partner_id" }
      )
      .select()
      .single()
    return unwrap(r, "attachPartner") as ClientPartner
  },
  async updateClientPartner(id, patch) {
    const r = await db().from("client_partners").update(patch).eq("id", id).select().single()
    if (r.error) throw new Error(`Supabase: updateClientPartner — ${r.error.message}`)
    return r.data as ClientPartner
  },
  async detachPartner(id) {
    const r = await db().from("client_partners").delete().eq("id", id)
    if (r.error) throw new Error(`Supabase: detachPartner — ${r.error.message}`)
  },

  // ── notes ────────────────────────────────────────────────────────────────
  async createNote(input) {
    const r = await db()
      .from("notes")
      .insert({
        content: input.content,
        client_id: input.client_id ?? null,
        lead_id: input.lead_id ?? null,
        author_id: input.author_id ?? null,
      })
      .select()
      .single()
    return unwrap(r, "createNote") as Note
  },
  async deleteNote(id) {
    const r = await db().from("notes").delete().eq("id", id)
    if (r.error) throw new Error(`Supabase: deleteNote — ${r.error.message}`)
  },
}

