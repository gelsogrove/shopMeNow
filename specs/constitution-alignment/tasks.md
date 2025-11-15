# Tasks: Constitution v1.5.0 Alignment

**Branch**: `constitution-v1.5-alignment`  
**Input**: Design documents from `/specs/constitution-alignment/`  
**Prerequisites**: plan.md ✅, spec.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

---

## Phase 1: Setup & Verification (Shared Infrastructure)

**Purpose**: Verify constitution v1.5.0 is in place and review changes

- [ ] T001 Verify constitution.md is at version 1.5.0 in `.specify/memory/constitution.md`
- [ ] T002 Review Principle VIII (Multi-Agent Architecture Rules) - 17 sub-rules
- [ ] T003 Review debug mode changes (environment-based fallback vs hardcoded `?? true`)
- [ ] T004 Review variable validation changes (MUST throw error vs SHOULD log)
- [ ] T005 Create git branch `constitution-v1.5-alignment` if not already on it

**Checkpoint**: Constitution reviewed - ready for implementation

---

## Phase 2: Foundational Changes (BLOCKS ALL USER STORIES)

**Purpose**: Core infrastructure changes that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T006 Create `PromptValidationError` class in `backend/src/errors/PromptValidationError.ts` extending Error with `code: 'PROMPT_VALIDATION_ERROR'`
- [ ] T007 Add error export to `backend/src/errors/index.ts` for PromptValidationError

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Environment-Based Debug Mode (Priority: P1) 🎯 MVP

**Goal**: Implement database-first compliant debug mode with environment-based fallback

**Independent Test**: Set debugMode=NULL, NODE_ENV=production → billing enabled | NODE_ENV=development → billing disabled

### Implementation for User Story 1

- [ ] T008 [US1] Update debug mode logic in `backend/src/repositories/message.repository.ts` (around line 900-920):
  - Replace: `if (!(workspace?.debugMode ?? true))`
  - With: `const effectiveDebugMode = workspace?.debugMode ?? (process.env.NODE_ENV === 'production' ? false : true); if (!effectiveDebugMode)`
  - Add comment: `// Environment-based fallback (Constitution v1.5.0 Principle I compliance)`
- [ ] T009 [P] [US1] Add unit test in `backend/__tests__/unit/repositories/message.repository.test.ts`:
  - Test: debugMode=NULL, NODE_ENV=production → returns false
  - Test: debugMode=NULL, NODE_ENV=development → returns true
  - Test: debugMode=NULL, NODE_ENV=undefined → returns true (safe default)
  - Test: debugMode=true (explicit) → returns true (ignores NODE_ENV)
  - Test: debugMode=false (explicit) → returns false (ignores NODE_ENV)

**Checkpoint**: User Story 1 complete - Debug mode respects Database-First principle

---

## Phase 4: User Story 2 - Runtime Variable Validation (Priority: P1) 🎯 MVP

**Goal**: Prevent LLM API failures by detecting duplicate large variables at runtime

**Independent Test**: Prompt with {{PRODUCTS}} twice → throws PromptValidationError with clear message

### Tests for User Story 2 (TDD - Write FIRST)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T010 [P] [US2] Unit test for validatePromptVariables in `backend/__tests__/unit/services/prompt-processor.test.ts`:
  - Test: No duplicates → no error thrown
  - Test: {{PRODUCTS}} twice → throws PromptValidationError with message "Variable {{PRODUCTS}} appears 2 times"
  - Test: {{OFFERS}} three times → throws error with count
  - Test: {{SERVICES}} + {{CATEGORIES}} duplicates → throws error listing both
  - Test: Small variables duplicated ({{nameUser}}) → no error (only large vars checked)

### Implementation for User Story 2

- [ ] T011 [US2] Add `validatePromptVariables()` method to `PromptProcessorService` in `backend/src/services/prompt-processor.service.ts`:
  - Checks: {{PRODUCTS}}, {{OFFERS}}, {{SERVICES}}, {{CATEGORIES}}
  - Regex: `/\{\{(PRODUCTS|OFFERS|SERVICES|CATEGORIES)\}\}/g`
  - Logic: Count occurrences, if >1 throw PromptValidationError
  - Error message format: `Variable {{VARIABLE_NAME}} can only appear once per prompt. Found N occurrences.`
