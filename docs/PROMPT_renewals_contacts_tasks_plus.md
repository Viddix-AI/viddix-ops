# Viddix Ops — Prompt para Claude Code: Renewals + Multi-Contact + Tasks Plus

> Copia y pega el bloque `## PROMPT` completo en Claude Code dentro de este
> repo. Es Next.js 16 + React 19 + Tailwind v4 + shadcn `base-nova` +
> `@base-ui/react` + Supabase + TanStack Query.
>
> **Objetivo del prompt: que funcione**. No estética nueva, no refactor del
> modelo. Añadir 5 capacidades sobre el schema existente.

---

## PROMPT

Vas a añadir 5 capacidades a `viddix-ops` (Next.js 16.2.4, React 19.2.4,
Tailwind v4, shadcn `base-nova`, `@base-ui/react`, Supabase, TanStack
Query, `@hello-pangea/dnd`). Lee `AGENTS.md` y, antes de tocar nada de
App Router, repasa `node_modules/next/dist/docs/` — esta versión de Next
tiene breaking changes documentados.

**Prioridad absoluta: que funcione end-to-end en los DOS backends
(`src/lib/data-store.ts` localStorage y `src/lib/supabase-backend.ts`)**.
Toda la app está conectada a través de la interfaz `Backend`
(`src/lib/backend.ts`). Si una operación nueva no existe en ambos
backends, la UI rompe en demo o en producción.

### 0. Contexto que NO debes romper

- Convención de tablas: `id uuid pk default gen_random_uuid()`,
  `created_at timestamptz default now()`, `updated_at timestamptz default
  now()` con trigger `set_updated_at` (ver `001_init.sql`).
- RLS uniforme: `team read` y `team write` con `using (true)` para
  `authenticated`. Aplica el mismo patrón a tablas nuevas.
- `Database` en `src/lib/types.ts` declara `Tables.<name>` con `Row<T>`.
  Cada nueva tabla añade su entrada ahí.
- `data-store.ts` tiene un `read()` que "cura" payloads legacy de
  localStorage. Cualquier campo nuevo en una entidad existente requiere
  un default en ese healer; subir `KEY` (hoy `viddix-ops:v7`) sólo si el
  cambio es incompatible.
- Cada mutación llama a `record(db, kind, message, refs)` (local) o
  `logActivity({...})` (supabase) con un `ActivityKind`. Añade los
  nuevos kinds al enum TS (`types.ts:ActivityKind`) Y al CHECK del SQL
  (`migration 008` + cualquier extensión posterior — usa una nueva
  migración tipo `013_activity_event_updated.sql` para extender el
  CHECK, no edites una migración antigua).
- El pairing automático `events.task_id` (migration 014) **ya existe y
  funciona**. No lo toques. Cuando añadas subtasks/recurring, respeta
  que un task creado vía pairing de evento NO se duplique como subtask
  ni se reprograme como recurrente automáticamente (los eventos los
  reprograma Cal.com).
- Hooks viven en `src/hooks/use-*.ts` con TanStack Query, `KEY` como
  `[entidad]`, e `invalidateQueries` en `onSuccess`. Sigue ese patrón.
- Dialogs/Sheets están bajo `src/components/ui/`. Reusa Sheet para
  formularios complejos, Dialog para confirmaciones cortas.
- **No introduzcas librerías nuevas sin justificación**. Para reglas de
  recurrencia, usa `date-fns` (ya instalado) — no añadas `rrule.js`.

---

### 1. Contract dates en clientes

**Migración** `src/supabase/migrations/015_client_contract_dates.sql`:

```sql
alter table public.clients
  add column if not exists contract_start_date date,
  add column if not exists contract_end_date   date,
  add column if not exists renewal_date        date;

-- Cuando renewal_date < hoy y el cliente sigue activo, dashboard widget
-- lo destacará. Index para el lookup "próximas renovaciones".
create index if not exists clients_renewal_idx
  on public.clients(renewal_date)
  where renewal_date is not null;

create index if not exists clients_contract_end_idx
  on public.clients(contract_end_date)
  where contract_end_date is not null;
```

