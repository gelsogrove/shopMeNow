# Tasks: LLM Router Unification

**Feature**: 177-routing-unification  
**Epic**: Consolidate routing logic, remove duplications  
**Branch**: `177-routing-unification`  
**Status**: READY TO IMPLEMENT  

---

## 📊 Task Summary

- **Total Tasks**: 22
- **Setup Phase**: 3 tasks
- **Foundational Phase**: 4 tasks
- **User Story 1** (US1 - Handler Pattern): 7 tasks
- **User Story 2** (US2 - Routing Consolidation): 5 tasks
- **User Story 3** (US3 - Multilingua): 2 tasks
- **User Story 4** (US4 - Performance): 1 task

**Independent test criteria per story**: See each story phase below.

---

## 🔄 Parallel Execution Strategy

### Parallelizable Groups
1. **Setup Phase**: Run all 3 tasks in parallel (different files)
2. **Foundational Phase**: Run all 4 tasks in parallel (different services)
3. **US1 Handlers**: Run T09-T10 in parallel (different files, no dependencies)
4. **US2 Routing**: Run T14-T15 in parallel (different services)
5. **US3-US4**: Single tasks, run after foundational

### Suggested MVP Scope
Start with **US1 (Handler Pattern)** + **US2 (Routing Consolidation)** = ~12 tasks = 1.5-2 days

---

## 🎯 PHASE 1: SETUP

**Goal**: Create project structure and type definitions  
**Duration**: 0.5 days  
**Parallel**: ✅ All tasks can run in parallel

### Type Definitions

- [ ] T001 Create Intent and routing types in `apps/backend/src/domain/entities/routing.entity.ts` 
  - Define: `Intent`, `RoutingPath`, `RoutingContext`, `RoutingDecision`, `HandlerResult`
  - Ensure: All properties typed strictly (no `any`)
  - Dependencies: None

- [ ] T002 Create handler interfaces in `apps/backend/src/domain/interfaces/intent-handler.interface.ts`
  - Define: `IntentHandler<T>` generic interface
  - Methods: `handle(intent: Intent, context: T): Promise<HandlerResult>`
  - Dependencies: routing.entity.ts

- [ ] T003 Create handler context types in `apps/backend/src/domain/entities/handler-context.entity.ts`
  - Define: `SimpleIntentHandlerContext`, `LLMIntentHandlerContext`
  - Fields: message, workspace, customer, conversation, history
  - Dependencies: routing.entity.ts

---

## 🏗️ PHASE 2: FOUNDATIONAL

**Goal**: Create base services that multiple user stories depend on  
**Duration**: 1 day  
**Parallel**: ✅ All 4 tasks can run in parallel (different files)  
**Acceptance Criteria**:
- All services compile (TypeScript --strict)
- All services instantiate without errors
- Unit tests for each service (>70% coverage)

### Routing Infrastructure

- [ ] T004 [P] Implement UnifiedRoutingService in `apps/backend/src/application/services/unified-routing.service.ts`
  - Methods:
    - `detectIntent(context: RoutingContext): Promise<Intent>` - Pattern → LLM pipeline
    - `selectRoutingPath(workspace: Workspace, intent: Intent): RoutingPath` - Determine SIMPLE|LLM|FAQ
    - `loadDataForIntent(workspace: Workspace, intent: Intent): Promise<LoadedData>` - Products/FAQs/services
    - `getWorkspace(workspaceId: string): Promise<Workspace>` - With caching
    - `logRoutingDecision(decision: RoutingDecision): void` - Structured logging
  - Type safety: Strict mode
  - **⚠️ FIX REQUIRED**: Prisma table names (product→products, category→categories, faq→fAQ, service→services, offer→offers)
  - Dependencies: PrismaClient, IntentParser, logger
  - Test: Unit test coverage >80% for each method

- [ ] T005 [P] Implement ResponseBuilderService in `apps/backend/src/application/services/response-builder.service.ts`
  - Methods:
    - `buildSimpleResponse(intent: Intent, context: SimpleIntentHandlerContext): Promise<ResponseData>`
    - `buildErrorResponse(error: string, context: SimpleIntentHandlerContext): Promise<ResponseData>`
  - Purpose: Build structured response before LLMFormatter
  - Dependencies: LLMFormatterService, templates
  - Test: Unit test for response structure validation

- [ ] T006 [P] Implement CacheService for workspace/product data in `apps/backend/src/application/services/cache.service.ts`
  - Methods:
    - `set(key: string, value: any, ttl: number): void`
    - `get(key: string): any | null`
    - `invalidate(workspaceId: string): void`
  - Purpose: Avoid duplicate queries within message lifetime
  - TTL: 5 minutes
  - Dependencies: None (in-memory cache)
  - Test: Unit test for cache hits/misses

