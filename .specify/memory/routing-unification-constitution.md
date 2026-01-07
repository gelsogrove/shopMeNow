# LLM Router Unification - Project Constitution

**Feature**: Routing Orchestration Consolidation  
**Branch**: `feature/routing-unification`  
**Created**: January 7, 2026

---

## 🎯 CORE PRINCIPLES

### Principle 1: Single Source of Truth for Routing
- **MUST**: One unified orchestrator decides all routing paths
- **MUST**: No duplicate logic across ChatEngine, RouterOrchestrationService, LLMRouter
- **IMPACT**: Prevents divergence bugs, easier to test, maintainable
- **VIOLATION**: Finding two implementations of intent detection → REJECT

### Principle 2: Handler Pattern for Extensibility
- **MUST**: All intent handling goes through defined handlers (SimpleIntentHandler, LLMIntentHandler)
- **MUST**: New intent types = new handler method, NOT scattered business logic
- **IMPACT**: Clear responsibility boundaries, easy to add features
- **VIOLATION**: Hardcoded intent logic in ChatEngine → REJECT

### Principle 3: Zero Duplicate Data Loads
- **MUST**: Workspace config loaded ONCE per message
- **MUST**: Products/FAQs/Services loaded ONCE per message
- **IMPACT**: Performance, database efficiency
- **VIOLATION**: Multiple `prisma.workspace.findUnique()` calls → REJECT

### Principle 4: LLMRouterService Untouched
- **MUST**: LLMRouterService remains exactly as-is (specialist coordinator)
- **MUST**: Only refactor ChatEngine → calls LLMRouterService as before
- **IMPACT**: Minimal risk, proven working system
- **VIOLATION**: Modifying LLMRouterService logic → REJECT

### Principle 5: Translation Layer Unchanged
- **MUST**: All responses still pass through Translation Layer (STEP 2 in ChatEngine.routeMessage)
- **MUST**: No hardcoded strings in handlers (all Italian by default)
- **IMPACT**: Multilingua support maintained
- **VIOLATION**: Missing translation call → REJECT

### Principle 6: Workspace Isolation Critical
- **MUST**: All queries filter by `workspaceId`
- **MUST**: E-commerce vs Informational workspaces properly routed
- **IMPACT**: Multi-tenant security
- **VIOLATION**: Query without `workspaceId` → REJECT

### Principle 7: Centralized Logging
- **MUST**: All routing decisions logged in UnifiedRoutingService
- **MUST**: Remove/cleanup debug logs from old orchestrators
- **IMPACT**: Production debugging, audit trail
- **VIOLATION**: Scattered logging → REJECT

### Principle 8: Tests First, Then Code
- **MUST**: Unit tests written BEFORE implementing handlers
- **MUST**: Integration tests cover all routing scenarios
- **MUST**: >80% coverage on routing logic
- **IMPACT**: Confidence in refactoring, catch regressions
- **VIOLATION**: Code without tests → REJECT

### Principle 9: No Hardcoded Strings
- **MUST**: All user-facing text from DB/templates
- **MUST**: No language-specific constants in code
- **IMPACT**: True multilingua support
- **VIOLATION**: Hardcoded "Ciao", "Hello", etc. → REJECT

### Principle 10: Type Safety Strict
- **MUST**: TypeScript `--strict` mode compliant
- **MUST**: No `any` types in interfaces (except internal utilities)
- **MUST**: All Intent types properly mapped to handlers
- **IMPACT**: Compile-time error prevention
- **VIOLATION**: TypeScript errors on merge → REJECT

---

## ✅ ACCEPTANCE CRITERIA

### Code Quality
- [ ] Zero TypeScript compilation errors (`tsc --noEmit`)
- [ ] All 10 principles validated
- [ ] Code follows project conventions
- [ ] No TODO/FIXME comments left behind
- [ ] File sizes <500 lines (extract if larger)

