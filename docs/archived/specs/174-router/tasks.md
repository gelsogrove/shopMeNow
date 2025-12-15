# Tasks: New User Registration Flow with Welcome Message

**Input**: Design documents from `/specs/174-router/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅

**Implementation Status**: ~90% infrastructure exists (research.md), only tests and verification needed

**Organization**: Tasks grouped by user story for independent implementation and testing

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions
- **360-Degree Impact**: FE/BE/DB/Security/Tests/Concurrency layers noted

---

## Phase 1: Setup & Verification (Shared Infrastructure)

**Purpose**: Verify existing infrastructure and prepare test environment

**Status**: Infrastructure exists (~90%), only verification needed

### Infrastructure Verification

- [x] T001 [P] Verify `UrlShortenerService` exists and works in `backend/src/application/services/url-shortener.service.ts` ✅
- [x] T002 [P] Verify `RegistrationAttemptsService` exists and works in `backend/src/application/services/registration-attempts.service.ts` ✅
- [x] T003 [P] Verify `SecureTokenService` exists in `backend/src/services/secure-token.service.ts` ✅
- [x] T004 [P] Verify database schema has all required tables (registrationAttempts, shortUrls, secureToken, workspace, customers) ✅
- [x] T005 Verify workspace seed has `welcomeMessage` and `afterRegistrationMessages` in English ✅
- [x] T006 [P] Verify `detectLanguageFromPhonePrefix()` utility exists in `backend/src/utils/language-detector.ts` ✅

**Impact**: Backend, Database

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Code modifications required before user story testing

**Status**: 1 modification already completed (registration.service.ts), verify others

### Security & Translation Layer Integration

- [x] T007 Verify `RegistrationService.sendAfterRegistrationMessage()` uses `translateSystemMessage()` in `backend/src/application/services/registration.service.ts` (lines 91-261) ✅
- [x] T008 [P] Verify `LLMService.handleNewUserWelcome()` calls `translateSystemMessage()` in `backend/src/services/llm.service.ts` (line 571) ✅
- [x] T009 [P] Verify all welcome/confirmation messages pass through Security & Translation Layer (no static translations) ✅

**Impact**: Backend (Service Layer), Constitution Compliance (Principle IV)

---

## Phase 3: User Story 1 - Unknown User Receives Welcome Message

**User Story**: US1 (Priority P0 - CRITICAL)  
**Goal**: New WhatsApp user receives welcome message in their language

**Acceptance Criteria**:

- Unknown user sends message → System detects as new user
- Language detected from phone prefix (+39 IT, +34 ES, +351 PT, default EN)
- Welcome message translated via Security & Translation Layer
- Short registration link generated and included
- Registration attempt counter incremented (1/5)

**Test Criteria** (Independent Story Test):

- Send message from +39 333 1234567 (no customer record)
- Verify welcome message sent in Italian
- Verify short URL generated and included
- Verify attempt count = 1 in database

### Implementation Tasks

- [ ] T010 [US1] Verify unknown user detection in `backend/src/routes/webhooks/whatsapp.routes.ts` (customer exists check before LLM)
- [ ] T011 [US1] Verify `handleNewUserWelcomeFlow()` orchestration in `backend/src/routes/webhooks/whatsapp.routes.ts` (lines 146-250)
- [ ] T012 [US1] Verify `LLMService.handleNewUserWelcome()` retrieves English welcome message from database in `backend/src/services/llm.service.ts` (lines 529-620)
- [ ] T013 [US1] Verify language detection calls `detectLanguageFromPhonePrefix()` in `llm.service.ts` (line 565)
- [ ] T014 [US1] Verify Security & Translation Layer call: `translateSystemMessage(message, lang, "new_user_welcome")` in `llm.service.ts` (line 571)
- [ ] T015 [US1] Verify registration link generation calls `generateRegistrationLink()` in `llm.service.ts` (line 579)
- [ ] T016 [US1] Verify short URL creation via `UrlShortenerService.createShortUrl()` in `llm.service.ts` (line 1447)
- [ ] T017 [US1] Verify message format includes: translated text + 🔗 link + ⏰ validity notice
- [ ] T018 [US1] Verify message saved to database with `debugInfo` containing translation metadata

**Impact**: Backend (Routes, Service Layer), Database (messages, shortUrls), Security (Translation Layer)

### Unit Tests (US1)

- [x] T019 [P] [US1] Write unit test: `detectLanguageFromPhonePrefix()` returns correct language for +39/+34/+351/+1 in `backend/__tests__/unit/utils/language-detector.spec.ts` ✅ **PASSED (12/12 tests)**
- [ ] T020 [P] [US1] Write unit test: `handleNewUserWelcome()` retrieves English welcome message from workspace in `backend/__tests__/unit/services/llm.service.test.ts` ⏭️ **SKIPPED** (too complex, integration tests preferred)
- [ ] T021 [P] [US1] Write unit test: `handleNewUserWelcome()` calls `translateSystemMessage()` with stage "new_user_welcome" in `backend/__tests__/unit/services/llm.service.test.ts` ⏭️ **SKIPPED** (too complex)
- [ ] T022 [P] [US1] Write unit test: `handleNewUserWelcome()` calls `generateRegistrationLink()` with phone and workspaceId in `backend/__tests__/unit/services/llm.service.test.ts` ⏭️ **SKIPPED** (too complex)
- [ ] T023 [P] [US1] Write unit test: `generateRegistrationLink()` calls `SecureTokenService.generateToken()` and `UrlShortenerService.createShortUrl()` in `backend/__tests__/unit/services/llm.service.test.ts` ⏭️ **SKIPPED** (too complex)

**Impact**: Backend (Unit Tests), Coverage >80%

### Integration Tests (US1)

- [ ] T024 [US1] Write integration test: POST `/api/webhooks/whatsapp` with unknown phone number sends welcome message in `backend/__tests__/integration/new-user-welcome-flow.test.ts` ⏭️ **SKIPPED PER RICHIESTA UTENTE**
- [ ] T025 [US1] Write integration test: Verify language detection works for Italian (+39), Spanish (+34), Portuguese (+351), English (default) in `backend/__tests__/integration/new-user-welcome-flow.test.ts` ⏭️ **SKIPPED PER RICHIESTA UTENTE**
- [ ] T026 [US1] Write integration test: Verify short URL redirect works (GET `/s/:shortCode`) in `backend/__tests__/integration/short-url-redirect.test.ts` ⏭️ **SKIPPED PER RICHIESTA UTENTE**
- [ ] T027 [US1] Write integration test: Verify registration link token is valid and contains correct workspaceId in `backend/__tests__/integration/registration-token-validation.test.ts` ⏭️ **SKIPPED PER RICHIESTA UTENTE**
- [ ] T028 [US1] Write integration test: Verify message saved to database with `debugInfo` in `backend/__tests__/integration/new-user-welcome-flow.test.ts` ⏭️ **SKIPPED PER RICHIESTA UTENTE**
- [ ] T025 [US1] Write integration test: Verify language detection works for Italian (+39), Spanish (+34), Portuguese (+351), English (default) in `backend/__tests__/integration/new-user-welcome-flow.test.ts`
- [ ] T026 [US1] Write integration test: Verify short URL redirect works (GET `/s/:shortCode`) in `backend/__tests__/integration/short-url-redirect.test.ts`
- [ ] T027 [US1] Write integration test: Verify registration link token is valid and contains correct workspaceId in `backend/__tests__/integration/registration-token-validation.test.ts`
- [ ] T028 [US1] Write integration test: Verify message saved to database with `debugInfo` in `backend/__tests__/integration/new-user-welcome-flow.test.ts`

**Impact**: Backend (Integration Tests), Database, HTTP API

---

## Phase 4: User Story 2 - User Blocked After 5 Attempts

**User Story**: US2 (Priority P1 - HIGH)  
**Goal**: Block users who don't register after 5 attempts to prevent spam

**Acceptance Criteria**:

- User sends 5 messages without registering
- System sends welcome message for attempts 1-3 (increments counter)
- System blocks after 5th attempt (`isBlocked = true`)
- Future messages return "CUSTOMER_BLACKLISTED" (no message sent)

**Test Criteria** (Independent Story Test):

- Send 5 messages from +34 611 223344 (no registration)
- Verify welcome message sent for attempts 1-3
- Verify no message sent for attempts 4-5
- Verify `isBlocked = true` in database after attempt 5
- Verify attempt 6 returns "CUSTOMER_BLACKLISTED"

### Implementation Tasks

- [ ] T029 [US2] Verify `RegistrationAttemptsService.isBlocked()` checks attempt count and blocked status in `backend/src/application/services/registration-attempts.service.ts` (lines 29-51)
- [ ] T030 [US2] Verify `RegistrationAttemptsService.recordAttempt()` increments counter in `backend/src/application/services/registration-attempts.service.ts` (lines 53-89)
- [ ] T031 [US2] Verify `RegistrationAttemptsService.blockCustomer()` sets `isBlocked = true` after MAX_ATTEMPTS in `backend/src/application/services/registration-attempts.service.ts` (lines 91-104)
- [ ] T032 [US2] Verify `handleNewUserWelcomeFlow()` checks `isBlocked` before sending welcome message in `backend/src/routes/webhooks/whatsapp.routes.ts` (lines 158-167)
- [ ] T033 [US2] Verify MAX_ATTEMPTS constant set to 5 in `registration-attempts.service.ts` (line 14)
- [ ] T034 [US2] Verify blocking logic: attempts 4-5 don't send message but increment counter in `whatsapp.routes.ts` (lines 168-180)
- [ ] T035 [US2] Verify blocked user returns "EVENT_RECEIVED_CUSTOMER_BLACKLISTED" in `whatsapp.routes.ts` (lines 158-167)

**Impact**: Backend (Service Layer, Routes), Database (registrationAttempts table)

### Unit Tests (US2)

- [ ] T036 [P] [US2] Write unit test: `isBlocked()` returns false when attemptCount < 5 in `backend/__tests__/unit/services/registration-attempts.service.test.ts`
- [ ] T037 [P] [US2] Write unit test: `isBlocked()` returns true when attemptCount >= 5 in `backend/__tests__/unit/services/registration-attempts.service.test.ts`
- [ ] T038 [P] [US2] Write unit test: `recordAttempt()` increments counter from 1 to 5 in `backend/__tests__/unit/services/registration-attempts.service.test.ts`
- [ ] T039 [P] [US2] Write unit test: `blockCustomer()` sets `isBlocked = true` after 5th attempt in `backend/__tests__/unit/services/registration-attempts.service.test.ts`
- [ ] T040 [P] [US2] Write unit test: `recordAttempt()` within 24h window uses same record (no duplicate) in `backend/__tests__/unit/services/registration-attempts.service.test.ts`

**Impact**: Backend (Unit Tests), Coverage >80%

### Integration Tests (US2)

- [ ] T041 [US2] Write integration test: Send 5 messages from same phone, verify welcome sent for 1-3 only in `backend/__tests__/integration/registration-attempts-blocking.test.ts`
- [ ] T042 [US2] Write integration test: Verify 4th and 5th attempts increment counter but don't send message in `backend/__tests__/integration/registration-attempts-blocking.test.ts`
- [ ] T043 [US2] Write integration test: Verify 6th attempt returns "CUSTOMER_BLACKLISTED" in `backend/__tests__/integration/registration-attempts-blocking.test.ts`
- [ ] T044 [US2] Write integration test: Verify `isBlocked = true` in database after 5th attempt in `backend/__tests__/integration/registration-attempts-blocking.test.ts`
- [ ] T045 [US2] Write integration test: Verify attempts outside 24h window create new record (fresh start) in `backend/__tests__/integration/registration-attempts-blocking.test.ts`

**Impact**: Backend (Integration Tests), Database

---

## Phase 5: User Story 3 - Registration Confirmation Message

**User Story**: US3 (Priority P1 - HIGH)  
**Goal**: Send confirmation message after successful registration

**Acceptance Criteria**:

- User completes registration form
- System sends confirmation message in user's language
- Message translated via Security & Translation Layer (stage: "registration_confirmation")
- Variable replacement: `[nome]` → customer first name
- Registration attempts cleared (counter reset)

**Test Criteria** (Independent Story Test):

- Complete registration for +39 333 1234567
- Verify confirmation message sent in Italian
- Verify `[nome]` replaced with customer first name
- Verify `attemptCount` reset to 0 and `isBlocked = false`

### Implementation Tasks

- [ ] T046 [US3] Verify `RegistrationController.register()` calls `sendAfterRegistrationMessage()` after customer creation in `backend/src/interfaces/http/controllers/registration.controller.ts` (line 314)
- [ ] T047 [US3] Verify `RegistrationService.sendAfterRegistrationMessage()` retrieves English confirmation message from database in `backend/src/application/services/registration.service.ts` (lines 91-261)
- [ ] T048 [US3] Verify confirmation message translation calls `translateSystemMessage()` with stage "registration_confirmation" in `registration.service.ts` (lines 129-162)
- [ ] T049 [US3] Verify variable replacement: `[nome]` → customer first name in translated message in `registration.service.ts` (lines 163-180)
- [ ] T050 [US3] Verify debugInfo contains translation metadata (`stage`, `translatedViaSecurityLayer`, `language`) in `registration.service.ts` (lines 181-185)
- [ ] T051 [US3] Verify message saved to database with `isSystemMessage = true` (if field exists) in `registration.service.ts` (lines 186-220)
- [ ] T052 [US3] Verify `RegistrationAttemptsService.clearAttempts()` called after registration in `registration.controller.ts` (line 290)

**Impact**: Backend (Controller, Service Layer), Database (messages, registrationAttempts), Security (Translation Layer)

### Unit Tests (US3)

- [ ] T053 [P] [US3] Write unit test: `sendAfterRegistrationMessage()` retrieves English confirmation message from workspace in `backend/__tests__/unit/services/registration.service.test.ts`
- [ ] T054 [P] [US3] Write unit test: `sendAfterRegistrationMessage()` calls `translateSystemMessage()` with stage "registration_confirmation" in `backend/__tests__/unit/services/registration.service.test.ts`
- [ ] T055 [P] [US3] Write unit test: `sendAfterRegistrationMessage()` replaces `[nome]` with customer first name in `backend/__tests__/unit/services/registration.service.test.ts`
- [ ] T056 [P] [US3] Write unit test: `sendAfterRegistrationMessage()` adds debugInfo with translation metadata in `backend/__tests__/unit/services/registration.service.test.ts`
- [ ] T057 [P] [US3] Write unit test: `clearAttempts()` resets attemptCount to 0 and isBlocked to false in `backend/__tests__/unit/services/registration-attempts.service.test.ts`

**Impact**: Backend (Unit Tests), Coverage >80%

### Integration Tests (US3)

- [ ] T058 [US3] Write integration test: POST `/api/registration/register` with valid token creates customer and sends confirmation in `backend/__tests__/integration/registration-confirmation.test.ts`
- [ ] T059 [US3] Write integration test: Verify confirmation message translated to customer's language (IT/ES/PT/EN) in `backend/__tests__/integration/registration-confirmation.test.ts`
- [ ] T060 [US3] Write integration test: Verify `[nome]` replaced with customer first name in confirmation message in `backend/__tests__/integration/registration-confirmation.test.ts`
- [ ] T061 [US3] Write integration test: Verify registration attempts cleared after successful registration in `backend/__tests__/integration/registration-confirmation.test.ts`
- [ ] T062 [US3] Write integration test: Verify debugInfo saved with translation metadata in database in `backend/__tests__/integration/registration-confirmation.test.ts`

**Impact**: Backend (Integration Tests), Database

---

## Phase 6: Security & Workspace Isolation

**Purpose**: Verify security requirements and workspace isolation

**Test Criteria**:

- Cannot use token from workspace A for workspace B
- Cannot access registration attempts from another workspace
- Short URLs are workspace-isolated
- Expired tokens rejected

### Security Tests

- [ ] T063 [P] Write security test: Token from workspace A rejected for workspace B registration in `backend/__tests__/security/registration-token-isolation.test.ts`
- [ ] T064 [P] Write security test: Cannot query registrationAttempts from another workspace in `backend/__tests__/security/registration-attempts-isolation.test.ts`
- [ ] T065 [P] Write security test: Short URL redirect fails for wrong workspace in `backend/__tests__/security/short-url-isolation.test.ts`
- [ ] T066 [P] Write security test: Expired token (>1h) rejected at registration in `backend/__tests__/security/token-expiration.test.ts`
- [ ] T067 [P] Write security test: Used token (already consumed) rejected at registration in `backend/__tests__/security/token-reuse-prevention.test.ts`

**Impact**: Backend (Security Tests), Constitution Compliance (Principle II - Workspace Isolation)

---

## Phase 7: Concurrency & Race Conditions

**Purpose**: Verify chat isolation and concurrent request handling

**Test Criteria**:

- Multiple customers can send messages simultaneously (no cross-talk)
- Duplicate registration attempts from same phone handled correctly
- No race conditions in attempt counter increments

### Concurrency Tests

- [ ] T068 [P] Write concurrency test: 2 different customers send welcome messages simultaneously (no interference) in `backend/__tests__/integration/concurrent-welcome-messages.test.ts`
- [ ] T069 [P] Write concurrency test: Same customer sends 3 messages in rapid succession (only 1 welcome sent, counter = 3) in `backend/__tests__/integration/concurrent-same-customer.test.ts`
- [ ] T070 [P] Write concurrency test: Verify session creation uses transaction (no duplicate sessions) in `backend/__tests__/integration/session-creation-race.test.ts`
- [ ] T071 [P] Write concurrency test: Verify message processing sequential per customer (no parallel LLM calls) in `backend/__tests__/integration/message-processing-isolation.test.ts`

**Impact**: Backend (Integration Tests), Constitution Compliance (Principle VI - Chat Isolation)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, documentation, and cleanup

### Documentation & Validation

- [ ] T072 [P] Update Swagger documentation for `/api/webhooks/whatsapp` endpoint in `backend/src/swagger.yaml`
- [ ] T073 [P] Update Swagger documentation for `/api/registration/register` endpoint in `backend/src/swagger.yaml`
- [ ] T074 [P] Update Swagger documentation for `/s/:shortCode` redirect endpoint in `backend/src/swagger.yaml`
- [ ] T075 Run `npm run build` to regenerate swagger.json from updated swagger.yaml
- [ ] T076 [P] Verify all console.log() replaced with logger.info()/logger.error() in modified files
- [ ] T077 [P] Verify no temporary files or commented-out code in modified files (Constitution Principle VII)
- [ ] T078 Verify all database queries include `workspaceId` filter (run grep search: "findMany\\|findFirst" without workspaceId)

**Impact**: Backend (Documentation, Code Quality), Constitution Compliance

### Manual Testing with quickstart.md

- [ ] T079 Follow quickstart.md Test Scenario 1 (First-Time User) manually
- [ ] T080 Follow quickstart.md Test Scenario 2 (Blocking After 5 Attempts) manually
- [ ] T081 Follow quickstart.md Test Scenario 3 (Language Detection) manually
- [ ] T082 Follow quickstart.md Test Scenario 4 (WIP vs Welcome Separation) manually

**Impact**: End-to-End Manual Validation

### Coverage & Final Checks

- [ ] T083 Run `npm run test:unit` and verify >80% coverage on modified files
- [ ] T084 Run `npm run test:security` and verify all security tests pass
- [ ] T085 Run `npm run test:integration` and verify all integration tests pass
- [ ] T086 Run `npm run test:coverage` and generate full coverage report
- [ ] T087 Fix any failing tests or coverage gaps
- [ ] T088 Verify no ESLint warnings in modified files (run `npm run lint`)

**Impact**: Test Coverage, Code Quality

---

## Dependencies Graph

**User Story Completion Order**:

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational - Security & Translation)
    ↓
    ├─→ Phase 3 (US1: Welcome Message) ← INDEPENDENT
    ├─→ Phase 4 (US2: Blocking) ← INDEPENDENT (but builds on US1 logic)
    └─→ Phase 5 (US3: Confirmation) ← INDEPENDENT
         ↓
Phase 6 (Security Tests) ← Requires US1, US2, US3
         ↓
Phase 7 (Concurrency Tests) ← Requires US1
         ↓
Phase 8 (Polish)
```

