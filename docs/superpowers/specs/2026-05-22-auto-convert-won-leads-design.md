# Auto-convertir leads en Won

**Fecha:** 2026-05-22
**Estado:** Diseño aprobado, pendiente de plan de implementación

## Problema

Hoy, cuando un usuario arrastra un lead a la columna "Won" del kanban, solo se actualiza `leads.stage = 'won'`. Para crear el Client correspondiente hay que abrir el detail sheet y pulsar el botón "Convert". El flujo natural ("ya está cerrado, ya es cliente") requiere dos pasos manuales.

Queremos que **cualquier** transición de un lead a `stage = 'won'` cree el Client automáticamente, sin importar desde qué UI se haga.

## Rutas que llevan un lead a Won

Hay tres puntos de entrada en `src/lib/supabase-backend.ts` que pueden setear `stage = 'won'`:

1. `moveLead(id, toStage, toIndex)` — drag-and-drop en el kanban (`leads-board.tsx onDragEnd`).
2. `updateLead(id, patch)` — dropdown de stage en el detail sheet (`lead-detail-sheet.tsx` línea 152-153).
3. `createLead(input)` — alta de un lead directamente con `stage: 'won'` desde el add sheet.

La función existente `convertLeadToClient` es una cuarta ruta pero ya hace bien el trabajo y se queda intacta para el botón explícito.

## Comportamiento esperado

- **Auto-convertir sin confirmación.** Cualquier transición a Won (drag, dropdown del detail sheet, alta directa con stage=won) crea el cliente y loguea actividad. Toast de éxito en la UI tras drag o dropdown; en la creación basta con la actividad en el feed.
- **Una sola vez.** Si `lead.converted_client_id` ya está set, no se vuelve a crear. La operación es idempotente.
- **Stage Won es definitivo.** Una vez convertido, el lead no puede moverse fuera de Won. La UI bloquea el drag y deshabilita el dropdown; el backend rechaza con error si alguien intenta saltárselo. Mensaje: *"Este lead ya es cliente. Bórralo desde /clients para revertir."*
- **Partner pre-asignado se materializa.** Si el lead tenía `partner_id`, se crea la fila `client_partners` con el split correspondiente (igual que hace hoy `convertLeadToClient`).

## Arquitectura

### Capa de datos (`src/lib/supabase-backend.ts`)

Extraemos el cuerpo de `convertLeadToClient` (líneas 232-293) a un helper privado:

```ts
async function ensureClientForWonLead(lead: Lead): Promise<Client>
```

**Contrato:**
- Si `lead.converted_client_id` está set y la fila clients aún existe, devuelve ese Client sin hacer nada más. Idempotente.
- Si no, hace `INSERT INTO clients` mapeando los campos del lead (mismo mapping que el `convertLeadToClient` actual: `name = company ?? name`, `contact_name = name`, `mrr = value`, etc.).
- Si el lead tenía `partner_id`, hace `UPSERT INTO client_partners` con `onConflict: 'client_id,partner_id'`.
- Emite `lead_converted` y opcionalmente `partner_attached` en el feed de actividades.
- Devuelve el Client (existente o nuevo).

**No** actualiza `leads.stage` ni `leads.converted_client_id` — eso es responsabilidad del caller, para que cada caller pueda combinar la actualización del lead con su propio update en una única operación.

### Reescritura de los puntos de entrada

`convertLeadToClient(id)` queda como wrapper fino:
1. Carga el lead.
2. Llama `ensureClientForWonLead(lead)`.
3. `UPDATE leads SET stage = 'won', converted_client_id = client.id WHERE id = lead.id`.
4. Devuelve el client.

`moveLead(id, toStage, toIndex)`:
1. Carga el lead.
2. **Guard**: si `lead.converted_client_id !== null && toStage !== 'won'`, lanza `Error("Cannot move converted lead out of won")`.
3. Si `toStage === 'won' && lead.converted_client_id === null`: llama `ensureClientForWonLead(lead)`, captura el `client.id`, y lo incluye en el update junto a stage + position.
4. Hace el update normal de stage + position (+ converted_client_id si aplica).
5. Loguea `lead_moved` como ya hace.

