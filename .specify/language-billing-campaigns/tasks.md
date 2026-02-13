# Tasks: E2E Language, Billing, Campaigns & Escalation

**Input**: `.specify/e2e-language-billing-campaigns/plan.md`, `minrequirement.md`
**Prerequisites**: plan.md ✅, spec.md ✅
**Last Updated**: 2026-02-13 (post-gap analysis — all 9 minrequirement scenarios covered)

## Coverage Matrix (minrequirement.md ↔ tasks)

| # | Scenario | Status | Tasks |
|---|----------|--------|-------|
| 1 | Language & Translation | ✅ Covered | T001-T013, T020-T021, T036 |
| 2 | Registration & Profile Links | ✅ VERIFIED WORKING | — (no changes needed) |
| 3 | Unregistered user reminders (6th msg) | ✅ VERIFIED WORKING | — (no changes needed) |
| 4 | Human operator escalation | ✅ Covered | T015, T023 |
| 5 | Widget vs WhatsApp parity | ✅ Covered | T008, T029, T037 |
| 6 | Billing & credit cutoffs | ✅ Covered | T006-T007, T014, T016-T019, T030-T032, T038 |
| 7 | Campaign CRUD & send | ✅ Covered | T033-T035 |
| 8 | Profile update notifications | ✅ VERIFIED WORKING | — (no changes needed) |
| 9 | Safety | ✅ VERIFIED WORKING | — (no changes needed) |
| — | Refactoring (>300-400 lines) | ✅ Tracked | T039-T043 |

### Verified Working (no code changes needed)
Research confirmed these features are **fully implemented and working**:
- **Scenario 2**: LinkReplacementService (550 lines), register.tsx (logo + widgetPrimaryColor), CustomerProfilePublicPage.tsx (delete account), SecureTokenService, manual approval flow, validate-secure-token endpoint
- **Scenario 3**: llm-router.service.ts L1706-1765 — counts assistant msgs, appends `[LINK_REGISTRATION]` at 6th/12th/18th
- **Scenario 8**: profile.service.ts `sendProfileUpdateMessage()` — translates + sends via WhatsApp queue
- **Scenario 9**: security-check.service.ts 5-step pipeline, widget channel disabled check, debug mode skip, no queue for widget

---

## Phase 1: Database & Config (Shared Infrastructure)

**Purpose**: Fix default values and pricing — blocks all other changes

- [ ] T001 **[DB]** Change `customer.language @default("it")` → `@default("en")` in `packages/database/prisma/schema.prisma:405`
- [ ] T002 **[DB]** Change `workspace.defaultLanguage @default("it")` → `@default("en")` in `packages/database/prisma/schema.prisma:25`
- [ ] T003 **[DB]** Change `workspace.widgetLanguage @default("it")` → `@default("en")` in `packages/database/prisma/schema.prisma:45`
- [ ] T004 **[DB]** Generate Prisma migration: `cd packages/database && npx prisma migrate dev --name default-language-to-english`
- [ ] T005 **[DB]** Run `npx prisma generate` to regenerate client
- [x] T006 **[DB/Seed]** Update `apps/backend/prisma/data/platformConfig.ts`: WIDGET_MESSAGE value "0.005" → "0.05" ✅ DONE
- [x] T007 **[DB/Seed]** Update `apps/backend/prisma/data/pricingConfig.ts`: WIDGET_MESSAGE value 0.005 → 0.05 ✅ DONE

**Checkpoint**: All database defaults are correct. Prisma client regenerated.

---

## Phase 2: Language & Translation Fixes (Priority: P1) 🎯 MVP

**Goal**: WIP message through TranslationAgent, default language = "en" everywhere

### T008 **[BE]** Fix WIP message to use TranslationAgent
**File**: `apps/backend/src/interfaces/http/controllers/widget-chat.controller.ts`
**Change**: Replace `resolveWipMessage()` JSON lookup (lines 43-59) with TranslationAgent.process() call
**Details**:
- Import TranslationAgent at top of file
- In getStatus() (line ~144): after getting wipMessage text, call TranslationAgent.process() with workspace WIP message and requested language
- In sendMessage() (line ~444): same — translate WIP before returning
- Add error handling: if TranslationAgent fails, fall back to raw wipMessage text (graceful degradation)
- **minrequirement**: "WIP message solo se debugMode=true e comunque tradotto via TranslationAgent"
- [ ] T008

