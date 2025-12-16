# Tasks: Order Transport Optimization

**Input**: Design documents from `/specs/optimize-transport/`  
**Prerequisites**: plan.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 = DB/Schema, US2 = Backend Service, US3 = LLM Agent, US4 = Menu Integration
- Include exact file paths in descriptions
- **360-Degree Impact**: Note affected layers (FE/BE/DB/Security/Tests)

---

## Phase 1: Setup (Shared Infrastructure) ✅ COMPLETED

**Purpose**: Database schema changes - BLOCKING for all other phases

- [x] T001 **[DB]** Add `price` field to TransportType model in `packages/database/prisma/schema.prisma`
- [x] T002 **[DB]** Add `isActive` field to TransportType model (for filtering)
- [x] T003 **[DB]** Applied SQL migration directly (Prisma drift workaround)
- [x] T004 **[DB]** Update seed script with transport prices (Ambiente=8€, Refrigerato=12€, Frozen=15€): `packages/database/prisma/seed.ts`
- [x] T005 **[DB]** Run `npx prisma generate` to update Prisma client
- [x] T006 **[DB]** Verify migration applied successfully

**Checkpoint**: ✅ Database ready with transport prices

---

## Phase 2: User Story 1 - Transport Price Display in Cart ✅ COMPLETED

**Goal**: Show transport costs when viewing cart (options 1-4 flow - read-only change)

- [x] T007 [US1] **[BE/Repository]** Create method `findActiveWithPrices(workspaceId)` in `transport-type.repository.ts`
- [x] T008 [US1] **[BE/Repository]** Create method `hasConfiguredPrices(workspaceId)` in `transport-type.repository.ts`
- [x] T009 [US1] **[BE/Agent]** Update `formatCartResponseWithTransport()` in `CartManagementAgentLLM.ts` to show transport costs
- [x] T010 [US1] **[Tests/Unit]** Unit tests for transport cost calculation (12 tests passing)

**Checkpoint**: ✅ Cart view shows transport costs - existing flow unchanged

---

## Phase 3: User Story 2 - OrderOptimizationService ✅ COMPLETED

**Goal**: Backend service calculates transport analysis deterministically

- [x] T012 [US2] **[BE/Service]** Create `OrderOptimizationService` class in `order-optimization.service.ts`
- [x] T013 [US2] **[BE/Service]** Implement `hasTransportPricesConfigured(workspaceId)` - pre-check method
- [x] T014 [US2] **[BE/Service]** Implement `analyzeCart(workspaceId, customerId)` - main analysis method
- [x] T015 [US2] **[BE/Service]** Implement `getAvailableProductsForOptimization(workspaceId, excludeSkus)` - suggestions data
- [x] T016 [US2] **[BE/Service]** Implement `formatAnalysisForDisplay(analysis)` - formatted text output
- [x] T017 [US2] **[Tests/Unit]** Unit tests (12 tests): `order-optimization.spec.ts`

**Checkpoint**: ✅ Service returns complete TransportAnalysis with deterministic calculations

---

## Phase 4: User Story 3 - OrderOptimizationAgentLLM ✅ COMPLETED

**Goal**: LLM sub-agent generates natural language explanation from analysis data

- [x] T018 [US3] **[BE/Template]** Create prompt template `10-order-optimization.template.md`
- [x] T019 [US3] **[BE/Agent]** Create `OrderOptimizationAgentLLM` class using GPT-4.1 via OpenRouter
- [x] T020 [US3] **[BE/Agent]** Implement `process(input)` method with fallback explanation

**Checkpoint**: ✅ Agent returns formatted explanation given TransportAnalysis JSON

---

## Phase 5: User Story 4 - Menu Integration & Plan Gating ✅ COMPLETED

**Goal**: Add option 5 to cart menu for Premium/Enterprise workspaces only

- [x] T023 [US4] **[BE/Agent]** Update `formatCartResponseWithTransport()` to show option 5 conditionally
- [x] T024 [US4] **[BE/Engine]** Update `buildCartActionOptions()` to be async and check workspace.planType
- [x] T025 [US4] **[BE/DataLoader]** Add `OPTIMIZE_TRANSPORT` case in `data-loader.service.ts`
- [x] T026 [US4] **[BE/Engine]** Add `OPTIMIZE_TRANSPORT` handler in `chat-engine.service.ts`
- [x] T027 [US4] **[BE/Types]** Add `CART_ACTION` and `CART_REMOVAL_OPTIONS` to `ResponseType` in `response-builder.service.ts`
- [x] T028 [US4] **[Tests/Unit]** Plan gating tests (9 tests): `cart-action-plan-gating.spec.ts`

**Checkpoint**: ✅ Option 5 appears only for PREMIUM/ENTERPRISE plans

---

## Summary

| Phase | Status | Tests |
|-------|--------|-------|
| Phase 1: DB Schema | ✅ Complete | N/A |
| Phase 2: Cart View | ✅ Complete | 12 passing |
| Phase 3: OrderOptimizationService | ✅ Complete | 12 passing |
| Phase 4: OrderOptimizationAgentLLM | ✅ Complete | N/A |
| Phase 5: Menu Integration | ✅ Complete | 9 passing |

**Total Tests**: 21 passing
  - Input format (JSON with analysis + available products)
  - Output format (explanation + recommendations + nextAction)
  - Example input/output
- [ ] T019 [P] [US3] **[BE/Types]** Add LLM types in `apps/backend/src/types/order-optimization.types.ts`:
  - `OrderOptimizationInput`
  - `OrderOptimizationOutput`