- [ ] T007 [P] Implement HandlerFactory in `apps/backend/src/application/factories/handler.factory.ts`
  - Methods:
    - `createHandler(path: RoutingPath): IntentHandler`
    - Returns: SimpleIntentHandler | LLMIntentHandler based on path
  - Purpose: Instantiate correct handler type
  - Dependencies: Both handlers (created in US1)
  - Test: Unit test for handler type selection

---

## 👥 PHASE 3: USER STORY 1 - Handler Pattern Clarity

**Goal**: Implement handler pattern for clear intent processing  
**Duration**: 1 day  
**Parallel**: T009-T010 can run in parallel (different files)  
**Story Priority**: P1 (core architectural change)  
**Independent Test Criteria**:
- SimpleIntentHandler accepts pattern/keyword intents → returns Italian response
- LLMIntentHandler accepts INCOMPREHENSIBLE intents → delegates to LLMRouter
- Both handlers have identical output structure (HandlerResult)
- Easy to add new handler types (extensible interface)

### Handler Implementation

- [ ] T008 [US1] Create SimpleIntentHandler in `apps/backend/src/application/chat-engine/handlers/simple-intent.handler.ts`
  - Implements: `IntentHandler<SimpleIntentHandlerContext>`
  - Logic:
    - Accept intent types: SHOW_PRODUCTS, ADD_TO_CART, REPEAT_ORDER, VIEW_CART, CONTINUE_CHECKOUT
    - Build structured response (products, cart, order details)
    - Call LLMFormatter to format response
    - Return HandlerResult
  - Type safety: Strict, no intent.source or intent.confidence (not on type)
  - Dependencies: LLMFormatterService, ResponseBuilderService, logger
  - **Error handling**: If intent type unknown → throw error (only SIMPLE intents allowed)
  - Test: Unit tests for 5 intent types (>80% coverage)

- [ ] T009 [P] [US1] Create LLMIntentHandler in `apps/backend/src/application/chat-engine/handlers/llm-intent.handler.ts`
  - Implements: `IntentHandler<LLMIntentHandlerContext>`
  - Logic:
    - Accept intent type: INCOMPREHENSIBLE only
    - Delegate to LLMRouterService.routeMessage()
    - Return HandlerResult with response from LLMRouter
  - Type safety: Strict mode
  - Dependencies: LLMRouterService, logger
  - Test: Unit test for LLMRouter delegation (>80% coverage)

- [ ] T010 [P] [US1] Create handlers index export in `apps/backend/src/application/chat-engine/handlers/index.ts`
  - Exports: `SimpleIntentHandler`, `LLMIntentHandler`, `IntentHandler<T>`
  - Purpose: Clean import path for ChatEngine
  - Test: Verify exports compile and resolve correctly

### Handler Tests

- [ ] T011 [US1] Write unit tests for SimpleIntentHandler in `apps/backend/__tests__/handlers/simple-intent.handler.test.ts`
  - Test cases: 5 intent types (SHOW_PRODUCTS, ADD_TO_CART, REPEAT_ORDER, VIEW_CART, CONTINUE_CHECKOUT)
  - Each test: Intent → Handler → Verify HandlerResult structure
  - Verify: `message` (string), `agentUsed` ("SIMPLE"), `confidence` (number)
  - Coverage target: >80%

- [ ] T012 [US1] Write unit tests for LLMIntentHandler in `apps/backend/__tests__/handlers/llm-intent.handler.test.ts`
  - Test cases: INCOMPREHENSIBLE intent → delegates to LLMRouter
  - Mock: LLMRouterService.routeMessage()
  - Verify: Handler calls LLMRouter with correct params
  - Coverage target: >80%

- [ ] T013 [US1] Write unit tests for HandlerFactory in `apps/backend/__tests__/factories/handler.factory.test.ts`
  - Test cases:
    - `selectPath("SIMPLE")` → returns SimpleIntentHandler
    - `selectPath("LLM")` → returns LLMIntentHandler
    - Invalid path → throws error
  - Coverage target: >80%

- [ ] T014 [US1] Validate handler pattern in integration test `apps/backend/__tests__/integration/handler-routing.integration.test.ts`
  - Test: SHOW_PRODUCTS message → SimpleIntentHandler → Italian response
  - Test: Unknown message → LLMIntentHandler → LLMRouter → specialist response
  - Test: Handler outputs match expected structure
  - Coverage: All 5 simple intent types + INCOMPREHENSIBLE

---

## 👥 PHASE 4: USER STORY 2 - Single Routing Decision Point

