// Static seed data used as a fallback when Supabase isn't connected and as
// reference values for SQL inserts. Not auto-loaded — these are constants.
import type {
  Activity,
  Client,
  ClientPartner,
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
    team: "madrid",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: id(2),
    full_name: "Pablo Capita",
    email: "capita@viddix.ai",
    avatar_url: null,
    role: "ops",
    team: "madrid",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: id(3),
    full_name: "Pablo Sanz",
    email: "sanz@viddix.ai",
    avatar_url: null,
    role: "engineering",
    team: "us",
    created_at: "2026-01-01T00:00:00Z",
  },
]

// All operational data ships empty so the workspace boots clean. Profiles
// stay populated because they represent the actual team and double as
// "owner" / "actor" defaults across the UI.
export const SEED_CLIENTS: Client[] = []
export const SEED_LEADS: Lead[] = []
export const SEED_TASKS: Task[] = []
export const SEED_EVENTS: Event[] = []
export const SEED_NOTES: Note[] = []
export const SEED_PARTNERS: Partner[] = []
export const SEED_CLIENT_PARTNERS: ClientPartner[] = []
export const SEED_ACTIVITIES: Activity[] = []

// Combined "database" used by the in-memory fallback when Supabase isn't set
export const SEED_DB = {
  profiles:        SEED_PROFILES,
  clients:         SEED_CLIENTS,
  leads:           SEED_LEADS,
  tasks:           SEED_TASKS,
  events:          SEED_EVENTS,
  notes:           SEED_NOTES,
  partners:        SEED_PARTNERS,
  client_partners: SEED_CLIENT_PARTNERS,
  activities:      SEED_ACTIVITIES,
}
