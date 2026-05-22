# Auto-convert Won leads — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every transition of a lead's `stage` to `'won'` create a Client automatically (across drag, dropdown, and create paths), and make Won definitive — once converted, the lead can't be moved out.

**Architecture:** Centralize all conversion logic in a single helper `ensureClientForWonLead(lead)` inside each backend (Supabase + localStorage mirror). Wire that helper into the three entry points (`moveLead`, `updateLead`, `createLead`) and keep the existing `convertLeadToClient` as a thin wrapper. Block reverse-moves at both the UI (drag guard + disabled dropdown) and the backend (throw).

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase JS v2, TanStack Query v5, sonner toasts, @hello-pangea/dnd.

**Spec:** `docs/superpowers/specs/2026-05-22-auto-convert-won-leads-design.md`

**No test framework configured.** Verification is `npm run lint && npm run build` + manual smoke tests on `npm run dev`.

## File Structure

| File | Change |
|---|---|
| `src/lib/supabase-backend.ts` | Add `ensureClientForWonLead`. Refactor `convertLeadToClient`. Wire `moveLead`, `updateLead`, `createLead`. |
| `src/lib/data-store.ts` | Mirror the same five edits. |
| `src/hooks/use-leads.ts` | `useMoveLead` / `useUpdateLead` / `useCreateLead` must invalidate `["clients"]`. |
| `src/app/(dashboard)/leads/leads-board.tsx` | `onDragEnd` aborts if dragging a converted lead out of Won. |
| `src/app/(dashboard)/leads/lead-detail-sheet.tsx` | Disable the stage `Select` when `lead.converted_client_id` is set. |

---

## Task 1: Supabase backend — extract helper and wire all three entry points

**Files:**
- Modify: `src/lib/supabase-backend.ts` (currently has `createLead` ~159-198, `updateLead` ~199-203, `moveLead` ~204-218, `convertLeadToClient` ~232-293)

- [ ] **Step 1: Add `ensureClientForWonLead` helper above the `// ── leads ──` section**

Place this new function just after `logActivity` and before the backend object (around line 80, after the activity helpers). It encapsulates the same body that `convertLeadToClient` has today, minus the `leads` update — the caller decides when to update the lead row.

```ts
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
```

- [ ] **Step 2: Refactor `convertLeadToClient` to use the helper**

Replace the entire current body (lines 232-293) with this thin wrapper:

```ts
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
```

- [ ] **Step 3: Modify `moveLead` to auto-convert on Won and guard the reverse move**

Replace the current `moveLead` (lines 204-218) with:

```ts
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
```

- [ ] **Step 4: Modify `updateLead` to auto-convert on stage→won and guard reverse stage changes**

Replace the current `updateLead` (lines 199-203) with:

```ts
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
```

- [ ] **Step 5: Modify `createLead` to auto-convert when stage is initially Won**

Replace the body of `createLead` after the existing `logActivity({ kind: "lead_created", ... })` call (around line 197). Find the `return lead` and replace the final block so the function ends with:

```ts
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
```

- [ ] **Step 6: Verify lint and build pass**

```bash
npm run lint
npm run build
```

Expected: no errors. The `Client` and `Lead` types are already imported at the top of the file; if your edit introduces an unused import warning, remove it.

- [ ] **Step 7: Commit**

```bash
git add src/lib/supabase-backend.ts
git commit -m "feat(leads): auto-convert to client on stage=won (supabase backend)"
```

---

## Task 2: localStorage backend — mirror the same logic

The localStorage backend (`data-store.ts`) is used when `NEXT_PUBLIC_SUPABASE_URL` is not configured (demo / offline). It must behave identically.

**Files:**
- Modify: `src/lib/data-store.ts` (currently has `createLead` ~210-230 approx, `updateLead` ~230-258, `moveLead` ~259-282, `convertLeadToClient` ~294-347)

- [ ] **Step 1: Add `ensureClientForWonLead` helper at module scope (above the `store` object)**

Place this just before the `store` object declaration. It mirrors the supabase version but operates on the in-memory `db` snapshot and is **synchronous**.

```ts
// Materialise a Client (and optional client_partners row) for a lead that is
// transitioning to stage="won". Idempotent. Does NOT touch lead.stage or
// lead.converted_client_id — the caller wires those into its own update.
// `db` is the in-memory snapshot already loaded by the caller via read().
function ensureClientForWonLead(db: DB, lead: Lead): Client {
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
    owner_id: lead.owner_id,
    created_at: now(),
    updated_at: now(),
  }
  db.clients.push(client)
  record(db, "lead_converted", `${lead.name} converted to client`, {
    lead_id: lead.id,
    client_id: client.id,
  })
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
  return client
}
```

Note: `DB` is the existing module-internal snapshot type used by `read()` / `write()`. If it's not exported at module scope, name the parameter `db: ReturnType<typeof read>` instead. Check the top of the file to confirm.

- [ ] **Step 2: Refactor `convertLeadToClient` to use the helper**

