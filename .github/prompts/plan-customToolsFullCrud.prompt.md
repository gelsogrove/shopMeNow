# Plan: Custom Tools — Full CRUD + UI Improvements

## TL;DR
Full CRUD per system e custom functions. Hard-delete per tutte. Sync service limitato alla creazione workspace (non più all'avvio). Pulsante "Reinstall" una-a-una per le system functions cancellate. Nuova API `/agent-types` backend-driven (no hardcoding). `attachedLlm` field + badge + dropdown dinamico nel modal. Unit test completi per controller e repository.

## Decisioni architetturali
- **Hard-delete per tutte le calling functions** (no soft-delete): semplice, pulito
- **Sync service → solo alla creazione workspace** (non più ad ogni startup): una system function cancellata dall'admin non torna mai da sola
- **Reinstall una-a-una**: pulsante "Reinstall" in UI per ogni system function disponibile ma non installata
- **Delete workspace → cascade**: già presente via `onDelete: Cascade` ✅

---

## Phase 1 — DB Schema

**1.** `packages/database/prisma/schema.prisma` → `WorkspaceCallingFunction` model:
- Add `attachedLlm String?` (quale LLM gestisce il dispatch — NESSUN `deletedAt`, hard-delete)

**2.** Migration: `npx prisma migrate dev --name add_attached_llm_to_calling_functions`

**3.** Nel migration SQL populate `attachedLlm` per i record esistenti DELEGATE_TO_AGENT:
- `productSearchAgent` → `"PRODUCT_SEARCH"`
- `cartManagementAgent` → `"CART_MANAGEMENT"`
- `orderTrackingAgent` → `"ORDER_TRACKING"`
- `customerSupportAgent` → `"CUSTOMER_SUPPORT"`
- `profileManagementAgent` → `"PROFILE_MANAGEMENT"`
- tutti INTERNAL/WEBHOOK → `NULL`

Note: usa AGENT_TYPE strings (es. "PRODUCT_SEARCH") NON class names — matches con `getValidAgentTypesForMode()`.

---

## Phase 2 — Backend Repository + Sync Service

**4.** `apps/backend/src/repositories/calling-functions.repository.ts`:
- `delete()` rimane hard delete (nessuna modifica necessaria)
- Nessun `deletedAt` da aggiungere

**5.** `apps/backend/src/services/system-functions-sync.service.ts`:
- **Rimuovere** la chiamata a `syncSystemFunctionsOnStartup()` dall'avvio del server
- Il sync ora viene chiamato SOLO da `workspace.service.ts` alla creazione di un nuovo workspace
- Aggiungere nuovo metodo pubblico `reinstallFunction(workspaceId, functionName)` — reinstalla una singola system function dai default

**6.** Nuovo endpoint `POST /workspaces/:workspaceId/functions/:functionName/reinstall`:
- Controlla che `functionName` esista in `ALL_ECOMMERCE_FUNCTIONS` / `ALL_INFO_FUNCTIONS` (è una system function valida)
- Usa `upsert` per ricrearla con i valori di default da `system-functions.ts`
- 3-layer middleware

---

## Phase 3 — Backend Controller + Routes

**7.** `apps/backend/src/interfaces/http/controllers/calling-functions.controller.ts`:

  a. `updateFunction()` — REPLACE whitelist con blacklist:
     - PRIMA: `allowedKeys = ['isActive', 'description']` per system functions
     - DOPO: `IMMUTABLE_KEYS = new Set(['functionName', 'isSystemFunction'])` — tutto il resto è editabile
     - Include `attachedLlm` nei campi passati a `repository.update()`

  b. `deleteFunction()` — RIMUOVI il blocco `if (existing.isSystemFunction) return 403`
     - Hard delete per tutte le calling functions (system + custom)
     - Il soft-delete nel repository gestisce la protezione dal re-sync

  c. `createFunction()` — include `attachedLlm` da `req.body`

  d. Nuovo metodo `getAgentTypes()`:
     - Legge `workspace.channelMode`
     - Usa `getValidAgentTypesForMode(channelMode)` da `template-path.helper.ts`
     - Filtra via `NON_DISPATCH_AGENTS = Set(["SECURITY","TRANSLATION","SUMMARY_AGENT","CONVERSATION_HISTORY","ROUTER"])`
     - Returns `{ agentTypes: string[] }`

  e. Nuovo metodo `reinstallFunction()`:
     - `POST /workspaces/:workspaceId/functions/:functionName/reinstall`
     - Verifica che `functionName` sia una system function valida (presente in `ALL_ECOMMERCE_FUNCTIONS` / `ALL_INFO_FUNCTIONS`)
     - Usa `upsert` per ricrearla dai default in `system-functions.ts`
     - Returns 200 con la funzione reinstallata

**8.** `apps/backend/src/interfaces/http/routes/calling-functions.routes.ts`:
  - Aggiungi `GET /workspaces/:workspaceId/functions/agent-types` con 3-layer middleware
  - Aggiungi `POST /workspaces/:workspaceId/functions/:functionName/reinstall` con 3-layer middleware

---

## Phase 4 — Frontend

**9.** `apps/frontend/src/services/callingFunctionApi.ts`:
- Add `attachedLlm?: string | null` to `CallingFunction` interface
- Add `getAgentTypes(workspaceId: string): Promise<{ agentTypes: string[] }>` method
- Add `reinstall(workspaceId: string, functionName: string): Promise<CallingFunction>` method
- Add `getSystemMissing(workspaceId: string): Promise<{ missing: SystemFunctionDef[] }>` method

**10.** `apps/frontend/src/components/settings/sections/CallingFunctionsSection.tsx`:

  a. Rename `EXECUTION_TYPE_CONFIG.INTERNAL.label`: "Internal" → "Calling Function"

  b. Add `AGENT_TYPE_LABELS` const mapping AGENT_TYPE → display label:
     `PRODUCT_SEARCH → "Product Search"`, `CART_MANAGEMENT → "Cart"`, etc.

  c. State: add `agentTypes: string[]` (loaded from `/functions/agent-types`)

  d. `loadFunctions()` also calls `callingFunctionsApi.getAgentTypes()` → set `agentTypes`

  e. List sorting: sort `functions` — DELEGATE_TO_AGENT first (grouped by attachedLlm), then INTERNAL, then WEBHOOK

  f. List row: badge `attachedLlm` dopo execution type badge (solo se non null)

  g. List row: RIMUOVI la differenza lock-icon vs edit-buttons per system functions:
     - Tutte le funzioni (system + custom) mostrano Edit + Delete buttons (con canEdit)
     - Tutte le funzioni (system + custom) mostrano il Switch isActive toggle
     - Le system functions mostrano anche Reinstall (teal 🔄) per ripristinare i default
     - L'ordine dei pulsanti: Switch → Edit → Reinstall (solo system) → Delete

  h. Edit modal:
     - `functionName` INPUT: `disabled` solo per system functions (immutabile anche backend)
     - `executionType` SELECT: `disabled` solo per system functions (non ha senso cambiare il tipo)
     - Tutti gli altri campi: abilitati per tutti
     - Nuovo field `attachedLlm` SELECT: visibile solo quando `executionType === "DELEGATE_TO_AGENT"`, opzioni da `agentTypes` state (dinamico dal backend) — NO HARDCODING
     - Parameters editor: abilitato per tutti (rimosso `readOnly: editingFunction?.isSystemFunction`)
     - Credentials editor: abilitato per tutti

  i. DialogFooter: RIMUOVI `{!editingFunction?.isSystemFunction && ...}` guard da Save button — mostra sempre

  j. Sezione "Available System Functions" (sotto la lista principale):
     - Mostra le system functions disponibili per il channelMode ma NON installate nel workspace
     - Backend endpoint: `GET /workspaces/:workspaceId/functions/system-missing` (controller: `getMissingSystemFunctions()`)
     - Applica stesse regole di filtro di `getFunctions` (channelMode, hasHumanSupport, enableCalendarBooking)
     - Ogni riga ha pulsante **"Reinstall"** → chiama `callingFunctionsApi.reinstall()` → ricarica lista
     - Card visivamente distinta (dashed amber border) — visibile solo se >0 funzioni mancanti

---

## Phase 5 — Tests

**11.** Creare `apps/backend/__tests__/unit/calling-functions-controller.spec.ts`:
```
SCENARIO: GET list
  - Returns all functions with attachedLlm field

SCENARIO: POST create
  - Custom function created with attachedLlm
  - Returns 201

SCENARIO: GET agent-types
  - ECOMMERCE workspace returns ["PRODUCT_SEARCH", "CART_MANAGEMENT", "ORDER_TRACKING", "CUSTOMER_SUPPORT", "PROFILE_MANAGEMENT"]
  - INFORMATIONAL workspace returns ["INFO_AGENT", "PROFILE_MANAGEMENT"]
  - Infrastructure types (SECURITY, ROUTER, etc.) are excluded

SCENARIO: PATCH custom function
  - Updates functionName, executionType, attachedLlm — all allowed

SCENARIO: PATCH system function
  - Allows: description, attachedLlm, isActive, webhookUrl, parameters, responseInstructions
  - Blocks: functionName → 403 with "Immutable fields"
  - Blocks: isSystemFunction → 403

SCENARIO: DELETE custom function
  - Returns 200, repository.delete() called (hard delete)

SCENARIO: DELETE system function
  - Returns 200, repository.delete() called (hard delete — no longer 403)

SCENARIO: POST reinstall
  - Valid system function name → upsert from defaults → 200
  - Unknown functionName (not in system-functions list) → 400 "Not a valid system function"
  - Workspace isolation: functionName valid but workspaceId mismatch → 404
```

**12.** ~~`apps/backend/__tests__/unit/system-functions-sync.spec.ts`~~ — SKIPPED:
- Il comportamento di `reinstallFunction` è già coperto dal controller spec (test reinstallFunction)
- Testare "questa funzione NON viene chiamata allo startup" è test architetturale fragile, non test di business logic

---

## Relevant files
- `packages/database/prisma/schema.prisma` — add `attachedLlm` to `WorkspaceCallingFunction`
- `apps/backend/src/repositories/calling-functions.repository.ts` — no changes (hard delete already)
- `apps/backend/src/interfaces/http/controllers/calling-functions.controller.ts` — blacklist, getAgentTypes, reinstallFunction
- `apps/backend/src/interfaces/http/routes/calling-functions.routes.ts` — agent-types + reinstall routes
- `apps/backend/src/utils/template-path.helper.ts` — `getValidAgentTypesForMode` (READ ONLY)
- `apps/backend/src/services/system-functions-sync.service.ts` — rimuovere chiamata da startup; aggiungere `reinstallFunction()`
- `apps/backend/src/constants/system-functions.ts` — add `attachedLlm` to interface + constants
- `apps/frontend/src/services/callingFunctionApi.ts` — CallingFunction interface + getAgentTypes + reinstall
- `apps/frontend/src/components/settings/sections/CallingFunctionsSection.tsx` — UI changes + Reinstall section
- `apps/backend/__tests__/unit/calling-functions-controller.spec.ts` — NEW
- `apps/backend/__tests__/unit/system-functions-sync.spec.ts` — NEW/UPDATE

---

## Security Checklist
- ✅ `/agent-types` endpoint: 3-layer middleware (auth + session + workspace)
- ✅ `/reinstall` endpoint: 3-layer middleware; valida che functionName sia una system function valida
- ✅ IDOR: tutti gli update/delete verificano esistenza record con `workspaceId`
- ✅ Campi immutabili (`functionName`, `isSystemFunction`): blacklist server-side
- ✅ No hardcoding in FE: agentTypes vengono dal backend
- ✅ Delete workspace → cascade già presente

## Verification
1. `npm run test:unit` — nuovi spec passano
2. `npm run prisma:generate` — Prisma client aggiornato
3. Custom Tools page: tutti i tools mostrano Edit + Delete (anche system)
4. "Internal" → "Calling Function" badge
5. Dropdown agentTypes popolato dal backend (F12 → network GET agent-types)
6. Edit system function (description) → 200 OK
7. Edit system function (functionName) → 403 Immutable fields
8. Delete system function → scompare dalla lista; restart app → **NON ritorna** (sync non gira più all'avvio ✅)
9. Delete + Reinstall system function → torna con i valori di default ✅
10. Custom function → hard delete, sparisce definitivamente