### T009 **[BE]** Fix fallback response message (Italian → English)
**File**: `apps/backend/src/interfaces/http/controllers/widget-chat.controller.ts:711`
**Change**: `"Mi dispiace, non ho capito la tua richiesta."` → `"Sorry, I couldn't understand your request."`
- [ ] T009

### T010 [P] **[Scheduler]** Fix normalizeLanguage default in push-campaigns.job.ts
**File**: `apps/scheduler/src/jobs/push-campaigns.job.ts:528`
**Change**: Final return in normalizeLanguage from `return 'it'` → `return 'en'`
- [ ] T010

### T011 [P] **[Scheduler]** Fix language fallback in whatsapp-channel-queue.job.ts
**File**: `apps/scheduler/src/jobs/whatsapp-channel-queue.job.ts:564`
**Change**: `workspace.defaultLanguage || 'it'` → `workspace.defaultLanguage || 'en'`
- [ ] T011

### T012 [P] **[Scheduler]** Fix push-campaigns.job.ts workspace fallback
**File**: `apps/scheduler/src/jobs/push-campaigns.job.ts:180`
**Change**: `workspace.defaultLanguage || 'it'` → `workspace.defaultLanguage || 'en'`
- [ ] T012

### T013 [P] **[Scheduler]** Fix translation.service.ts null language default
**File**: `apps/scheduler/src/services/translation.service.ts:42`
**Change**: `const normalizedLang = targetLanguage?.toUpperCase() || 'IT'` → `'EN'`
**Note**: Also update the "If target is Italian" skip logic — when default is EN, null should translate to English
- [ ] T013

**Checkpoint**: Language defaults are "en" across entire stack. WIP translated via LLM.

---

## Phase 3: Billing Cost Fix (Priority: P1)

**Goal**: Widget cost = $0.05 in all seeds and tests

### T014 [P] **[BE/Log]** Update billing log in widget-chat.controller.ts
**File**: `apps/backend/src/interfaces/http/controllers/widget-chat.controller.ts`
**Change**: Already done — log says "$0.05" ✅
- [x] T014

**Checkpoint**: Billing costs match spec. Seed data correct.

---

## Phase 4: contactOperator Translation (Priority: P2)

**Goal**: humanSupportInstructions translated to customer language before returning

### T015 **[BE]** Add TranslationAgent call in contactOperator
**File**: `apps/backend/src/domain/calling-functions/contactOperator.ts`
**Change**:
- Import TranslationAgent
- After variable replacement (line ~480), determine customer language
- Call `translationAgent.process({ workspaceId, message: responseMessage, targetLanguage: customerLanguage })`
- Use translated result as final response
- Error handling: if translation fails, use variable-replaced (untranslated) message
- **minrequirement**: "Uses humanSupportInstructions (translated) for user-facing message"
- [ ] T015

**Checkpoint**: Escalation messages translated to customer language.

---

## Phase 5: Widget vs WhatsApp Parity (Priority: P2) 🆕

**Goal**: Widget sends same welcome message as WhatsApp for first-time visitors

### T029 **[BE]** Add welcome message flow to widget for new visitors
**File**: `apps/backend/src/interfaces/http/controllers/widget-chat.controller.ts`
**Research**: WhatsApp sends `workspace.welcomeMessage` with variable replacement + TranslationAgent for NEW customers (whatsapp-webhook.controller.ts L965-975). Widget currently has NO welcome flow — user messages go straight to LLM.
**Change**:
- In `sendMessage()`, detect first-time visitor (no prior messages / new visitor flag)
- Fetch `workspace.welcomeMessage` from DB
- Apply variable replacement (via PromptVariableBuilder if needed)
- Pass through TranslationAgent for customer language
- Return welcome + LLM response, or just welcome on first contact
- **minrequirement**: "Same welcome message and WIP message"
- [ ] T029

**Checkpoint**: Widget welcome message matches WhatsApp behavior.

---

## Phase 6: Campaign Billing Guards (Priority: P2) 🆕

**Goal**: Push campaigns blocked when credit ≤ -$10; billing check on schedule/runNow

### T030 **[BE]** Add CREDIT_MIN_THRESHOLD check to campaign schedule/runNow
**File**: `apps/backend/src/interfaces/http/controllers/push-campaign.controller.ts`
**Research**: `schedule()` (L208-234) and `runNow()` have NO billing check. `WorkspaceAccessService.canProcessMessages()` is available but not called.
**Change**:
- Import `WorkspaceAccessService` (or `CREDIT_MIN_THRESHOLD` from workspace-access.service.ts)
- In `schedule()` and `runNow()`: fetch owner credit balance, check `< CREDIT_MIN_THRESHOLD`
- If blocked: return 402 with "Credit exhausted — cannot schedule campaign"
- **minrequirement**: "Push campaigns also blocked if credit insufficient before schedule/send"
- [ ] T030

