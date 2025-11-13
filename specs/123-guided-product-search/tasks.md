# Tasks: Guided Progressive Product Search

**Branch**: `123-guided-product-search`  
**Input**: Design documents from `/specs/123-guided-product-search/`  
**Prerequisites**: plan.md ✅, spec.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup & Verification (Shared Infrastructure)

**Purpose**: Verify existing infrastructure and prepare for implementation

- [ ] T001 [P] Verify product certification fields exist in `backend/prisma/schema.prisma` (isDOP, isBio, isHalal, isIntegrale)
- [ ] T002 [P] Verify AddToCart calling function accepts optional `quantity` parameter in `backend/src/domain/calling-functions/AddToCart.ts`
- [ ] T003 [P] Measure baseline {{PRODUCTS}} token count with 100 test products (log in PromptProcessorService)
- [ ] T004 Create git branch `123-guided-product-search` if not already on it

**Checkpoint**: Infrastructure verified - ready for implementation

---

## Phase 2: Database & Data Preparation (Foundational - BLOCKS ALL USER STORIES)

**Purpose**: Ensure product data includes certifications for filtering and display

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Add certification fields to Product model in `backend/prisma/schema.prisma` if missing (isDOP, isBio, isHalal, isIntegrale as Boolean with @default(false))
- [ ] T006 Create database migration: `npx prisma migrate dev --name add_product_certifications`
- [ ] T007 Update seed file `backend/prisma/seed.ts` to add certification data to 50+ test products (mix of DOP, Bio, Halal, Integrale)
- [ ] T008 Run seed: `npm run seed` and verify products have diverse certifications
- [ ] T009 Update PromptProcessorService `backend/src/services/prompt-processor.service.ts` to include certification fields in {{PRODUCTS}} variable output

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Generic Search with Dynamic Grouping (Priority: P1) 🎯 MVP

**Goal**: Enable customers to search broadly ("formaggi", "vini") and receive intelligent groupings that help narrow choices

**Independent Test**: Customer types "formaggi" → System groups by categories (Freschi, Stagionati, DOP) → Customer selects group → Receives refined list

### Implementation for User Story 1

- [ ] T010 [US1] Rewrite ProductSearchAgent prompt in `docs/prompts/product-search-agent.md`:
  - Section 1: Role & Context (specialist for product discovery, access to {{PRODUCTS}})
  - Section 2: Dynamic Grouping Logic with few-shot examples (formaggi→categories, halal→certifications, regali→price, aperitivo→use-case)
  - Section 3: Progressive Filtering Rules (show groups when >3 products, continue until ≤3)
- [ ] T011 [US1] Add LLM grouping analysis logic in ProductSearchAgent prompt (analyze query intent: category, dietary, price, use-case, certification)
- [ ] T012 [US1] Add grouping examples in prompt (10-15 high-quality examples with Italian group names)
- [ ] T013 [US1] Update database prompt via script: `cd backend && npm run update-prompt`
- [ ] T014 [US1] Add token count logging in `backend/src/services/prompt-processor.service.ts` (warn if {{PRODUCTS}} >50k tokens)
- [ ] T015 [US1] Add grouping decision logging in `backend/src/application/agents/ProductSearchAgentLLM.ts` (log to analytics for quality review)

**Checkpoint**: User Story 1 complete - Customer can search generically and get meaningful groupings

---

## Phase 4: User Story 2 - Progressive Filtering to Final Selection (Priority: P1) 🎯 MVP

**Goal**: After initial grouping, customer progressively narrows choices until reaching max 3 products

**Independent Test**: Customer selects "Formaggi stagionati" → System offers sub-filters (DOP, Bio) → Customer selects "DOP" → Receives max 3 products

### Implementation for User Story 2

- [ ] T016 [US2] Add progressive filtering rules to ProductSearchAgent prompt in `docs/prompts/product-search-agent.md`:
  - Continue filtering until ≤3 products remain
  - Skip grouping if only 1 product matches (show details directly)
  - Offer sub-filters based on available product attributes
- [ ] T017 [US2] Add "max 3 products" constraint logic in prompt (explicit instruction: "NEVER show more than 3 products in final list")
- [ ] T018 [US2] Add product display format rules in prompt:
  - Final list (≤3): Name, Price (original → discounted), Certifications, Origin
  - Show certifications as badges (DOP, Bio, Halal, Integrale)
