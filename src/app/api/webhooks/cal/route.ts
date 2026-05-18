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

export const runtime = "nodejs"

// ── Cal.com payload shape (the subset we use) ────────────────────────────
type CalPayload = {
  triggerEvent: "BOOKING_CREATED" | "BOOKING_RESCHEDULED" | "BOOKING_CANCELLED"
  payload: {
    uid: string
    title?: string
    startTime: string
    endTime: string
    organizer?: { email?: string | null } | null
    attendees?: Array<{ email?: string | null }> | null
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

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  })

  try {
    switch (body.triggerEvent) {
      case "BOOKING_CREATED":
      case "BOOKING_RESCHEDULED":
        await upsertBooking(supabase, body.payload)
        break
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

async function upsertBooking(supabase: SupabaseClient, p: CalPayload["payload"]) {
  const inviteeEmail = p.attendees?.[0]?.email ?? null
  const ownerEmail = p.organizer?.email ?? null

  // Best-effort mapping. Failures are non-fatal — the event still saves.
  const ownerId = ownerEmail ? await profileIdByEmail(supabase, ownerEmail) : null
  const { leadId, clientId } = inviteeEmail
    ? await leadOrClientByEmail(supabase, inviteeEmail)
    : { leadId: null, clientId: null }

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

  const { error } = await supabase
    .from("events")
    .upsert(row, { onConflict: "cal_booking_id" })
  if (error) throw new Error(`upsert events: ${error.message}`)
}

async function cancelBooking(supabase: SupabaseClient, uid: string) {
  const { error } = await supabase
    .from("events")
    .delete()
    .eq("cal_booking_id", uid)
  if (error) throw new Error(`delete events: ${error.message}`)
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