- [ ] T012 [US2] Call `validatePromptVariables()` in `preProcessPrompt()` BEFORE replacement (fail-fast pattern)
- [ ] T013 [US2] Add error handling in calling code (`llm-router.service.ts`, `ProductSearchAgentLLM.ts`) to catch PromptValidationError
- [ ] T014 [US2] Add logging for PromptValidationError (ERROR level with full prompt details for debugging)

**Checkpoint**: User Story 2 complete - Runtime validation prevents token explosion

---

## Phase 5: User Story 3 - Multi-Agent Delegation Tests (Priority: P1) 🎯 MVP

**Goal**: Integration tests verify Router → Specialist delegation architecture

**Independent Test**: Call `/api/whatsapp/webhook` with "avete salami?" → Router delegates to ProductSearchAgent → Returns real products

### Implementation for User Story 3

- [ ] T015 [US3] Create `backend/__tests__/integration/multi-agent-delegation.test.ts` with test suite "Multi-Agent Architecture (Principle VIII)"
- [ ] T016 [US3] Test: "Router delegates product queries to ProductSearchAgent":
  - Mock: Customer, Workspace, Products in DB
  - Call: LLMRouterService.routeMessage({ message: "avete formaggi?" })
  - Assert: ProductSearchAgent was called (spy on productSearchAgent.processQuery)
  - Assert: Response includes products from DB (not hallucinated)
- [ ] T017 [US3] Test: "Router prompt does NOT contain {{PRODUCTS}} or {{CATEGORIES}}":
  - Get: Processed Router prompt from LLMRouterService
  - Assert: Prompt does NOT match regex `/\{\{PRODUCTS\}\}/`
  - Assert: Prompt does NOT match regex `/\{\{CATEGORIES\}\}/`
  - Log: Prompt length (should be ~2,000 tokens, not 50,000+)
- [ ] T018 [US3] Test: "ProductSearchAgent prompt DOES contain {{PRODUCTS}}":
  - Get: ProductSearchAgent prompt from agentConfig table
  - Assert: Prompt DOES match regex `/\{\{PRODUCTS\}\}/` exactly once
  - Assert: Prompt DOES match regex `/\{\{CATEGORIES\}\}/` exactly once
- [ ] T019 [US3] Test: "Delegation flow Router → ProductSearch → Router → Safety":
  - Mock: All LLM calls to track execution order
  - Call: LLMRouterService.routeMessage({ message: "show me cheese" })
  - Assert: Execution order: [Router call 1, ProductSearch call, Router call 2, Safety call]
  - Verify: Router second call includes ProductSearch response in messages array

**Checkpoint**: User Story 3 complete - Multi-agent architecture verified with tests

---

## Phase 6: User Story 4 - Pre-commit Hook (Priority: P2)

**Goal**: Automate constitution compliance checks before commit

**Independent Test**: Try to commit with `*.backup` file → hook rejects | Commit clean code → hook passes

### Implementation for User Story 4

- [ ] T020 [US4] Install Husky if not present: `npm install --save-dev husky` in backend/
- [ ] T021 [US4] Add prepare script to `backend/package.json`: `"prepare": "husky install"`
- [ ] T022 [US4] Create `.husky/pre-commit` file with executable permissions (`chmod +x`)
- [ ] T023 [US4] Add check 1 to pre-commit: Reject temp files
  ```bash
  # Check for temporary/backup files (Constitution Principle VII)
  if git diff --cached --name-only | grep -E '\.(backup|old|tmp)$|^temp\.|^test-.*\.js$'; then
    echo "❌ ERROR: Temporary files detected (Constitution Principle VII)"
    echo "Remove: *.backup, *.old, *.tmp, temp.*, test-*.js"
    exit 1
  fi
  ```
- [ ] T024 [US4] Add check 2 to pre-commit: ESLint with zero warnings
  ```bash
  # Run ESLint (Constitution Principle VII - no unused code)
  npm run lint -- --max-warnings 0 || exit 1
  ```
- [ ] T025 [US4] Add check 3 to pre-commit: Prompt validation
  ```bash
  # Validate agent prompts (Constitution Principle III + VIII)
  npm run validate-prompts || exit 1
  ```
