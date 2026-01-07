# LLM Router Unification - Implementation Plan

**Branch**: `feature/routing-unification`  
**Status**: PLANNING  
**Target**: Consolidate routing logic, remove duplications, single source of truth

---

## 📋 SCOPE

### What changes
- ❌ **Remove**: `RouterOrchestrationService` (redundant layer)
- ✅ **Refactor**: `ChatEngine` to be central orchestrator
- ✅ **Extract**: Handler pattern (SimpleIntentHandler, LLMIntentHandler)
- ✅ **Keep unchanged**: LLMRouterService, Translation Layer, Sub-agents

### What stays the same
- ✅ LLMRouterService (specialist coordinator)
- ✅ TranslationAgent (final translation)
- ✅ ConversationHistoryLayer
- ✅ All specialist agents (ProductSearch, Cart, Order, Support, Profile)
- ✅ Database schema
- ✅ WebhookController

---

## 📊 FILE STRUCTURE CHANGES

```
apps/backend/src/

├─ application/
│  ├─ chat-engine/
│  │  ├─ chat-engine.service.ts           [REFACTOR] Central orchestrator
│  │  ├─ handlers/                        [NEW] Handler pattern
│  │  │  ├─ index.ts                      [NEW] Export handlers
│  │  │  ├─ simple-intent.handler.ts      [NEW] Pattern/Keyword matches
│  │  │  └─ llm-intent.handler.ts         [NEW] LLM routing
│  │  └─ index.ts                         [UNCHANGED]
│  │
│  └─ services/
│     └─ unified-routing.service.ts       [NEW] Core routing logic
│
└─ services/
   ├─ router-orchestration.service.ts     [DEPRECATE] Mark as unused
   ├─ llm-router.service.ts               [UNCHANGED]
   └─ conversation-manager.service.ts     [UNCHANGED]
```

---

## 🎯 IMPLEMENTATION TASKS

### TASK 1: Create unified-routing.service.ts
**File**: `apps/backend/src/application/services/unified-routing.service.ts`  
**Responsible for**:
- Single intent detection pipeline
- Strategy selection (E-commerce vs Informational)
- Data loading (workspace-aware)
- Routing decision logic

**Methods to implement**:
```typescript
class UnifiedRoutingService {
  // Unified intent detection (replaces ChatEngine + RouterOrch logic)
  async detectIntent(message, context): Promise<Intent>
  
  // Select routing path based on workspace config
  selectRoutingPath(workspace, intent): RoutingPath
  
  // Load workspace-specific data
  async loadDataForIntent(workspace, intent): Promise<LoadedData>
  
  // Log routing decision
  logRoutingDecision(intent, path, workspace): void
}
```

**Acceptance Criteria**:
- [ ] One method: `detectIntent()` (replaces 2 duplicates)
- [ ] One method: `selectRoutingPath()` (replaces RouterOrchestrationService logic)
- [ ] One method: `loadDataForIntent()` (workspace-aware)
- [ ] No duplicate workspace loads
- [ ] All logging centralized

---

### TASK 2: Create SimpleIntentHandler
**File**: `apps/backend/src/application/chat-engine/handlers/simple-intent.handler.ts`  
**Responsible for**:
- Handle pattern/keyword matched intents
- Rules-based responses
- Direct response building

**Methods to implement**:
```typescript
class SimpleIntentHandler {
  async handle(intent: SimpleIntent, context): Promise<HandlerResult>
  
  private buildResponse(intent, data): StructuredResponse
  
  private validateIntent(intent): boolean
}
```

**Acceptance Criteria**:
- [ ] Handles: SEARCH, ADD_TO_CART, REMOVE_FROM_CART, REPEAT_ORDER
- [ ] Returns response in Italian
- [ ] No LLM calls
- [ ] Deterministic (same input = same output)

---

### TASK 3: Create LLMIntentHandler
**File**: `apps/backend/src/application/chat-engine/handlers/llm-intent.handler.ts`  
**Responsible for**:
- Handle UNKNOWN/complex intents
- Delegate to LLMRouterService
- Return formatted response

**Methods to implement**:
```typescript
class LLMIntentHandler {
  async handle(intent: UnknownIntent, context): Promise<HandlerResult>
  
  private delegateToRouter(intent, context): Promise<Response>
  
  private validateLLMResponse(response): boolean
}
```

