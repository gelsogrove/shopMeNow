# Constitution v1.5.0 Alignment

**Branch**: `constitution-v1.5-alignment`  
**Constitution Version**: 1.5.0  
**Date**: 2025-11-13

## Overview

Align codebase with updated constitution (v1.4.0 → v1.5.0) that added:
- Principle VIII: Multi-Agent Architecture Rules (17 sub-rules)
- Refined debug mode behavior (environment-based fallback)
- Strengthened variable uniqueness validation (MUST throw error)

## Context

Constitution updated with critical architectural rules discovered during Session 123 (product hallucination bug fix). Key changes:
1. **Multi-Agent Architecture** - Router MUST NOT have product/category data
2. **Debug Mode** - Environment-based fallback instead of hardcoded `?? true`
3. **Variable Validation** - Runtime detection MUST throw error (not just log)

## User Stories

### User Story 1: Environment-Based Debug Mode (Priority: P1)

**As a** developer  
**I want** debug mode to respect Database-First principle  
**So that** NULL values use environment context (NODE_ENV) instead of hardcoded fallbacks

**Acceptance Criteria**:
- [ ] When `workspace.debugMode` is NULL and `NODE_ENV=production` → defaults to false (billing enabled)
- [ ] When `workspace.debugMode` is NULL and `NODE_ENV=development` → defaults to true (billing disabled)
- [ ] When `workspace.debugMode` is NULL and NODE_ENV not set → defaults to true (safe default)
- [ ] No hardcoded `?? true` fallbacks remain in codebase

**Impact**: Complies with Principle I (Database-First) while maintaining safe defaults

---

### User Story 2: Runtime Variable Validation (Priority: P1)

**As a** system  
**I want** to detect duplicate large variables at runtime  
**So that** LLM API failures are prevented (100k+ token prompts rejected)

**Acceptance Criteria**:
- [ ] `PromptProcessorService.validatePromptVariables()` throws error when {{PRODUCTS}}, {{OFFERS}}, {{SERVICES}}, or {{CATEGORIES}} appear >1 time
- [ ] Error message includes: variable name, occurrence count, line numbers (if available)
- [ ] Validation runs BEFORE variable replacement (fail-fast)
- [ ] Unit tests verify error thrown for duplicate scenarios

**Impact**: Prevents production failures from token explosion

---

### User Story 3: Multi-Agent Delegation Tests (Priority: P1)

**As a** developer  
**I want** integration tests for Router → Specialist delegation  
**So that** architectural violations are caught in CI/CD

**Acceptance Criteria**:
- [ ] Test verifies Router delegates product queries to ProductSearchAgent
- [ ] Test verifies Router does NOT have {{PRODUCTS}} or {{CATEGORIES}} in prompt
- [ ] Test verifies ProductSearchAgent HAS {{PRODUCTS}} in prompt
- [ ] Test verifies delegation flow: Router → ProductSearch → Router → Safety

**Impact**: Enforces Principle VIII (Multi-Agent Architecture Rules)

---

### User Story 4: Pre-commit Hook for Code Cleanliness (Priority: P2)

**As a** developer  
**I want** automated validation before commits  
**So that** constitution violations are caught locally

**Acceptance Criteria**:
- [ ] Pre-commit hook rejects: `*.backup`, `*.old`, `*.tmp`, `temp.*`, `test-*.js`
- [ ] Pre-commit hook runs ESLint with `--max-warnings 0`
- [ ] Pre-commit hook runs `npm run validate-prompts` (checks variable uniqueness)
- [ ] Hook can be bypassed with `--no-verify` for emergency hotfixes
- [ ] Installation: `npm run prepare` sets up Husky

**Impact**: Enforces Principle VII (Code Cleanliness)

---

### User Story 5: Prompt Audit Automation (Priority: P3)

**As a** team lead  
**I want** automated prompt audits in CI/CD  
**So that** agent prompt quality is continuously validated

**Acceptance Criteria**:
- [ ] Script `npm run audit:prompts` checks all prompts in `docs/prompts/`
- [ ] Validates: variable isolation, no duplicates, English-only output (except Safety)
- [ ] GitHub Action runs on every commit to main branch
- [ ] Failing audit blocks merge

**Impact**: Enforces Principle VIII (Prompt Context Integrity)

---

## Non-Functional Requirements

### Performance
- Variable validation adds <10ms overhead to prompt processing
- Pre-commit hook completes in <30 seconds for typical changes

### Security
- No new security implications (improves architectural security)

### Maintainability
- All validation logic centralized in PromptProcessorService
- Tests document expected behavior for future developers

### Compatibility
- Backward compatible: existing workspaces with explicit debugMode unaffected
- Migration path: seed script sets explicit values for test workspaces

---

## Success Metrics

- [ ] All unit tests pass with new validation
- [ ] Integration tests verify delegation flow
- [ ] Pre-commit hook installed on all dev machines
- [ ] CI/CD pipeline includes prompt audits
- [ ] Zero production failures from duplicate variables (90 days post-deploy)

---

## Out of Scope

- Refactoring existing agent prompts (separate effort)
- UI for debug mode configuration (future enhancement)
- Distributed locking for multi-instance deployments (future)
- Agent architecture diagram (documentation task)
