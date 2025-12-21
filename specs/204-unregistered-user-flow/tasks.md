# Feature 204: Tasks

## Legend
- `[P]` = Can be parallelized with other [P] tasks in same phase
- `[S]` = Sequential, must complete before next task
- `[B]` = Blocker for next phase

---

## Phase 1: Database Schema & Migration

### T001 [S][B] - Add Workspace fields to Prisma schema
**File**: `packages/database/prisma/schema.prisma`
**Description**: Add 3 new nullable JSON fields for unregistered user messages
**Acceptance Criteria**:
- [ ] `registrationPromptMessage Json?` added after `userActivatedMessage`
- [ ] `postRegistrationPendingMessage Json?` added
- [ ] `userActivatedMessage Json?` added
- [ ] All fields have JSDoc comments explaining purpose
**Estimated**: 15 min

### T002 [S][B] - Create database migration
**Command**: `cd packages/database && npx prisma migrate dev --name feature_204_unregistered_user_messages`
**Acceptance Criteria**:
- [ ] Migration file created in `prisma/migrations/`
- [ ] Migration applies without errors
- [ ] `npx prisma generate` runs successfully
**Estimated**: 10 min
**Depends on**: T001

### T003 [S] - Update seed.ts with default messages
**File**: `packages/database/prisma/seed.ts`
**Description**: Add default multilingua messages to BellItalia VIP workspace
**Acceptance Criteria**:
- [ ] `registrationPromptMessage` with it/en/es/pt/de/fr translations
- [ ] `postRegistrationPendingMessage` with all translations
- [ ] `userActivatedMessage` with all translations
- [ ] Messages contain proper variables ({{registrationLink}}, {{customerName}})
**Estimated**: 30 min
**Depends on**: T002

### T004 [S] - Run seed and verify
**Command**: `cd packages/database && npm run seed`
**Acceptance Criteria**:
- [ ] Seed runs without errors
- [ ] Workspace has all 3 new fields populated
- [ ] Query workspace and verify JSON structure
**Estimated**: 10 min
**Depends on**: T003

---

## Phase 2: Remove Blocking Logic

### T005 [S][B] - Remove MAX_UNREGISTERED_MESSAGES check from webhook
**File**: `apps/backend/src/interfaces/http/controllers/whatsapp-webhook.controller.ts`
**Description**: Remove the 5-message limit for unregistered users
**Lines to remove**: ~762-797 (the entire `MAX_UNREGISTERED_MESSAGES` block)
**Acceptance Criteria**:
- [ ] `MAX_UNREGISTERED_MESSAGES` constant removed
- [ ] `if (customer && !customer.isActive)` message count block removed
- [ ] Rate limiting (15/min per customer, 100/min per workspace) PRESERVED
- [ ] No compilation errors
**Estimated**: 15 min

### T006 [P] - Unit test: webhook accepts unlimited messages
**File**: `apps/backend/__tests__/unit/controllers/whatsapp-webhook-unregistered.spec.ts` (NEW)
**Description**: Verify unregistered users can send unlimited messages
**Test cases**:
- [ ] Unregistered user can send 6th message (was blocked before)
- [ ] Unregistered user can send 10th message
- [ ] Rate limiting still blocks at 16th message in 1 minute
**Estimated**: 30 min
**Depends on**: T005

---

## Phase 3: Chat Engine Registration Check

### T007 [S][B] - Add STEP 0.02 to chat-engine.service.ts
**File**: `apps/backend/src/application/chat-engine/chat-engine.service.ts`
**Description**: Add isUnregisteredUser check after STEP 0.1
**Location**: After STEP 0.1 (Welcome Message), before STEP 0.5
**Acceptance Criteria**:
- [ ] Query customer with `isActive` field
- [ ] Set `isUnregisteredUser = !customer.isActive`
- [ ] Log registration status
- [ ] Pass flag to processMessageInternal context
**Estimated**: 30 min

### T008 [S] - Propagate isUnregisteredUser through pipeline
**File**: `apps/backend/src/application/chat-engine/chat-engine.service.ts`
**Description**: Ensure flag reaches Response Builder and LLM Formatter
**Acceptance Criteria**:
- [ ] Flag passed to `buildResponse()` call
- [ ] Flag passed to `formatResponse()` call
- [ ] Flag accessible in pipeline context object
**Estimated**: 20 min
**Depends on**: T007

### T009 [P] - Unit test: isUnregisteredUser flag propagation
**File**: `apps/backend/__tests__/unit/chat-engine/unregistered-user-flag.spec.ts` (NEW)
**Description**: Verify flag is correctly set and propagated
**Test cases**:
- [ ] Customer with isActive=true → isUnregisteredUser=false
- [ ] Customer with isActive=false → isUnregisteredUser=true
- [ ] Customer not found → isUnregisteredUser=true (edge case)
- [ ] Flag reaches Response Builder
- [ ] Flag reaches LLM Formatter
**Estimated**: 45 min
**Depends on**: T008