### T031 **[BE]** Add CREDIT_MIN_THRESHOLD hard cutoff to campaign create
**File**: `apps/backend/src/application/services/push-campaign.service.ts`
**Research**: `create()` (L262-274) checks `creditBalance < estimatedCost` but NOT the -$10 hard cutoff
**Change**:
- Import `CREDIT_MIN_THRESHOLD` from workspace-access.service.ts
- Add check: `if (Number(owner.creditBalance) < CREDIT_MIN_THRESHOLD)` → throw error
- Keep existing estimated cost check as secondary guard
- [ ] T031

### T032 **[Scheduler]** Add upfront -$10 cutoff to push campaign scheduler job
**File**: `apps/scheduler/src/jobs/push-campaigns.job.ts`
**Research**: Per-message check exists (L155-160: `availableBalance < costPerMessage`) but no upfront -$10 cutoff. Job could start processing before realizing owner is blocked.
**Change**:
- At beginning of campaign processing loop (~L100): check owner credit >= CREDIT_MIN_THRESHOLD
- If below: skip campaign entirely with status PAUSED, log reason
- **minrequirement**: "Push campaigns also blocked if credit insufficient before schedule/send"
- [ ] T032

**Checkpoint**: Campaign billing guards match spec. No campaign starts when credit exhausted.

---

## Phase 7: Campaign Verification Tests (Priority: P2) 🆕

**Goal**: Test campaign edge cases from minrequirement — targetingType quoted, rebuild recipients

### T033 **[Tests]** NEW: Campaign targetingType quoted values test
**File**: `apps/backend/__tests__/unit/push-campaign-targetingType.spec.ts`
**Test**: Verify `normalizeTargetingType()` handles:
- `"MANUAL"` (plain)
- `"\"MANUAL\""` (JSON-escaped quotes)
- `"manual"` (lowercase)
- `"  MANUAL  "` (whitespace)
- **minrequirement**: "Create/Update accepts targetingType in any client format (MANUAL/ALL/TAGS; quoted values handled)"
- [ ] T033

### T034 **[Tests]** NEW: Campaign rebuild recipients on targeting change test
**File**: `apps/backend/__tests__/unit/push-campaign-recipients-rebuild.spec.ts`
**Test**: Verify `update()` rebuilds recipients when:
- targetingType changes from ALL → MANUAL
- MANUAL with new targetCustomerIds
- TAGS with new tagId
- expectedRecipients recalculated after rebuild
- **minrequirement**: "Manual selection rebuilds recipients and expectedRecipients; card shows real pending count"
- [ ] T034

### T035 **[Tests]** NEW: Campaign delete vs cancel distinction test
**File**: `apps/backend/__tests__/unit/push-campaign-delete-cancel.spec.ts`
**Test**: Verify:
- DELETE removes campaign from DB (hard delete)
- Cancel only sets status=CANCELLED
- **minrequirement**: "Delete (trash) removes campaign; Cancel sets status=CANCELLED only"
- [ ] T035

**Checkpoint**: Campaign edge cases verified via tests.

---

## Phase 8: Prompt & Variable Verification (Priority: P3) 🆕

**Goal**: Ensure no {{VAR}} placeholders leak to customers

### T036 **[Tests]** NEW: TranslationAgent prompt variables completeness test
**File**: `apps/backend/__tests__/unit/agents/translation-agent-variables.spec.ts`
**Test**: Verify TranslationAgent prompt includes and replaces:
- `{{frustrationEscalationInstructions}}`
- `{{humanSupportInstructions}}`
- `{{botIdentityResponse}}`
- `{{allowedExternalLinks}}`
- No `{{VAR}}` remains after replacement
- **minrequirement**: "Ensure TranslationAgent prompt variables include: frustrationEscalation..., and are replaced (no {{VAR}} left)"
- [ ] T036

**Checkpoint**: No placeholder leakage verified.

---

## Phase 9: Test Updates for Existing Code Changes

**Goal**: Update all tests to reflect new correct values from Phases 1-6

### T016 [P] **[Tests]** Update widget-billing.spec.ts
**File**: `apps/backend/__tests__/unit/widget/widget-billing.spec.ts`
**Changes**: Update comment "$0.005" → "$0.05", mock newBalance calculation
- [ ] T016