**Goal**: Consolidate routing logic into UnifiedRoutingService  
**Duration**: 1 day  
**Parallel**: T015-T016 can run in parallel (different files)  
**Story Priority**: P1 (core refactoring)  
**Independent Test Criteria**:
- UnifiedRoutingService is single source for routing decisions
- RouterOrchestrationService marked deprecated
- All routing logic (intent detection, path selection, data loading) consolidated
- Chat logs show complete routing path via structured logging
- Zero duplicate queries (workspace, products, FAQs loaded once)

### ChatEngine Refactoring

- [ ] T015 [P] [US2] Refactor ChatEngine in `apps/backend/src/application/chat-engine/chat-engine.service.ts`
  - Changes:
    - Inject `UnifiedRoutingService` in constructor
    - Inject `HandlerFactory` in constructor
    - In `processMessageInternal()` STEP 1 (before Translation Layer):
      - Call `unifiedRouting.detectIntent(context)` → Intent
      - Call `unifiedRouting.selectRoutingPath(workspace, intent)` → RoutingPath
      - Call `unifiedRouting.loadDataForIntent(workspace, intent)` → LoadedData
      - Get handler via `handlerFactory.createHandler(path)`
      - Call `handler.handle(intent, handlerContext)` → HandlerResult
    - Keep Translation Layer call (STEP 2) unchanged
  - Scope: ~100 line changes (constructor + main flow)
  - Type safety: Strict mode
  - Dependencies: UnifiedRoutingService, HandlerFactory
  - **Preserve**: Translation Layer, ConversationHistoryLayer, all existing flow
  - Test: Unit test for handler injection + method calls (>80%)

- [ ] T016 [P] [US2] Mark RouterOrchestrationService deprecated in `apps/backend/src/services/router-orchestration.service.ts`
  - Changes:
    - Add JSDoc comment at top of file:
      ```
      /**
       * @deprecated Consolidated into UnifiedRoutingService + Handler Pattern
       * See: apps/backend/src/application/services/unified-routing.service.ts
       * Do not use in new code. Remove in next major version.
       */
      ```
    - Add @deprecated JSDoc to class declaration
    - Add @deprecated JSDoc to all public methods
  - Test: Verify comments visible in IDE (no functional change)

### Routing Tests

- [ ] T017 [US2] Write integration test for unified routing in `apps/backend/__tests__/integration/unified-routing.integration.test.ts`
  - Test: Message → UnifiedRoutingService → Intent detection (pattern match)
  - Test: Intent + Workspace → Path selection (SIMPLE|LLM)
  - Test: Path + Intent → Handler selection
  - Test: Verify logs show complete routing path (structured)
  - Test: Multiple workspace isolation (2+ workspaces)
  - Coverage: >80%

- [ ] T018 [US2] Write performance test for duplicate query prevention in `apps/backend/__tests__/performance/unified-routing.perf.test.ts`
  - Test: Single message → measure database queries
  - Verify: Workspace loaded once (not twice)
  - Verify: Products loaded once (not per handler, not per specialist)
  - Verify: FAQs loaded once (if applicable)
  - Baseline: Current system query count (measure first)
  - Acceptance: No increase in query count post-refactoring

- [ ] T019 [US2] Write multi-workspace isolation test in `apps/backend/__tests__/integration/workspace-isolation.test.ts`
  - Setup: 2 different workspaces with different products/FAQs
  - Test: Customer A (workspace 1) message → loads workspace 1 data only
  - Test: Customer B (workspace 2) message → loads workspace 2 data only
  - Verify: No data cross-contamination
  - Coverage: All routing queries include workspaceId filter

---

## 👥 PHASE 5: USER STORY 3 - Reliable Multilingua

**Goal**: Ensure all responses translated correctly, no hardcoded strings  
**Duration**: 0.5 days  
**Story Priority**: P2 (quality of life)  
**Independent Test Criteria**:
- All responses in new code translated via TranslationAgent
- No hardcoded strings in UnifiedRoutingService, handlers
- Works for IT (base), EN, ES, PT
- Translation consistent across multiple requests

### Multilingua Validation

- [ ] T020 [US3] Write multilingua test for handler responses in `apps/backend/__tests__/multilingua/handler-translations.test.ts`
  - Setup: Override `preferredLanguage` to IT, EN, ES, PT
  - Test: SHOW_PRODUCTS intent → SimpleIntentHandler → responses in each language
  - Test: INCOMPREHENSIBLE intent → LLMIntentHandler → responses in each language
  - Verify: All responses non-empty, properly formatted
  - Coverage: All 4 languages