**Acceptance Criteria**:
- [ ] Calls LLMRouterService unchanged
- [ ] Returns response in Italian
- [ ] Includes tokensUsed in result
- [ ] Handles LLMRouter errors gracefully

---

### TASK 4: Refactor ChatEngine.processMessageInternal()
**File**: `apps/backend/src/application/chat-engine/chat-engine.service.ts`  
**Changes**:
- Remove RouterOrchestrationService calls
- Add UnifiedRoutingService call
- Select handler based on intent type
- Delegate to appropriate handler

**New flow**:
```typescript
async processMessageInternal(input) {
  // STEP 1: Preprocess
  const preprocessed = await this.preprocessMessage(input.message)
  
  // STEP 2: Unified intent detection
  const intent = await this.unifiedRouting.detectIntent(
    preprocessed.message,
    context
  )
  
  // STEP 3: Select routing path
  const path = this.unifiedRouting.selectRoutingPath(workspace, intent)
  
  // STEP 4: Load data
  const data = await this.unifiedRouting.loadDataForIntent(workspace, intent)
  
  // STEP 5: Route to handler
  let result
  if (intent.type === 'SIMPLE') {
    result = await this.simpleHandler.handle(intent, { data, workspace })
  } else if (intent.type === 'UNKNOWN') {
    result = await this.llmHandler.handle(intent, { data, workspace })
  }
  
  // STEP 6: Format response (Italian)
  const formatted = await this.formatResponse(result)
  
  // STEP 7: Return
  return {
    message: formatted,
    agentUsed: intent.source,
    ...
  }
}
```

**Acceptance Criteria**:
- [ ] No RouterOrchestrationService calls
- [ ] Single workspace load per message
- [ ] Single intent detection per message
- [ ] No duplicate data loading

---

### TASK 5: Update ChatEngine constructor
**File**: `apps/backend/src/application/chat-engine/chat-engine.service.ts`  
**Changes**:
- Inject UnifiedRoutingService
- Inject SimpleIntentHandler
- Inject LLMIntentHandler
- Remove RouterOrchestrationService injection

```typescript
constructor(private prisma: PrismaClient) {
  // NEW
  this.unifiedRouting = new UnifiedRoutingService(prisma)
  this.simpleHandler = new SimpleIntentHandler(prisma)
  this.llmHandler = new LLMIntentHandler(prisma)
  
  // REMOVE
  // this.routerOrchestration = ...
}
```

**Acceptance Criteria**:
- [ ] All handlers initialized
- [ ] No RouterOrchestrationService
- [ ] Code compiles

---

### TASK 6: Remove RouterOrchestrationService usage
**Files**:
- `apps/backend/src/application/chat-engine/chat-engine.service.ts`
- `apps/backend/src/services/router-orchestration.service.ts`

**Changes**:
- Remove all calls to `routerOrchestration.route()`
- Keep file but mark as DEPRECATED with comment
- Add migration note in comments

**Acceptance Criteria**:
- [ ] Zero imports of RouterOrchestrationService in ChatEngine
- [ ] File marked DEPRECATED
- [ ] No compilation errors

---

### TASK 7: Add unit tests
**File**: `apps/backend/__tests__/unit/routing/unified-routing.test.ts`  
**Tests**:
```typescript
describe('UnifiedRouting', () => {
  test('intent detection: pattern match → SIMPLE', () => {})
  test('intent detection: keyword match → SIMPLE', () => {})
  test('intent detection: no match → UNKNOWN', () => {})
  test('routing path: sellProducts=true → ECOMMERCE', () => {})
  test('routing path: sellProducts=false → INFORMATIONAL', () => {})
  test('data loading: only products for ECOMMERCE', () => {})
  test('data loading: only FAQs for INFORMATIONAL', () => {})
  test('single workspace load per message', () => {})
  test('no duplicate intent detection', () => {})
})
```

**Acceptance Criteria**:
- [ ] 9+ test cases
- [ ] All green
- [ ] Coverage >80%

---

### TASK 8: Add integration tests
**File**: `apps/backend/__tests__/integration/routing-orchestration.test.ts`  
**Scenarios**:
```typescript
describe('Routing Integration', () => {
  test('FAQ query (informational) → FAQ response', () => {})
  test('Add to cart (ecommerce) → Cart updated', () => {})
  test('Unknown query (ecommerce) → LLM routing', () => {})
  test('Number selection → Use mapping', () => {})
  test('Same message → Consistent routing', () => {})
  test('Workspace isolation: different workspaces isolate', () => {})
})
```