### T017 [P] **[Tests]** Update platform-config.service.spec.ts
**File**: `apps/backend/__tests__/unit/services/platform-config.service.spec.ts`
**Changes**: Mock value "0.005" → "0.05", assertion `0.005` → `0.05`
- [ ] T017

### T018 [P] **[Tests]** Update pricing-configuration.spec.ts
**File**: `apps/backend/__tests__/unit/pricing-configuration.spec.ts`
**Changes**: Mock value "0.005" → "0.05", assertion text and value `0.005` → `0.05`
- [ ] T018

### T019 [P] **[Tests]** Update subscription-billing.service.spec.ts
**File**: `apps/backend/__tests__/unit/subscription-billing.service.spec.ts`
**Changes**: Mock `0.005` → `0.05`, assertion `0.005` → `0.05`
- [ ] T019

### T020 [P] **[Tests]** Update widget-language-priority.spec.ts
**File**: `apps/backend/__tests__/unit/widget/widget-language-priority.spec.ts`
**Changes**: System fallback assertions from "it" → "en"
- [ ] T020

### T021 [P] **[Tests]** Update translation.service.spec.ts (scheduler)
**File**: `apps/scheduler/__tests__/translation.service.spec.ts`
**Changes**: Null language default expectation (was: returns original as Italian → now: translates to English)
- [ ] T021

### T022 **[Tests]** NEW: WIP translation through TranslationAgent test
**File**: `apps/backend/__tests__/unit/widget/widget-wip-translation.spec.ts`
**Test**: Verify WIP message calls TranslationAgent.process() instead of JSON key lookup
- [ ] T022

### T023 **[Tests]** NEW: contactOperator translated response test
**File**: `apps/backend/__tests__/unit/calling-functions/contactOperator-translation.spec.ts`
**Test**: Verify contactOperator translates humanSupportInstructions via TranslationAgent for non-Italian customers
- [ ] T023

### T037 **[Tests]** NEW: Widget welcome message parity test 🆕
**File**: `apps/backend/__tests__/unit/widget/widget-welcome-parity.spec.ts`
**Test**: Verify widget sends `workspace.welcomeMessage` for first-time visitors, matching WhatsApp flow (variable replacement + language translation)
- [ ] T037

### T038 **[Tests]** NEW: Campaign billing cutoff test 🆕
**File**: `apps/backend/__tests__/unit/push-campaign-billing-cutoff.spec.ts`
**Test**: Verify schedule/runNow blocked when `creditBalance < CREDIT_MIN_THRESHOLD (-10)`
- [ ] T038

**Checkpoint**: All tests pass with corrected values.

---

## Phase 10: Progressive Refactoring (Priority: P3 — ongoing) 🆕

**Goal**: Split files > 400 lines per execution directive. Progressive, not blocking.

### T039 **[Refactor]** Audit and prioritize refactoring candidates
**Action**: Create refactoring backlog of top-priority splits based on file size and change frequency
**Top backend candidates** (lines):
- `chat-engine.service.ts` (6,134) → `message-preprocessor`, `state-machine`, `agent-delegation`, `response-assembler`
- `llm-router.service.ts` (4,090) → `language-resolver`, `billing-guard`, `delegation-handler`, `token-replacement`
- `user-admin.routes.ts` (3,698) → `user-admin-crud`, `user-admin-subscription`, `user-admin-analytics`
- `message.repository.ts` (3,156) → `conversation-message.repo`, `message-history.repo`, `message-stats.repo`
- `data-loader.service.ts` (2,707) → `product-loader`, `category-loader`, `offer-loader`, `cache-manager`
- `whatsapp-webhook.controller.ts` (2,452) → `webhook-verification`, `new-user-handler`, `existing-user-handler`
**Top frontend candidates** (lines):
- `WorkspaceSelectionPage.tsx` (2,922) → `WorkspaceCard`, `WorkspaceWizard`, `useWorkspaceSelection`
- `LoginPage.tsx` (2,620) → `LoginForm`, `OAuthButtons`, `useLogin`
- `LanguageContext.tsx` (2,081) → `language-translations`, `useLanguage`, `LanguageProvider`
- `ProductsPage.tsx` (2,021) → `ProductTable`, `ProductEditSheet`, `useProducts`
- `ChatPage.tsx` (1,873) → `ChatSidebar`, `ChatMessages`, `useChat`
- [ ] T039