**Tipos** (`src/lib/types.ts`): añade a `Client`:

```ts
contract_start_date: string | null
contract_end_date:   string | null
renewal_date:        string | null
```

**Data-store healer** (`src/lib/data-store.ts` `read()`): añade los 3
campos con default `null` al `clients` map. No subas `KEY`.

**Seed** (`src/lib/seed-data.ts`): rellena un par de clientes con fechas
de ejemplo (uno con renewal en +14d, otro vencido, uno sin fechas) para
que el dashboard widget tenga algo que mostrar.

**Backend** (`src/lib/supabase-backend.ts`): no hacen falta métodos
nuevos. `updateClient` pasa el patch tal cual.

**UI**:

1. `src/app/(dashboard)/clients/add-client-dialog.tsx` — añade 3 inputs
   tipo date: Contract start / Contract end / Next renewal. Opcionales.
2. `src/app/(dashboard)/clients/[id]/client-detail.tsx` —
   - En `Card "Overview"`: añade `ContactRow` para los 3 nuevos campos
     (mantén el grid `sm:grid-cols-2` y ordena: industry, started_at,
     contract_start_date, contract_end_date, renewal_date, contact).
   - Permite edición inline: convierte estos campos en un mini-form que
     llame a `useUpdateClient`. Reusa el patrón de "store-info-from-
     previous-renders" si quieres evitar `useEffect`.
3. `src/app/(dashboard)/clients/clients-table.tsx` — añade columna
   ordenable "Renewal" tras "Started". Si `renewal_date < today`, pinta
   el texto en `text-destructive`; si está en los próximos 30 días, en
   `text-warning` (token semántico ya existe en `globals.css`).
4. Dashboard `src/app/(dashboard)/dashboard/page.tsx` — añade un nuevo
   `Card` lateral "Upcoming renewals" (top 5 clientes con
   `renewal_date BETWEEN today AND today + 60d`, ordenados ascendente).
   Cada fila: nombre cliente, días restantes, MRR. Link a
   `/clients/{id}`. Si no hay ninguno: `EmptyState size="sm"`.

**Activity log**: ninguna entrada nueva específica — el
`client_updated` existente cubre cambios de fechas (ya está en el enum).

**Smoke**:
- Crear cliente con renewal date dentro de 30d → aparece en widget.
- Editar renewal date inline → la tabla y el widget refrescan.
- Filtro/ordenación por la columna Renewal funciona en ambos sentidos.

---

### 2. Contactos múltiples por cliente

**Migración** `src/supabase/migrations/016_client_contacts.sql`:

```sql
do $$ begin
  create type contact_role as enum (
    'primary','champion','decision_maker','influencer','blocker','other'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  full_name   text not null,
  email       text,
  phone       text,
  role        contact_role not null default 'other',
  title       text,
  is_primary  boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists contacts_client_idx     on public.contacts(client_id);
create index if not exists contacts_email_idx      on public.contacts(email);
create unique index if not exists contacts_one_primary_per_client
  on public.contacts(client_id) where is_primary;

drop trigger if exists trg_contacts_updated on public.contacts;
create trigger trg_contacts_updated before update on public.contacts
  for each row execute function public.set_updated_at();

-- Backfill: cada cliente con contact_name no nulo se materializa como
-- contacto primario. Idempotente — sólo inserta si no existe ya.
insert into public.contacts (client_id, full_name, email, phone, role, is_primary)
select
  c.id,
  coalesce(nullif(c.contact_name, ''), c.name),
  c.contact_email,
  c.contact_phone,
  'primary'::contact_role,
  true
from public.clients c
where c.contact_name is not null
  and not exists (
    select 1 from public.contacts ct where ct.client_id = c.id
  );

-- RLS team-wide read/write idéntica al resto.
alter table public.contacts enable row level security;

do $$ begin
  drop policy if exists "team read"  on public.contacts;
  drop policy if exists "team write" on public.contacts;
  create policy "team read"  on public.contacts
    for select to authenticated using (true);
  create policy "team write" on public.contacts
    for all    to authenticated using (true) with check (true);
end $$;
```