- [ ] T019 [US2] Update database prompt: `cd backend && npm run update-prompt`
- [ ] T020 [US2] Add iteration tracking in ProductSearchAgent (count filtering steps, warn if >5 iterations)

**Checkpoint**: User Story 2 complete - Customer can progressively filter to final product list

---

## Phase 5: User Story 3 - Product Detail View & Cart Addition (Priority: P1) 🎯 MVP

**Goal**: Customer views full product details and can add to cart with optional quantity

**Independent Test**: Customer selects "Parmigiano Reggiano DOP" → Views details → Says "sì lo voglio" → Product added to cart → Receives cart link

### Tests for User Story 3 (MANDATORY)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T021 [P] [US3] Unit test for AddToCart with quantity in `backend/__tests__/unit/calling-functions/AddToCart.test.ts`:
  - Test: defaults to quantity=1 when not specified
  - Test: accepts explicit quantity=5
  - Test: rejects quantity=0 with error
  - Test: rejects quantity>100 with error

### Implementation for User Story 3

- [ ] T022 [US3] Verify/modify AddToCart calling function in `backend/src/domain/calling-functions/AddToCart.ts`:
  - Add optional `quantity?: number` parameter if missing
  - Default to quantity=1 if not provided
  - Validate quantity (1-100 range)
  - Return error if invalid
- [ ] T023 [US3] Add product detail display format to ProductSearchAgent prompt in `docs/prompts/product-search-agent.md`:
  - Full description, weight, stock status
  - Original price → Discounted price with clear formatting
  - Certifications as badges
  - Origin (region/country)
- [ ] T024 [US3] Add cart integration instructions to ProductSearchAgent prompt:
  - Recognize "sì lo voglio", "aggiungi al carrello" as cart intent
  - Extract quantity from message: "ne voglio 5" → qty=5
  - Delegate to Router with "ADD_TO_CART: {productId}, {quantity}"
- [ ] T025 [US3] Add Router Agent recognition for cart intent in `docs/prompts/router-agent.md`:
  - Recognize "sì lo voglio" after ProductSearchAgent shows product details
  - Delegate to CartManagementAgent with addToCart(productId, quantity)
- [ ] T026 [US3] Update database prompts: `cd backend && npm run update-prompt`
- [ ] T027 [US3] Run unit tests: `cd backend && npm run test:unit` - verify AddToCart quantity tests pass

**Checkpoint**: User Story 3 complete - Customer can view details and add to cart with quantity

---

## Phase 6: User Story 4 - LLM Dynamic Grouping Intelligence (Priority: P2)

**Goal**: LLM chooses optimal grouping strategy based on query context rather than fixed rules

**Independent Test**: Customer searches "formaggi per pizza" → LLM groups by melting properties instead of generic categories

### Implementation for User Story 4

- [ ] T028 [US4] Enhance ProductSearchAgent prompt with advanced grouping strategies in `docs/prompts/product-search-agent.md`:
  - Dietary constraint grouping ("prodotti halal" → Halal formaggi, Halal salumi)
  - Price-based grouping ("formaggi economici" → €5-€10, €10-€15, €15+)
  - Use-case grouping ("aperitivo" → Formaggi da tavola, Salumi affettati, Vini)
  - Context-aware grouping ("pizza" → melting properties, "natale" → gift-suitable)
- [ ] T029 [US4] Add explicit LLM reasoning instructions in prompt:
  - "Analyze customer query for intent keywords (dietary, price, occasion, use-case)"
  - "Choose grouping strategy that best matches query intent"
  - "Group names MUST be customer-friendly Italian (NOT English translations)"
- [ ] T030 [US4] Add fallback logic instruction in prompt:
  - "If query intent unclear, default to category-based grouping"
  - "If LLM returns generic group names (Group 1, Group 2), retry with category grouping"
- [ ] T031 [US4] Update database prompt: `cd backend && npm run update-prompt`

**Checkpoint**: User Story 4 complete - LLM intelligently chooses grouping strategy

---

## Phase 7: Edge Cases & Error Handling (Cross-Cutting)

**Purpose**: Handle boundary conditions and errors gracefully

