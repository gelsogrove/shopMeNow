# LLM Router Unification - Feature Specification

**Status**: SPECIFICATION  
**Branch**: `feature/routing-unification`  
**Epic**: Consolidate routing logic, remove duplications, single source of truth

---

## 📋 Overview

The chatbot currently has **three parallel layers** making routing decisions:
1. **ChatEngine** - Intent detection + simple routing
2. **RouterOrchestrationService** - Strategy selection (redundant)
3. **LLMRouterService** - Specialist agent coordination

**Problem**: Duplicated logic, unclear responsibilities, hard to maintain and test.

**Solution**: Consolidate into **single UnifiedRoutingService** with clean handler pattern.

---

## 🎯 Functional Requirements

### FR1: Unified Intent Detection
- **WHAT**: Single pipeline for detecting user intent
- **HOW**: Pattern → Keyword → LLM-based decision
- **IMPACT**: Replace scattered intent detection logic
- **Acceptance**: One `detectIntent()` method in UnifiedRoutingService

### FR2: Route Path Selection
- **WHAT**: Decide routing path based on workspace config
- **Paths**: 
  - SIMPLE (pattern/keyword matches)
  - LLM (unknown/complex intents)
  - FAQ (informational workspaces)
- **IMPACT**: Replace RouterOrchestrationService logic
- **Acceptance**: One `selectRoutingPath()` method

### FR3: Workspace-Aware Data Loading
- **WHAT**: Load products/FAQs/services based on workspace type
- **Constraint**: Only one workspace load per message
- **Constraint**: Only one data load per message
- **IMPACT**: Performance + clarity
- **Acceptance**: One `loadDataForIntent()` method

### FR4: Handler Pattern for Intent Processing
- **WHAT**: Route intents to appropriate handlers
- **SimpleIntentHandler**: Pattern/keyword matches → deterministic response
- **LLMIntentHandler**: Unknown intents → delegate to LLMRouterService
- **IMPACT**: Clear separation of concerns
- **Acceptance**: Both handlers implement same interface

### FR5: Centralized Routing Logs
- **WHAT**: All routing decisions logged in one place
- **FORMAT**: Structured logs with decision context
- **IMPACT**: Production debugging, audit trail
- **Acceptance**: Logs in UnifiedRoutingService, others cleaned up

### FR6: Zero Duplicate Data Queries
- **WHAT**: No repeated prisma queries for same data
- **CONSTRAINT**: Workspace loaded once
- **CONSTRAINT**: Products/FAQs loaded once
- **CONSTRAINT**: Services/offers loaded once
- **IMPACT**: Database efficiency
- **Acceptance**: Verified in tests

### FR7: Multilingua Support Maintained
- **WHAT**: All responses still translated
- **CONSTRAINT**: No hardcoded strings in new code
- **CONSTRAINT**: All from DB/templates
- **IMPACT**: Support 5+ languages
- **Acceptance**: Webhook test in different languages

### FR8: LLMRouterService Unchanged
- **WHAT**: Specialist agent coordinator remains as-is
- **CONSTRAINT**: No modifications to business logic
- **CONSTRAINT**: Only called from LLMIntentHandler
- **IMPACT**: Minimal risk, proven working
- **Acceptance**: LLMRouterService code identical before/after

---

## 🏗️ Non-Functional Requirements

### NFR1: Type Safety
- **Target**: TypeScript `--strict` mode compliant
- **Metric**: Zero compilation errors
- **Enforcement**: CI gate

### NFR2: Test Coverage
- **Target**: >80% on routing logic
- **Metric**: Coverage report from Jest
- **Enforcement**: Merge blocker if <80%

### NFR3: Performance
- **Target**: No regression vs current system
- **Metric**: Response time, database queries per message
- **Baseline**: TBD (measure before/after)

### NFR4: Code Quality
- **Target**: Max 500 lines per file
- **Metric**: Linter + manual review
- **Enforcement**: Auto-extract if exceeded

### NFR5: Workspace Isolation
- **Target**: Zero workspace data bleeding
- **Metric**: All queries filter by `workspaceId`
- **Test**: Integration test with 2+ workspaces

---

## 👥 User Stories

### US1: Handler Pattern Clarity
**As a** developer  
**I want** clear, separated handlers for different intent types  
**So that** I can easily understand and extend the routing logic

**Acceptance Criteria**:
- SimpleIntentHandler handles only pattern/keyword intents
- LLMIntentHandler handles only unknown intents
- Both follow same interface
- Easy to add new handler types

### US2: Single Routing Decision Point
**As a** developer  
**I want** one place to understand how routing decisions are made  
**So that** I don't have to search through three different files

**Acceptance Criteria**:
- UnifiedRoutingService is single source of truth
- RouterOrchestrationService marked deprecated
- All routing logic consolidated
- Logs show complete routing path

### US3: Reliable Multilingua
**As a** customer  
**I want** to receive responses in my language  
**So that** I understand the chatbot

**Acceptance Criteria**:
- All responses translated correctly
- No hardcoded strings in new code
- Works for IT, EN, ES, PT (at minimum)
- Translation happens consistently

### US4: Performance Maintained
**As a** system  
**I want** routing to be efficient  
**So that** users get responses quickly

**Acceptance Criteria**:
- No duplicate database queries
- Response time ≤ baseline
- No n+1 query problems
- Cache used appropriately

---

## 📊 Success Criteria

| Criterion | Metric | Target | Verification |
|-----------|--------|--------|--------------|
| Code Quality | TypeScript errors | 0 | CI: `tsc --noEmit` |
| Test Coverage | Routing logic | >80% | Jest coverage report |
| Performance | Response time | ≤ baseline | Load test results |
| Functionality | Handler routes | 100% correct | Integration tests |
| Security | Workspace isolation | Zero bleeding | Multi-workspace tests |
| Maintenance | Single routing POI | 1 service | Code review |
| Documentation | Completeness | All handlers documented | Review docs |

---

## 📊 Key Entities

### UnifiedRoutingService
- Responsibilities: Intent detection, path selection, data loading, logging
- Methods: `detectIntent()`, `selectRoutingPath()`, `loadDataForIntent()`, `getWorkspace()`, `logRoutingDecision()`

### SimpleIntentHandler
- Responsibilities: Handle pattern/keyword matched intents
- Input: Intent (type SHOW_PRODUCTS, ADD_TO_CART, etc.)
- Output: Italian response

### LLMIntentHandler
- Responsibilities: Delegate unknown intents to LLMRouter
- Input: Intent (type INCOMPREHENSIBLE)
- Output: Italian response from specialist agents

### RoutingContext
- Message, conversationHistory, workspace, customerId, conversationId

### RoutingDecision
- Intent, path, workspace, confidence, source

---

## 🚫 Out of Scope

- ❌ Changing LLMRouterService (specialist agents)
- ❌ Changing Translation Layer
- ❌ Changing database schema
- ❌ Changing WebhookController
- ❌ New features (only refactoring)

---

## 🔒 Constraints

- **Timeline**: 2-3 days implementation
- **Risk**: Medium (refactoring core logic, but LLMRouter untouched)
- **Testing**: All integration scenarios required before merge
- **Rollback**: Have git branches ready for quick revert

---

## 📝 Assumptions

1. LLMRouterService is production-ready and shouldn't change
2. Translation Layer works correctly (no regression expected)
3. Current test suite provides baseline performance
4. Database schema stays the same
5. Webhook format unchanged

---

## 🎬 Next Phase

→ **speckit.clarify**: Resolve any ambiguities  
→ **speckit.plan**: Create detailed implementation plan

---