**Decisión sobre `clients.contact_name/email/phone`**: NO las dropees.
Quedan como "shortcut al contacto primario" para no romper el resto de
la app. La fuente de verdad para multi-contacto pasa a ser `contacts`.
Documenta esto en un comentario al inicio de la migración 016.

**Tipos** (`src/lib/types.ts`):

```ts
export type ContactRole =
  | "primary" | "champion" | "decision_maker"
  | "influencer" | "blocker" | "other"

export type Contact = {
  id: string
  client_id: string
  full_name: string
  email: string | null
  phone: string | null
  role: ContactRole
  title: string | null
  is_primary: boolean
  notes: string | null
  created_at: string
  updated_at: string
}
```

Añade a `Database.Tables.contacts: Row<Contact>` y al enum
`Database.public.Enums.contact_role: ContactRole`.

Añade `ActivityKind`: `'contact_created' | 'contact_updated' |
'contact_deleted' | 'contact_set_primary'`. Y extiende el CHECK de
`activities.kind` con una nueva migración
`017_activity_contact_kinds.sql` (drop constraint + recreate, como hizo
`013_activity_event_updated.sql`).

**Backend** — añade a `Backend` (`src/lib/backend.ts`):

```ts
contactsFor(clientId: string): Promise<Contact[]>
createContact(input: Partial<Contact> & { client_id: string; full_name: string }): Promise<Contact>
updateContact(id: string, patch: Partial<Contact>): Promise<Contact | null>
deleteContact(id: string): Promise<void>
setPrimaryContact(clientId: string, contactId: string): Promise<void>
```

Implementaciones:

- **localStorage** (`src/lib/data-store.ts`): añade
  `contacts: Contact[]` al tipo `DB` + seed vacío en `seed()` (o algunos
  contactos de ejemplo). En `read()`, healer: `parsed.contacts ?? []`.
  `setPrimaryContact` debe poner `is_primary=false` en los otros
  contactos del mismo cliente antes de marcar el nuevo (atómico dentro
  del mismo `write()`).
- **Supabase** (`src/lib/supabase-backend.ts`): `setPrimaryContact` =
  dos statements: update todos los del cliente a false, update el
  elegido a true. Idealmente en un RPC; mínimo viable: hazlo en dos
  llamadas con manejo de error explícito. Llama `logActivity` con
  `kind: 'contact_set_primary'`.

**Hook nuevo** `src/hooks/use-contacts.ts` — sigue el patrón de
`use-clients.ts`:

```ts
useContactsFor(clientId)
useCreateContact()
useUpdateContact()
useDeleteContact()
useSetPrimaryContact()
```

Cuando una mutación de contactos cambia `is_primary`, también invalida
`["clients"]` y `["client", clientId]` (porque el cliente puede surface
el contacto primario en otras vistas).

**UI**:

1. Nuevo tab **"Contacts"** en `client-detail.tsx` (entre Tasks y
   Notes, o como primer tab). Lista los contactos del cliente con:
   - Avatar (initials), nombre, role como `Pill`, title opcional,
     email, phone.
   - Badge "Primary" si `is_primary`.
   - Botón `Set primary` (oculto si ya lo es).
   - Botón `Edit` → abre Dialog `EditContactDialog`.
   - Botón `Delete` → confirm.
   - `EmptyState` cuando no hay.
2. Botón en header del tab "+ Add contact" → Dialog
   `AddContactDialog` (nuevo fichero `add-contact-dialog.tsx`). Campos:
   full_name (req), email, phone, role (Select), title, notes,
   is_primary (checkbox — al marcarlo, advierte que desmarcará el
   anterior).
3. Sustituye los campos `Contact email/phone/name` del Card "Overview"
   por una mini-lectura del contacto primario:
   `useContactsFor(client.id)` → busca `is_primary` → muestra. Si no
   hay primario, muestra el primero. Si no hay ninguno, "No contacts
   yet" con CTA al tab.
4. Command palette (`src/components/dashboard/command-palette.tsx`):
   añade group **"Contacts"** que matchea full_name/email/title y
   navega a `/clients/{client_id}?tab=contacts&contact={id}`. Lee el
   query param en `client-detail` para auto-abrir el tab y resaltar la
   fila.

