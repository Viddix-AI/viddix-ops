// Static seed data used as a fallback when Supabase isn't connected and as
// reference values for SQL inserts. Not auto-loaded — these are constants.
import type {
  Client,
  Event,
  Lead,
  Note,
  Profile,
  Task,
} from "@/lib/types"

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`

export const SEED_PROFILES: Profile[] = [
  {
    id: id(1),
    full_name: "Pablo Martin",
    email: "pablo@viddix.ai",
    avatar_url: null,
    role: "founder",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: id(2),
    full_name: "Pablo Capita",
    email: "capita@viddix.ai",
    avatar_url: null,
    role: "ops",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: id(3),
    full_name: "Pablo Sanz",
    email: "sanz@viddix.ai",
    avatar_url: null,
    role: "engineering",
    created_at: "2026-01-01T00:00:00Z",
  },
]

const PABLO_M = id(1)
const PABLO_C = id(2)
const PABLO_S = id(3)

export const SEED_CLIENTS: Client[] = [
  {
    id: id(101),
    name: "Jake Shultz",
    contact_name: "Jake Shultz",
    contact_email: "jake@shultz.co",
    contact_phone: null,
    mrr: 500,
    status: "active",
    industry: "Real Estate",
    website: null,
    notes: "AI lead-qualifier agent. Monthly retainer.",
    started_at: "2025-11-01",
    owner_id: PABLO_M,
    created_at: "2025-11-01T00:00:00Z",
    updated_at: "2026-04-15T00:00:00Z",
  },
  {
    id: id(102),
    name: "Matt Lavinder",
    contact_name: "Matt Lavinder",
    contact_email: "matt@lavinder.io",
    contact_phone: null,
    mrr: 500,
    status: "active",
    industry: "Coaching",
    website: null,
    notes: "Inbound DM responder + content automations.",
    started_at: "2025-12-10",
    owner_id: PABLO_C,
    created_at: "2025-12-10T00:00:00Z",
    updated_at: "2026-04-10T00:00:00Z",
  },
  {
    id: id(103),
    name: "Ingederen",
    contact_name: "Iván Gederen",
    contact_email: "ivan@ingederen.com",
    contact_phone: null,
    mrr: 1800,
    status: "active",
    industry: "B2B Services",
    website: "https://ingederen.com",
    notes: "Full sales-ops automation suite. Largest account.",
    started_at: "2025-09-15",
    owner_id: PABLO_M,
    created_at: "2025-09-15T00:00:00Z",
    updated_at: "2026-04-20T00:00:00Z",
  },
  {
    id: id(104),
    name: "Hotel Náyade",
    contact_name: "Reservas Náyade",
    contact_email: "reservas@hotelnayade.es",
    contact_phone: null,
    mrr: 800,
    status: "active",
    industry: "Hospitality",
    website: "https://hotelnayade.es",
    notes: "Reservation chat agent (ES/EN) + WhatsApp triage.",
    started_at: "2026-01-05",
    owner_id: PABLO_S,
    created_at: "2026-01-05T00:00:00Z",
    updated_at: "2026-04-25T00:00:00Z",
  },
  {
    id: id(105),
    name: "Big Elephant",
    contact_name: "Marc Tan",
    contact_email: "marc@bigelephant.co",
    contact_phone: null,
    mrr: 400,
    status: "active",
    industry: "E-commerce",
    website: null,
    notes: "Product research + content engine.",
    started_at: "2026-02-12",
    owner_id: PABLO_C,
    created_at: "2026-02-12T00:00:00Z",
    updated_at: "2026-04-18T00:00:00Z",
  },
]

export const SEED_LEADS: Lead[] = [
  { id: id(201), name: "Sara Ortega", company: "Bloomwell Clinics", email: "sara@bloomwell.co", phone: null, source: "Referral", stage: "new",         value: 1200, position: 0, owner_id: PABLO_M, notes: null, created_at: "2026-04-28T00:00:00Z", updated_at: "2026-04-28T00:00:00Z" },
  { id: id(202), name: "Tom Reilly",  company: "Reilly & Co",       email: "tom@reilly.co",     phone: null, source: "LinkedIn", stage: "contacted",   value: 600,  position: 0, owner_id: PABLO_C, notes: null, created_at: "2026-04-22T00:00:00Z", updated_at: "2026-04-26T00:00:00Z" },
  { id: id(203), name: "Lucía Pérez", company: "Pérez Inmobiliaria", email: "lucia@perez.es",   phone: null, source: "Cold email", stage: "contacted", value: 900,  position: 1, owner_id: PABLO_M, notes: null, created_at: "2026-04-20T00:00:00Z", updated_at: "2026-04-25T00:00:00Z" },
  { id: id(204), name: "Mark Foster", company: "Foster Roofing",    email: "mark@foster.co",    phone: null, source: "Inbound", stage: "qualified",   value: 1500, position: 0, owner_id: PABLO_S, notes: "Wants demo next week", created_at: "2026-04-18T00:00:00Z", updated_at: "2026-04-29T00:00:00Z" },
  { id: id(205), name: "Aisha Kahn",  company: "Kahn Legal",        email: "aisha@kahnlegal.com", phone: null, source: "Referral", stage: "proposal", value: 2200, position: 0, owner_id: PABLO_M, notes: "Sent proposal 4/30", created_at: "2026-04-15T00:00:00Z", updated_at: "2026-04-30T00:00:00Z" },
  { id: id(206), name: "David Chen",  company: "Chen Auto Group",   email: "david@chenauto.com", phone: null, source: "Outbound", stage: "negotiation", value: 1800, position: 0, owner_id: PABLO_C, notes: "Pricing pushback", created_at: "2026-04-08T00:00:00Z", updated_at: "2026-05-01T00:00:00Z" },
  { id: id(207), name: "Emma Walsh",  company: "Walsh Studio",      email: "emma@walsh.studio", phone: null, source: "Inbound", stage: "won",         value: 700,  position: 0, owner_id: PABLO_M, notes: "Closed 4/29", created_at: "2026-04-01T00:00:00Z", updated_at: "2026-04-29T00:00:00Z" },
  { id: id(208), name: "Ravi Singh",  company: "Singh Logistics",   email: "ravi@singhlog.com", phone: null, source: "Cold call", stage: "lost",       value: 1000, position: 0, owner_id: PABLO_S, notes: "Went with in-house",  created_at: "2026-03-20T00:00:00Z", updated_at: "2026-04-22T00:00:00Z" },
]

const today = new Date()
const iso = (offsetDays: number) => {
  const d = new Date(today)
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}
const isoT = (offsetDays: number, hour = 10) => {
  const d = new Date(today)
  d.setDate(d.getDate() + offsetDays)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

export const SEED_TASKS: Task[] = [
  { id: id(301), title: "Send proposal to Aisha Kahn",        description: null, due_date: iso(-1), priority: "high",   status: "todo",        assignee_id: PABLO_M, client_id: null,    lead_id: id(205), created_at: "", updated_at: "" },
  { id: id(302), title: "Onboarding call — Big Elephant",     description: null, due_date: iso(0),  priority: "high",   status: "todo",        assignee_id: PABLO_C, client_id: id(105), lead_id: null,    created_at: "", updated_at: "" },
  { id: id(303), title: "Weekly report — Ingederen",          description: null, due_date: iso(0),  priority: "medium", status: "in_progress", assignee_id: PABLO_M, client_id: id(103), lead_id: null,    created_at: "", updated_at: "" },
  { id: id(304), title: "Fix WhatsApp webhook — Hotel Náyade", description: null, due_date: iso(0),  priority: "urgent", status: "in_progress", assignee_id: PABLO_S, client_id: id(104), lead_id: null,    created_at: "", updated_at: "" },
  { id: id(305), title: "Follow up with David Chen",          description: null, due_date: iso(1),  priority: "high",   status: "todo",        assignee_id: PABLO_C, client_id: null,    lead_id: id(206), created_at: "", updated_at: "" },
  { id: id(306), title: "Review Matt's content automations",  description: null, due_date: iso(2),  priority: "medium", status: "todo",        assignee_id: PABLO_M, client_id: id(102), lead_id: null,    created_at: "", updated_at: "" },
  { id: id(307), title: "Demo prep for Mark Foster",          description: null, due_date: iso(3),  priority: "medium", status: "todo",        assignee_id: PABLO_S, client_id: null,    lead_id: id(204), created_at: "", updated_at: "" },
  { id: id(308), title: "Refactor agent prompt — Jake",       description: null, due_date: iso(4),  priority: "low",    status: "todo",        assignee_id: PABLO_S, client_id: id(101), lead_id: null,    created_at: "", updated_at: "" },
  { id: id(309), title: "Q2 retros + roadmap",                description: null, due_date: iso(7),  priority: "medium", status: "todo",        assignee_id: PABLO_M, client_id: null,    lead_id: null,    created_at: "", updated_at: "" },
  { id: id(310), title: "Update pricing page",                description: null, due_date: iso(10), priority: "low",    status: "todo",        assignee_id: PABLO_C, client_id: null,    lead_id: null,    created_at: "", updated_at: "" },
]

export const SEED_EVENTS: Event[] = [
  { id: id(401), title: "Aisha Kahn — proposal walk-through", description: null, start_at: isoT(0,  16), end_at: isoT(0,  17), event_type: "call",     client_id: null,    lead_id: id(205), attendees: [PABLO_M], created_at: "" },
  { id: id(402), title: "Onboarding — Big Elephant",          description: null, start_at: isoT(0,  11), end_at: isoT(0,  12), event_type: "meeting",  client_id: id(105), lead_id: null,    attendees: [PABLO_C, PABLO_M], created_at: "" },
  { id: id(403), title: "Mark Foster demo",                   description: null, start_at: isoT(3,  15), end_at: isoT(3,  16), event_type: "meeting",  client_id: null,    lead_id: id(204), attendees: [PABLO_S, PABLO_M], created_at: "" },
  { id: id(404), title: "Ingederen monthly review",           description: null, start_at: isoT(5,  10), end_at: isoT(5,  11), event_type: "meeting",  client_id: id(103), lead_id: null,    attendees: [PABLO_M], created_at: "" },
  { id: id(405), title: "Internal — sprint planning",         description: null, start_at: isoT(2,   9), end_at: isoT(2,  10), event_type: "internal", client_id: null,    lead_id: null,    attendees: [PABLO_M, PABLO_C, PABLO_S], created_at: "" },
]

export const SEED_NOTES: Note[] = [
  { id: id(501), content: "Proposal sent 4/30 — $2.2k retainer + setup",        client_id: null,    lead_id: id(205), author_id: PABLO_M, created_at: "2026-04-30T00:00:00Z" },
  { id: id(502), content: "Loves the pilot. Pushing on price — ok at $1.5k.",   client_id: null,    lead_id: id(206), author_id: PABLO_C, created_at: "2026-05-01T00:00:00Z" },
  { id: id(503), content: "Wants WhatsApp + booking flow integrated by Q2 end.", client_id: id(104), lead_id: null,    author_id: PABLO_S, created_at: "2026-04-25T00:00:00Z" },
]

// Combined "database" used by the in-memory fallback when Supabase isn't set
export const SEED_DB = {
  profiles: SEED_PROFILES,
  clients:  SEED_CLIENTS,
  leads:    SEED_LEADS,
  tasks:    SEED_TASKS,
  events:   SEED_EVENTS,
  notes:    SEED_NOTES,
}
