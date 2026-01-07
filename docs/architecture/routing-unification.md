# LLM Router Unification - Architecture Decision Record

**Date**: January 7, 2026  
**Status**: In Progress  
**Impact**: CRITICAL - Refactors message routing pipeline

---

## 📊 FLOW ATTUALE (3 layer)

```
WebhookController
       ↓
ChatEngine.routeMessage()
       ↓
┌─────────────────────────────────┐
│ STEP 1: Intent Parse            │
│ (Pattern → Keyword → LLM)       │
└─────────────────────────────────┘
       ↓
┌─────────────────────────────────┐
│ STEP 2: Load Data               │
│ (Products, FAQs, Services)      │
└─────────────────────────────────┘
       ↓
┌─────────────────────────────────┐
│ STEP 3: Build Response          │
│ (Rules-based → Structured)      │
└─────────────────────────────────┘
       ↓
   Is intent UNKNOWN?
   ├─ NO  → Format + Translate → Response
   └─ YES → RouterOrchestrationService
            ↓
            Decide: sellsProductsAndServices?
            ├─ NO  → FAQ only (CustomerSupportAgentLLM)
            └─ YES → Full LLMRouterService
                     ↓
                     Router LLM (function calling)
                     ↓
                     Sub-agents (ProductSearch, Cart, etc.)
                     ↓
                     Response (IT)
       ↓
┌─────────────────────────────────┐
│ STEP 4: Translation Layer       │
│ (IT → Customer Language)        │
└─────────────────────────────────┘
       ↓
   Return to Customer
```

---

## 🎯 FLOW NUOVO (2 layer - unificato)

```
WebhookController
       ↓
UnifiedChatEngine.routeMessage()
       ↓
┌─────────────────────────────────┐
│ STEP 1: Preprocess              │
│ (Numbers, yes-no, context)      │
└─────────────────────────────────┘
       ↓
┌─────────────────────────────────┐
│ STEP 2: Unified Intent Detection│
│ (Pattern → Keyword → LLM)       │
└─────────────────────────────────┘
       ↓
┌─────────────────────────────────┐
│ STEP 3: Route Path Selection    │
│ (sellsProductsAndServices?)     │
└─────────────────────────────────┘
       ↓
┌─────────────────────────────────┐
│ STEP 4: Load Data               │
│ (workspace-dependent)           │
└─────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────┐
│ STEP 5: Route to Handler                    │
├─ SimpleIntentHandler (pattern/keyword)      │
│  └─ Direct rules-based response             │
├─ LLMIntentHandler (unknown intent)          │
│  └─ LLMRouterService (unchanged)            │
│     └─ Sub-agents                           │
└─────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────┐
│ STEP 6: Format Response         │
│ (Structured → Natural Italian)  │
└─────────────────────────────────┘
       ↓
┌─────────────────────────────────┐
│ STEP 7: Translation Layer       │
│ (IT → Customer Language)        │
└─────────────────────────────────┘
       ↓
   Return to Customer
```

---

## 🔴 PROBLEMI ATTUALI

### 1. RouterOrchestrationService è ridondante
- Solo decide se `sellsProductsAndServices` è true/false
- Aggiunge un layer senza logica
- **Soluzione**: Integra questa decisione in ChatEngine

### 2. Duplicazione: Intent detection
- **ChatEngine**: `intentParser.parse()` (Pattern/Keyword/LLM)
- **LLMRouter**: `callRouterLLM()` (LLM function calling)
- Due modi di decidere l'intent

### 3. Duplicazione: Data loading
- **ChatEngine**: `dataLoader.load()`
- **LLMRouter**: Query direttamente Prisma
- **RouterOrchestrationService**: Carica ancora una volta
- **Impatto**: Query ripetute, logica sparsa

### 4. Duplicazione: Response formatting
- **ChatEngine**: `responseBuilder.build()` + `llmFormatter.format()`
- **LLMRouter**: Specialist agents formattano loro
- **LLMRouter**: `ConversationHistoryLayer` humanize
- Tre percorsi diversi per lo stesso output

### 5. No clear handler pattern
- Non è chiaro quale orchestratore fa cosa
- Difficile aggiungere nuovi flussi
- Testing frammentato