**Activity log**: emite `contact_created`, `contact_updated`,
`contact_deleted`, `contact_set_primary` con `client_id` poblado en la
fila de activities (no inventes una columna `contact_id` en activities
— linkea via client).

**Smoke**:
- Migración corre limpia sobre BD con datos. Verifica backfill: clientes
  existentes con `contact_name` no nulo aparecen como primary.
- Crear segundo contacto, marcarlo primario → el anterior pierde el
  flag. Unique index no se queja.
- Cascade: borrar un cliente borra sus contactos (FK).
- Demo mode (sin Supabase): funciona idéntico contra localStorage.

---

### 3. Pairing event ↔ task — NO TOCAR

Migration 014 + lógica en `supabase-backend.ts` (`createEvent`,
`updateEvent`, `deleteEvent`) y en `app/api/webhooks/cal/route.ts`
(`ensurePairedTask`). Funciona. Sólo asegúrate de que la sección 4
(subtasks/recurring/time) **no rompe** estos flujos:

- Si añades `recurrence` a `tasks`, las tasks pairadas con eventos
  Cal.com deben quedar con `recurrence='none'`. Cal.com es la fuente de
  recurrencia.
- Si añades `parent_id` (subtasks), las tasks pairadas con eventos
  siempre son root (`parent_id=null`).
- Documenta estos invariantes en `buildTaskFromEvent` (vive duplicado
  en `data-store.ts` y `app/api/webhooks/cal/route.ts` — extrae a
  `src/lib/build-task-from-event.ts` SIN `"use client"` para que ambos
  consumers lo importen. El comentario actual en `route.ts:20-26`
  explica por qué se duplicó; con un módulo neutro se resuelve).

---

### 4. Subtasks + checklist + recurring + time tracking

Una sola migración consolidada
`src/supabase/migrations/018_tasks_plus.sql`:

```sql
-- Subtasks: self-reference. Cascade: borrar parent borra los hijos.
alter table public.tasks
  add column if not exists parent_id uuid
    references public.tasks(id) on delete cascade;

create index if not exists tasks_parent_idx on public.tasks(parent_id);

-- Recurrencia: enum simple, hasta donde lleguemos sin RRULE completo.
do $$ begin
  create type task_recurrence as enum ('none','daily','weekly','monthly','yearly');
exception when duplicate_object then null; end $$;

alter table public.tasks
  add column if not exists recurrence task_recurrence not null default 'none',
  add column if not exists recurrence_until date,
  -- Cuando una recurrente se completa y genera la siguiente, la nueva
  -- apunta al template original (la primera de la cadena) vía
  -- recurrence_parent_id. NULL en non-recurring y en el template.
  add column if not exists recurrence_parent_id uuid
    references public.tasks(id) on delete set null;

-- Estimación + tracking acumulado. tracked_minutes es el sumatorio de
-- task_time_entries; mantenerlo como contador denormalizado nos ahorra
-- un SUM en cada render.
alter table public.tasks
  add column if not exists estimate_minutes integer
    check (estimate_minutes is null or estimate_minutes >= 0),
  add column if not exists tracked_minutes integer not null default 0
    check (tracked_minutes >= 0);

-- Time entries: una fila por sesión iniciada. duration_seconds se
-- rellena al cerrar la entry; mientras esté abierta es null.
create table if not exists public.task_time_entries (
  id               uuid primary key default gen_random_uuid(),
  task_id          uuid not null references public.tasks(id) on delete cascade,
  user_id          uuid references public.profiles(id) on delete set null,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds integer
    check (duration_seconds is null or duration_seconds >= 0),
  note             text,
  created_at       timestamptz not null default now()
);

create index if not exists time_entries_task_idx on public.task_time_entries(task_id);
create index if not exists time_entries_user_idx on public.task_time_entries(user_id);
-- Sólo puede haber UNA entry abierta por usuario a la vez. Sin esto, el
-- usuario inicia 5 timers en 5 tasks distintas y nada cierra.
create unique index if not exists time_entries_open_per_user
  on public.task_time_entries(user_id) where ended_at is null;

alter table public.task_time_entries enable row level security;

do $$ begin
  drop policy if exists "team read"  on public.task_time_entries;
  drop policy if exists "team write" on public.task_time_entries;
  create policy "team read"  on public.task_time_entries
    for select to authenticated using (true);
  create policy "team write" on public.task_time_entries
    for all    to authenticated using (true) with check (true);
end $$;
```

