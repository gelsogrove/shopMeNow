# Implementation Plan: Order Selection, Invoice Email & Agent Variables

**Branch**: `202-order-selection-invoice-agent` | **Date**: 2024-12-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/202-order-selection-invoice-agent/spec.md`

## Summary

Fix critical chatbot bugs and add new features:
1. **P1**: Fix order selection bug - typing "1" after order list returns "product not found" (root cause: `#` prefix not stripped)
2. **P1**: Show action options after order details (Scarica fattura, Ripeti ordine, Nota di credito)
3. **P2**: Send invoice PDF as email attachment
4. **P2**: Handle "chi è il mio agente?" query with proper agent info
5. **P2**: Route emails to agent/admin based on `hasSalesAgents` workspace flag
6. **P2**: Repeat order flow (atomic: clear cart → add items → confirm → email)

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 18+  
**Primary Dependencies**: Express, Prisma ORM, OpenRouter (LLM)  
**Storage**: PostgreSQL  
**Testing**: Jest (unit + integration)  
**Target Platform**: Linux server (Docker)  
**Project Type**: Monorepo (apps/backend, apps/frontend)  
**Performance Goals**: Response < 2s, Email delivery < 30s  
**Constraints**: Workspace isolation mandatory, no hardcoded data  
**Scale/Scope**: Multi-tenant SaaS, WhatsApp chatbot

## Constitution Check

_GATE: Must pass before implementation._

**Principle I - Database-First**:
- [x] No hardcoded prompts, configurations, or translations
- [x] All dynamic content from database (agentConfig, products, categories)
- [x] Proper error handling if database data missing (no fallback defaults)

**Principle II - Workspace Isolation**:
- [x] All database queries filter by `workspaceId`
- [x] Middleware stack extracts workspace from JWT token
- [x] No cross-workspace data access (security tests required)

**Principle III - Variable Replacement**:
- [x] Agent prompts use template syntax: `{{variable}}`
- [x] Runtime replacement via `replaceAllVariables()` before LLM calls
- [x] `{{agentName}}`, `{{agentPhone}}`, `{{agentEmail}}` already exist

**Principle V - 360-Degree Thinking**:
- [x] Backend-only changes (WhatsApp chatbot, no frontend)
- [x] Security: Verify customer owns order before sending invoice
- [x] Tests: Unit tests for all new logic

**Principle VI - Chat Isolation & Concurrency Safety**:
- [x] Repeat order uses transaction for atomicity
- [x] Cart operations with locking to prevent race conditions

**Principle VII - Code Cleanliness**:
- [x] No temporary files
- [x] Reuse existing patterns (EmailService, ResponseBuilder)
- [x] Extract email routing logic to shared utility

---

## Implementation Phases

### Phase 1: Fix Order Selection Bug (P1) ⚡ CRITICAL

**Goal**: Customer types "1" after order list → sees order details (not "product not found")

**Files to modify**:
| File | Change |
|------|--------|
| `apps/backend/src/application/chat-engine/options-mapping.service.ts` | Update `cleanLabel()` to strip `#` prefix |

**Implementation**:
```typescript
// In cleanLabel method, add:
.replace(/^#/, '')  // Strip # prefix from order codes
```

**Tests**:
- [ ] UT-OM-1: `cleanLabel` strips `#` prefix from `#ORD-048-2025-9` → `ORD-048-2025-9`
- [ ] UT-OM-2: `cleanLabel` handles order codes without `#` prefix
- [ ] UT-OM-3: `cleanLabel` preserves other label formats (products, categories)

**Checkpoint**: Run existing tests + new tests → All pass

---

### Phase 2: Order Details with Actions (P1)

**Goal**: After selecting order, show action options (fattura, ripeti, nota credito)

**Files to modify**:
| File | Change |
|------|--------|
| `apps/backend/src/application/response-builder/response-builder.service.ts` | Add action options after order details |
| `apps/backend/src/application/chat-engine/options-mapping.service.ts` | Store action options in `lastOptionsContext` |

**Response format** (from spec):
```
Cosa vuoi fare?
1. 📄 Scarica fattura
2. 🔄 Ripeti ordine
3. 📋 Scarica nota di credito  ← (solo se presenti)
```

**Tests**:
- [ ] UT-RB-1: Order details include action options
- [ ] UT-RB-2: Action options stored in lastOptionsContext
- [ ] UT-RB-3: Credit note option only shown when credit notes exist

**Checkpoint**: Test order selection → details with actions displayed

---

### Phase 3: Invoice Email with PDF (P2)

**Goal**: Customer selects "Scarica fattura" → receives email with PDF attached

**Files to modify**:
| File | Change |
|------|--------|
| `apps/backend/src/services/email.service.ts` | Add `sendInvoiceEmail()` with PDF attachment |
| `apps/backend/src/domain/calling-functions/` | Add `sendInvoice.ts` calling function |

**PDF Naming**: `{orderCode}_fattura.pdf` (e.g., `ORD-048-2025-9_fattura.pdf`)

**Tests**:
- [ ] UT-EM-1: Invoice email includes PDF attachment
- [ ] UT-EM-2: Invoice PDF naming follows convention

**Checkpoint**: Test invoice email → PDF attached

---

### Phase 4: Agent Info Query (P2)

**Goal**: "Chi è il mio agente?" → shows agent name, email, phone

**Files to modify**:
| File | Change |
|------|--------|
| `apps/backend/src/application/intent/intent.types.ts` | Add `SHOW_AGENT_INFO` intent |
| `apps/backend/src/application/data-loader/data-loader.service.ts` | Add `loadAgentInfo()` method |
| `apps/backend/src/application/response-builder/response-builder.service.ts` | Add agent info response builder |

