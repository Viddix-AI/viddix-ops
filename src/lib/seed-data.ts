// Static seed data used as a fallback when Supabase isn't connected and as
// reference values for SQL inserts. Not auto-loaded — these are constants.
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

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`

export const SEED_PROFILES: Profile[] = [
  {
    id: id(1),
    full_name: "Pablo Martin",
    email: "pablo@viddix.ai",
    avatar_url: null,
    role: "founder",
    cal_link: null,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: id(2),
    full_name: "Pablo Capita",
    email: "capita@viddix.ai",
    avatar_url: null,
    role: "ops",
    cal_link: null,
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: id(3),
    full_name: "Pablo Sanz",
    email: "sanz@viddix.ai",
    avatar_url: null,
    role: "engineering",
    cal_link: null,
    created_at: "2026-01-01T00:00:00Z",
  },
]

// All operational data ships empty so the workspace boots clean. Profiles
// stay populated because they represent the actual team and double as
// "owner" / "actor" defaults across the UI. The exception is a small set of
// example clients so the dashboard "Upcoming renewals" widget has something to
// show in demo mode — see SEED_CLIENTS below.
const DEMO_DATE = (offsetDays: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

export const SEED_CLIENTS: Client[] = [
  {
    id: id(101),
    name: "Northwind Labs",
    contact_name: "Jordan Avery",
    contact_email: "jordan@northwind.example",
    contact_phone: "+1 555 010 2030",
    mrr: 4800,
    industry: "biotech",
    website: "https://northwind.example",
    notes: null,
    started_at: DEMO_DATE(-380),
    contract_start_date: DEMO_DATE(-365),
    contract_end_date: DEMO_DATE(14),
    renewal_date: DEMO_DATE(14),
    owner_id: id(1),
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: id(102),
    name: "Atlas Studio",
    contact_name: "Mei Tanaka",
    contact_email: "mei@atlas.example",
    contact_phone: null,
    mrr: 2200,
    industry: "design",
    website: null,
    notes: null,
    started_at: DEMO_DATE(-220),
    contract_start_date: DEMO_DATE(-200),
    contract_end_date: DEMO_DATE(-5),
    renewal_date: DEMO_DATE(-5),
    owner_id: id(2),
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: id(103),
    name: "Greenfield Co",
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    mrr: 1500,
    industry: null,
    website: null,
    notes: null,
    started_at: null,
    contract_start_date: null,
    contract_end_date: null,
    renewal_date: null,
    owner_id: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
]
export const SEED_LEADS: Lead[] = []
export const SEED_TASKS: Task[] = []
export const SEED_EVENTS: Event[] = []
export const SEED_NOTES: Note[] = []
export const SEED_CONTACTS: Contact[] = [
  {
    id: id(201),
    client_id: id(101),
    full_name: "Jordan Avery",
    email: "jordan@northwind.example",
    phone: "+1 555 010 2030",
    role: "primary",
    title: "Head of Ops",
    is_primary: true,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: id(202),
    client_id: id(102),
    full_name: "Mei Tanaka",
    email: "mei@atlas.example",
    phone: null,
    role: "primary",
    title: "Creative Director",
    is_primary: true,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
]
export const SEED_PARTNERS: Partner[] = []
export const SEED_CLIENT_PARTNERS: ClientPartner[] = []
export const SEED_ACTIVITIES: Activity[] = []

// Combined "database" used by the in-memory fallback when Supabase isn't set
export const SEED_DB = {
  profiles:        SEED_PROFILES,
  clients:         SEED_CLIENTS,
  contacts:        SEED_CONTACTS,
  leads:           SEED_LEADS,
  tasks:           SEED_TASKS,
  events:          SEED_EVENTS,
  notes:           SEED_NOTES,
  partners:        SEED_PARTNERS,
  client_partners: SEED_CLIENT_PARTNERS,
  activities:      SEED_ACTIVITIES,
}