**Acceptance Criteria**:
- [ ] 6+ integration scenarios
- [ ] All green
- [ ] No workspace bleeding

---

### TASK 9: Update logging
**Changes**:
- Centralize routing logs in UnifiedRoutingService
- Add debug step for each routing decision
- Remove old RouterOrchestrationService logs
- Remove debug logs from LLMRouter (if any)

**Log format**:
```
[UnifiedRouting] Intent detected: SEARCH (source: PATTERN, confidence: HIGH)
[UnifiedRouting] Routing path: ECOMMERCE (sellProducts=true)
[UnifiedRouting] Data loaded: 45 products, 12 categories
[Handler:SimpleIntent] Executing SEARCH → 5 results
```

**Acceptance Criteria**:
- [ ] Each routing decision logged
- [ ] No sensitive data logged
- [ ] Production logs clean (no DEBUG level)

---

### TASK 10: Verify multilingua (no hardcoding)
**Checks**:
- [ ] No hardcoded Italian strings in new handlers
- [ ] All user-facing text comes from DB/templates
- [ ] Translation layer still called for all responses
- [ ] Test: same message in different languages

**Acceptance Criteria**:
- [ ] Zero hardcoded strings in routing logic
- [ ] All from database/config
- [ ] Test passes for IT/EN/ES/PT

---

### TASK 11: Webhook verification
**Test**: Send message via WhatsApp webhook, verify routing

**Scenarios**:
- [ ] FAQ message → Correct FAQ response
- [ ] Product query → Product list (if ecommerce)
- [ ] Add to cart → Cart updated
- [ ] Unknown query → LLM response
- [ ] Different languages → Translated correctly

**Acceptance Criteria**:
- [ ] Message travels correct path
- [ ] Response arrives in correct language
- [ ] No errors in logs

---

## 🧪 TESTING CHECKLIST

| Test Type | File | Status |
|-----------|------|--------|
| Unit: Intent detection | `routing/unified-routing.test.ts` | [ ] |
| Unit: Handlers | `routing/handlers.test.ts` | [ ] |
| Integration: Routing | `routing-orchestration.test.ts` | [ ] |
| Integration: Webhook | Manual/postman | [ ] |
| Security: Workspace isolation | Covered in integration | [ ] |
| Performance: No duplicate loads | Covered in unit | [ ] |
| Multilingua: No hardcoding | New test | [ ] |

---

## ✅ ACCEPTANCE CRITERIA (OVERALL)

- [ ] All duplicated logic removed (workspace load, intent detection, data load)
- [ ] RouterOrchestrationService deprecated (marked unused)
- [ ] Handler pattern clear and extensible
- [ ] All tests passing (>80% coverage)
- [ ] Routing decisions logged (centralized)
- [ ] No hardcoded strings (multilingua verified)
- [ ] Webhook tested end-to-end
- [ ] Code compiles (tsc --noEmit)
- [ ] No performance regression
- [ ] Documentation updated

---

## 📈 ESTIMATED EFFORT

| Task | Effort | Status |
|------|--------|--------|
| 1. UnifiedRoutingService | 2h | |
| 2. SimpleIntentHandler | 1h | |
| 3. LLMIntentHandler | 1h | |
| 4. Refactor ChatEngine | 2h | |
| 5. Update constructor | 30m | |
| 6. Remove RouterOrch usage | 30m | |
| 7. Unit tests | 2h | |
| 8. Integration tests | 2h | |
| 9. Logging audit | 1h | |
| 10. Multilingua check | 1h | |
| 11. Webhook test | 1h | |
| **TOTAL** | **~14h** | |

---

## 🚦 GO/NO-GO DECISION GATES

**Before coding**:
- [ ] Plan approved by Andrea
- [ ] Branch created
- [ ] No open issues in routing

**Before testing**:
- [ ] Code compiles
- [ ] No TypeScript errors
- [ ] All 11 tasks completed

**Before merge**:
- [ ] All tests passing
- [ ] Webhook verified
- [ ] No hardcoded strings
- [ ] Logs reviewed

---

## 📝 NOTES

- Keep LLMRouterService **completely unchanged** (it's a specialist)
- Translation layer is perfect → **don't touch**
- Workspace isolation critical → **test thoroughly**
- No hardcoding → **all from DB**
- Log everything → **debug production issues**

---
