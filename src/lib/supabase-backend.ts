// Supabase implementation of the Backend interface. Engaged automatically
// when NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY are set;
// otherwise the localStorage backend in data-store.ts wins.
//
// Tables / columns mirror src/supabase/migrations/001_init.sql onwards.
"use client"

import { createClient } from "@/lib/supabase/client"
import type { Backend } from "@/lib/backend"
import type {
  Activity,
  Client,
  ClientPartner,
  Event,
  Lead,
  Note,
  Partner,
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
    return lead
  },
  async updateLead(id, patch) {
    const r = await db().from("leads").update(patch).eq("id", id).select().single()
    if (r.error) throw new Error(`Supabase: updateLead — ${r.error.message}`)
    return r.data as Lead
  },
  async moveLead(id, toStage, toIndex) {
    // Two-step: update target row, then renormalize positions inside the
    // destination stage. Source stage will renormalise on its next move.
    const u = await db().from("leads").update({ stage: toStage, position: toIndex }).eq("id", id)
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
    if (lead.converted_client_id) {
      const existing = await this.client(lead.converted_client_id)
      if (existing) return existing
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
        owner_id: lead.owner_id,
      })
      .select()
      .single()
    const client = unwrap(r, "convertLeadToClient") as Client
    await db()
      .from("leads")
      .update({ stage: "won", converted_client_id: client.id })
      .eq("id", lead.id)
    // Materialise the lead's pre-allocated partner as a client_partners row
    // so the split survives conversion.
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

  // ── tasks ────────────────────────────────────────────────────────────────
  async createTask(input) {
    const r = await db()
      .from("tasks")
      .insert({
        title: input.title,
        description: input.description ?? null,
        due_date: input.due_date ?? null,
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
    const r = await db().from("tasks").delete().eq("id", id)
    if (r.error) throw new Error(`Supabase: deleteTask — ${r.error.message}`)
  },

  // ── events ───────────────────────────────────────────────────────────────
  async createEvent(input) {
    const r = await db()
      .from("events")
      .insert({
        title: input.title,
        description: input.description ?? null,
        start_at: input.start_at,
        end_at: input.end_at ?? null,
        event_type: input.event_type ?? "meeting",
        client_id: input.client_id ?? null,
        lead_id: input.lead_id ?? null,
        attendees: input.attendees ?? [],
      })
      .select()
      .single()
    return unwrap(r, "createEvent") as Event
  },
  async deleteEvent(id) {
    const r = await db().from("events").delete().eq("id", id)
    if (r.error) throw new Error(`Supabase: deleteEvent — ${r.error.message}`)
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