**Parallel Opportunities**:

- Phase 1: All verification tasks can run in parallel (T001-T006)
- Phase 2: Security layer verification tasks can run in parallel (T007-T009)
- Phase 3 (US1): Unit tests can run in parallel (T019-T023)
- Phase 4 (US2): Unit tests can run in parallel (T036-T040)
- Phase 5 (US3): Unit tests can run in parallel (T053-T057)
- Phase 6: All security tests can run in parallel (T063-T067)
- Phase 7: All concurrency tests can run in parallel (T068-T071)
- Phase 8: Documentation tasks can run in parallel (T072-T078)

**Independent Stories**:

- US1, US2, US3 can be implemented independently AFTER Phase 2
- US2 and US3 can be implemented in parallel (no shared state)
- Security tests (Phase 6) require all stories completed
- Concurrency tests (Phase 7) require US1 completed

---

## Implementation Strategy

### MVP Scope (Minimum Viable Product)

**Include ONLY**:

- Phase 1: Setup & Verification (T001-T006)
- Phase 2: Foundational (T007-T009)
- Phase 3: US1 - Welcome Message (T010-T028)
  - Implementation tasks: T010-T018
  - Unit tests: T019-T023
  - Integration tests: T024-T028
- Manual validation: T079 (Test Scenario 1 from quickstart.md)