- [ ] T032 [P] Add empty search results handling to ProductSearchAgent prompt in `docs/prompts/product-search-agent.md`:
  - "Non abbiamo [product] al momento. Posso suggerirti prodotti simili come [alternative]?"
- [ ] T033 [P] Add single product match handling in prompt:
  - Skip grouping, show product details directly if only 1 match
- [ ] T034 [P] Add ambiguous quantity handling in prompt:
  - "ne voglio alcuni" → Ask clarification: "Quanti esattamente? Specifica un numero"
  - Extract only explicit numbers (regex: `\b(\d+)\b`)
- [ ] T035 [P] Add out-of-stock handling in prompt:
  - "Prodotto esaurito. Ti interessa un'alternativa simile?"
- [ ] T036 [P] Add invalid quantity handling in AddToCart function validation:
  - Negative numbers → Error: "Quantità non valida"
  - Numbers >100 → Error: "Quantità massima superata"
- [ ] T037 Update database prompt: `cd backend && npm run update-prompt`

**Checkpoint**: Edge cases handled - System responds gracefully to errors

---

## Phase 8: Integration Tests (MANDATORY)

**Purpose**: Validate end-to-end user flows work correctly

> **NOTE: Integration tests require backend running (port 3001) and seeded database**

- [ ] T038 [P] Create integration test file `backend/__tests__/integration/agents/ProductSearchAgentLLM.test.ts`
- [ ] T039 [P] [US1] Integration test: Generic query "formaggi" returns category groups (Freschi, Stagionati, DOP)
- [ ] T040 [P] [US2] Integration test: Filtered query "formaggi DOP" returns ≤3 products with DOP certification
- [ ] T041 [P] [US2] Integration test: Single match "Parmigiano 36 mesi" skips grouping, shows product details directly
- [ ] T042 [P] [US3] Integration test: "sì lo voglio" after product details adds to cart with qty=1, returns cart link
- [ ] T043 [P] [US3] Integration test: "ne voglio 5" extracts quantity=5 and delegates to CartManagementAgent
- [ ] T044 [P] Integration test: Empty result "caviale" suggests alternatives
- [ ] T045 [P] [US4] Integration test: Dietary query "prodotti halal" groups by certification
- [ ] T046 [P] [US4] Integration test: Price query "formaggi economici" groups by price ranges
- [ ] T047 Run all integration tests: `cd backend && npm run test:integration` - verify all pass

**Checkpoint**: All integration tests passing - System validated end-to-end

---

## Phase 8B: User Story 5 Implementation & Tests (Service Flow) 🎯 COMPLETED ✅

**Purpose**: Document completed service selection and cart addition feature

**Status**: ✅ **IMPLEMENTED** (2025-11-12)

- [x] T048 [US5] Update Router Agent prompt `docs/prompts/router-agent.md`:
  - Added SERVICE SELECTION FLOW section (3 steps: numbered list → details → confirmation → addService)
  - Added addService() function as Function #2 (after manageNotifications)
  - Documented 5-field service details format
  - **CRITICAL**: Services always quantity=1 (NO "Quanti ne vuoi?" question)
- [x] T049 [US5] Update `getActiveServices()` in `backend/src/repositories/message.repository.ts`:
  - Changed format from `🔧 Name: Description` to numbered list with 5 fields
  - Format: `1. **Name** - €Price\n   📝 Descrizione\n   📋 Codice\n   ⏰ Disponibilità`
  - Returns structured string for {{SERVICES}} variable
- [x] T050 [US5] Verified `addService()` calling function in `backend/src/domain/calling-functions/AddService.ts`:
  - Function accepts serviceCode and quantity parameters
  - Integrates with CallingFunctionsService.addServiceToCart()
  - Returns cart link with expiration after successful addition
- [x] T051 [US5] Updated all agent prompts in database: `cd backend && npm run update-all-agent-prompts` (Router + 5 others)
- [x] T052 [US5] Build verification: `cd backend && npm run build` - TypeScript compilation + Prisma generation successful
- [ ] T053 [P] [US5] Manual test: "che servizi avete?" → numbered list → "1" → details → "sì" → service added to cart (PENDING - requires WhatsApp or MCP client testing)

**Checkpoint**: User Story 5 complete - Service flow implemented and documented

---

## Phase 9: Performance Validation & Risk Mitigation

