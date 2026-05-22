// Cal.com webhook receiver.
//
// Subscribe in Cal.com → Settings → Developer → Webhooks to:
//   - BOOKING_CREATED       → upsert an event row
//   - BOOKING_RESCHEDULED   → update start_at / end_at on the existing row
//   - BOOKING_CANCELLED     → delete the row
//
// Auth: HMAC-SHA256 of the raw request body using CAL_WEBHOOK_SECRET (set
// when creating the webhook in Cal.com). Verification is skipped when the
// secret env var is unset, which is only safe in local dev.
//
// Idempotency: we upsert by `events.cal_booking_id` (unique, migration 012).
// Cal.com retries 5xx — keep handler returns 200 in expected cases.

import crypto from "node:crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { buildTaskFromEvent } from "@/lib/data-store"

export const runtime = "nodejs"

// ── Cal.com payload shape (the subset we use) ────────────────────────────
// Cal.com puts the *previous* booking uid under one of several names depending
// on platform version. We try them all so a future rename doesn't silently
// break reschedule handling.
type CalPayload = {
  triggerEvent: "BOOKING_CREATED" | "BOOKING_RESCHEDULED" | "BOOKING_CANCELLED"
  payload: {
    uid: string
    title?: string
    startTime: string
    endTime: string
    organizer?: { email?: string | null } | null
    attendees?: Array<{ email?: string | null }> | null
    // Reschedule-only — one of these holds the prior booking uid.
    rescheduleUid?: string | null
    rescheduleId?: string | null
    fromReschedule?: string | null
  }
}

// ─────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !serviceKey) {
    // Supabase isn't configured (demo mode). Acknowledge so Cal.com doesn't
    // pile up retries against this endpoint.
    return Response.json({ ok: true, skipped: "supabase-not-configured" })
  }

  const rawBody = await req.text()
  const signature = req.headers.get("x-cal-signature-256") ?? ""
  const secret = process.env.CAL_WEBHOOK_SECRET
  if (secret && !verifyHmac(rawBody, signature, secret)) {
    return Response.json({ ok: false, error: "bad-signature" }, { status: 401 })
  }

  let body: CalPayload
  try {
    body = JSON.parse(rawBody) as CalPayload
  } catch {
    return Response.json({ ok: false, error: "bad-json" }, { status: 400 })
  }

  // Temporary diagnostic — captures the full reschedule payload shape so we
  // can confirm which field holds the previous booking uid in this Cal.com
  // version. Remove once reschedule is verified working end-to-end.
  console.log("cal webhook", {
    triggerEvent: body.triggerEvent,
    uid: body.payload?.uid,
    rescheduleUid: body.payload?.rescheduleUid,
    rescheduleId: body.payload?.rescheduleId,
    fromReschedule: body.payload?.fromReschedule,
    payloadKeys: Object.keys(body.payload ?? {}),
  })

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  })

  try {
    switch (body.triggerEvent) {
      case "BOOKING_CREATED":
        await upsertBooking(supabase, body.payload, null)
        break
      case "BOOKING_RESCHEDULED": {
        // Cal.com keeps the old row alive on reschedule — it just fires this
        // event with a NEW uid. We have to point our row at the new uid so
        // the next webhook still matches; if we just upsert by the new uid
        // we'd duplicate. Carry the paired task_id across.
        const previousUid =
          body.payload.rescheduleUid ??
          body.payload.rescheduleId ??
          body.payload.fromReschedule ??
          null
        await upsertBooking(supabase, body.payload, previousUid)
        break
      }
      case "BOOKING_CANCELLED":
        await cancelBooking(supabase, body.payload.uid)
        break
      default:
        // Unhandled trigger — ack so we don't get reretried forever.
        break
    }
    return Response.json({ ok: true })
  } catch (err) {
    console.error("cal webhook error", err)
    // Any 5xx makes Cal.com retry. Return 200 so a one-off DB hiccup doesn't
    // spam the endpoint; surface the message in logs.
    return Response.json({ ok: false, error: String(err) })
  }
}

// ── Handlers ─────────────────────────────────────────────────────────────