### Architecture
- [ ] RouterOrchestrationService marked DEPRECATED
- [ ] UnifiedRoutingService single point for routing
- [ ] SimpleIntentHandler handles pattern/keyword intents
- [ ] LLMIntentHandler delegates to LLMRouterService
- [ ] All handlers follow same interface

### Testing
- [ ] Unit tests: Intent detection, path selection, data loading
- [ ] Integration tests: End-to-end routing scenarios
- [ ] Security tests: Workspace isolation verification
- [ ] Coverage: >80% on routing logic
- [ ] Webhook test: Message flows correctly

### Performance
- [ ] No performance regression (baseline TBD)
- [ ] Single workspace load per message
- [ ] Single data load per message
- [ ] Caching works properly

### Documentation
- [ ] Code comments explain WHY, not WHAT
- [ ] Handler pattern documented
- [ ] Routing flow diagram ASCII
- [ ] Migration notes for deprecated service

---

## 🚫 ANTI-PATTERNS (FORBIDDEN)

❌ **Duplicate Intent Detection**
- No second `intentParser.parse()` call
- No second LLM routing decision in different service

❌ **Multiple Workspace Loads**
- Only one `prisma.workspace.findUnique()` per message
- Use caching if needed

❌ **Hardcoded Intent Names**
- Switch statements must match actual Intent.type values
- No "SEARCH" when actual type is "SHOW_PRODUCTS"

❌ **Scattered Business Logic**
- No intent handling in ChatEngine.processMessageInternal() directly
- All goes through handlers

❌ **Skip Translation Layer**
- All responses MUST pass through TranslationAgent
- No shortcuts to final response

❌ **RouterOrchestrationService Still Used**
- Mark as DEPRECATED
- Move logic to UnifiedRoutingService

---

## 📋 DEFINITION OF DONE

A task is DONE when:

1. ✅ Code written per principles
2. ✅ Tests passing (unit + integration)
3. ✅ No TypeScript errors
4. ✅ All acceptance criteria met
5. ✅ Documentation updated
6. ✅ Webhook tested
7. ✅ Reviewed by team (commit ready, Andrea pushes)

---

## 🔍 VALIDATION GATES

### Before Implementation
- [ ] Constitution reviewed ✅
- [ ] Plan finalized ✅
- [ ] Branch created ✅

### Before Testing
- [ ] Code compiles ✅
- [ ] All 3 new services created ✅
- [ ] No TypeScript errors ✅

### Before Merge
- [ ] All tests passing ✅
- [ ] Webhook verified ✅
- [ ] No hardcoded strings ✅
- [ ] Logging clean ✅
- [ ] Performance verified ✅

---

## 📚 REFERENCE

**Files to Change**:
- `apps/backend/src/application/services/unified-routing.service.ts` (CREATE)
- `apps/backend/src/application/chat-engine/handlers/simple-intent.handler.ts` (CREATE)
- `apps/backend/src/application/chat-engine/handlers/llm-intent.handler.ts` (CREATE)
- `apps/backend/src/application/chat-engine/handlers/index.ts` (CREATE)
- `apps/backend/src/application/chat-engine/chat-engine.service.ts` (REFACTOR)
- `apps/backend/src/services/router-orchestration.service.ts` (MARK DEPRECATED)

**Files to Keep Unchanged**:
- `apps/backend/src/services/llm-router.service.ts` ← UNCHANGED
- `apps/backend/src/application/agents/TranslationAgent.ts` ← UNCHANGED
- `apps/backend/src/application/layers/ConversationHistoryLayer.ts` ← UNCHANGED
- All specialist agents (ProductSearch, Cart, Order, etc.) ← UNCHANGED

---

## 🎬 NEXT STEPS

1. ✅ Constitution approved
2. → Create spec.md (WHAT we're doing)
3. → Run speckit.specify
4. → Run speckit.clarify
5. → Run speckit.plan
6. → Implementation per plan
7. → Testing
8. → Webhook verification
9. → Code review + commit

---