- [ ] T026 [US4] Verify `npm run validate-prompts` script exists in `backend/package.json` (or create it pointing to `scripts/validate-prompts.ts`)
- [ ] T027 [US4] Test pre-commit hook:
  - Create test.backup file → try commit → verify rejection
  - Fix issues → verify commit succeeds
  - Test bypass: `git commit --no-verify` → verify allowed (emergency hotfix use case)

**Checkpoint**: User Story 4 complete - Pre-commit hook prevents constitution violations

---

## Phase 7: User Story 5 - Prompt Audit Automation (Priority: P3)

**Goal**: CI/CD pipeline validates agent prompt quality continuously

**Independent Test**: Modify router-agent.md to add duplicate {{PRODUCTS}} → GitHub Action fails → Fix prompt → Action passes

### Implementation for User Story 5

- [ ] T028 [P] [US5] Create `backend/scripts/audit-agent-prompts.sh` with executable permissions
- [ ] T029 [US5] Add audit check 1: Variable isolation per agent
  ```bash
  # Check: Router does NOT have {{PRODUCTS}} or {{CATEGORIES}}
  if grep -q "{{PRODUCTS}}\|{{CATEGORIES}}" docs/prompts/router-agent.md; then
    echo "❌ ERROR: Router has product data (Principle VIII Rule #6)"
    exit 1
  fi
  
  # Check: ProductSearch HAS {{PRODUCTS}} exactly once
  count=$(grep -o "{{PRODUCTS}}" docs/prompts/product-search-agent.md | wc -l)
  if [ "$count" -ne 1 ]; then
    echo "❌ ERROR: ProductSearch must have {{PRODUCTS}} exactly once (found: $count)"
    exit 1
  fi
  ```
- [ ] T030 [US5] Add audit check 2: No duplicate large variables
  ```bash
  # Check all prompts for duplicate PRODUCTS/OFFERS/SERVICES/CATEGORIES
  for file in docs/prompts/*.md; do
    for var in PRODUCTS OFFERS SERVICES CATEGORIES; do
      count=$(grep -o "{{$var}}" "$file" | wc -l)
      if [ "$count" -gt 1 ]; then
        echo "❌ ERROR: $file has {{$var}} $count times (max: 1)"
        exit 1
      fi
    done
  done
  ```
- [ ] T031 [US5] Add `audit:prompts` script to `backend/package.json`: `"audit:prompts": "bash scripts/audit-agent-prompts.sh"`
- [ ] T032 [US5] Test audit script locally: `npm run audit:prompts` should pass with current prompts
- [ ] T033 [P] [US5] Create `.github/workflows/prompt-audit.yml` GitHub Action:
  ```yaml
  name: Prompt Audit
  on:
    push:
      branches: [main]
      paths:
        - 'docs/prompts/**'
  jobs:
    audit:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - name: Run Prompt Audit
          run: cd backend && npm run audit:prompts
  ```
- [ ] T034 [US5] Test GitHub Action:
  - Push change to docs/prompts/ → verify action runs
  - Introduce violation (duplicate {{PRODUCTS}}) → verify action fails
  - Fix violation → verify action passes

**Checkpoint**: User Story 5 complete - Automated prompt audits in CI/CD

---

## Phase 8: Polish & Documentation

**Purpose**: Finalize implementation with documentation and team enablement

- [ ] T035 [P] Update `backend/README.md` with pre-commit hook setup instructions (`npm run prepare`)
- [ ] T036 [P] Document PromptValidationError in error handling guide (if exists) or inline JSDoc comments
- [ ] T037 [P] Create migration guide in `docs/constitution-v1.5-migration.md`:
  - Explain environment-based debug mode (NODE_ENV usage)
  - Explain prompt validation errors (how to fix duplicate variables)
  - Explain pre-commit hook installation (npm run prepare)
- [ ] T038 Run `npm run audit:prompts` on all existing prompts in `docs/prompts/` → fix any violations found
- [ ] T039 Update `.specify/memory/constitution.md` follow-up TODOs section (mark completed tasks)
- [ ] T040 Create summary document `specs/constitution-alignment/IMPLEMENTATION_SUMMARY.md`:
  - List all files changed
  - List all tests added
  - Document any deviations from plan
  - Include before/after metrics (if available)

**Checkpoint**: Implementation complete - ready for team adoption

---

## Dependencies & Execution Order

### Critical Path (Must Complete in Order)

