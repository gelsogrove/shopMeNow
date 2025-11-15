# Agent Architecture Rules - Constitution

**Created**: 2025-11-15  
**Status**: MANDATORY - Must follow these rules  
**Owner**: Andrea

---

## 🏛️ REGOLA I: Single Source of Truth per Funzioni

**RULE**: Tutte le funzioni disponibili per gli agent LLM DEVONO essere definite in UN SOLO FILE configurazione.

**IMPLEMENTATION**:

- ✅ File unico: `backend/src/config/agent-functions.config.ts`
- ✅ Backend `llm.service.ts` legge da questo file
- ✅ Frontend `/agents` legge da API che espone questo file
- ✅ Database `availableFunctions` viene popolato da questo file nel seed
- ❌ NO hardcoded functions in multiple places
- ❌ NO duplicazione definizioni

**WHY**: Evitare disallineamento tra UI admin e comportamento reale LLM

---

## 🏛️ REGOLA II: Variable Uniqueness Constraint (Aggiornata)

**RULE**: Ogni variabile grande può apparire **AL MASSIMO UNA VOLTA PER AGENT PROMPT**.

**VARIABILI GRANDI**:

- `{{PRODUCTS}}` - Lista tutti prodotti (~50k tokens)
- `{{SERVICES}}` - Lista tutti servizi (~5k tokens)
- `{{CATEGORIES}}` - Lista tutte categorie (~2k tokens)
- `{{OFFERS}}` - Lista tutte offerte (~3k tokens)

**ALLOWED**:

- ✅ `{{SERVICES}}` in Router Agent prompt
- ✅ `{{SERVICES}}` in Product Search Agent prompt (agents diversi OK)
- ✅ `{{PRODUCTS}}` in Product Search Agent prompt
- ✅ `{{CATEGORIES}}` in Product Search Agent prompt

**FORBIDDEN**:

- ❌ `{{SERVICES}}` due volte nello STESSO prompt Router Agent
- ❌ `{{PRODUCTS}}` due volte nello STESSO prompt Product Search Agent
- ❌ `{{CATEGORIES}}` due volte nello STESSO prompt

**REASON**: Ogni variabile può generare 50k+ tokens. Duplicazione NELLO STESSO PROMPT causa 100k+ prompt → API failure.

**ENFORCEMENT**:

- Validazione on save in Admin UI
- Runtime warnings in PromptProcessorService

---

## 🏛️ REGOLA III: Router Agent Responsibility

**RULE**: Router Agent ha SOLO responsabilità di orchestrazione + storia conversazionale.

**ROUTER AGENT DOES**:

- ✅ Mantiene storia conversazione (conversation history)
- ✅ Decide quale specialist agent chiamare
- ✅ Risponde a FAQ semplici
- ✅ Gestisce notifiche push (manageNotifications)

**ROUTER AGENT DOES NOT**:

- ❌ Gestire logica di prodotti/servizi (delega a Product Search Agent)
- ❌ Gestire carrello (delega a Cart Management Agent)
- ❌ Gestire ordini (delega a Order Tracking Agent)
- ❌ Formattazione/tone response (questo è dei specialist)

**WHY**: Separation of concerns - Router orchestrates, Specialists execute

---

## 🏛️ REGOLA IV: Welcome/WIP Messages Format

**RULE**: `welcomeMessage` e `wipMessage` nel database sono **stringhe semplici in INGLESE**, NON oggetti JSON multi-lingua.

**DATABASE SCHEMA**:

```prisma
model Workspace {
  welcomeMessage String?  // "Welcome to ShopME! I'm your assistant..." (plain English)
  wipMessage     String?  // "Work in progress. Contact us later." (plain English)
}
```

**ADMIN UI FORM**:

- ✅ Input type: `<textarea>` semplice
- ✅ Placeholder: "Enter welcome message in English..."
- ✅ Save: Stringa diretta (no JSON.stringify)
- ✅ Load: Stringa diretta (no JSON.parse)
- ❌ NO multi-language object `{en: "", it: "", es: ""}`
- ❌ NO JSON editor

**TRANSLATION**:

- Translation Layer (Safety & Translation Agent) traduce automaticamente in lingua cliente
- Admin scrive SOLO in inglese
- Sistema traduce runtime

**SEED DATA**:

```typescript
// backend/prisma/data/workspaceSettings.ts
export const workspaceSettings = {
  welcomeMessage: "Welcome to Bell'Italia! I'm SofiA...", // ✅ String
  wipMessage: "Work in progress. Contact us later.", // ✅ String
  // ❌ NO: welcomeMessages: { en: "", it: "" }
}
```

**WHY**: Simplicità - una sola versione, traduzione automatica

---

## 🏛️ REGOLA V: Agent Configuration UI

**RULE**: Frontend `/agents` page mostra configurazione REALE degli agent dal backend, non placeholder.

**IMPLEMENTATION**:

- ✅ Frontend chiama API: `GET /api/agent-config`
- ✅ API ritorna agent configs dal database + funzioni disponibili da `agent-functions.config.ts`
- ✅ UI mostra: nome agent, tipo, temperature, max tokens, **funzioni reali disponibili**
- ❌ NO funzioni hardcoded nel frontend
- ❌ NO placeholder "addToCart, viewCart, clearCart"

**RESPONSE EXAMPLE**:

```json
{
  "agents": [
    {
      "name": "Router Agent",
      "type": "ROUTER",
      "temperature": 0.3,
      "maxTokens": 2048,
      "availableFunctions": [
        "productSearchAgent",
        "cartManagementAgent",
        "orderTrackingAgent",
        "manageNotifications"
      ]
    },
    {
      "name": "Cart Management Agent",
      "type": "CART_MANAGEMENT",
      "availableFunctions": ["addProduct", "resetCart", "getCartLink"]
    }
  ]
}
```

**WHY**: Admin vede esattamente cosa può fare ogni agent

---

## 📋 IMPLEMENTATION CHECKLIST

Prima di implementare, verificare:

- [ ] `agent-functions.config.ts` esiste e definisce TUTTE le funzioni
- [ ] `llm.service.ts` usa `agent-functions.config.ts` (no hardcoded)
- [ ] Database seed popola `availableFunctions` da config file
- [ ] API endpoint espone funzioni disponibili per frontend
- [ ] Frontend `/agents` legge da API (no placeholder)
- [ ] `welcomeMessage` e `wipMessage` sono stringhe semplici (no JSON)
- [ ] Admin UI usa `<textarea>` per welcome/wip (no JSON editor)
- [ ] Seed data ha stringhe semplici per welcome/wip
- [ ] Ogni variabile appare max 1 volta per prompt
- [ ] Router Agent ha solo orchestrazione (no business logic)

---

## 🚨 VIOLATIONS TO AVOID

❌ **NO**: Funzioni hardcoded in `llm.service.ts` getAvailableFunctions()  
✅ **YES**: Funzioni da `agent-functions.config.ts`

❌ **NO**: Frontend mostra funzioni placeholder  
✅ **YES**: Frontend legge funzioni reali da API

❌ **NO**: welcomeMessage come JSON object `{en: "", it: ""}`  
✅ **YES**: welcomeMessage come stringa semplice "Welcome..."

❌ **NO**: `{{SERVICES}}` due volte nello stesso prompt  
✅ **YES**: `{{SERVICES}}` max una volta per prompt

❌ **NO**: Router Agent gestisce logica prodotti  
✅ **YES**: Router Agent delega a Product Search Agent

---

**Last Updated**: 2025-11-15  
**Next Review**: Dopo implementazione completa