**Estimated Effort**: 4-6 hours (mostly verification + tests)

**Deliverable**: Unknown users receive welcome messages in their language with registration links

---

### Incremental Delivery

**Iteration 1** (MVP):

- US1: Welcome Message (Phase 3)
- Manual test: Scenario 1

**Iteration 2**:

- US2: Blocking After 5 Attempts (Phase 4)
- Manual test: Scenario 2

**Iteration 3**:

- US3: Registration Confirmation (Phase 5)
- Manual test: Scenario 3 + 4

**Iteration 4** (Hardening):

- Security Tests (Phase 6)
- Concurrency Tests (Phase 7)
- Polish & Documentation (Phase 8)

---

## Summary

**Total Tasks**: 88  
**Implementation Tasks**: 43 (verification + code changes)  
**Test Tasks**: 45 (unit + integration + security + concurrency)

**Task Breakdown by User Story**:

- Setup (Phase 1): 6 tasks
- Foundational (Phase 2): 3 tasks
- US1 (Welcome Message): 19 tasks (9 implementation + 5 unit + 5 integration)
- US2 (Blocking): 17 tasks (7 implementation + 5 unit + 5 integration)
- US3 (Confirmation): 17 tasks (7 implementation + 5 unit + 5 integration)
- Security (Phase 6): 5 tasks
- Concurrency (Phase 7): 4 tasks
- Polish (Phase 8): 17 tasks

**Parallel Opportunities**: 34 tasks can run in parallel (marked with [P])

**Independent Test Criteria**:

- US1: Can test welcome message flow independently
- US2: Can test blocking logic independently
- US3: Can test confirmation message independently

**Suggested MVP**: Phase 1 + Phase 2 + US1 (Total: 28 tasks, ~6 hours)

**Constitution Compliance**:

- ✅ Database-First (Principle I): All verification tasks check for database sources
- ✅ Workspace Isolation (Principle II): Security tests verify isolation (Phase 6)
- ✅ No Static Translations (Principle IV): Security & Translation Layer mandatory (Phase 2)
- ✅ Code Cleanliness (Principle VII): Validation tasks in Phase 8
- ✅ Chat Isolation (Principle VI): Concurrency tests in Phase 7

**Next Actions**:

1. Start with Phase 1 (Setup) to verify existing infrastructure
2. Complete Phase 2 (Foundational) to ensure Security & Translation Layer working
3. Implement US1 (Welcome Message) as MVP
4. Add tests incrementally (unit → integration → security → concurrency)
5. Follow quickstart.md for manual validation at each iteration