- [ ] T021 [US3] Audit for hardcoded strings in new code in `apps/backend/src/application/services/unified-routing.service.ts`, `handlers/`, `factories/`
  - Action: Search for string literals (not from templates/DB)
  - Verify: All logs use structured format (no hardcoded messages)
  - Verify: All responses come from LLMFormatter (not hardcoded)
  - Test: Linter rule to prevent future hardcoding

---

## 👥 PHASE 6: USER STORY 4 - Performance Maintained

**Goal**: Ensure routing efficiency with no regression  
**Duration**: 0.5 days  
**Story Priority**: P3 (optimization)  
**Independent Test Criteria**:
- Response time ≤ baseline (measure first)
- No n+1 query problems
- Cache used for workspace config (5 min TTL)
- Load test with concurrent messages

### Performance Validation

- [ ] T022 [US4] Write performance baseline test in `apps/backend/__tests__/performance/routing-baseline.test.ts`
  - Measure: Current system (before refactoring)
    - Single message → response time
    - Database query count
    - Response size
  - Log results to `docs/performance/routing-baseline.json`
  - Use as comparison for post-refactoring tests
  - Note: Run BEFORE merging unified routing

---

## 🔍 PHASE 7: VALIDATION & COMPLETION

**Goal**: Verify all acceptance criteria met  
**Duration**: 0.5 days  

### Pre-Merge Checklist

- [ ] TypeScript compilation: `cd apps/backend && npx tsc --noEmit` (0 errors)
- [ ] Unit test coverage: `npm run test:unit -- --coverage` (>80% for routing logic)
- [ ] Integration tests pass: `npm run test:integration`
- [ ] Multilingua tests pass: `npm run test` (IT, EN, ES, PT)
- [ ] Performance baseline: Response time ≤ current system
- [ ] Code review: All files reviewed for security, readability
- [ ] Documentation: JSDoc complete on all public methods
- [ ] No hardcoded strings: Audit pass on all new code

### Post-Merge Validation

- [ ] Branch merged to main
- [ ] No TypeScript errors in CI
- [ ] All tests green in CI
- [ ] Code coverage >80% reported in GitHub
- [ ] Deployment to production (separate task)

---

## 🔗 Dependencies & Sequencing

### Strict Sequential Order
```
PHASE 1 (Setup) → PHASE 2 (Foundational) → PHASE 3-6 (User Stories) → PHASE 7 (Validation)
```

### Parallel Opportunities Within Phases
- **Phase 1**: All 3 tasks (different files)
- **Phase 2**: All 4 tasks (different services, no cross-dependencies)
- **Phase 3**: T009-T010 parallel (both handlers)
- **Phase 4**: T015-T016 parallel (different files)
- **Phase 5-6**: Sequential (small phases)

### Story Dependencies
- **US1 → US2**: US1 handlers required before ChatEngine refactoring
- **US1, US2 → US3**: All core code done before multilingua verification
- **US1, US2 → US4**: Performance baseline needed before optimization

---

## 📊 Effort Estimate

| Phase | Tasks | Est. Hours | Notes |
|-------|-------|-----------|-------|
| Setup | 3 | 2 | Types, interfaces, context entities |
| Foundational | 4 | 4 | Services that unblock user stories |
| US1 (Handlers) | 7 | 8 | Implement + unit test handlers |
| US2 (Routing) | 5 | 6 | ChatEngine refactor + integration tests |
| US3 (Multilingua) | 2 | 2 | Verify translations, audit strings |
| US4 (Performance) | 1 | 1 | Performance test + baseline |
| Validation | N/A | 2 | Pre-merge checklist, code review |
| **TOTAL** | **22** | **25** | **~3 days with team parallelization** |

---

## ✅ Success Criteria Summary

| Criterion | Task(s) | Verification |
|-----------|---------|--------------|
| Type safety | T001-T003, T008-T010, T015-T016 | TypeScript --strict: 0 errors |
| Handler pattern | T008-T014 | 5 handler tests >80% coverage |
| Routing consolidation | T004-T007, T015-T017 | 1 service, deprecated old |
| Multilingua | T020-T021 | 4 languages tested, 0 hardcoded strings |
| Performance | T022, T018 | Response time ≤ baseline |
| Test coverage | All units + integration | >80% on routing logic |
| Code quality | T015-T016, T021 | <500 LOC per file, clean imports |

---

## 🚀 Implementation Start

**Ready to begin?** 
1. Run PHASE 1 (Setup) - all 3 tasks in parallel
2. Run PHASE 2 (Foundational) - all 4 tasks in parallel
3. Run PHASE 3-6 per MVP scope (start with US1+US2)
4. Run PHASE 7 validation before merge

**Next command**: `npm run test:unit -- --watch` (watch mode during development)

---