### 6. Logging sparso
- Debug logs in ChatEngine
- Debug logs in LLMRouter
- Debug logs in RouterOrchestrationService
- Impossibile seguire il flusso completo

---

## ✅ SOLUZIONE: UNIFIED ROUTING ORCHESTRATOR

### Nuova architettura

```
UnifiedChatEngine
├─ Core Pipeline:
│  ├─ Preprocess
│  ├─ Unified Intent Detection (replace RouterOrch + ChatEngine logic)
│  ├─ Route Path Selection
│  ├─ Load Data
│  ├─ Delegate to Handler
│  ├─ Format Response
│  └─ Translation
│
└─ Handlers (implementano strategia specifica):
   ├─ SimpleIntentHandler
   │  └─ Gestisce pattern/keyword matches
   │  └─ Regole deterministiche
   │
   ├─ LLMIntentHandler
   │  └─ Gestisce UNKNOWN intent
   │  └─ Chiama LLMRouterService (unchanged)
   │
   └─ FAQHandler
      └─ Fallback per FAQ
      └─ Solo in informational mode
```

### Che rimane invariato

- ✅ **LLMRouterService**: Rimane esattamente così (sub-agents specialist)
- ✅ **Sub-agents**: ProductSearch, Cart, Order, Support, Profile
- ✅ **Translation Layer**: Unchanged
- ✅ **ConversationManager**: Unchanged

### Che cambia

- ❌ **RouterOrchestrationService**: DEPRECATO (logica integrata in ChatEngine)
- ✅ **ChatEngine**: Diventa vero orchestratore centrale
- ✅ **Handlers**: Pattern chiaro per estensibilità

---

## 📊 DUPLICAZIONI ESATTE DA RIMUOVERE

### Duplication 1: Workspace config load
```
CURRENT: ChatEngine + LLMRouterService + RouterOrchestrationService (3x caricano)
NEW: UnifiedChatEngine carica UNA volta in STEP 3
```

### Duplication 2: Intent decision logic
```
CURRENT:
- ChatEngine.intentParser (Pattern/Keyword/LLM fallback)
- LLMRouter.callRouterLLM (LLM function calling)

NEW:
- UnifiedChatEngine.intentDetectionPipeline() (unica fonte di verità)
- Se UNKNOWN → LLMIntentHandler → LLMRouterService
```

### Duplication 3: Data loading
```
CURRENT:
- ChatEngine.dataLoader
- LLMRouter.loadFAQs/Products (repeated)

NEW:
- UnifiedChatEngine.loadDataForIntent() (workspace-aware)
```

---

## 🧪 TEST SCENARIOS

| Scenario | Input | Expected | Handler |
|----------|-------|----------|---------|
| FAQ match | "Come funziona?" | FAQ response | SimpleIntentHandler |
| Add to cart | "Aggiungi 2 mozzarelle" | Cart updated | SimpleIntentHandler |
| Number selection | "2" | Use mapping | SimpleIntentHandler |
| Unknown intent | "Mi raccomanderesti..." | LLM call | LLMIntentHandler |
| Informational only | "Prodotti?" (sellProducts=false) | FAQ-only | FAQHandler |
| E-commerce | "Prodotti?" (sellProducts=true) | Product list | LLMIntentHandler |

---

## 🛠️ IMPLEMENTATION CHECKLIST

- [ ] Create `unified-routing-orchestrator.service.ts`
- [ ] Create handler interfaces
- [ ] Implement `SimpleIntentHandler`
- [ ] Implement `LLMIntentHandler`
- [ ] Integrate handlers into ChatEngine
- [ ] Remove RouterOrchestrationService usage
- [ ] Update ChatEngine.processMessageInternal()
- [ ] Add routing tests
- [ ] Webhook verification
- [ ] Log audit (no debug logs in production flow)

---

## 📝 NOTES

- **No changes to LLMRouterService**: Rimane specialista sub-agents
- **Keep Translation Layer**: È già perfetto
- **Keep ConversationHistoryLayer**: È già perfetto
- **Centralize logging**: Tutti gli step in UnifiedChatEngine

---