---

## Phase 4: Response Builder - Block Intents

### T010 [S][B] - Define REGISTRATION_REQUIRED_INTENTS
**File**: `apps/backend/src/application/response-builder/response-builder.service.ts`
**Description**: Add constant with all blocked intents for unregistered users
**Acceptance Criteria**:
- [ ] Set includes: VIEW_PRICES, ADD_TO_CART, VIEW_CART, REMOVE_FROM_CART, UPDATE_CART_QUANTITY, CREATE_ORDER, CHECKOUT, VIEW_ORDERS, VIEW_ORDER_DETAILS, CANCEL_ORDER, ADD_SERVICE, ADD_SERVICE_TO_CART, CONFIRM_ORDER
- [ ] Exported for testing
**Estimated**: 10 min

### T011 [S][B] - Add blocked intent check in buildResponse()
**File**: `apps/backend/src/application/response-builder/response-builder.service.ts`
**Description**: Return REGISTRATION_REQUIRED when unregistered user attempts blocked intent
**Location**: At start of buildResponse() method
**Acceptance Criteria**:
- [ ] Check `isUnregisteredUser` flag
- [ ] Check if intent is in REGISTRATION_REQUIRED_INTENTS
- [ ] Return `{ type: "REGISTRATION_REQUIRED", data: { attemptedIntent, registrationLink } }`
- [ ] Generate proper registration link with workspaceId
**Estimated**: 30 min
**Depends on**: T010

### T012 [P] - Unit test: blocked intents for unregistered
**File**: `apps/backend/__tests__/unit/response-builder/unregistered-blocked-intents.spec.ts` (NEW)
**Description**: Verify each blocked intent returns REGISTRATION_REQUIRED
**Test cases**:
- [ ] ADD_TO_CART → REGISTRATION_REQUIRED
- [ ] VIEW_CART → REGISTRATION_REQUIRED
- [ ] CREATE_ORDER → REGISTRATION_REQUIRED
- [ ] VIEW_ORDERS → REGISTRATION_REQUIRED
- [ ] VIEW_PRICES → REGISTRATION_REQUIRED
- [ ] SHOW_PRODUCTS → NOT blocked (allowed)
- [ ] GREETING → NOT blocked (allowed)
- [ ] FAQ → NOT blocked (allowed)
**Estimated**: 45 min
**Depends on**: T011

---

## Phase 5: LLM Formatter - Registration Prompt

### T013 [S][B] - Add formatRegistrationPrompt() method
**File**: `apps/backend/src/application/llm-formatter/llm-formatter.service.ts`
**Description**: Format registration message with multilingua support
**Acceptance Criteria**:
- [ ] Method accepts workspaceId, customerLanguage, attemptedIntent
- [ ] Loads workspace.registrationPromptMessage from DB
- [ ] Selects correct language (fallback to 'it')
- [ ] Replaces {{registrationLink}} variable
- [ ] Returns formatted string
**Estimated**: 30 min

### T014 [S] - Handle REGISTRATION_REQUIRED in format pipeline
**File**: `apps/backend/src/application/llm-formatter/llm-formatter.service.ts`
**Description**: Route REGISTRATION_REQUIRED responses to formatRegistrationPrompt
**Acceptance Criteria**:
- [ ] Check response.type === "REGISTRATION_REQUIRED"
- [ ] Call formatRegistrationPrompt() with correct params
- [ ] Return formatted message (no LLM call needed)
**Estimated**: 20 min
**Depends on**: T013

### T015 [P] - Unit test: registration prompt formatting
**File**: `apps/backend/__tests__/unit/llm-formatter/registration-prompt.spec.ts` (NEW)
**Description**: Verify registration prompt generation
**Test cases**:
- [ ] Italian message when customer.language = 'it'
- [ ] English message when customer.language = 'en'
- [ ] Fallback to Italian when language not found
- [ ] {{registrationLink}} replaced correctly
- [ ] Workspace-specific link generated
**Estimated**: 30 min
**Depends on**: T014

---

## Phase 6: Admin Activation Flow

### T016 [S][B] - Update activateCustomer() to also enable chatbot
**File**: `apps/backend/src/interfaces/http/controllers/customers.controller.ts`
**Description**: When activating customer, also set activeChatbot=true
**Acceptance Criteria**:
- [ ] `activeChatbot: true` added to update query
- [ ] Both isActive and activeChatbot set in single query
**Estimated**: 15 min