**Purpose**: Ensure system meets performance targets and mitigates identified risks

- [ ] T054 Measure {{PRODUCTS}} token count with 500 test products in seed database (target: <50k tokens)
- [ ] T055 Add product count check in ProductSearchAgent:
  - If >500 products, use category-based pre-filtering before sending to LLM
  - Log warning if approaching token limit
- [ ] T056 Test LLM grouping response time with 500 products (target: <3 seconds)
- [ ] T057 Review grouping decision logs (check analytics for quality patterns):
  - Verify 90%+ groupings use meaningful Italian names (not "Group 1", "Group 2")
  - Check for inconsistent groupings (same query → different groups)
- [ ] T058 Add A/B testing tracking (optional):
  - Log grouping strategy used (dynamic vs. fallback category-based)
  - Track conversion rate for each strategy
- [ ] T059 Verify function calling iterations stay ≤6 (max 8 allowed):
  - Check Router logs for iteration counts
  - Ensure ProductSearchAgent doesn't cause iteration loops

**Checkpoint**: Performance validated - System meets all targets

---

## Phase 10: Documentation & Knowledge Base

---

## Phase 10: Documentation & Deployment

**Purpose**: Prepare for production deployment

- [ ] T054 [P] Update `docs/memory-bank/PRD.md` with Feature 123 summary:
  - Add section: "Feature 123: Guided Progressive Product Search + Service Selection (US5)"
  - Document: Dynamic grouping, max 3 products, quantity support, service flow (US5), prompt engineering approach
  - Include {{SERVICES}} variable format documentation
- [ ] T055 [P] Create deployment checklist in this file (see below)
- [ ] T056 [P] Update CHANGELOG.md with Feature 123 entry
- [ ] T057 Run full test suite: `cd backend && npm run test:unit && npm run test:integration`
- [ ] T058 Verify backend auto-restart works (ts-node-dev should reload prompt changes)
- [ ] T059 Create manual testing plan for WhatsApp (when integration ready):
  - Document test cases for all 5 user stories (US1-US5 including service flow)
  - Include edge cases and error scenarios
  - Add service-specific test: "che servizi avete?" → "1" → "sì" flow

**Checkpoint**: Feature 123 ready for deployment

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 - BLOCKS all user stories
- **Phase 3-6 (User Stories)**: All depend on Phase 2 completion
  - **US1 (Generic Search)**: Can start after Phase 2 - No dependencies on other stories
  - **US2 (Progressive Filtering)**: Can start after Phase 2 - Logically follows US1 but technically independent
  - **US3 (Cart Addition)**: Can start after Phase 2 - Integrates with US1+US2 but independently testable
  - **US4 (LLM Intelligence)**: Can start after Phase 2 - Enhances US1 but optional for MVP
- **Phase 7 (Edge Cases)**: Can run in parallel with any user story (different prompt sections)
- **Phase 8 (Integration Tests)**: Depends on all user stories being complete
- **Phase 9 (Performance)**: Depends on all user stories + tests being complete
- **Phase 10 (Documentation)**: Depends on everything being complete

### Parallel Opportunities

**Phase 1**: All tasks can run in parallel (T001, T002, T003, T004)

**Phase 2**: T005-T009 must run sequentially (schema → migration → seed → verify → prompt processor)

**Phase 3-6 (User Stories)**:

- US1, US2, US3, US4 can be worked on by different developers simultaneously
- Within each user story, most tasks are sequential (prompt updates must be sequential)

**Phase 7**: All edge case tasks (T032-T036) can run in parallel (different prompt sections)

**Phase 8**: All integration tests (T039-T046) can run in parallel (independent test cases)

**Phase 10**: Documentation tasks (T054, T055, T056) can run in parallel

---

## Implementation Strategy

### MVP First (Minimum Viable Product)

**Goal**: Get basic guided search working as quickly as possible

1. Complete Phase 1: Setup & Verification
2. Complete Phase 2: Database & Data Preparation (CRITICAL)
3. Complete Phase 3: User Story 1 (Generic Search)
4. Complete Phase 4: User Story 2 (Progressive Filtering)
5. Complete Phase 5: User Story 3 (Cart Addition)
6. **STOP and VALIDATE**: Test these 3 stories manually
7. Deploy MVP if ready (skip US4, edge cases, full test suite for now)