async function upsertBooking(
  supabase: SupabaseClient,
  p: CalPayload["payload"],
  previousUid: string | null
) {
  const inviteeEmail = p.attendees?.[0]?.email ?? null
  const ownerEmail = p.organizer?.email ?? null

  const ownerId = ownerEmail ? await profileIdByEmail(supabase, ownerEmail) : null
  const { leadId, clientId } = inviteeEmail
    ? await leadOrClientByEmail(supabase, inviteeEmail)
    : { leadId: null, clientId: null }

  // Reschedule path: rewrite the existing row's cal_booking_id (and times)
  // in place so we keep the same row and task_id. If the previous row isn't
  // found (e.g. older booking pre-dating the integration), fall through to
  // the normal upsert which will insert a new row.
  if (previousUid) {
    const { data: prev } = await supabase
      .from("events")
      .select("id")
      .eq("cal_booking_id", previousUid)
      .maybeSingle()
    if (prev) {
      const { data: event, error } = await supabase
        .from("events")
        .update({
          title: p.title ?? "Cal.com booking",
          start_at: p.startTime,
          end_at: p.endTime,
          client_id: clientId,
          lead_id: leadId,
          attendees: ownerId ? [ownerId] : [],
          cal_booking_id: p.uid,
        })
        .eq("id", prev.id)
        .select("id, title, start_at, event_type, client_id, lead_id, task_id")
        .single()
      if (error || !event) throw new Error(`reschedule events: ${error?.message ?? "no row"}`)
      await ensurePairedTask(supabase, event)
      return
    }
  }

  const row = {
    title: p.title ?? "Cal.com booking",
    description: null,
    start_at: p.startTime,
    end_at: p.endTime,
    event_type: "meeting" as const,
    client_id: clientId,
    lead_id: leadId,
    attendees: ownerId ? [ownerId] : [],
    cal_booking_id: p.uid,
  }

  const { data: event, error } = await supabase
    .from("events")
    .upsert(row, { onConflict: "cal_booking_id" })
    .select("id, title, start_at, event_type, client_id, lead_id, task_id")
    .single()
  if (error || !event) throw new Error(`upsert events: ${error?.message ?? "no row"}`)

  await ensurePairedTask(supabase, event)
}

async function cancelBooking(supabase: SupabaseClient, uid: string) {
  // Look up the row first so we can clear the FK before deleting. The webhook
  // bypasses the EventBlockedByCalCom guard intentionally — Cal.com IS the
  // authoritative deleter here.
  const { data: event } = await supabase
    .from("events")
    .select("id, task_id")
    .eq("cal_booking_id", uid)
    .maybeSingle()
  if (!event) return  // already gone

  if (event.task_id) {
    const { error: ue } = await supabase
      .from("events")
      .update({ task_id: null })
      .eq("id", event.id)
    if (ue) console.warn(`cancel: detach task failed: ${ue.message}`)
  }

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", event.id)
  if (error) throw new Error(`delete events: ${error.message}`)
}

async function ensurePairedTask(
  supabase: SupabaseClient,
  event: { id: string; title: string; start_at: string; event_type: string; client_id: string | null; lead_id: string | null; task_id: string | null }
): Promise<void> {
  // The webhook only sends meeting bookings, but be defensive.
  if (event.event_type !== "meeting" && event.event_type !== "call") return

  const payload = buildTaskFromEvent(event)

  if (event.task_id) {
    // Mirror title/time to existing task.
    const { error } = await supabase
      .from("tasks")
      .update({
        title: payload.title,
        due_date: payload.due_date,
        due_time: payload.due_time,
      })
      .eq("id", event.task_id)
    if (error) console.warn(`webhook task mirror failed: ${error.message}`)
    return
  }

  // No paired task yet — create one and link.
  const { data: task, error: te } = await supabase
    .from("tasks")
    .insert({
      title: payload.title,
      description: null,
      due_date: payload.due_date,
      due_time: payload.due_time,
      priority: payload.priority,
      status: payload.status,
      assignee_ids: [],
      link: null,
      client_id: payload.client_id,
      lead_id: payload.lead_id,
    })
    .select("id")
    .single()
  if (te || !task) {
    console.warn(`webhook task create failed: ${te?.message ?? "no data"}`)
    return
  }
  const { error: ue } = await supabase
    .from("events")
    .update({ task_id: task.id })
    .eq("id", event.id)
  if (ue) console.warn(`webhook event link failed: ${ue.message}`)
}

// ── Mapping helpers ──────────────────────────────────────────────────────

async function profileIdByEmail(supabase: SupabaseClient, email: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle()
  return data?.id ?? null
}

async function leadOrClientByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<{ leadId: string | null; clientId: string | null }> {
  const [{ data: leadRow }, { data: clientRow }] = await Promise.all([
    supabase.from("leads").select("id").eq("email", email).maybeSingle(),
    supabase.from("clients").select("id").eq("contact_email", email).maybeSingle(),
  ])
  return {
    leadId: leadRow?.id ?? null,
    clientId: clientRow?.id ?? null,
  }
}

// ── Crypto ───────────────────────────────────────────────────────────────

function verifyHmac(body: string, providedHex: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex")
  // Cal.com sends just the hex digest (no "sha256=" prefix per docs).
  const given = providedHex.replace(/^sha256=/, "")
  if (expected.length !== given.length) return false
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(given, "hex"))
  } catch {
    return false
  }
}