Replace the entire body (currently lines ~294-347) with:

```ts
  convertLeadToClient(id: string): Client | null {
    const db = read()
    const lead = db.leads.find((l) => l.id === id)
    if (!lead) return null
    const client = ensureClientForWonLead(db, lead)
    if (lead.stage !== "won" || lead.converted_client_id !== client.id) {
      lead.stage = "won"
      lead.converted_client_id = client.id
      lead.updated_at = now()
    }
    write(db)
    return client
  },
```

- [ ] **Step 3: Modify `moveLead` to auto-convert and guard the reverse move**

Replace the existing body (currently ~259-282) with:

```ts
  moveLead(id: string, toStage: Lead["stage"], toIndex: number) {
    const db = read()
    const lead = db.leads.find((l) => l.id === id)
    if (!lead) return
    if (lead.converted_client_id && toStage !== "won") {
      throw new Error("Cannot move a converted lead out of won")
    }
    const fromStage = lead.stage
    if (toStage === "won" && !lead.converted_client_id) {
      const client = ensureClientForWonLead(db, lead)
      lead.converted_client_id = client.id
    }
    lead.stage = toStage
    lead.updated_at = now()

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
```

- [ ] **Step 4: Modify `updateLead` to auto-convert on stage→won and guard reverse stage changes**

Find the existing `updateLead` (currently around lines 230-258). At the top of the function — after loading the lead but before any field assignments — add the conversion logic. The exact insertion point: right after `const lead = db.leads.find(...)` and the `if (!lead) return null` guard.

The simplest edit: read the current function, then insert these lines between the lead lookup and the field applications.

```ts
    // Stage transitions: guard reverse moves and auto-convert on Won.
    if (patch.stage !== undefined) {
      if (lead.converted_client_id && patch.stage !== "won") {
        throw new Error("Cannot change stage of a converted lead")
      }
      if (patch.stage === "won" && !lead.converted_client_id) {
        const client = ensureClientForWonLead(db, lead)
        lead.converted_client_id = client.id
      }
    }
```

The rest of `updateLead` (applying the patch fields, recording the activity, calling `write`) stays unchanged.

- [ ] **Step 5: Modify `createLead` to auto-convert when initial stage is Won**

Find `createLead` in `data-store.ts` (around lines 210-230). After the lead is pushed into `db.leads` and before `write(db)` is called, add:

```ts
    if (lead.stage === "won" && !lead.converted_client_id) {
      const client = ensureClientForWonLead(db, lead)
      lead.converted_client_id = client.id
    }
```

If `createLead` uses `record(db, "lead_created", ...)` before the `write`, put this block after the `record` call so the activity order matches the supabase backend (lead_created first, then lead_converted).

- [ ] **Step 6: Verify lint and build pass**

```bash
npm run lint
npm run build
```

Expected: no errors. If you see "ensureClientForWonLead is defined but never used" it means one of the wirings (Steps 3-5) didn't land — re-check.

- [ ] **Step 7: Commit**

```bash
git add src/lib/data-store.ts
git commit -m "feat(leads): auto-convert to client on stage=won (localStorage backend)"
```

---

## Task 3: Hook layer — invalidate the clients query when leads change

Three mutations can now create a client as a side effect. TanStack Query won't know unless we tell it.

**Files:**
- Modify: `src/hooks/use-leads.ts`

- [ ] **Step 1: Update `useMoveLead`, `useUpdateLead`, and `useCreateLead` to invalidate both queries**

In `useCreateLead`, change the `onSuccess` from:

```ts
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
```

to:

```ts
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ["clients"] })
    },
```

In `useUpdateLead`, apply the same shape — replace its single-line `onSuccess` with the two-invalidation block.

In `useMoveLead`, the existing `onSettled` already invalidates `KEY`. Replace it with:

```ts
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ["clients"] })
    },
```

`useConvertLead` already invalidates both, leave it alone.

- [ ] **Step 2: Verify lint and build pass**

```bash
npm run lint
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-leads.ts
git commit -m "feat(leads): invalidate clients query when lead mutations may create one"
```

---

## Task 4: Kanban — guard the drag interaction

Prevents the user from dragging a converted lead out of Won. The backend will also throw, but blocking at the source avoids the optimistic-update flicker and gives a cleaner toast.

**Files:**
- Modify: `src/app/(dashboard)/leads/leads-board.tsx` (the `onDragEnd` handler is around lines 129-142)

- [ ] **Step 1: Add the guard in `onDragEnd`**

Replace the existing `onDragEnd` body (lines 129-142) with:

```ts
  const onDragEnd = (r: DropResult) => {
    if (!r.destination) return
    const fromStage = r.source.droppableId as LeadStage
    const toStage = r.destination.droppableId as LeadStage
    if (fromStage === toStage && r.source.index === r.destination.index) return
    const draggedLead = leads.find((l) => l.id === r.draggableId)
    if (draggedLead?.converted_client_id && toStage !== "won") {
      toast.error("Este lead ya es cliente. Bórralo desde /clients para revertir.")
      return
    }
    move.mutate({
      id: r.draggableId,
      toStage,
      toIndex: r.destination.index,
    })
  }
```