**Result**: Customer can search, filter progressively, and add to cart with quantity

### Full Feature Delivery

1. MVP complete (US1 + US2 + US3)
2. Add Phase 6: User Story 4 (LLM Intelligence)
3. Add Phase 7: Edge Cases & Error Handling
4. Add Phase 8: Integration Tests (MANDATORY before production)
5. Add Phase 9: Performance Validation
6. Add Phase 10: Documentation & Deployment
7. **FULL VALIDATION**: All tests passing, performance targets met
8. Deploy to production

### Parallel Team Strategy (3 Developers)

**Week 1**:

- Team completes Phase 1 + Phase 2 together (foundational)

**Week 2** (Parallel):

- Developer A: Phase 3 (US1 - Generic Search)
- Developer B: Phase 4 (US2 - Progressive Filtering)
- Developer C: Phase 5 (US3 - Cart Addition)

**Week 3** (Parallel):

- Developer A: Phase 6 (US4 - LLM Intelligence)
- Developer B: Phase 7 (Edge Cases)
- Developer C: Phase 8 (Integration Tests - start writing tests)

**Week 4**:

- Team: Phase 8 (Run all tests), Phase 9 (Performance), Phase 10 (Documentation)
- Deploy

---

## Deployment Checklist

- [ ] Database migration applied: `npx prisma migrate deploy` (production)
- [ ] Seed updated with certifications: `npm run seed` (dev/staging only)
- [ ] Prompts deployed to database via `npm run update-prompt`
- [ ] Unit tests passing: `npm run test:unit` (100% AddToCart quantity tests)
- [ ] Integration tests passing: `npm run test:integration` (all 8 test cases)
- [ ] Performance validated: {{PRODUCTS}} <50k tokens with 500 products
- [ ] Backend auto-restart verified (ts-node-dev reloads on prompt changes)
- [ ] Analytics logging enabled (grouping decisions tracked)
- [ ] Error handling tested (empty results, invalid quantity, out of stock)
- [ ] Manual testing completed (all 4 user stories + edge cases)
- [ ] Documentation updated (PRD.md, CHANGELOG.md)
- [ ] Rollback plan ready (revert migration, restore old prompt from backup)

---

## Notes

- **Prompt Engineering Focus**: 90% of work is in `docs/prompts/product-search-agent.md` rewrite (T010-T031)
- **Minimal Code Changes**: Only AddToCart.ts needs modification (T022), PromptProcessorService.ts update (T009)
- **No Flow Changes**: Router → ProductSearchAgent → CartManagementAgent architecture preserved
- **Database-First**: All certifications from DB (T005-T008), no hardcoded values
- **Workspace Isolation**: All queries filter by `workspaceId` (verify in integration tests)
- **Test-Driven**: Unit tests written BEFORE AddToCart implementation (T021)
- **Performance Critical**: Monitor {{PRODUCTS}} token count throughout (T003, T014, T048)
- **Quality Validation**: Review grouping logs weekly for LLM quality (T051)
- **Commit Strategy**: Commit after each user story phase (Phase 3, 4, 5, 6 separately) for easy rollback
- **Stop Points**: Can stop at MVP (after T027) or continue to full feature (T059)

---

## Task Count Summary

- **Phase 1 (Setup)**: 4 tasks
- **Phase 2 (Foundational)**: 5 tasks
- **Phase 3 (US1)**: 6 tasks
- **Phase 4 (US2)**: 5 tasks
- **Phase 5 (US3)**: 7 tasks (including 1 test task)
- **Phase 6 (US4)**: 4 tasks
- **Phase 7 (Edge Cases)**: 6 tasks
- **Phase 8 (Integration Tests)**: 10 tasks
- **Phase 8B (US5 - Service Flow)**: 6 tasks ✅ COMPLETED
- **Phase 9 (Performance)**: 6 tasks
- **Phase 10 (Documentation)**: 6 tasks

**Total**: 65 tasks (59 original + 6 service flow)

**Completed**: 5 tasks (T048-T052 for service implementation)

**Estimated Time**:

- MVP (Phases 1-5 + 8B): 3-4 days (1 developer) or 1-2 days (3 developers parallel)
- Full Feature (Phases 1-10): 6-8 days (1 developer) or 3-4 days (3 developers parallel)