### T017 [S] - Send activation message via WhatsApp queue
**File**: `apps/backend/src/interfaces/http/controllers/customers.controller.ts`
**Description**: After activation, queue WhatsApp message with userActivatedMessage
**Acceptance Criteria**:
- [ ] Load workspace.userActivatedMessage
- [ ] Select message in customer's language
- [ ] Replace {{customerName}} variable
- [ ] Create WhatsAppQueue entry with priority=1
- [ ] Only send if customer has phone number
**Estimated**: 30 min
**Depends on**: T016

### T018 [P] - Integration test: activation flow
**File**: `apps/backend/__tests__/integration/customers/activation-flow.spec.ts` (NEW)
**Description**: E2E test of admin activating customer
**Test cases**:
- [ ] Admin calls activate endpoint
- [ ] Customer isActive becomes true
- [ ] Customer activeChatbot becomes true
- [ ] WhatsAppQueue entry created
- [ ] Message in correct language
- [ ] {{customerName}} replaced
**Estimated**: 45 min
**Depends on**: T017

---

## Phase 7: Integration Testing

### T019 [S] - E2E test: unregistered user price request
**File**: `apps/backend/__tests__/integration/chat-engine/unregistered-price.spec.ts` (NEW)
**Description**: Full flow test - unregistered asks for price, gets registration prompt
**Test flow**:
1. Create unregistered customer (isActive=false)
2. Send message "quanto costa la pasta?"
3. Verify response is registration prompt
4. Verify NO price in response
**Estimated**: 45 min
**Depends on**: T012, T015

### T020 [S] - E2E test: unregistered user product info
**File**: `apps/backend/__tests__/integration/chat-engine/unregistered-info.spec.ts` (NEW)
**Description**: Full flow test - unregistered asks product info, gets normal response
**Test flow**:
1. Create unregistered customer (isActive=false)
2. Send message "che tipi di pasta avete?"
3. Verify response lists products
4. Verify NO prices in response
**Estimated**: 30 min
**Depends on**: T019

### T021 [S] - Security test: no price leakage
**File**: `apps/backend/__tests__/security/unregistered-price-leakage.spec.ts` (NEW)
**Description**: Verify prices never appear for unregistered users
**Test cases**:
- [ ] Search products → no prices
- [ ] Category listing → no prices
- [ ] Offers → no numeric discounts (only descriptions)
- [ ] Direct price question → registration prompt (no price)
**Estimated**: 45 min
**Depends on**: T020

---

## Phase 8: Documentation & Cleanup

### T022 [P] - Update Swagger documentation
**File**: `apps/backend/src/swagger.yaml`
**Description**: Document new response type and activation endpoint changes
**Acceptance Criteria**:
- [ ] REGISTRATION_REQUIRED response documented
- [ ] activateCustomer endpoint updated with new behavior
- [ ] New workspace fields documented in schemas
**Estimated**: 20 min

### T023 [P] - Update PRD with new flow
**File**: `docs/PRD.md`
**Description**: Add section describing unregistered user flow
**Acceptance Criteria**:
- [ ] New section "Unregistered User Flow"
- [ ] List of allowed vs blocked actions
- [ ] Registration prompt message template
- [ ] Activation flow description
**Estimated**: 30 min

### T024 [S] - Final review and cleanup
**Description**: Review all changes, run all tests, verify no regressions
**Acceptance Criteria**:
- [ ] `npm run test:unit` passes
- [ ] `npm run test:security` passes
- [ ] `npm run test:integration` passes (if backend running)
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Seed runs successfully
**Estimated**: 30 min
**Depends on**: All previous tasks

---

## Summary

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| 1. Database | T001-T004 | 1h 5min |
| 2. Remove Block | T005-T006 | 45min |
| 3. Chat Engine | T007-T009 | 1h 35min |
| 4. Response Builder | T010-T012 | 1h 25min |
| 5. LLM Formatter | T013-T015 | 1h 20min |
| 6. Admin Activation | T016-T018 | 1h 30min |
| 7. Integration Tests | T019-T021 | 2h |
| 8. Documentation | T022-T024 | 1h 20min |
| **TOTAL** | **24 tasks** | **~11 hours** |

---

## Dependencies Graph

```
T001 → T002 → T003 → T004
                        ↓
                      T005 → T006
                        ↓
                      T007 → T008 → T009
                        ↓
                      T010 → T011 → T012
                        ↓
                      T013 → T014 → T015
                        ↓
                      T016 → T017 → T018
                        ↓
                      T019 → T020 → T021
                        ↓
                    T022, T023 (parallel)
                        ↓
                      T024 (final)
```