**Response format** (from spec):
```
Il tuo agente dedicato è:
👤 Marco Bianchi
📧 marco.bianchi@azienda.it
📞 +39 333 1234567

Puoi contattarlo per qualsiasi esigenza!
```

**Tests**:
- [ ] UT-DL-3: `loadAgentInfo` returns agent details when customer has salesId
- [ ] UT-DL-4: `loadAgentInfo` returns null when no salesId
- [ ] UT-DL-5: `loadAgentInfo` respects `hasSalesAgents` flag

**Checkpoint**: Test agent query → correct response

---

### Phase 5: Email Routing (P2)

**Goal**: Emails route to agent (if `hasSalesAgents=true` + `salesId`) or admin

**Files to modify**:
| File | Change |
|------|--------|
| `apps/backend/src/domain/calling-functions/contactOperator.ts` | Check `hasSalesAgents` flag |
| `apps/backend/src/domain/calling-functions/confirmOrder.ts` | Check `hasSalesAgents` flag |
| `apps/backend/src/utils/email-routing.utils.ts` | NEW: Extract shared routing logic |

**Routing logic**:
```
hasSalesAgents=true AND salesId exists → Agent email
hasSalesAgents=true AND NO salesId    → Admin email
hasSalesAgents=false                  → Admin email
```

**Tests**:
- [ ] UT-EM-5: Email to agent when `hasSalesAgents=true` + `salesId`
- [ ] UT-EM-6: Email to admin when `hasSalesAgents=false`
- [ ] UT-EM-7: Email to admin when `hasSalesAgents=true` but no `salesId`

**Checkpoint**: Test email routing → correct recipients

---

### Phase 6: Repeat Order (P2)

**Goal**: "Ripeti ordine" → clear cart, add items, confirm, send email

**Files to modify**:
| File | Change |
|------|--------|
| `apps/backend/src/domain/calling-functions/repeatOrder.ts` | NEW: Atomic repeat order function |

**Flow** (atomic transaction):
1. Check ALL products available → if ANY unavailable, ABORT
2. Clear existing cart
3. Add all items from original order
4. Confirm order automatically
5. Send confirmation email
6. Respond with new order code

**ABORT message**:
```
❌ Mi dispiace, l'ordine non si può ripetere per mancanza di stock in questo momento.

Vuoi vedere la lista dei prodotti?
1. 📦 Sì, mostrami i prodotti
2. 🔙 No, torna al menu
```

**Tests**:
- [ ] UT-RO-1: Repeat order clears existing cart
- [ ] UT-RO-2: Repeat order adds all items from original order
- [ ] UT-RO-3: Repeat order creates new order automatically
- [ ] UT-RO-4: Repeat order sends confirmation email
- [ ] UT-RO-5: Repeat order fails gracefully when products unavailable
- [ ] UT-RO-6: Repeat order is atomic (rollback on failure)

**Checkpoint**: Test repeat order → new order created, email sent

---

### Phase 7: Credit Notes Email (P2)

**Goal**: "Scarica nota di credito" → email with credit note PDFs

**Files to modify**:
| File | Change |
|------|--------|
| `apps/backend/src/services/email.service.ts` | Add `sendCreditNotesEmail()` |
| `apps/backend/src/domain/calling-functions/sendCreditNotes.ts` | NEW: Calling function |

**PDF Naming**: `{orderCode}_notadicredito{N}.pdf`

**Tests**:
- [ ] UT-EM-3: Credit note email includes multiple PDF attachments
- [ ] UT-EM-4: Credit note naming follows convention

---

## Project Structure

```text
apps/backend/src/
├── application/
│   ├── chat-engine/
│   │   └── options-mapping.service.ts    # Phase 1: cleanLabel fix
│   ├── data-loader/
│   │   └── data-loader.service.ts        # Phase 4: loadAgentInfo
│   ├── intent/
│   │   └── intent.types.ts               # Phase 4: SHOW_AGENT_INFO
│   └── response-builder/
│       └── response-builder.service.ts   # Phase 2, 4: action options, agent info
├── domain/calling-functions/
│   ├── contactOperator.ts                # Phase 5: email routing
│   ├── confirmOrder.ts                   # Phase 5: email routing
│   ├── repeatOrder.ts                    # Phase 6: NEW
│   ├── sendInvoice.ts                    # Phase 3: NEW
│   └── sendCreditNotes.ts                # Phase 7: NEW
├── services/
│   └── email.service.ts                  # Phase 3, 7: PDF attachments
└── utils/
    └── email-routing.utils.ts            # Phase 5: NEW shared utility
```

---

## Verification Checklist

### Before Each Phase
- [ ] Read existing code in files to modify
- [ ] Study existing patterns (ResponseBuilder, EmailService)
- [ ] Run existing tests to establish baseline

### After Each Phase
- [ ] New unit tests pass
- [ ] Existing tests still pass
- [ ] No TypeScript errors
- [ ] Code follows existing patterns

### Final Verification
- [ ] ALL 23 unit tests from spec pass
- [ ] `npm run test:unit` passes
- [ ] Existing chatbot flows work:
  - [ ] Lista prodotti + selezione numerica
  - [ ] Lista categorie + selezione numerica
  - [ ] Carrello + checkout
  - [ ] Ricerca prodotti
  - [ ] Lista ordini

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing order flow | HIGH | Test existing flow after Phase 1 |
| PDF attachment fails | MEDIUM | Create demo PDF for MVP, test email service |
| Repeat order race condition | MEDIUM | Use transaction, add integration test |
| Response format mismatch | HIGH | Follow EXACT format from spec, reuse ResponseBuilder patterns |
