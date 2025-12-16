# Research: Order Transport Optimization

**Phase**: 0 | **Status**: Complete | **Date**: 2025-12-16

## Pre-Research Questions from Spec

### Q1: Plan Gating (Option 5 visibility)
**Question**: Se l'utente è Basic/Free, Option 5 appare grigia o non appare proprio?  
**Answer**: Non appare proprio nel menu. Il MenuCartView filtra le opzioni in base a `workspace.planType`.

**Implementation**: Aggiungere flag `requiredPlan: 'premium'` agli item menu in CallingFunctionsService.

### Q2: Modello LLM
**Question**: Quale modello LLM per OrderOptimizationAgentLLM?  
**Answer**: **GPT-4.1** (via OpenRouter). Premium feature = premium model.

### Q3: Persistenza fallback trasporti
**Question**: Il check "trasporti configurati?" ha memoria o ricontrolla ogni volta?  
**Answer**: Ricontrolla ogni volta. Nessuna persistenza. Lo stato può cambiare (admin aggiunge prezzi mid-session).

### Q4: Validazione input
**Question**: Servono ulteriori validazioni sull'input utente (opzione 5)?  
**Answer**: No. Il sistema menu esistente gestisce già la validazione. Utente seleziona "5", nessun altro input richiesto.

### Q5: Prodotto senza trasporto
**Question**: Se un prodotto non ha trasporto associato, cosa succede?  
**Answer**: **Rendere trasporto obbligatorio**:
- DB: `Product.transportTypeId` diventa required (NOT NULL)
- FE Admin: Dropdown trasporto obbligatorio nella form prodotto
- Seed: Tutti i prodotti esistenti ricevono un trasporto di default

## Existing Code Analysis

### TransportType Model (Current)
```prisma
model TransportType {
  id          String    @id @default(uuid())
  workspaceId String
  name        String    // e.g., "Frigo", "Surgelato", "Ambiente"
  description String?
  isActive    Boolean   @default(true)
  // MISSING: price field
}
```

**Gap**: Manca il campo `price` per il costo di spedizione.

### Product-Transport Relationship
```prisma
model Products {
  // ... existing fields
  transportTypeId String?       // CURRENT: nullable
  transportType   TransportType?
}
```

**Gap**: `transportTypeId` è nullable. Deve diventare required.

### Cart Service (Existing)
File: `apps/backend/src/application/services/cart-service.service.ts`
- Già calcola totali carrello
- Già raggruppa per prodotto
- **Estendere** con metodo `analyzeTransportOptimization()`

### CallingFunctions Menu System
File: `apps/backend/src/application/services/calling-functions.service.ts`
- Gestisce opzioni menu carrello (1-4 attuali)
- **Estendere** con opzione 5 e plan gating

## Dependencies

### New Dependencies
Nessuna. Usa dipendenze esistenti:
- Prisma (DB access)
- OpenRouter (LLM API) - già configurato per altri agents

### Internal Dependencies
- `CartService` - estendere con metodo optimization
- `CallingFunctionsService` - aggiungere opzione 5
- `LLMRouterService` - routing a nuovo sub-agent
- `PromptProcessorService` - variabili nel template prompt

## Research Decisions

| Decision | Option Chosen | Alternatives Considered |
|----------|---------------|------------------------|
| LLM Model | GPT-4.1 | GPT-4-mini (troppo economico per premium feature) |
| Menu visibility | Hidden for Basic/Free | Greyed out (confusing UX) |
| Transport check | Re-check every time | Cache (stale data risk) |
| Product transport | Required (NOT NULL) | Optional with fallback (complexity) |
| Price field type | Decimal(10,2) | Integer (loses precision for frazioni) |

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| LLM latency | Medium | Medium | Set timeout 30s, show loading state |
| Missing transport prices | Low | High | Admin notifica + fallback message |
| Concurrent cart changes | Low | Low | Re-fetch cart prima di analisi |

## Open Items

Nessuno. Tutte le domande risolte nella sessione di clarify.

---

**Next**: Phase 1 - [data-model.md](./data-model.md)