`leads` is the React-Query data already available in the component (line 64). `toast` is already imported (line 23).

- [ ] **Step 2: Verify lint and build pass**

```bash
npm run lint
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/leads/leads-board.tsx
git commit -m "feat(leads): block dragging converted leads out of won"
```

---

## Task 5: Detail sheet — disable the stage select when converted

Mirrors the kanban guard for the dropdown path.

**Files:**
- Modify: `src/app/(dashboard)/leads/lead-detail-sheet.tsx` (the stage `Select` is around lines 150-164)

- [ ] **Step 1: Add `disabled` and a helper line under the field**

Replace the existing stage `Field` block (lines 150-164) with:

```tsx
          <Field label="Stage">
            <Select
              value={lead.stage}
              onValueChange={(v) => onUpdate({ stage: v as LeadStage })}
              disabled={!!lead.converted_client_id}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STAGES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lead.converted_client_id && (
              <p className="mt-1 text-[11px] text-slate-500">
                Lead convertido. Para revertir, borra el cliente desde /clients.
              </p>
            )}
          </Field>
```

- [ ] **Step 2: Verify lint and build pass**

```bash
npm run lint
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/leads/lead-detail-sheet.tsx
git commit -m "feat(leads): disable stage select for converted leads"
```

---

## Task 6: Manual verification on the dev server

No automated tests in this repo. Walk through every scenario from the spec on `npm run dev`.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Open the browser to the printed local URL (usually http://localhost:3000) and log in.

- [ ] **Step 2: Scenario 1 — Drag-to-Won creates a client**

1. Navigate to `/leads`.
2. Find a lead currently in any stage other than Won. If none exists, create one ("New lead" button, stage = `negotiation`, give it a name like "Test Drag").
3. Drag the card to the Won column.
4. Navigate to `/clients`. Verify the lead appears as a new client with the expected name (uses `company` if set, else `name`) and MRR equal to the lead's value.
5. Navigate to `/activity`. Verify both `lead_moved` and `lead_converted` activities are present.

- [ ] **Step 3: Scenario 2 — Dropdown-to-Won creates a client**

1. Find another lead not in Won. Create one if needed.
2. Open the lead detail sheet (click the card).
3. Change the Stage dropdown from its current value to `Won`.
4. Verify the dropdown becomes disabled and the helper text "Lead convertido. Para revertir..." appears.
5. Navigate to `/clients` and verify the new client row exists.

- [ ] **Step 4: Scenario 3 — Create lead directly in Won**

1. Click "New lead".
2. Fill in the form, set Stage to `Won` from the start.
3. Submit.
4. Navigate to `/clients` and verify the client row exists.
5. Navigate to `/activity` and verify both `lead_created` and `lead_converted` activities are present.

- [ ] **Step 5: Scenario 4 — Cannot drag a converted lead out of Won**

1. In `/leads`, locate any of the leads converted in Scenarios 1-3 (they are in the Won column).
2. Attempt to drag the card to `negotiation`.
3. Verify a toast appears with the message "Este lead ya es cliente. Bórralo desde /clients para revertir." and the card snaps back to Won.

- [ ] **Step 6: Scenario 5 — Detail sheet dropdown is disabled for converted leads**

1. Open the detail sheet of any converted lead (from the Won column).
2. Verify the Stage `Select` is visibly disabled and shows the helper text.

- [ ] **Step 7: Scenario 6 — Manual Convert button still works**

1. Find a non-converted lead in a stage other than Won (create one if needed).
2. Open its detail sheet.
3. Click the existing "Convert" button.
4. Verify a toast confirms success, the sheet closes, and `/clients` has the new client row.

- [ ] **Step 8: Scenario 7 — Partner relationship is materialised**

1. Create a new lead. In the add-lead sheet, pick a partner from the partner field and set a split percentage (e.g. 30%).
2. Drag the lead to Won.
3. Navigate to `/clients/[id]` for the new client and verify the partner is listed with the same split.

- [ ] **Step 9: Scenario 8 — Idempotency under re-drop in Won**

1. Take a lead already in Won (converted in an earlier scenario).
2. Drag it inside the Won column to a different position.
3. Verify `/clients` does NOT gain a new row — count stays the same.
4. Verify no error toast appears.

- [ ] **Step 10: If any scenario fails, file an issue note and stop**

Open an issue or jot in the PR description which scenario failed and what was observed vs expected. Otherwise mark the plan complete.

- [ ] **Step 11: Final lint + build sanity check**

```bash
npm run lint
npm run build
```

Both must pass.

- [ ] **Step 12: Final commit (only if scenarios 1-9 all passed)**

If any docs need updating from what you learned, commit them now. Otherwise the work from Tasks 1-5 already lives in git — nothing more to add.