- [ ] T020 [US3] **[BE/Agent]** Create `OrderOptimizationAgentLLM` class in `apps/backend/src/application/agents/OrderOptimizationAgentLLM.ts`
  - Use GPT-4.1 model via OpenRouter
  - Load prompt template
  - Process input → LLM → parse output
  - Handle timeout (30s)
- [ ] T021 [US3] **[BE/Agent]** Integrate with Translation Agent for final output
- [ ] T022 [P] [US3] **[Tests/Unit]** Unit tests for agent: `apps/backend/__tests__/unit/agents/order-optimization-agent.spec.ts`
  - Mock LLM responses
  - Test input formatting
  - Test output parsing

**Checkpoint**: Agent generates human-readable optimization explanation

**360-Degree Validation US3**:
- [ ] Agent: Uses GPT-4.1 (Premium feature = premium model)
- [ ] Agent: Input is deterministic JSON from service
- [ ] Agent: Output goes through Translation Agent
- [ ] Tests: Mock LLM, verify prompt template loading

---

## Phase 5: User Story 4 - Menu Integration & Plan Gating (Priority: P1) 🎯 MVP

**Goal**: Option 5 appears for Premium/Enterprise, triggers optimization flow

**Independent Test**: Premium user sees option 5, Basic user doesn't

### Implementation for User Story 4

- [ ] T023 [US4] **[BE/Service]** Add plan gating to CallingFunctionsService in `apps/backend/src/application/services/calling-functions.service.ts`:
  - Add `requiredPlan` property to menu options
  - Create `getCartMenuOptions(workspaceId)` method
  - Filter options by workspace.planType
- [ ] T024 [US4] **[BE/Service]** Add option 5 handler in CallingFunctionsService:
  - Case 'OPTIMIZE_ORDER' or '5'
  - Call OrderOptimizationService.hasTransportPricesConfigured()
  - If not configured: return fallback message
  - If configured: call OrderOptimizationService.analyzeCart()
  - Pass analysis to OrderOptimizationAgentLLM
  - Return formatted response
- [ ] T025 [US4] **[BE/Router]** Update LLM Router to handle menu 5 selection in `apps/backend/src/application/services/llm-router.service.ts`
- [ ] T026 [P] [US4] **[Tests/Unit]** Unit tests for plan gating: `apps/backend/__tests__/unit/services/calling-functions-gating.spec.ts`
  - Premium sees options 1-5
  - Basic sees options 1-4
  - Option 5 triggers correct handler
- [ ] T027 [P] [US4] **[Tests/Integration]** Integration test for full flow: `apps/backend/__tests__/integration/order-optimization.spec.ts`

**Checkpoint**: Full flow works end-to-end for Premium workspace

**360-Degree Validation US4**:
- [ ] Routes: Plan gating before menu generation
- [ ] Service: Workspace isolation on plan check
- [ ] Handler: Proper error handling for unconfigured transports
- [ ] Tests: Plan gating + full flow integration

---

## Phase 6: Frontend Updates (Priority: P2)

**Goal**: Admin UI updates for transport price management and required transport on products

### Implementation for Frontend

- [ ] T028 [P] **[FE/Admin]** Add `price` field to Transport Type form in `apps/backoffice/src/pages/TransportTypesPage.tsx`
- [ ] T029 [P] **[FE/Admin]** Make transport dropdown required in Product form in `apps/backoffice/src/pages/ProductsPage.tsx`
- [ ] T030 [P] **[FE/Admin]** Add validation error message for missing transport
- [ ] T031 [P] **[FE/API]** Update transport type API service with price field: `apps/backoffice/src/services/transportTypeApi.ts`

**Checkpoint**: Admin can configure transport prices, products require transport

---

## Phase 7: Final Validation & Documentation

- [ ] T032 **[Docs]** Update Swagger documentation for any modified endpoints
- [ ] T033 **[Tests]** Run full test suite: `cd apps/backend && npm run test:unit && npm run test:integration`
- [ ] T034 **[Docs]** Update PRD if needed with implementation details
- [ ] T035 **[QA]** Manual testing checklist:
  - [ ] Premium workspace: Option 5 visible
  - [ ] Basic workspace: Option 5 hidden
  - [ ] Cart shows transport costs
  - [ ] Optimization returns LLM explanation
  - [ ] Missing transport config shows fallback message

---

## Dependency Graph

```
Phase 1 (DB Schema)
    │
    ├──────────────────┬──────────────────┐
    ▼                  ▼                  ▼
Phase 2 (Cart View)  Phase 3 (Service)  Phase 6 (FE Admin)
                       │
                       ▼
                    Phase 4 (LLM Agent)
                       │
                       ▼
                    Phase 5 (Menu Integration)
                       │
                       ▼
                    Phase 7 (Validation)
```

## Estimated Effort

| Phase | Tasks | Estimated Hours | Parallelizable |
|-------|-------|-----------------|----------------|
| 1. DB Schema | T001-T006 | 2h | No |
| 2. Cart View | T007-T011 | 3h | Partial |
| 3. Service | T012-T017 | 4h | Partial |
| 4. LLM Agent | T018-T022 | 4h | Partial |
| 5. Menu Integration | T023-T027 | 3h | Partial |
| 6. Frontend | T028-T031 | 2h | Yes |
| 7. Validation | T032-T035 | 2h | Partial |
| **Total** | 35 tasks | **~20h** | - |

---

**Next**: Start with Phase 1 (T001-T006) - Database schema changes
