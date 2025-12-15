# Spec 200: Prompt On-Demand Rendering

## Overview

Migrazione da sistema "compile-and-save" a sistema "on-demand rendering" per i prompt degli agent LLM.

### Problema Attuale
- `systemPrompt` viene salvato nel DB dopo compilazione IF
- Richiede trigger al save di workspace settings
- Possibile desync tra template e DB
- Complessità aggiuntiva con `PromptCompilerService`

### Nuova Architettura
- Template `.md` letti da file system
- **STEP 1 - RENDER**: Compila `{{#if}}` con workspace settings (live)
- **STEP 2 - REPLACE**: Sostituisce `{{variables}}` con dati runtime
- **DB salva SOLO**: `model`, `temperature`, `maxTokens`, `isActive` per agent
- `systemPrompt` nel DB → deprecato/non usato

---

## Acceptance Criteria

### AC-1: Template Loading
- [x] Ogni agent legge il proprio template da `/apps/backend/src/templates/{type}/`
- [x] Template ecommerce: `router.md`, `product-search.md`, `order-tracking.md`, `cart-management.md`, `customer-support.md`
- [x] Template informational: `router.md`, `customer-support.md`
- [x] Selezione automatica basata su `workspace.sellsProductsAndServices`

### AC-2: Step 1 - RENDER (Conditionals)
- [x] `TemplateEngineService.compileConditionals(template, workspaceSettings)` risolve:
  - `{{#if hasHumanSupport}}...{{/if}}`
  - `{{#unless sellsProductsAndServices}}...{{/unless}}`
  - Nested conditionals
- [x] Output: template senza IF/UNLESS ma con `{{variables}}` intatte
- [x] Workspace settings letti live dal DB (non cached stale)

### AC-3: Step 2 - REPLACE (Variables)
- [x] `PromptProcessorService.replaceAllVariables()` sostituisce:
  - `{{products}}` → lista prodotti da DB
  - `{{services}}` → lista servizi da DB
  - `{{categories}}` → lista categorie da DB
  - `{{offers}}` → offerte attive da DB
  - `{{faqs}}` → FAQ da DB
  - `{{customerName}}`, `{{companyName}}`, `{{languageUser}}`, etc.
- [x] Output: prompt finale pronto per LLM

### AC-4: Agent Configuration
- [x] DB `AgentConfig` usato SOLO per: `model`, `temperature`, `maxTokens`, `isActive`, `type`
- [x] `systemPrompt` colonna ignorata (legacy)
- [x] Frontend mostra solo campi editabili (no systemPrompt)
- [x] API ignora `systemPrompt` se inviato dal frontend

### AC-5: Performance
- [x] Template files cached in memoria (invalidati solo a restart)
- [x] Workspace settings cached per request (non per ogni agent call)
- [x] Latency < 50ms per step RENDER + REPLACE
- [x] No N+1 queries per products/categories/etc.

### AC-6: Security
- [x] Workspace isolation: ogni agent vede SOLO dati del proprio workspace
- [x] No prompt injection via `customAiRules` o altri campi user-editable
- [x] Template files read-only (non modificabili via API)

### AC-7: Agents Updated
- [x] `RouterAgentLLM` usa on-demand rendering (via PromptBuilder + fallback TemplateLoaderService)
- [x] `ProductSearchAgentLLM` usa on-demand rendering
- [x] `OrderTrackingAgentLLM` usa on-demand rendering
- [x] `CartManagementAgentLLM` usa on-demand rendering
- [x] `CustomerSupportAgentLLM` usa on-demand rendering
- [x] `ProfileManagementAgentLLM` usa on-demand rendering

### AC-8: Cleanup
- [x] Rimosso `PromptCompilerService` references
- [x] Rimosso trigger in `WorkspaceService.update()`
- [x] Rimossi riferimenti a `systemPrompt` save in agent.service
- [x] Nessun codice morto o duplicato

### AC-9: Frontend
- [x] `AgentSettingsPage` mostra SOLO: model, temperature, maxTokens, isActive
- [x] Nessuna visualizzazione di systemPrompt (neanche readonly)
- [x] Help text spiega che prompts sono generati da templates

### AC-10: Documentation
- [x] `docs/PROMPT_VARIABLES.md` aggiornato con nuovo flusso
- [ ] `docs/PRD.md` aggiornato (sezione prompt system) - N/A (PRD già completo)
- [ ] `docs/architecture/` aggiornato con diagrammi - N/A (optional)

---

## Edge Cases

### E-1: Workspace senza prodotti
- Se `sellsProductsAndServices=true` ma 0 prodotti nel DB
- `{{products}}` → messaggio "Nessun prodotto disponibile" (non errore)

### E-2: Template file mancante
- Log error e fallback a prompt minimale
- Non crash dell'agent

### E-3: Cambio settings durante conversazione
- Nuovi settings applicati immediatamente alla prossima chiamata LLM
- Nessun caching cross-request

### E-4: Variable non trovata
- `{{unknownVar}}` → lasciata com'è o rimossa (con warning log)
- Non crash

---

## Performance Requirements

| Metric | Target | Max |
|--------|--------|-----|
| Template load (cached) | < 1ms | 5ms |
| Template load (cold) | < 10ms | 50ms |
| RENDER step | < 5ms | 20ms |
| REPLACE step | < 30ms | 100ms |
| Total prompt generation | < 50ms | 150ms |

---

## Test Plan

### Unit Tests
- `TemplateEngineService.compileConditionals()` - tutti i casi IF/UNLESS
- `PromptProcessorService.replaceAllVariables()` - tutte le variabili
- Template loading con cache

### Integration Tests
- Full flow: template → render → replace → LLM call
- Workspace isolation (agent A non vede dati workspace B)

### Security Tests
- Prompt injection attempts via customAiRules
- Template path traversal attempts

---

## Files to Modify

### Backend - Remove
- `apps/backend/src/application/services/prompt-compiler.service.ts` (DELETE)
- Trigger in `workspace.service.ts` (REMOVE)
- systemPrompt handling in `agent.service.ts` (REMOVE)

### Backend - Modify
- `apps/backend/src/application/agents/*.ts` - tutti gli agent
- `apps/backend/src/application/services/prompt-builder/template-engine.service.ts`
- `apps/backend/src/services/prompt-processor.service.ts`

### Frontend - Modify
- `apps/frontend/src/pages/AgentSettingsPage.tsx` - rimuovi systemPrompt UI

### Docs - Update
- `docs/PROMPT_VARIABLES.md`
- `docs/PRD.md`
- `docs/architecture/prompt-system.md` (create if needed)
