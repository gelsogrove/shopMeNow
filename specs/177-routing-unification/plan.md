# Implementation Plan: LLM Router Unification

**Epic**: Consolidate routing logic to single source of truth  
**Branch**: `177-routing-unification`  
**Technology Stack**: TypeScript, Node.js 18+, Express, Prisma ORM, Jest  
**Duration**: 2-3 days  

---

## 🏗️ Architecture Changes

### Current State (3-Layer Redundancy)
```
ChatEngine.processMessageInternal()
    ↓
    intent = detectIntent(message)  [DUPLICATION #1]
    config = loadWorkspaceConfig()  [DUPLICATION #2]
    ↓
RouterOrchestrationService.selectPath()
    ↓ intent check + data loading [DUPLICATION #3]
    ↓
LLMRouterService.routeMessage()
    ↓ specialist agents
```

**Problems**:
- 3 places detecting intent (different logic paths)
- 2 places loading workspace config
- 2 places loading product/FAQ/service data
- No clear responsibility boundaries
- Hard to test, maintain, extend

### Target State (2-Layer Clean)
```
ChatEngine.processMessageInternal()
    ↓ [CENTRAL ENTRY]
UnifiedRoutingService.detectIntent()
    intent + path decision + loaded data
    ↓
Handler Pattern:
    - SimpleIntentHandler (pattern/keyword)
    - LLMIntentHandler (unknown → LLMRouter)
    ↓
LLMRouterService.routeMessage() [UNCHANGED]
```

**Benefits**:
- Single source of truth for routing logic
- Clear handler responsibilities
- Easier to test (handlers are pure functions)
- Easy to add new handler types
- Performance: One data load per message

---

## 📦 Project Structure

### New Services
```
apps/backend/src/application/services/
├─ unified-routing.service.ts
│  ├─ detectIntent(context: RoutingContext): Promise<Intent>
│  ├─ selectRoutingPath(workspace, intent): "SIMPLE" | "LLM" | "FAQ"
│  ├─ loadDataForIntent(workspace, intent): Promise<LoadedData>
│  └─ logRoutingDecision(decision: RoutingDecision): void
```

### New Handlers
```
apps/backend/src/application/chat-engine/handlers/
├─ index.ts                           [export handlers]
├─ simple-intent.handler.ts
│  └─ handle(intent, context): Promise<HandlerResult>
└─ llm-intent.handler.ts
   └─ handle(intent, context): Promise<HandlerResult>
```

### Modified Files
```
apps/backend/src/application/chat-engine/
├─ chat-engine.service.ts
│  ├─ Inject handlers (constructor)
│  ├─ Call handlers in processMessageInternal()
│  └─ Keep Translation Layer call (STEP 2)
```

### Deprecated
```
apps/backend/src/services/
├─ router-orchestration.service.ts [MARK DEPRECATED]
│  └─ Add comment: "Consolidated into UnifiedRoutingService + Handler Pattern"
```

---

## 🔧 Technical Details

### Intent Types (remain same)
- `SHOW_PRODUCTS` - Pattern: "mostra prodotti"
- `ADD_TO_CART` - Pattern: "aggiungi 2 cose al carrello"
- `REPEAT_ORDER` - Pattern: "ripeti ordine"
- `VIEW_CART` - Pattern: "vedi carrello"
- `CONTINUE_CHECKOUT` - Pattern: "procedi pagamento"
- `INCOMPREHENSIBLE` - Fallback: no pattern match

### Routing Paths
1. **SIMPLE**: Pattern/keyword matches → SimpleIntentHandler → deterministic response
2. **LLM**: Unknown intents → LLMIntentHandler → LLMRouter → specialist agents
3. **FAQ**: Workspace FAQ mode → FAQ specialist agent

### Data Loading Strategy
- Load workspace config **once** per message
- Load products **if** intent needs them (SHOW_PRODUCTS, SEARCH)
- Load FAQs **if** intent needs them (FAQ mode)
- Load services/offers **if** intent needs them
- **Constraint**: No duplicate queries

### Handler Interface
```typescript
interface IntentHandler {
  handle(
    intent: Intent,
    context: SimpleIntentHandlerContext | LLMIntentHandlerContext
  ): Promise<HandlerResult>
}

interface HandlerResult {
  message: string
  agentUsed: "SIMPLE" | "LLM" | "FAQ"
  workspaceId: string
  customerId: string
  conversationId: string
  confidence: number
}
```

---

## 📚 Dependencies

### External Libraries (no changes)
- `@prisma/client` - Database access
- `express` - HTTP server
- `jest` - Testing
- `winston` - Logging

### Internal Services (unchanged)
- `LLMRouterService` - Specialist coordination
- `TranslationAgent` - Final translation
- `ConversationHistoryLayer` - Humanization
- `ResponseBuilderService` - Response formatting
- `LLMFormatterService` - LLM output formatting

### New Dependencies (within refactoring)
- `UnifiedRoutingService` - Replaces duplication
- `SimpleIntentHandler` - Delegates from ChatEngine
- `LLMIntentHandler` - Delegates from ChatEngine

---

## 🧪 Testing Strategy

### Unit Tests (Jest)
- UnifiedRoutingService: Intent detection, path selection, data loading
- SimpleIntentHandler: Pattern matching responses
- LLMIntentHandler: Delegation to LLMRouter
- Target: >80% coverage on routing logic

### Integration Tests
- ChatEngine + handlers + LLMRouter end-to-end
- 6+ routing scenarios: SHOW_PRODUCTS, ADD_TO_CART, REPEAT_ORDER, etc.
- Multi-workspace isolation (2+ workspaces)
- Performance baseline validation

### Manual Testing
- Webhook: Test end-to-end with real WhatsApp (after merge)
- Languages: Verify IT, EN, ES, PT translations (consistent)

---

## 🔒 Security & Performance

### Security
- ✅ Workspace isolation: All queries filter by `workspaceId`
- ✅ Type safety: TypeScript strict mode
- ✅ No hardcoded strings: All from DB/templates

### Performance
- ✅ One workspace load per message
- ✅ One data load per intent (products OR FAQs, not both)
- ✅ No n+1 query problems
- ✅ Cache workspace config if needed
- Baseline: Response time ≤ current system

---

## 📋 Deliverables

1. ✅ UnifiedRoutingService (220 LOC)
2. ✅ SimpleIntentHandler (140 LOC)
3. ✅ LLMIntentHandler (120 LOC)
4. ✅ Handlers index export
5. ✅ ChatEngine refactored (~100 LOC changes)
6. ✅ RouterOrchestrationService marked deprecated
7. ✅ Unit tests (>80% coverage)
8. ✅ Integration tests (6+ scenarios)
9. ✅ Documentation updated (JSDoc, API docs)
10. ✅ End-to-end webhook test

---

## ⚠️ Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Type safety broken | High | Strict TypeScript + CI gate |
| Performance regression | High | Baseline test + load test before merge |
| Workspace data bleeding | Critical | Test with 2+ workspaces |
| Handler signature mismatch | Medium | Interface-based testing |
| Translation breaks | Medium | Test all 4 languages |

---

## ✅ Definition of Done

- [x] Code compiles (TypeScript `--strict`)
- [x] Unit tests pass (>80% coverage)
- [x] Integration tests pass (all 6+ scenarios)
- [x] Code review approved
- [x] No hardcoded strings
- [x] Workspace isolation verified
- [x] Performance baseline verified
- [x] Documentation complete
- [ ] Ready for merge to main

---
