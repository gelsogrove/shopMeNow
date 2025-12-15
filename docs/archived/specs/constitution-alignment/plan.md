# Implementation Plan: Constitution v1.5.0 Alignment

**Feature**: Constitution compliance updates  
**Branch**: `constitution-v1.5-alignment`  
**Estimated Effort**: 2-3 days (solo developer)

---

## Tech Stack

**Existing Stack** (no changes):
- **Backend**: Node.js 18+ / TypeScript 5.x / Express / Prisma ORM
- **Testing**: Jest + Supertest
- **CI/CD**: GitHub Actions
- **Git Hooks**: Husky + lint-staged

**New Tools**:
- None (uses existing infrastructure)

---

## Architecture

### High-Level Changes

```
Constitution v1.5.0 Compliance
│
├── 1. Debug Mode Environment-Based (US1)
│   └── backend/src/repositories/message.repository.ts
│       - Change: workspace?.debugMode ?? true
│       + Change: workspace?.debugMode ?? (NODE_ENV === 'production' ? false : true)
│
├── 2. Variable Validation Runtime (US2)
│   └── backend/src/services/prompt-processor.service.ts
│       + Add: validatePromptVariables() method
│       + Add: Throws PromptValidationError on duplicates
│
├── 3. Multi-Agent Delegation Tests (US3)
│   └── backend/__tests__/integration/multi-agent-delegation.test.ts
│       + Test: Router delegates to ProductSearchAgent
│       + Test: Router prompt has NO {{PRODUCTS}}
│       + Test: ProductSearch prompt HAS {{PRODUCTS}}
│
├── 4. Pre-commit Hook (US4)
│   └── .husky/pre-commit
│       + Check: No temp files (*.backup, *.old, *.tmp)
│       + Check: ESLint passes (--max-warnings 0)
│       + Check: Prompt validation (npm run validate-prompts)
│
└── 5. Prompt Audit Script (US5)
    ├── scripts/audit-agent-prompts.sh
    │   + Check: Variable isolation per agent
    │   + Check: No duplicate large variables
    └── .github/workflows/prompt-audit.yml
        + Run: On every commit to main
        + Fail: If audit detects violations
```

---

## Project Structure

```
backend/
├── src/
│   ├── repositories/
│   │   └── message.repository.ts       # US1: Update debugMode logic
│   ├── services/
│   │   └── prompt-processor.service.ts # US2: Add validatePromptVariables()
│   └── errors/
│       └── PromptValidationError.ts    # US2: New error class
├── __tests__/
│   ├── unit/
│   │   └── services/
│   │       └── prompt-processor.test.ts # US2: Validation tests
│   └── integration/
│       └── multi-agent-delegation.test.ts # US3: New test file
└── scripts/
    ├── audit-agent-prompts.sh          # US5: New audit script
    └── validate-prompts.ts             # US4: Existing script (verify)

.husky/
└── pre-commit                          # US4: New hook

.github/
└── workflows/
    └── prompt-audit.yml                # US5: New workflow

docs/
└── prompts/
    └── *.md                            # Audited by US5
```

---

## Data Model

**No schema changes required** - all changes are runtime behavior.

**Affected Tables**:
- `workspace.debugMode` - behavior changes (environment-based fallback)
- No migrations needed (existing data unaffected)

---

## Implementation Phases

### Phase 1: Core Validation Logic (US1 + US2)
**Goal**: Implement database-first debug mode + variable validation

**Tasks**:
1. Update `message.repository.ts` with environment-based debugMode
2. Create `PromptValidationError` class
3. Add `validatePromptVariables()` to `PromptProcessorService`
4. Write unit tests for validation logic

**Deliverable**: Backend throws errors on duplicate variables, respects NODE_ENV for debug mode

---

### Phase 2: Integration Testing (US3)
**Goal**: Verify multi-agent architecture compliance

**Tasks**:
1. Create `multi-agent-delegation.test.ts`
2. Test Router → ProductSearchAgent delegation
3. Test prompt isolation (Router vs ProductSearch)
4. Verify delegation flow (Router → Specialist → Router → Safety)

**Deliverable**: Integration tests pass, architectural boundaries verified

---

### Phase 3: Developer Tooling (US4 + US5)
**Goal**: Automate constitution compliance checks

**Tasks**:
1. Create `.husky/pre-commit` hook
2. Create `scripts/audit-agent-prompts.sh`
3. Create GitHub Action `prompt-audit.yml`
4. Update package.json scripts (`prepare`, `audit:prompts`, `validate-prompts`)

**Deliverable**: Automated checks prevent violations before commit/merge

---

### Phase 4: Documentation & Rollout
**Goal**: Enable team adoption

**Tasks**:
1. Update README with pre-commit hook setup
2. Document new error handling (PromptValidationError)
3. Create migration guide for existing workspaces
4. Run `npm run audit:prompts` on all existing prompts

**Deliverable**: Team can adopt new validation without friction

---

## Testing Strategy

### Unit Tests
- `prompt-processor.test.ts` - Variable validation logic
- `message.repository.test.ts` - Debug mode fallback behavior

### Integration Tests
- `multi-agent-delegation.test.ts` - Router delegation flow
- `prompt-audit.test.ts` - Audit script correctness

### E2E Tests
- Manual: Trigger prompt with duplicate {{PRODUCTS}} → verify error
- Manual: Set NODE_ENV=production, debugMode=NULL → verify billing enabled

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Breaking existing prompts with duplicates | HIGH | Run audit first, fix prompts before deploying validation |
| Pre-commit hook slows down commits | MEDIUM | Optimize ESLint, cache results, allow --no-verify bypass |
| NODE_ENV not set in production | HIGH | Add deployment checklist, verify in staging first |
| Integration tests flaky | MEDIUM | Use deterministic test data, mock LLM calls |

---

## Dependencies

**External**:
- None (uses existing dependencies)

**Internal**:
- Constitution v1.5.0 (already updated)
- Router contamination fix (already applied in Session 123)

---

## Deployment Plan

1. **Pre-deploy**: Run `npm run audit:prompts` on all existing prompts
2. **Deploy**: Merge to main (CI/CD auto-deploys)
3. **Verify**: Check backend logs for PromptValidationError (should be zero)
4. **Rollout**: Notify team to run `npm run prepare` for pre-commit hook
5. **Monitor**: Track debug mode behavior (production vs development)

---

## Success Criteria

- [ ] All unit tests pass (100% coverage on new validation logic)
- [ ] Integration tests verify delegation flow
- [ ] Pre-commit hook installed on ≥3 dev machines
- [ ] Prompt audit runs in CI/CD
- [ ] Zero production errors from duplicate variables (30 days post-deploy)
- [ ] Debug mode behaves correctly in prod (billing enabled) and dev (billing disabled)

---

## Timeline

- **Phase 1**: 1 day (validation logic + tests)
- **Phase 2**: 0.5 days (integration tests)
- **Phase 3**: 0.5 days (pre-commit hook + audit script)
- **Phase 4**: 0.5 days (documentation)
- **Total**: 2.5 days (solo developer, full-time)

---

## Open Questions

1. Should we backfill explicit `debugMode=true/false` for existing workspaces? (Recommendation: No - let environment-based fallback handle it)
2. Should prompt audit run on every commit or only on main branch? (Recommendation: Main only - avoid slowing down feature branches)
3. Should we add UI for debug mode configuration? (Recommendation: Future enhancement - not blocking)

---

## References

- Constitution v1.5.0: `.specify/memory/constitution.md`
- Principle VIII: Multi-Agent Architecture Rules
- Session 123: Router contamination fix (product hallucination bug)