### T040 **[Refactor]** Extract `language-resolver.service.ts` from llm-router.service.ts
**Scope**: Language detection, phone prefix mapping, language priority logic → new dedicated service
**Why**: This logic is used in widget, WhatsApp, and scheduler — a shared module improves consistency
- [ ] T040

### T041 **[Refactor]** Extract `billing-guard.service.ts` from llm-router.service.ts
**Scope**: Credit checking, CREDIT_MIN_THRESHOLD enforcement, billing deduction → new dedicated service
**Why**: Currently credit checks are scattered across workspace-access.service, llm-router, whatsapp-queue, push-campaign.service
- [ ] T041

### T042 **[Refactor]** Split widget-chat.controller.ts into handler modules
**Scope**: `widget-status.handler.ts`, `widget-message.handler.ts` — extract getStatus and sendMessage logic
**Why**: File is 749 lines and growing with TranslationAgent and welcome message additions
- [ ] T042

### T043 **[Refactor]** Extract frontend hooks from large pages
**Scope**: `useCampaigns`, `useLanguage`, `useTokenValidation` hooks; `CampaignCard`, `CampaignForm` components
**Why**: Pages like CampaignsPage, SettingsPage embed too much logic inline
- [ ] T043

**Note**: Refactoring tasks are progressive — each can be done independently. They don't block feature work but should be merged incrementally. Per the execution directive: "Se un file è troppo lungo o denso per essere compreso facilmente (oltre ~300-400 righe), va spezzato/modularizzato."

---

## Phase 11: Verification & Cleanup

- [ ] T044 Run `cd apps/backend && npm run test:unit` — all tests MUST pass
- [ ] T045 Run `cd apps/scheduler && npm test` — all tests MUST pass
- [ ] T046 Run `cd apps/frontend && npm test` — all tests MUST pass
- [ ] T047 Stage all changes: `git add -A`
- [ ] T048 Verify `git status` — no temp files, no uncommitted artifacts

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (DB)          → No dependencies — start immediately
Phase 2 (Language)    → Depends on Phase 1 (Prisma schema)
Phase 3 (Billing)     → Independent ✅ DONE
Phase 4 (Escalation)  → Independent — can parallel with Phase 2
Phase 5 (Widget Parity) → Depends on Phase 2 (TranslationAgent pattern)
Phase 6 (Campaign Billing) → Independent — can parallel with Phase 2/4/5
Phase 7 (Campaign Tests) → Independent — test existing code
Phase 8 (Prompt Vars) → Independent — test existing code
Phase 9 (Test Updates) → Depends on Phases 1-6 completion
Phase 10 (Refactoring) → Independent — progressive, non-blocking
Phase 11 (Verification) → Depends on all other phases
```

### Parallel Opportunities

```
Phase 1: T001-T005 sequential (migration), T006-T007 done ✅
Phase 2: T009, T010, T011, T012, T013 all [P] parallel (different files)
Phase 2: T008 independent (widget controller)
Phase 4: T015 independent (contactOperator)
Phase 5: T029 independent (widget welcome)
Phase 6: T030, T031, T032 all [P] parallel (different files)
Phase 7: T033, T034, T035 all [P] parallel (new test files)
Phase 8: T036 independent
Phase 9: T016-T021 all [P] parallel (different test files)
Phase 9: T022, T023, T037, T038 independent (new test files)
Phase 10: T040-T043 all independent (can be done any time)
```

### Critical Path

```
T001-T005 → T008 (WIP TranslationAgent) → T029 (welcome parity) → T022+T037 (tests) → T044 (verify)
T001-T005 → T009-T013 (language defaults) → T020-T021 (tests) → T044 (verify)
T030-T032 (campaign billing) → T038 (test) → T044 (verify)
T015 (contactOperator) → T023 (test) → T044 (verify)
```

## Summary

| Category | Tasks | Code Changes | New Tests |
|----------|-------|-------------|-----------|
| DB & Config | T001-T007 | 5 (2 done) | — |
| Language & Translation | T008-T013 | 6 | — |
| Billing Costs | T014 | 0 (done) | — |
| Escalation | T015 | 1 | — |
| Widget Parity | T029 | 1 | — |
| Campaign Billing | T030-T032 | 3 | — |
| Test Updates | T016-T023, T036-T038 | — | 11 (6 update, 5 new) |
| Campaign Tests | T033-T035 | — | 3 new |
| Refactoring | T039-T043 | 5 progressive | — |
| Verification | T044-T048 | — | — |
| **TOTAL** | **48 tasks** | **16 code changes** | **14 tests** |