**Tipos** (`src/lib/types.ts`):

```ts
export type TaskRecurrence =
  | "none" | "daily" | "weekly" | "monthly" | "yearly"

export type TaskTimeEntry = {
  id: string
  task_id: string
  user_id: string | null
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  note: string | null
  created_at: string
}
```

Extiende `Task`:

```ts
parent_id: string | null
recurrence: TaskRecurrence
recurrence_until: string | null
recurrence_parent_id: string | null
estimate_minutes: number | null
tracked_minutes: number
```

Y añade `task_time_entries: Row<TaskTimeEntry>` a `Database.Tables`.

**Healer en data-store** (`read()`): default los nuevos campos en cada
task — `parent_id ?? null`, `recurrence ?? 'none'`,
`recurrence_until ?? null`, `recurrence_parent_id ?? null`,
`estimate_minutes ?? null`, `tracked_minutes ?? 0`. Y añade
`time_entries: TaskTimeEntry[]` al tipo `DB`. NO subas `KEY` — el
healer lo cubre.

**Backend** (`src/lib/backend.ts` + ambos impls):

```ts
// Subtasks: usa updateTask normal con patch.parent_id. No hace falta
// método nuevo. Sólo asegúrate de que createTask acepta parent_id.

// Recurrencia: nuevo método de helper, llamado por updateTask cuando
// status pasa a 'done' y la task tiene recurrence != 'none'.
// La implementación vive DENTRO de updateTask, no se expone.

// Time tracking:
startTimer(taskId: string): Promise<TaskTimeEntry>
stopTimer(entryId: string, note?: string): Promise<TaskTimeEntry>
openTimerFor(userId: string): Promise<TaskTimeEntry | null>
timeEntriesFor(taskId: string): Promise<TaskTimeEntry[]>
```

Implementación:

- **`updateTask` extendido**: cuando recibe `patch.status === 'done'`,
  carga la task, mira `recurrence`. Si != 'none' y la nueva fecha
  calculada (`addDays|addWeeks|addMonths|addYears` desde `due_date`)
  ≤ `recurrence_until` (o `recurrence_until` es null), inserta una
  nueva task copia con:
  - `status: 'todo'`
  - `due_date` siguiente según recurrence
  - `due_time` igual
  - `parent_id: null` (la copia es root, no subtask)
  - `recurrence`, `recurrence_until` iguales
  - `recurrence_parent_id`: si la task original ya tenía
    `recurrence_parent_id`, copialo; si no, usa el id de la original
  - `tracked_minutes: 0`, ningún time entry copiado
  - assignee_ids, client_id, lead_id, priority, link, description
    iguales
  - `title` igual

  Usa `date-fns` para los add\*. Sin librería extra.

- **`startTimer`**: chequea que el usuario no tenga entry abierta
  (`openTimerFor`). Si la tiene, lánzala como error (UI mostrará toast
  "Ya tienes un timer corriendo en X — párelo antes"). Si no, inserta
  una entry con `started_at: now()`, `ended_at: null`.

- **`stopTimer`**: actualiza la entry con `ended_at: now()` y
  `duration_seconds = floor((ended_at - started_at) / 1000)`. Luego
  incrementa `tasks.tracked_minutes` por `round(duration / 60)`.

- **Subtasks en `deleteTask`**: la FK ya hace cascade. Sólo asegúrate
  de que el UI no pase una task con hijos a un sitio que asuma "borra
  uno". El cascade es lo que queremos.

**Hook nuevo** `src/hooks/use-time-entries.ts`:

```ts
useOpenTimerFor(userId)
useTimeEntriesFor(taskId)
useStartTimer()
useStopTimer()
```

