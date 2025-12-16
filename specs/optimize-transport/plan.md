# Implementation Plan: Order Transport Optimization

**Branch**: `feature/optimize-transport` | **Date**: 2025-12-16 | **Spec**: [docs/prompts/optimize-cart.md](../../docs/prompts/optimize-cart.md)
**Input**: Feature specification from `docs/prompts/optimize-cart.md`

## Summary

Aggiungere una nuova opzione **"5. Ottimizzazione dell'ordine"** al menu carrello per workspace **Premium/Enterprise**. Il sistema analizza i trasporti richiesti dal carrello, calcola i costi di spedizione (prezzi lordi, IVA inclusa), e propone prodotti compatibili per ottimizzare il costo per unità. Un sub-agent LLM dedicato (GPT-4.1) spiega l'analisi in linguaggio naturale.

**Key architectural decisions:**
- Backend calcola tutto deterministicamente (nessun calcolo LLM)
- LLM sub-agent solo per spiegazione e raccomandazioni
- Opzione 5 **invisibile** per piani Basic/Free/Trial (non compare nel menu)
- Trasporto obbligatorio per ogni prodotto (DB constraint + FE validation)
- Ricontrollo configurazione trasporti ad ogni richiesta (no cache/memoria)

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 18+  
**Primary Dependencies**: Express, Prisma ORM, OpenRouter (GPT-4.1)  
**Storage**: PostgreSQL (via Prisma)  
**Testing**: Jest (unit + integration)  
**Target Platform**: Node.js server + React frontend  
**Project Type**: Monorepo (apps/backend, apps/frontend)  
**Performance Goals**: <2s response time per ottimizzazione  
**Constraints**: Tutti i prezzi arrotondati (interi), IVA 22% inclusa  
**Scale/Scope**: Multi-tenant, ~1000 workspace

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

**Principle I - Database-First**:

- [x] No hardcoded prompts, configurations, or translations
- [x] All dynamic content from database (TransportType.price, Products, workspace.planType)
- [x] Proper error handling if database data missing (messaggio "trasporti non configurati")

**Principle II - Workspace Isolation**:

- [x] All database queries filter by `workspaceId`
- [x] Middleware stack extracts workspace from JWT token
- [x] No cross-workspace data access (TransportType, Products filtered)

**Principle III - Variable Replacement**:

- [x] Agent prompts use template syntax: `{{variable}}`
- [x] OrderOptimizationAgentLLM riceve JSON con dati deterministici
- [x] Base language Italian, LLM handles translation
- [x] **Variable Uniqueness**: Nessuna variabile large nel prompt di ottimizzazione

**Principle IV - No Static Translations**:

- [x] Transport names in Italian only (database)
- [x] Output LLM passa sempre da Translation Agent
- [x] No translation mapping dictionaries

**Principle V - 360-Degree Thinking**:

- [x] Frontend-backend contract validated (cart view + optimization endpoint)
- [x] Security middleware stack complete (auth → session → workspace)
- [x] Database migration (TransportType.price) + seed + repository + tests
- [x] Full-stack implementation (BE service + LLM agent + FE cart view)

**Principle VI - Chat Isolation & Concurrency Safety**:

- [x] Optimization è read-only (no race conditions sul carrello)
- [x] NO global locks needed (operazione stateless)

**Principle VII - Code Cleanliness & Technical Debt Prevention**:

- [x] No temporary scripts or backup files
- [x] OrderOptimizationService in file dedicato
- [x] Prompt in template standard (docs/prompts/templates/)

**Multi-Agent Architecture**:

- [x] Router → OrderOptimizationAgent → Translation Agent flow
- [x] Sub-agent usa contesto limitato (solo cart + transport data)
- [x] Output sempre tradotto prima di inviare a utente

**Security Requirements**:

- [x] Plan gating: Premium/Enterprise only (workspace.planType check)
- [x] workspaceId filter su tutte le query

**Testing Standards**:

- [x] Unit tests per OrderOptimizationService (calcoli, rounding)
- [x] Unit tests per routing menu 5
- [x] Integration tests per carrello con trasporti

## Project Structure

### Documentation (this feature)

```text
specs/optimize-transport/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
# Backend
apps/backend/
├── src/
│   ├── application/
│   │   └── services/
│   │       └── order-optimization.service.ts    # NEW: Core service
│   ├── application/agents/
│   │   └── OrderOptimizationAgentLLM.ts         # NEW: Sub-agent
│   ├── interfaces/http/routes/
│   │   └── (existing routes, menu option 5 routing)
│   └── templates/ecommerce/
│       └── 10-order-optimization.template.md    # NEW: Prompt template
└── __tests__/
    └── unit/
        └── services/
            └── order-optimization.spec.ts       # NEW: Tests

# Frontend
apps/frontend/
├── src/
│   └── (cart view updates only - transport prices display)

# Database
packages/database/
└── prisma/
    ├── schema.prisma                            # UPDATE: TransportType.price
    └── seed.ts                                  # UPDATE: Default transport prices
```

**Structure Decision**: Monorepo esistente con backend/frontend separati. Nuovi file isolati in `application/services/` e `application/agents/`.

## Complexity Tracking

> Nessuna violazione di Constitution. Feature allineata con architettura esistente.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| N/A | - | - |

---

## Phase 0: Research Output

Vedi [research.md](./research.md)

## Phase 1: Design Output

- [data-model.md](./data-model.md) - Entity definitions
- [contracts/](./contracts/) - API contracts
- [quickstart.md](./quickstart.md) - Development setup

## Next Steps

1. ✅ Plan created (`/speckit.plan`)
2. ⏳ **Run `/speckit.tasks`** to generate detailed task breakdown
3. ⏳ Implement Phase by Phase