1. **Phase 1** (Setup) → **Phase 2** (Foundation) → Unblocks all user stories
2. **User Story 2** (Variable Validation) → **User Story 3** (Tests) - Tests depend on validation being implemented
3. **User Story 4** (Pre-commit) depends on validation script existing
4. **User Story 5** (CI/CD Audit) depends on audit script from US4

### Parallel Opportunities

- **Phase 1-2**: Can work on US1 (debug mode) in parallel with US2 (validation) - different files
- **Within US2**: T010 (tests) can be written before T011 (implementation) - TDD approach
- **Phase 6-7**: US4 (pre-commit) and US5 (CI/CD) can be implemented in parallel after US2 complete
- **Phase 8**: All polish tasks (T035-T040) can run in parallel

### Dependency Graph

```
T001-T007 (Setup + Foundation)
  ↓
├─→ US1 (T008-T009) - Debug Mode [CAN PARALLELIZE]
│   
├─→ US2 (T010-T014) - Variable Validation [BLOCKS US3]
│   ↓
│   └─→ US3 (T015-T019) - Delegation Tests
│
├─→ US4 (T020-T027) - Pre-commit Hook [NEEDS US2 validation script]
│
└─→ US5 (T028-T034) - CI/CD Audit [CAN PARALLELIZE with US4]

All Above ↓
Phase 8 (T035-T040) - Polish (all parallel)
```

---

## Testing Strategy

### Unit Tests (TDD Approach)

- Write tests FIRST for US2 (T010) - ensure they FAIL
- Implement validation (T011-T012) - ensure tests PASS
- Minimum coverage: 100% for new validation logic

### Integration Tests

- US3 tests (T015-T019) verify end-to-end delegation flow
- Mock LLM calls for deterministic results
- Use real database with test data

### Manual Testing

- US1: Set NODE_ENV in different environments, verify billing behavior
- US4: Try committing violations, verify hook blocks
- US5: Push prompt changes, verify GitHub Action runs

---

## Implementation Strategy

### MVP Scope (Phases 1-5)

**Goal**: Core validation + tests (US1, US2, US3)  
**Effort**: 1.5 days  
**Deliverable**: Constitution-compliant validation with full test coverage

### Full Scope (Phases 1-8)

**Goal**: Complete automation + documentation (US1-US5 + Polish)  
**Effort**: 2.5 days  
**Deliverable**: Team-ready constitution compliance system

### Recommended Approach

1. **Day 1 Morning**: Setup + Foundation (T001-T007)
2. **Day 1 Afternoon**: US1 Debug Mode (T008-T009) + US2 Tests (T010)
3. **Day 2 Morning**: US2 Implementation (T011-T014) + US3 Tests (T015-T019)
4. **Day 2 Afternoon**: US4 Pre-commit (T020-T027) + US5 Audit Script (T028-T032)
5. **Day 3 Morning**: US5 GitHub Action (T033-T034) + Polish (T035-T040)

---

## Task Summary

| Phase | Tasks | Can Parallelize | Story | Priority |
|-------|-------|----------------|--------|----------|
| Setup (Phase 1) | T001-T005 | Yes (all) | - | - |
| Foundation (Phase 2) | T006-T007 | Yes (all) | - | - |
| US1 Debug Mode | T008-T009 | T009 | US1 | P1 |
| US2 Validation | T010-T014 | T010 | US2 | P1 |
| US3 Delegation Tests | T015-T019 | T015-T018 | US3 | P1 |
| US4 Pre-commit Hook | T020-T027 | Some | US4 | P2 |
| US5 Audit Automation | T028-T034 | T028,T033 | US5 | P3 |
| Polish (Phase 8) | T035-T040 | Yes (all) | - | - |
| **TOTAL** | **40 tasks** | **15 parallelizable** | **5 stories** | - |

**Parallel Efficiency**: 37.5% of tasks can run concurrently (15/40)

---

## Success Criteria

- [ ] All 40 tasks completed
- [ ] All unit tests pass (≥20 new tests added)
- [ ] Integration tests pass (multi-agent delegation verified)
- [ ] Pre-commit hook installed and tested
- [ ] GitHub Action deployed and tested
- [ ] Documentation complete (README, migration guide, summary)
- [ ] Zero constitution violations in current prompts
- [ ] Team notified and trained on new tooling

**Definition of Done**: All tasks checked, all tests green, team can adopt without friction.