`useStartTimer` invalida `["time_entries", taskId]`, `["time_entries",
"open", userId]`, y dispatchea un `viddix:timer-tick` cada 1s vía
intervalo en un Provider top-level (ver paso UI #4).

**UI**:

1. `add-task-dialog.tsx` y `task-detail-sheet.tsx`:
   - Campo `Estimate` (input number "min").
   - Campo `Recurrence` (Select con las 5 opciones; cuando != 'none'
     habilita campo opcional `Recurrence until` date).
   - Campo `Parent task` (Select buscable con tasks del mismo
     client/lead que NO sean hijas — para evitar ciclos: filtra
     `parent_id !== thisTaskId && grandparent !== thisTaskId`).

2. `task-detail-sheet.tsx`:
   - Sección **"Subtasks"**: lista hijas con checkbox (toggle done),
     título inline-editable, botón borrar. Botón "+ Add subtask" crea
     una task con `parent_id = thisTask.id`, hereda
     `client_id/lead_id/assignee_ids`.
   - Sección **"Time"**: botón Start/Stop timer. Si hay timer abierto
     en otra task del mismo user, lo deshabilita y muestra "Timer
     activo en {otra task}". Muestra `tracked_minutes` formateado
     ("2h 15m") vs `estimate_minutes`. Si `tracked > estimate`, badge
     warning "Over estimate".
   - Sección **"Time log"**: lista las entries de la task (recent
     first), con duración + note opcional.

3. `tasks-view.tsx`:
   - En cada fila, si la task tiene hijas: chevron expand → renderiza
     los hijos indentados con sus checkboxes (NO una página nueva,
     inline). Si tiene `recurrence != 'none'`, badge mono "↻ daily"
     etc.
   - Si tiene `tracked_minutes > 0`, muestra el valor a la derecha del
     nombre en `font-mono text-text-tertiary`.
   - **Las tasks subtask (con parent_id) NO se listan en el nivel raíz
     de la view** — sólo aparecen colgadas de su parent expandido. Esto
     mantiene la jerarquía visible y evita ruido.

4. Nuevo provider top-level
   `src/components/dashboard/active-timer-banner.tsx`:
   - Subscribe a `useOpenTimerFor(me.id)`. Si hay entry abierta, sticky
     bar en el bottom del viewport con: task title + cronómetro en
     tiempo real (recalcula `now - started_at` cada segundo) + botón
     Stop. Color jade. Token `--shadow-paper-md`.
   - Render desde `(dashboard)/layout.tsx` junto a `TaskRemindersClient`
     y `KeyboardShortcutsClient`.

5. Activity log: añade kinds `task_subtask_added`,
   `task_timer_started`, `task_timer_stopped`,
   `task_recurrence_generated`. Migración
   `019_activity_task_plus_kinds.sql` extendiendo CHECK como antes. Y
   sus emit en `data-store` y `supabase-backend`.

**Smoke**:
- Crear task con `recurrence='weekly'`, marcarla done → aparece nueva
  task 7 días después automáticamente.
- Iniciar timer en task A. Intentar iniciar en task B → error.
- Stop timer → `tracked_minutes` aumenta correctamente.
- Crear subtask, marcar done; el parent NO se marca done
  automáticamente.
- Borrar parent task → cascade borra hijos y sus time entries.
- Las tasks pairadas con eventos Cal.com siguen funcionando
  (`recurrence='none'`, `parent_id=null` automático).

---

### 5. Filtros en tasks-view: status / cliente / lead / tag

**Tags primero**.

**Migración** `src/supabase/migrations/020_tags.sql`:

```sql
create table if not exists public.tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text not null default 'slate',
  created_at timestamptz not null default now(),
  unique (name)
);

create table if not exists public.task_tags (
  task_id  uuid not null references public.tasks(id) on delete cascade,
  tag_id   uuid not null references public.tags(id)  on delete cascade,
  primary key (task_id, tag_id)
);

create index if not exists task_tags_tag_idx on public.task_tags(tag_id);

alter table public.tags      enable row level security;
alter table public.task_tags enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tags','task_tags']
  loop
    execute format('drop policy if exists "team read"  on public.%I', t);
    execute format('drop policy if exists "team write" on public.%I', t);
    execute format(
      'create policy "team read"  on public.%I for select to authenticated using (true)', t);
    execute format(
      'create policy "team write" on public.%I for all    to authenticated using (true) with check (true)', t);
  end loop;
end $$;
```

Diseñado para escalar a `lead_tags` / `client_tags` luego sin migrar `tags`.

**Tipos**:

```ts
export type Tag = {
  id: string
  name: string
  color: string  // pill tone key: 'slate'|'blue'|'sky'|'indigo'|'violet'|'emerald'|'amber'|'rose'
  created_at: string
}

export type TaskTag = { task_id: string; tag_id: string }
```

Añade a `Database.Tables`: `tags: Row<Tag>` y
`task_tags: { Row: TaskTag; Insert: TaskTag; Update: Partial<TaskTag>;
Relationships: [] }`.

**Backend** (`Backend` + ambos impls):

```ts
tags(): Promise<Tag[]>
tagsFor(taskId: string): Promise<Tag[]>
createTag(input: { name: string; color?: string }): Promise<Tag>
deleteTag(id: string): Promise<void>
attachTag(taskId: string, tagId: string): Promise<void>
detachTag(taskId: string, tagId: string): Promise<void>
```

**Hook** `src/hooks/use-tags.ts` siguiendo el patrón habitual. Cuando
attach/detach, invalida `["tags-for", taskId]` y `["tasks"]` (para que
el listado refresque los chips inline).

**UI tags**:

1. `task-detail-sheet.tsx`: sección **"Tags"** con chips removibles +
   input "+ Add tag" con autocompletado (Command primitivo) sobre
   `useTags()`. Si el typed string no matchea ninguno, opción "Create
   tag '{x}'" → llama `createTag` y luego `attachTag`.
2. `tasks-view.tsx`: en cada fila, render de chips de tags al final
   del título (max 3 visibles, "+N" si más).
3. `add-task-dialog.tsx`: mismo selector de tags.
4. Settings: nueva sub-sección **"Tags"** en `settings-view.tsx` con
   listado de todos los tags + count de uso + delete (cascade rompe
   las relaciones).

**Filtros en `tasks-view.tsx`**:

Sustituye la barra actual de 2 selects por una toolbar más rica:

```
[ Search... ] [ Status: All ▾ ] [ Assignee: All ▾ ] [ Priority: All ▾ ]
[ Client: All ▾ ] [ Lead: All ▾ ] [ Tags: chip multi-select ] [ Reset ]
```

Reglas:

- **Status filter**: opciones `All | Open | Todo | In progress | Done |
  Overdue`. "Open" = `status != 'done'`. "Overdue" = `due_date < today
  && status != 'done'`.
- **Client / Lead**: Select buscable (Command-like) sobre `useClients`
  / `useLeads`. Match exacto por id.
- **Tags**: multi-select chips. Si seleccionas varios → match OR
  (mostrar tasks que tengan AL MENOS un tag seleccionado). Si quieres
  AND, usa un toggle "Match all" (opcional, MVP queda en OR).
- **Search**: full-text simple sobre `title` y `description`,
  case-insensitive, ignora tags.
- **Reset**: vuelve a todos los filtros vacíos.

**Persistencia de filtros**:

- Reflejar en URL search params (`?status=open&assignee=...&tags=a,b`)
  para deep-link y back/forward.
- Backup en `localStorage` con key `viddix:tasks-filters` (mismo patrón
  que `viddix:clients-density` en `clients-table.tsx`).
- Al cargar la page: leer URL → si vacío, leer localStorage → si vacío,
  defaults.

**Filtrado**: hazlo en memoria sobre el array completo (`tasks +
filter`). Si en el futuro pasamos a Supabase server-side filters, se
refactoriza la hook; el contrato del componente no cambia.

**Group-by selector** (bonus, marca como opcional pero deja
implementado si tienes tiempo): un Select `Group by: Due date /
Assignee / Client / Priority` que reagrupa la lista sin perder los
filtros aplicados.

**Smoke**:
- Crear 3 tags, asignarlos a tasks, filtrar por uno → sólo aparecen
  las que lo tienen.
- Borrar un tag → desaparece de las cards y de los filtros.
- Combinar filtros (status=Open + client=Acme + tag=urgent-cliente) →
  intersección correcta.
- Recargar la page con filtros en URL → filtros restaurados.
- Filtros con localStorage funcionan si URL viene vacía.

---

### 6. Orden de ejecución

Hazlo en pequeñas tandas verificables, con `npm run build` y
`npm run lint` limpios entre cada una:

1. **Migración 015** (contract dates) + tipos + healer + UI clients +
   widget dashboard. PR review point.
2. **Migración 016 + 017** (contacts + activity kinds) + tipos +
   backend dual + hook + UI tab Contacts + Overview rewire + command
   palette. PR review point.
3. **Refactor `buildTaskFromEvent`** a `src/lib/build-task-from-event.ts`
   (sin "use client"); actualiza los dos consumers. Verifica que el
   webhook Cal.com sigue creando el task pareado. PR review point.
4. **Migración 018 + 019** (tasks plus + activity kinds) + tipos +
   healer + backend dual + hooks + UI subtasks/recurrence/time +
   ActiveTimerBanner. PR review point.
5. **Migración 020** (tags) + tipos + backend dual + hooks + UI tags +
   filtros nuevos en tasks-view + persistencia URL/localStorage. PR
   review point.

### 7. Checklist obligatorio antes de cerrar

- [ ] `npm run build` pasa sin errores y sin warnings nuevos.
- [ ] `npm run lint` limpio.
- [ ] Las migraciones corren en orden contra una BD vacía Y contra una
      copia de producción (idempotencia verificada).
- [ ] El backfill de contacts crea exactamente N filas (donde N =
      `count(*) from clients where contact_name is not null`).
- [ ] Modo demo (sin env Supabase) sigue funcionando — todos los
      flujos nuevos están implementados en `data-store.ts`.
- [ ] El webhook Cal.com sigue creando el task pareado con
      `recurrence='none'` y `parent_id=null`.
- [ ] No hay nuevas dependencias en `package.json`.
- [ ] Activity log emite los nuevos kinds (chequea la tabla
      activities tras hacer cada operación).
- [ ] El widget de renewals no muestra clientes con `renewal_date`
      nulo ni vencidos hace meses (limitar a window
      `today..today+60d`).
- [ ] Los nuevos campos opcionales tienen defaults en BD Y en healer
      Y en seed.
- [ ] `KeyboardShortcuts` no entra en conflicto con el ActiveTimerBanner.
- [ ] Los filtros de tasks persisten correctamente en URL y localStorage.
- [ ] El unique index de `contacts.is_primary` se respeta:
      `setPrimaryContact` no produce conflicto.

### 8. Documentación

- Añade entradas a `docs/UI_CHANGELOG.md` (nueva sección "Features —
  Renewals, Contacts, Tasks Plus, Tags") listando: tablas creadas,
  archivos modificados, hooks nuevos. Una línea por punto.
- Actualiza el comentario inicial de `src/lib/types.ts` mencionando
  las migraciones nuevas.

### 9. Lo que NO debes hacer

- No introducir `rrule.js`, `dayjs`, `temporal` u otra librería de
  fechas. `date-fns` ya está.
- No introducir un framework de drag & drop adicional para subtasks
  (reusa el patrón visual de `EditableTaskRow` si lo necesitas).
- No tocar la lógica de partners, leads pipeline, calendar (más allá
  de no romperla), ni el rediseño editorial.
- No cambiar la paleta ni los tokens semánticos (`docs/UI_REDESIGN_PROMPT.md`).
- No subir `KEY` de `data-store.ts` salvo que un cambio sea
  incompatible con el healer (no debería pasar — todos los campos
  nuevos tienen default).
- No dropees `clients.contact_name/email/phone` — siguen siendo el
  shortcut al primary contact.

---

Cuando termines: pega el diff resumen, lista de archivos modificados,
y resultado de `npm run build` + `npm run lint`. Si algo del schema o
del modelo de pairing event↔task te bloquea, párate y pregunta antes
de improvisar.
