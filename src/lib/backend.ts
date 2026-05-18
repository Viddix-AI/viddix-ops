// Shared interface for the data backend. The localStorage-backed `store` is
// the default — every method here is async so a Supabase backend can swap in
// without touching the React Query hooks (they already wrap calls in
// `async () => ...` so the await unwraps either a value or a Promise).

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

export interface Backend {
  reset(): Promise<void>

  // Reads
  profiles():       Promise<Profile[]>
  clients():        Promise<Client[]>
  leads():          Promise<Lead[]>
  tasks():          Promise<Task[]>
  events():         Promise<Event[]>
  notes():          Promise<Note[]>
  partners():       Promise<Partner[]>
  clientPartners(): Promise<ClientPartner[]>
  activities():     Promise<Activity[]>

  client(id: string): Promise<Client | null>
  lead(id: string):   Promise<Lead | null>

  notesFor(opts:  { clientId?: string; leadId?: string }): Promise<Note[]>
  tasksFor(opts:  { clientId?: string; leadId?: string }): Promise<Task[]>
  eventsFor(opts: { clientId?: string; leadId?: string }): Promise<Event[]>

  // Leads
  createLead(input: Partial<Lead> & { name: string }): Promise<Lead>
  updateLead(id: string, patch: Partial<Lead>):        Promise<Lead | null>
  moveLead(id: string, toStage: Lead["stage"], toIndex: number): Promise<void>
  deleteLead(id: string):                              Promise<void>
  convertLeadToClient(id: string):                     Promise<Client | null>

  // Clients
  createClient(input: Partial<Client> & { name: string }): Promise<Client>
  updateClient(id: string, patch: Partial<Client>):        Promise<Client | null>
  deleteClient(id: string):                                Promise<void>

  // Tasks
  createTask(input: Partial<Task> & { title: string }): Promise<Task>
  updateTask(id: string, patch: Partial<Task>):         Promise<Task | null>
  deleteTask(id: string):                               Promise<void>

  // Events
  createEvent(input: Partial<Event> & { title: string; start_at: string }): Promise<Event>
  updateEvent(id: string, patch: Partial<Event>):                           Promise<Event | null>
  deleteEvent(id: string):                                                  Promise<void>

  // Profiles
  updateProfile(id: string, patch: Partial<Profile>): Promise<Profile | null>

  // Partners
  partnersFor(clientId: string): Promise<(ClientPartner & { partner: Partner | null })[]>
  clientsForPartner(partnerId: string): Promise<(ClientPartner & { client: Client | null })[]>
  createPartner(input: Partial<Partner> & { name: string }): Promise<Partner>
  updatePartner(id: string, patch: Partial<Partner>):        Promise<Partner | null>
  deletePartner(id: string):                                 Promise<void>
  attachPartner(input: { client_id: string; partner_id: string; split_pct?: number }): Promise<ClientPartner>
  updateClientPartner(id: string, patch: Partial<Pick<ClientPartner, "split_pct">>): Promise<ClientPartner | null>
  detachPartner(id: string):                                 Promise<void>

  // Notes
  createNote(input: { content: string; client_id?: string; lead_id?: string; author_id?: string }): Promise<Note>
  deleteNote(id: string): Promise<void>
}

export const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