`updateLead(id, patch)`:
1. Si `patch.stage === 'won'`:
   - Carga el lead.
   - Si no tenía `converted_client_id`, llama `ensureClientForWonLead(lead)` e incluye `converted_client_id = client.id` en el patch antes de aplicarlo.
2. Si `patch.stage` viene set a algo distinto de `'won'`:
   - Carga el lead.
   - Si `lead.converted_client_id !== null`, lanza el mismo error.
3. Aplica el update.

`createLead(input)`:
1. Insert normal.
2. Si `input.stage === 'won'`, después del insert llama `ensureClientForWonLead(newLead)` y hace un segundo update con `converted_client_id`.

### Capa de UI

**`src/app/(dashboard)/leads/leads-board.tsx`** — en `onDragEnd`:

```ts
const lead = leads.find((l) => l.id === r.draggableId)
if (lead?.converted_client_id && toStage !== 'won') {
  toast.error("Este lead ya es cliente. Bórralo desde /clients para revertir.")
  return
}
```

Antes del `move.mutate(...)`. Si el toStage es Won, no hace nada especial — el backend se encarga.

**`src/app/(dashboard)/leads/lead-detail-sheet.tsx`** — el `Select` de stage en línea 152:
- `disabled={!!lead.converted_client_id}`
- Tooltip o label adyacente: "Lead convertido. Para revertir borra el cliente."

**`src/hooks/use-leads.ts`** — `useMoveLead` y `useUpdateLead` ahora pueden crear un Client como side-effect. Añadir `qc.invalidateQueries({ queryKey: ['clients'] })` en su `onSuccess`/`onSettled` (`useConvertLead` ya lo hace).

## Lo que NO cambiamos

- Schema de Postgres: ninguna migración. `converted_client_id` ya existe.
- El botón "Convert" en el detail sheet sigue funcionando: sigue llamando a `convertLeadToClient`, que sigue siendo válido (es la versión "convertir saltándome el dropdown"). Tras este cambio, mover el stage a Won y pulsar Convert son equivalentes — ambos pasan por `ensureClientForWonLead`.
- `data-store.ts` (el backend mock en memoria, usado cuando no hay sesión Supabase activa): replicar la misma lógica en sus implementaciones de `moveLead`, `updateLead` y `createLead`, llamando a una función equivalente `ensureClientForWonLead` local. Mismo contrato, sin acceso a red.

## Testing manual

En `npm run dev`:

1. Crear un lead nuevo en stage `new`. Arrastrarlo hasta `won`. Verificar que aparece una fila en /clients con el nombre del lead.
2. Detail sheet: cambiar stage de `negotiation` → `won` desde el dropdown. Mismo resultado.
3. Add lead sheet: crear un lead con stage `won` desde el inicio. Verificar que aparece en /clients.
4. Coger un lead ya convertido en la columna Won, intentar arrastrarlo a `negotiation`. Toast de error, lead se queda en Won.
5. Abrir el detail sheet de un lead convertido. El dropdown de stage debe estar deshabilitado.
6. Pulsar "Convert" en el detail sheet de un lead todavía en `negotiation`. Debe seguir funcionando.
7. Lead con `partner_id` → arrastrar a Won → verificar que aparece en `client_partners` con el split correcto.
8. Lead ya convertido, intentar dispararlo otra vez (e.g. drop dentro de la propia columna Won). No debe crear un segundo client.

## Riesgos / consideraciones

- **Feed de actividades duplicado en el drag.** Al arrastrar a Won, se emiten dos activities: `lead_moved` ("Lead moved to won") y `lead_converted` ("X converted to client"). Aceptable — son eventos distintos que aportan información distinta.
- **Race condition en doble drop rápido.** Si el usuario consigue disparar dos `moveLead` antes de que se invalide la query, podríamos intentar crear el client dos veces. La idempotencia de `ensureClientForWonLead` (chequea `converted_client_id` primero) lo cubre — el segundo call recibirá el lead ya actualizado.
- **Backend rechaza el move fuera de Won pero la UI ya hizo optimistic update.** El `onError` de `useMoveLead` ya hace rollback al estado previo, así que el flicker es aceptable. La guard en `onDragEnd` evita el flicker en el caso común.
