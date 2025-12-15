<!--
  SYNC IMPACT REPORT

  Version Change: 2.1.0 → 2.2.0 (MINOR)
  Rationale: Added Principle XV "User Context Freedom" - CRITICAL architectural principle that users can switch conversation context at ANY time. Text input = fresh context (reset state). Number input = use previous context (list selection).
  Date: 2025-12-15

  Modified Principles:
  - ADDED Principle XV: User Context Freedom (MUST - CRITICAL)
    - Users can change context mid-conversation at ANY moment
    - TEXT input → Reset FSM state to IDLE, clear optionsMapping
    - NUMBER input → Use previous context (list selection)
    - NO hardcoded phrase detection (only yes/no/numbers allowed)
    - Intent Parser handles fresh context interpretation

  Added Sections:
  - Principle XV: User Context Freedom
    - Input Classification: text vs number (only regex allowed)
    - State Reset Pattern: clearMapping + setState(IDLE)
    - Implementation in ChatEngine STEP 0.55
    - Examples: product list → service question → reset state
    - Anti-patterns: NO hardcoded if/regex/include for phrases

  Templates Requiring Updates:
  - ✅ `pattern-matcher.ts` - Already minimal (only numeric matching)
  - ✅ `chat-engine.service.ts` - STEP 0.55 added for state reset
  - ⚠️ `message-preprocessor.service.ts` - Verify inputType detection

  ---

  Version Change: 2.0.0 → 2.1.0 (MINOR)
  Rationale: Added Principle XIV "Context Interpretation Pattern" - CRITICAL pattern for Router Agent to interpret short customer responses ("SI", "NO", "1") by reading conversation history and converting them to explicit messages for specialist agents
  Date: 2025-11-16

  Modified Principles:
  - ADDED Principle XIV: Context Interpretation Pattern (MUST - CRITICAL)
    - Router reads last 3 messages from history when customer sends short responses (≤5 chars)
    - Extracts context from assistant's last question/action
    - Builds explicit, self-contained message for specialist agent
    - Applies to ALL agents: CART_MANAGEMENT, ORDER_TRACKING, PRODUCT_SEARCH, PROFILE_MANAGEMENT, NOTIFICATIONS, CUSTOMER_SUPPORT

  Added Sections:
  - Principle XIV: Context Interpretation Pattern
    - Pattern Requirements: Trigger conditions (≤5 chars, matches pattern)
    - Router Prompt Logic: Examples for all agent types (Cart, Notifications, Product, Order, Profile)
    - Implementation Pattern: Router LLM outputs `contextualizedMessage` in JSON
    - Test Coverage: Unit tests for ALL agents with short response scenarios
    - Edge Cases: Non-short responses, ambiguous history, multiple questions
    - Compliance Checklist: Pre-deployment validation steps

  Templates Requiring Updates:
  - ⚠️ `docs/prompts/router-agent-CLEAN.md` - Add Context Interpretation section with examples (NEXT PHASE)
  - ⚠️ `backend/src/application/services/llm-router.service.ts` - Use contextualizedMessage instead of original message
  - ⚠️ `backend/__tests__/unit/services/llm-router-context.spec.ts` - Add test coverage for all agents

  Follow-up TODOs:
  - Phase 1: ✅ Constitution updated with Principle XIV (v2.1.0)
  - Phase 2: Create `docs/prompts/router-agent-CLEAN.md` with context interpretation logic
  - Phase 3: Update NotificationsAgent, ProfileManagementAgent prompts
  - Phase 4: Backend implementation (routerDecision.contextualizedMessage)
  - Phase 5: Test coverage for all agents (Cart, Order, Product, Profile, Notifications)
  - Phase 6: Production validation (error rate should drop from ~15% to <2%)

  Breaking Changes:
  - NONE (additive change - new pattern for Router Agent)

  Migration Plan:
  - Phase 1: ✅ Constitution update (completed in this version)
  - Phase 2: Router Agent prompt refactoring (router-agent-CLEAN.md creation)
  - Phase 3: Specialist agent prompts (Notifications, Profile Management)
  - Phase 4: Backend implementation (contextualizedMessage usage)
  - Phase 5: Test coverage (all agents + edge cases)
  - Phase 6: Deploy + monitor error rates

  Version Change: 1.5.0 → 1.5.1 (PATCH)
  Rationale: Added "Example Products Prevention" rule to Principle III - prevents LLM hallucination by warning against copying fake product names from prompt examples
  Date: 2025-11-13

  Modified Principles:
  - Principle III: Variable Replacement
    - Added new sub-section "Example Products Prevention (MUST - NON-NEGOTIABLE)"
    - Critical fix for production issue: LLMs were inventing products by copying example names from prompts

  Added Sections:
  - Principle III.4: Example Products Prevention
    - Warning requirement: ALL agent prompts need "⚠️ EXAMPLE PRODUCTS ARE FAKE" header
    - Generic placeholders: Use [PRODUCT_NAME] instead of real-looking names
    - "Maximum 5" clarification: It's a limit, not a target (show what exists, don't invent)
    - Testing: validate-agent-prompts.ts checks for suspicious patterns

  Removed Sections:
  - NONE

  Templates Requiring Updates:
  - ⚠️ ALL agent prompts (docs/prompts/*.md): Add warning box at top
  - ⚠️ plan-template.md: Add LLM hallucination prevention section
  - ⚠️ spec-template.md: Add "Example validation" acceptance criteria
  - ⚠️ tasks-template.md: Add prompt example sanitization tasks

  Follow-up TODOs:
  - ✅ Update ProductSearchAgent prompt with warning box
  - ✅ Replace fake examples (Salame Toscano) with placeholders ([PRODUCT_NAME])
  - ✅ Add explicit instruction: "NEVER copy from examples"
  - ✅ Update database with corrected prompts
  - Manual test: Verify "avete salami?" returns only real products from database
  - Add automated test: Script checks response doesn't contain example product names
```
  - Add ESLint rule to detect hardcoded agent responses (violation of Database-First principle)

  Version Change: 1.5.1 → 1.6.0 (MINOR)
  Rationale: Added Principle VIII "Conversational Memory Invalidation" - critical fix for LLM showing incomplete product lists due to stale cache
  Date: 2025-11-13

  Version Change: 1.6.0 → 1.7.0 (MINOR)
  Rationale: Added Principle IX "Message Flow Timeline Integrity" - CRITICAL architectural principle ensuring debug timeline mirrors actual LLM execution
  Date: 2025-11-13

  Version Change: 1.7.0 → 1.8.0 (MINOR)
  Rationale: Added Principle X "Validation-Only Router Pattern" - PERFORMANCE optimization saving 25% tokens (~5000 per request) by skipping Router LLM call when specialist response is valid
  Date: 2025-11-13

  Modified Principles:
  - ADDED Principle X: Validation-Only Router Pattern (SHOULD - PERFORMANCE)
    - Router validates specialist responses without LLM call when validation passes
    - Saves ~5000 tokens per request (25% reduction) + 800ms latency
    - Agent-specific validation rules (if/else logic, no LLM)
    - Transparent in debug timeline: "Router Agent (validation-only)" with tokenUsage: 0

  Added Sections:
  - Principle X: Validation-Only Router Pattern
    - Validation Method: validateSubAgentResponse() with if/else rules (no LLM)
    - Flow Decision Tree: Valid → skip LLM (save 5000 tokens), Invalid → Router LLM call
    - Debug Timeline: Validation-only step with tokenUsage: 0
    - Performance Metrics: 25% token savings, $680/year cost reduction, 800ms latency improvement

  Version Change: 1.8.0 → 1.9.0 (MINOR)
  Rationale: Added Principle XI "Real-Time WebSocket Communication" - CRITICAL architectural enhancement enabling instant chat updates, customer blocking notifications, and new session alerts
  Date: 2025-11-14

  Modified Principles:
  - ADDED Principle XI: Real-Time WebSocket Communication (MUST - CRITICAL)
    - All chat operations emit WebSocket events to workspace room
    - Frontend invalidates React Query cache on WebSocket events
    - Toast notifications for background events (new messages, blocking)
    - Connection status indicator for user awareness

  Added Sections:
  - Principle XI: Real-Time WebSocket Communication
    - Event Types: new-message, chat-updated, user-blocked, user-unblocked, new-customer
    - Backend Emit Pattern: websocketService.notifyNewMessage() after DB save
    - Frontend Pattern: useWebSocket hook + React Query invalidation
    - Chat List Synchronization: Page reload on WhatsApp popup close (guarantees fresh data)
    - Room Architecture: workspace:${workspaceId} isolation

  Version Change: 1.9.0 → 1.9.1 (PATCH)
  Rationale: Enhanced Principle VII "Code Cleanliness" with MANDATORY Task Closure Checklist - ensures cleanup executed EVERY time a task completes (not optional)
  Date: 2025-11-14

  Modified Principles:
  - ENHANCED Principle VII: Code Cleanliness & Technical Debt Prevention
    - Added "Task Closure Checklist" section (5-step mandatory workflow)
    - Pre-commit hook now rejects `check-*.ts` temporary scripts
    - Explicit requirement: ALL scripts in `backend/scripts/` MUST be in package.json
    - Added verification commands: `find . -name "*.backup*"` must return empty

  Modified Sections:
  - Principle VII: Enforcement
    - Added `check-*.ts` to pre-commit hook rejection patterns
    - Added requirement: temporary scripts in `backend/scripts/` not in package.json
    - New subsection: "Task Closure Checklist" (MANDATORY workflow)
      - 5 steps: Code Cleanup → Constitution Update → Documentation → Verification → Commit Prep
      - Explicit command examples for verification
      - DO NOT PUSH reminder (user does manually)

  Templates Requiring Updates:
  - ✅ `.github/prompts/speckit.constitution.prompt.md` - Already references task closure workflow
  - ⚠️ `.specify/templates/tasks-template.md` - Add final task: "Execute Task Closure Checklist"
  - ⚠️ `docs/CONTRIBUTING.md` - Add task closure workflow documentation (if file exists)

  Follow-up TODOs:
  - ✅ Deleted 20 temporary scripts from backend/scripts/ (test-*.ts, check-*.ts)
  - ✅ Verified: Only 5 production scripts remain (all in package.json)
  - ✅ Constitution v1.9.1 enforces this cleanup EVERY task completion
  - Consider: Add pre-commit hook to automatically reject temporary files
  - Consider: GitHub Actions workflow to validate scripts/ directory on PR
  - ADDED Principle VIII: Conversational Memory Invalidation
    - Memory cache in searchConversations table must be cleared when returning stale/incomplete data
    - Root cause discovery: LLM showed 4/5 DOP cheeses because searchConversations cached old filter results
    - Solution: Clear session memory before re-querying to force fresh product lookup
  - ADDED Principle IX: Message Flow Timeline Integrity (CRITICAL)
    - Every LLM agent call MUST have corresponding debugStep push to timeline
    - NO hardcoded responses ANYWHERE - all responses through LLM with full debug tracking
    - Timeline MUST be 1:1 mirror of actual execution flow
    - Disalignment causes complete loss of observability and debugging capability

  Added Sections:
  - Principle VIII: Conversational Memory Invalidation (CRITICAL)
    - When to invalidate: Incomplete lists, count mismatch, stale data symptoms
    - How to invalidate: `searchConversations.deleteMany({ where: { sessionId } })`
    - Testing: test-cheese-count.ts validates count accuracy after memory clear
    - Prevention: Consider TTL expiration or product version tracking
  - Principle IX: Message Flow Timeline Integrity (MUST - NON-NEGOTIABLE)
    - 1:1 Mapping Rule: Every LLM call = ONE debugStep push (no exceptions)
    - Zero Hardcoded Responses: ALL responses MUST go through LLM with systemPrompt tracking
    - Timeline Verification: Before merging, validate timeline shows ALL agent interactions
    - Push Location: Add debugStep IMMEDIATELY after specialist agent returns (in functionCallingLoop)

  Follow-up TODOs:
  - ✅ Verified solution: Clearing searchConversations fixes 4/5 → 5/5 DOP cheese display
  - ✅ Test passed: test-cheese-count.ts shows all 5 products including Taleggio
  - ⚠️ CRITICAL: Audit ALL llm-router.service.ts flows to ensure no response skips debugStep push
  - ⚠️ CRITICAL: Remove ANY remaining hardcoded response shortcuts that bypass timeline tracking
  - ⚠️ Add automated test: Verify debugInfo.steps.length matches actual LLM calls count
  - Consider: Automatic cache invalidation on product updates
  - Consider: TTL-based expiration (currently 10 minutes)
  - Consider: Version tracking (invalidate if product catalog version changes)

  Version Change: 1.9.1 → 1.10.0 (MINOR)
  Rationale: Added Principle XII "Server Auto-Restart Prevention" - CRITICAL operational rule preventing AI from manually restarting dev servers (hot-reload handles this automatically)
  Date: 2025-11-14

  Version Change: 1.10.0 → 2.0.0 (MAJOR)
  Rationale: Added Principle XIII "LLM Message Flow Priority System" - CRITICAL architectural foundation consolidating Andrea's 12 core rules into constitution authority. This is a MAJOR version because it fundamentally redefines LLM architecture requirements.
  Date: 2025-11-15

  Modified Principles:
  - ADDED Principle XIII: LLM Message Flow Priority System (MUST - CRITICAL)
    - Rule 1: Blocked User Gate (P1) - isBlocked=true → zero response
    - Rule 2: Channel Disabled Gate (P2) - challengeStatus=false → WIP message
    - Rule 3: New Customer Welcome (P3) - first message → welcome message
    - Rule 4: Router Orchestration (P4) - delegation to specialist agents
    - Rule 5: Router Conversation History - full session context
    - Rule 6: Product + Services Unified - single agent for both
    - Rule 7: Variable Uniqueness - enforces Principle III (no duplication)
    - Rule 8: Router Pure Orchestration - NO dialogue logic (3,500 token target)
    - Rule 9: Security Gate FIRST - validation BEFORE priorities
    - Rule 10: Timeline Integrity - enforces Principle IX (debug observability)
    - Rule 11: Single Product Display - all fields mandatory
    - Rule 12: addToCart(PRODUCT/SERVICE) - unified cart handling

  Added Sections:
  - Principle XIII: Complete 12-rule framework with:
    - Priority flow diagram (Security → P1 → P2 → P3 → P4)
    - Implementation patterns for each rule
    - Test coverage requirements
    - Compliance checklist (pre-deployment validation)
    - Cross-references to existing principles (III, VIII, IX)

  Removed Sections:
  - NONE

  Templates Requiring Updates:
  - ⚠️ `docs/prompts/router-agent.md` - Remove {{services}}, strip to 3k tokens (Rule 7, 8)
  - ⚠️ `docs/prompts/product-search-agent.md` - Rename to `product-services-search-agent.md` (Rule 6)
  - ⚠️ `backend/src/interfaces/http/controllers/whatsapp-webhook.controller.ts` - Add Security Gate (Rule 9)
  - ⚠️ `backend/prisma/data/defaultAgents.ts` - Fix agent name (Rule 6)
  - ⚠️ `backend/src/__tests__/unit/services/llm-router-priorities.spec.ts` - Add welcome message test (Rule 3)

  Follow-up TODOs:
  - ❌ **CRITICAL**: Fix {{services}} duplication (Rule 7) - currently in Router + ProductSearch
  - ❌ **CRITICAL**: Strip Router from 8k to 3k tokens (Rule 8) - remove tone/examples
  - ❌ **CRITICAL**: Rename agent "Product & Services Search Agent" (Rule 6)
  - ❌ **CRITICAL**: Add Security Gate BEFORE priorities (Rule 9) - SQL/XSS validation
  - ⚠️ **HIGH**: Add welcome message unit test (Rule 3)
  - ⚠️ **HIGH**: Verify addToCart SERVICE handling in backend (Rule 12)
  - ⚠️ **MEDIUM**: Add product display field validation (Rule 11)
  - Manual test: Verify all 12 rules enforced in production deployment
  - Update PRD.md to reference Principle XIII as source of truth for LLM architecture

  Breaking Changes:
  - Router Agent role fundamentally redefined (orchestration only, NOT dialogue)
  - Product Search Agent becomes "Product & Services Search" (name change)
  - Security validation now MANDATORY first step (architecture change)
  - {{services}} variable MUST be removed from Router (breaks existing prompts)

  Migration Plan:
  - Phase 1: Update constitution (✅ completed in this version)
  - Phase 2: Create detailed implementation plan with code analysis
  - Phase 3: Execute changes (prompt refactoring, security gate, tests)
  - Phase 4: Validate with checklist + deploy

---

# Project Constitution

**Version**: 2.0.0 | **Ratified**: 2025-11-12 | **Last Amended**: 2025-11-15

  Modified Principles:
  - ADDED Principle XII: Server Auto-Restart Prevention (MUST - NON-NEGOTIABLE)
    - AI MUST NEVER run commands like `npm run dev`, `pkill -f`, or restart backend/frontend
    - Hot-reload automatically detects file changes (ts-node-dev for backend, Vite for frontend)
    - Manual restarts create race conditions, duplicate processes, port conflicts
    - Only exception: Database container restart if connection fails

  Added Sections:
  - Principle XII: Server Auto-Restart Prevention
    - Forbidden Commands: `npm run dev`, `npm start`, `pkill`, process kill commands
    - Hot-Reload Tools: ts-node-dev (backend), Vite (frontend) - automatic file watching
    - Exception Handling: Database issues only - verify with `docker ps` first
    - Verification: Check `lsof -i :PORT` before assuming server down

  Templates Requiring Updates:
  - ⚠️ `.github/copilot-instructions.md` - Add "Server Auto-Restart" critical rule #3
  - ⚠️ `.specify/templates/plan-template.md` - Add "Server management" anti-pattern warning
  - ⚠️ `.github/prompts/` - All command prompts should warn against manual server restarts

  Follow-up TODOs:
  - Update `.github/copilot-instructions.md` with explicit "MAI riavviare server" warning
  - Add to common mistakes section: Manual restart loops, port conflicts, duplicate processes
  - Consider: Add ESLint comment blocker for terminal commands containing "npm run dev"
  - Document hot-reload behavior: Backend ~2s compile, Frontend instant HMR
-->

# eChatbot Constitution

**Version**: 2.1.0 (MINOR - Context Interpretation Pattern)  
**Last Updated**: 2025-11-16

## Core Principles

### I. Database-First (MUST - NON-NEGOTIABLE)

**ALL configuration, prompts, and translations MUST come from the database.**

**Requirements**:

- ❌ **ZERO hardcoded fallbacks** - No default values, placeholder prompts, or mock data in production code
- ❌ **ZERO static constants** - Agent prompts, system messages, product data ONLY from `agentConfig`, `products`, `categories` tables
- ✅ **Database as single source of truth** - `agentConfig.systemPrompt`, `agentConfig.triggerKeywords`, `workspace.settings`
- ✅ **Explicit error handling** - If data missing from DB → return proper error, log issue, NEVER invent defaults

**Examples**:

```typescript
// ❌ WRONG - Hardcoded fallback
const prompt = agentConfig?.systemPrompt || "You are a helpful assistant"

// ✅ CORRECT - Database-first with error
if (!agentConfig?.systemPrompt) {
  throw new Error(`Missing systemPrompt for agent ${agentType}`)
}
const prompt = agentConfig.systemPrompt
```

**Rationale**: Multi-workspace system requires dynamic configuration per workspace. Hardcoded values break tenant isolation and prevent runtime customization.

**Enforcement**:

- Code reviews MUST verify no hardcoded prompts/configs
- Integration tests MUST verify database dependency
- Seed script MUST populate ALL required configuration

---

### II. Workspace Isolation (MUST - NON-NEGOTIABLE)

**ALL database queries MUST filter by `workspaceId` for multi-tenant security.**

**Requirements**:

- ✅ **Mandatory filter pattern**: `where: { workspaceId, ...otherFilters }`
- ✅ **Middleware extraction**: `workspaceValidationMiddleware` sets `(req as any).workspaceId`
- ✅ **Repository layer**: ALL Prisma queries include workspace filter
- ❌ **NO global queries** - Never query across workspaces (except system admin operations)

**Examples**:

```typescript
// ❌ WRONG - Missing workspace filter
const products = await prisma.products.findMany({
  where: { isActive: true },
})

// ✅ CORRECT - Workspace isolated
const workspaceId = (req as any).workspaceId
const products = await prisma.products.findMany({
  where: { workspaceId, isActive: true },
})
```

**Rationale**: Multi-tenant SaaS architecture. Data leakage between workspaces is CRITICAL security vulnerability.

**Enforcement**:

- Security tests MUST verify workspace isolation
- Code reviews MUST check workspace filter presence
- Middleware stack: `authMiddleware` → `sessionValidationMiddleware` → `validateWorkspaceOperation`

---

### III. Variable Replacement (MUST - NON-NEGOTIABLE)

**Agent prompts MUST use dynamic variables (`{{VARIABLE}}`), replaced at runtime with real data.**

**Requirements**:

- ✅ **Template syntax**: `{{nome}}`, `{{email}}`, `{{products}}`, `{{categories}}`, etc.
- ✅ **Runtime replacement**: `replaceAllVariables(prompt, context)` BEFORE LLM call
- ✅ **Base language: Italian** - Variables replaced with Italian text from database
- ✅ **LLM translation layer** - Final output translated to customer language (IT/ES/PT/FR/EN)
- ✅ **Variable Uniqueness Constraint** (CRITICAL) - See sub-section below

**Examples**:

```typescript
// Database prompt (Italian base):
"Ciao {{nome}}, abbiamo queste categorie: {{categories}}"

// Runtime replacement:
const prompt = replaceAllVariables(dbPrompt, {
  nome: customer.name,
  categories: getActiveCategories(workspaceId), // Italian from DB
})
// Result: "Ciao Andrea, abbiamo queste categorie: Formaggi, Salumi, Vini"

// LLM translates to customer language
// Spanish: "Hola Andrea, tenemos estas categorías: Quesos, Embutidos, Vinos"
```

**Rationale**: Dynamic prompts enable personalization, real-time product data, customer context. Static prompts cannot adapt to inventory changes or customer history.

**Enforcement**:

- `PromptProcessorService.replaceAllVariables()` MUST be called before LLM
- Code reviews MUST verify variable replacement
- NO static prompts in code - only in database `agentConfig` table

---

#### Variable Uniqueness Constraint (MUST - NON-NEGOTIABLE)

**The variables `{{products}}`, `{{offers}}`, `{{services}}`, `{{categories}}` MUST appear at most ONCE per prompt.**

**Requirements**:

- ❌ **ZERO duplicate usage** - Each large variable (products/offers/services/categories) can only appear ONCE in the same prompt
- ✅ **Token explosion prevention** - Prevents accidental duplication that causes 50k+ token prompts
- ✅ **Validation on save** - Admin UI MUST validate prompts before saving to `agentConfig`
- ✅ **Runtime detection** - `PromptProcessorService` MUST throw error if duplicates detected (prevents LLM API failure)

**Examples**:

```typescript
// ❌ WRONG - Duplicate {{products}} variable
const badPrompt = `
Ecco i nostri prodotti: {{products}}
...
Se vuoi vedere di nuovo, ecco i prodotti: {{products}}
`
// Result: Products list injected TWICE → 100k+ tokens → API failure

// ✅ CORRECT - Single usage of {{products}}
const goodPrompt = `
Ecco il nostro catalogo completo: {{products}}
Puoi chiedermi dettagli su qualsiasi prodotto.
`
// Result: Products list injected ONCE → ~50k tokens → works properly

// ✅ CORRECT - Multiple DIFFERENT variables allowed
const mixedPrompt = `
Categorie disponibili: {{categories}}
Offerte attive: {{offers}}
Prodotti in catalogo: {{products}}
`
// Result: Each variable used once → valid prompt
```

**Rationale**:

- `{{products}}` can contain 1000+ products → ~50k tokens per injection
- Duplicate usage → 100k+ tokens → exceeds LLM context window (128k for GPT-4-mini)
- Prevents accidental duplication in prompt templates
- Reduces API costs (fewer tokens = lower billing)

**Enforcement**:

- Admin UI prompt editor MUST validate before saving
- `PromptProcessorService.replaceAllVariables()` MUST throw error on duplicates (fail-fast pattern)
- Seed script validation: `npm run validate-prompts` checks all default prompts
- Integration tests MUST verify prompt validation rejects duplicates
- Code reviews MUST verify no manual prompt construction with duplicates

**Implementation Pattern**:

```typescript
// Validation function (MUST be added to PromptProcessorService)
private validatePromptVariables(prompt: string): void {
  const largeVariables = ["products", "offers", "services", "categories"]

  for (const variable of largeVariables) {
    const regex = new RegExp(`\\{\\{${variable}\\}\\}`, "g")
    const matches = prompt.match(regex)

    if (matches && matches.length > 1) {
      logger.warn(
        `[PromptValidation] ⚠️ Variable {{${variable}}} appears ${matches.length} times in prompt. Only first occurrence will be replaced.`
      )
      // Optionally: throw error in production to prevent invalid prompts
      throw new ValidationError(
        `Variable {{${variable}}} can only appear once per prompt. Found ${matches.length} occurrences.`
      )
    }
  }
}

// Usage in replaceAllVariables()
public async replaceAllVariables(
  promptContent: string,
  customerData: any,
  workspaceId: string,
  dynamicContent: { ... }
): Promise<string> {
  // STEP 1: Validate prompt before replacement
  this.validatePromptVariables(promptContent)

  // STEP 2: Replace variables (existing logic)
  let processedPrompt = promptContent
  // ... rest of replacement logic
}
```

---

#### Example Products Prevention (MUST - NON-NEGOTIABLE)

**LLMs MUST NOT copy product names from prompt examples - only from `{{products}}` variable.**

**Problem**: Agent prompts contain examples with fake product names (e.g., "Salame Toscano", "Parmigiano Reggiano 24 mesi"). LLMs can hallucinate and copy these examples instead of reading actual catalog data.

**Requirements**:

- ✅ **Warning at prompt start**: ALL agent prompts MUST have warning box: "⚠️ EXAMPLE PRODUCTS ARE FAKE - DON'T COPY THEM"
- ✅ **Generic placeholders**: Use `[PRODUCT_NAME]`, `[CATEGORY]` instead of real-looking names in examples
- ✅ **Explicit instruction**: "NEVER copy product names from examples - extract from {{products}} only"
- ✅ **"Maximum 5" clarification**: "Maximum 5 is a LIMIT (not a target) - if catalog has 2 products, show 2"
- ❌ **NO realistic fake examples**: Never use "Salame Milano 200g €6.80" in examples (LLM will copy it)

**Implementation Pattern**:

```markdown
# ProductSearchAgent Prompt

## ⚠️⚠️⚠️ CRITICAL WARNING ⚠️⚠️⚠️

**ALL EXAMPLE PRODUCTS IN THIS PROMPT ARE FAKE!**

Examples like "Parmigiano Reggiano", "Salame Toscano" are NOT in your catalog.

🚨 NEVER copy product names from examples
✅ ONLY use exact names from {{products}} variable
✅ IF catalog has 2 salami → show 2 (not 5 invented)

---

## Your Role

You help customers find products...

### Example Format (⚠️ Names are FAKE):
```

1. **[PRODUCT_NAME] [SIZE]** €[PRICE]
2. **[PRODUCT_NAME] [SIZE]** €[PRICE]

```

```

**Why This Matters**:

- LLMs have training data with real product names (Parmigiano, Mozzarella, etc.)
- If prompt examples use realistic names → LLM assumes they exist → hallucination
- Customer tries to select invented product → error (product not found in database)

**Testing**:

- Manual: Ask "avete salami?" and verify response only contains products from `{{products}}`
- Automated: Script `validate-agent-prompts.ts` checks for suspicious patterns

---

### IV. No Static Translations (MUST - NON-NEGOTIABLE)

**Categories, offers, products ALWAYS in Italian (base language) from database. LLM handles translation dynamically.**

**Requirements**:

- ✅ **Italian base**: `getActiveCategories()`, `getActiveOffers()` return Italian text
- ✅ **LLM Translation Layer**: Safety & Translation Agent translates final response
- ❌ **NO translation mappings**: Never create `{ it: "Formaggi", es: "Quesos", pt: "Queijos" }` dictionaries
- ❌ **NO hardcoded multilingual content**: All product names, descriptions in Italian only

**Examples**:

```typescript
// ❌ WRONG - Static translation mapping
const categoryTranslations = {
  formaggi: { it: "Formaggi", es: "Quesos", pt: "Queijos" },
}

// ✅ CORRECT - Italian from DB, LLM translates
const categories = await getActiveCategories(workspaceId) // ["Formaggi", "Salumi", "Vini"]
const prompt = `Categorie disponibili: ${categories.join(", ")}`
// LLM receives Italian, translates to customer language in final response
```

**Rationale**:

- Static mappings don't scale (5+ languages × 1000+ products = maintenance nightmare)
- LLM provides contextual, natural translations
- Database schema stays simple (single language column)
- Adding new language = configuration change, not code change

**Enforcement**:

- Database schema: product names, categories, offers in Italian only
- Translation happens at LLM layer (Safety & Translation Agent)
- Code reviews MUST reject static translation dictionaries

---

### V. 360-Degree Thinking (MUST - NON-NEGOTIABLE)

**ALL changes MUST consider the complete stack: FE → API → Middleware → Controller → Service → Repository → Database.**

**Requirements**:

- ✅ **Frontend-Backend Contract**: API parameter names, types, validation rules MUST match
- ✅ **Security Layer Verification**: Protected endpoints MUST have 3-layer middleware stack
  - `authMiddleware` (JWT validation)
  - `sessionValidationMiddleware` (x-session-id header)
  - `validateWorkspaceOperation` (x-workspace-id + param match)
- ✅ **HTTP Method Consistency**: GET (read), POST (create), PUT (update), DELETE (remove)
- ✅ **Database Impact Analysis**: Schema changes → migration → seed → repository → tests
- ✅ **Workspace Isolation Check**: ALL database queries MUST filter by `workspaceId`
- ❌ **NO partial implementations**: Cannot merge FE without BE, or API without security

**360-Degree Checklist** (MUST validate before committing):

```markdown
## Frontend Changes

- [ ] Component receives correct props/parameters
- [ ] API service calls match backend endpoint signature
- [ ] Error handling for all API failure cases
- [ ] Loading states for async operations
- [ ] Form validation matches backend validation rules

## Backend API Changes

- [ ] Route uses correct HTTP method (GET/POST/PUT/DELETE)
- [ ] Middleware stack complete (auth → session → workspace validation)
- [ ] Controller extracts workspaceId from middleware
- [ ] Swagger documentation updated with @swagger JSDoc tags
- [ ] Request/response types match frontend expectations

## Service Layer Changes

- [ ] Business logic uses workspace-isolated repositories
- [ ] Error handling with proper error types
- [ ] LLM calls use database prompts (no hardcoded)
- [ ] Variable replacement before LLM calls

## Repository/Database Changes

- [ ] ALL queries filter by workspaceId
- [ ] Migration created for schema changes (npx prisma migrate dev)
- [ ] Seed script updated if new tables/fields
- [ ] Prisma client regenerated (npx prisma generate)

## Testing Changes

- [ ] Unit tests for business logic (npm run test:unit)
- [ ] Security tests for workspace isolation (npm run test:security)
- [ ] Integration tests for API endpoints (npm run test:integration)
- [ ] Manual test via MCP server or curl if LLM-related
```

**Examples**:

```typescript
// ❌ WRONG - Only implemented frontend
// frontend/src/services/productApi.ts
export const deleteProduct = async (productId: string) => {
  await api.delete(`/products/${productId}`) // Backend endpoint doesn't exist!
}

// ✅ CORRECT - Full stack implementation
// 1. Database migration
// prisma/migrations/add_deleted_at/migration.sql
ALTER TABLE products ADD COLUMN deleted_at TIMESTAMP;

// 2. Repository layer
// backend/src/repositories/product.repository.ts
async softDelete(productId: string, workspaceId: string) {
  return this.prisma.products.update({
    where: { id: productId, workspaceId }, // Workspace isolation
    data: { deletedAt: new Date() }
  })
}

// 3. Service layer
// backend/src/application/services/product.service.ts
async deleteProduct(productId: string, workspaceId: string) {
  const product = await this.productRepo.findById(productId, workspaceId)
  if (!product) throw new NotFoundError("Product not found")
  return this.productRepo.softDelete(productId, workspaceId)
}

// 4. Controller
// backend/src/interfaces/http/controllers/product.controller.ts
async deleteProduct(req: Request, res: Response) {
  const workspaceId = (req as any).workspaceId // From middleware
  const { productId } = req.params
  await this.productService.deleteProduct(productId, workspaceId)
  return res.json({ success: true })
}

// 5. Route with security
// backend/src/interfaces/http/routes/product.routes.ts
/**
 * @swagger
 * /api/workspaces/{workspaceId}/products/{productId}:
 *   delete:
 *     summary: Soft delete a product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  "/:productId",
  authMiddleware, // JWT validation
  sessionValidationMiddleware, // Session check
  validateWorkspaceOperation, // Workspace isolation
  controller.deleteProduct.bind(controller)
)

// 6. Frontend service
// frontend/src/services/productApi.ts
export const deleteProduct = async (workspaceId: string, productId: string) => {
  const { data } = await api.delete(
    `/workspaces/${workspaceId}/products/${productId}`
  )
  return data
}

// 7. Frontend component
// frontend/src/components/ProductList.tsx
const handleDelete = async (productId: string) => {
  try {
    await productApi.deleteProduct(currentWorkspace.id, productId)
    toast.success("Product deleted")
    refetch() // Reload list
  } catch (error) {
    toast.error("Failed to delete product")
  }
}
```

**Database Change Trigger** (CRITICAL):

When touching database schema, ALWAYS execute this mental checklist:

1. **Migration**: `npx prisma migrate dev --name descriptive_name`
2. **Seed Update**: Add/modify test data in `prisma/seed.ts`
3. **Repository Layer**: Update queries with new fields/tables
4. **Entity/DTO**: Update TypeScript interfaces
5. **Service Layer**: Handle new fields in business logic
6. **API Validation**: Update request/response validation schemas
7. **Frontend Types**: Regenerate API types or update manually
8. **Tests**: Update fixtures, mocks, and assertions
9. **Swagger Docs**: Update API documentation with new fields

**Rationale**:

- 80% of bugs come from frontend-backend mismatches (wrong parameter names, missing validation)
- Security vulnerabilities arise from incomplete middleware stacks
- Database changes without migrations break production deployments
- Partial implementations create technical debt and integration issues

**Enforcement**:

- Code reviews MUST verify 360-degree checklist completed
- PR description MUST list all affected layers (FE/BE/DB)
- CI pipeline MUST verify migrations, tests, swagger generation
- Never approve PR with TODO comments like "// Add backend endpoint later"

---

### VI. Chat Isolation & Concurrency Safety (MUST - NON-NEGOTIABLE)

**ALL backend operations MUST prevent race conditions when multiple customers write simultaneously.**

**Requirements**:

- ✅ **Session-Level Isolation**: Each customer's chat session is independent (no shared state)
- ✅ **Atomic Operations**: Database writes MUST use transactions for multi-step operations
- ✅ **Customer-Based Locking**: Prevent concurrent processing of messages from SAME customer
- ✅ **Workspace Isolation**: Concurrent requests from DIFFERENT workspaces NEVER interfere
- ❌ **NO global locks**: Locking ONLY per customer (or per session), never system-wide

**Critical Scenarios Requiring Protection**:

1. **Session Creation**: `findOrCreateChatSession()` - Two messages arrive simultaneously for NEW customer

   - ❌ **Risk**: Duplicate session creation (two active sessions for same customer)
   - ✅ **Solution**: Prisma transaction with `upsert` or `findFirst` + retry logic

2. **Message Saving**: `saveMessage()` - Multiple WhatsApp messages arrive in rapid succession

   - ❌ **Risk**: Messages saved to wrong session, out-of-order timestamps
   - ✅ **Solution**: Queue messages per customer, process sequentially

3. **Cart Operations**: `addProduct()` while another message is processing

   - ❌ **Risk**: Lost cart updates, duplicate additions, race conditions
   - ✅ **Solution**: Transaction-based cart updates with optimistic locking

4. **LLM Processing**: Two messages from same customer trigger parallel LLM calls
   - ❌ **Risk**: Context confusion, lost conversation history, duplicate responses
   - ✅ **Solution**: In-memory lock per `customerId` (or message queue)

**Implementation Patterns**:

**Pattern 1: Transaction-Based Session Creation** (MANDATORY for `findOrCreateChatSession`)

```typescript
// ❌ WRONG - Race condition possible
async findOrCreateChatSession(workspaceId: string, customerId: string) {
  let session = await prisma.chatSession.findFirst({
    where: { customerId, status: "active" }
  })

  if (!session) {
    // ⚠️ Another request might create session HERE (race!)
    session = await prisma.chatSession.create({
      data: { workspaceId, customerId, status: "active" }
    })
  }
  return session
}

// ✅ CORRECT - Atomic upsert with unique constraint
async findOrCreateChatSession(workspaceId: string, customerId: string) {
  return await prisma.$transaction(async (tx) => {
    // Try to find active session
    let session = await tx.chatSession.findFirst({
      where: { customerId, status: "active" },
      orderBy: { startedAt: "desc" }
    })

    if (!session) {
      try {
        // Atomic create with unique constraint on (customerId, status="active")
        session = await tx.chatSession.create({
          data: { workspaceId, customerId, status: "active" }
        })
      } catch (error) {
        // If duplicate, retry findFirst (another request created it)
        if (error.code === "P2002") { // Unique constraint violation
          session = await tx.chatSession.findFirst({
            where: { customerId, status: "active" }
          })
        } else {
          throw error
        }
      }
    }

    return session
  })
}
```

**Pattern 2: In-Memory Customer Lock** (RECOMMENDED for LLM processing)

```typescript
// Global in-memory lock map (per process)
const customerLocks = new Map<string, Promise<void>>()

// ✅ Acquire lock before processing message
async function processCustomerMessage(customerId: string, message: string) {
  const lockKey = `customer:${customerId}`

  // Wait for any existing processing to finish
  while (customerLocks.has(lockKey)) {
    await customerLocks.get(lockKey)
  }

  // Acquire lock (create promise that will be resolved when done)
  let releaseLock: () => void
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve
  })
  customerLocks.set(lockKey, lockPromise)

  try {
    // Process message (LLM call, database writes, etc.)
    await llmRouterService.routeMessage({ customerId, message, ... })
  } finally {
    // Release lock
    customerLocks.delete(lockKey)
    releaseLock!()
  }
}
```

**Pattern 3: Message Queue System** (BEST for production scalability)

```typescript
// Using Bull/BullMQ for Redis-based message queue
import { Queue, Worker } from "bullmq"

const messageQueue = new Queue("whatsapp-messages", {
  connection: { host: "localhost", port: 6379 },
})

// ✅ Enqueue message from webhook (non-blocking)
app.post("/webhooks/whatsapp", async (req, res) => {
  const { customerId, message, workspaceId } = req.body

  await messageQueue.add(
    "process-message",
    {
      customerId,
      message,
      workspaceId,
      timestamp: Date.now(),
    },
    {
      // Ensure messages from same customer are processed in order
      jobId: `${customerId}-${Date.now()}`,
      removeOnComplete: true,
      removeOnFail: false,
    }
  )

  return res.status(200).json({ status: "queued" })
})

// ✅ Worker processes messages sequentially per customer
const worker = new Worker(
  "whatsapp-messages",
  async (job) => {
    const { customerId, message, workspaceId } = job.data

    // Process with full isolation (no concurrent execution per customer)
    await llmRouterService.routeMessage({ customerId, message, workspaceId })
  },
  {
    connection: { host: "localhost", port: 6379 },
    concurrency: 10, // Max 10 different customers processed in parallel
  }
)
```

**Database Schema Requirements**:

```prisma
// ✅ Add unique constraint to prevent duplicate active sessions
model ChatSession {
  id          String   @id @default(cuid())
  workspaceId String
  customerId  String
  status      String   @default("active") // "active" | "closed"
  startedAt   DateTime @default(now())

  @@unique([customerId, status]) // CRITICAL: Only ONE active session per customer
  @@index([customerId, status])   // Performance optimization for findFirst
  @@index([workspaceId])          // Workspace isolation
}
```

**Testing Requirements**:

```typescript
// ✅ Integration test for concurrent session creation
describe("Chat Isolation & Concurrency", () => {
  it("MUST NOT create duplicate sessions for concurrent requests", async () => {
    const customerId = "customer-123"
    const workspaceId = "workspace-456"

    // Simulate 5 concurrent requests from same customer
    const promises = Array.from({ length: 5 }, () =>
      messageRepository.findOrCreateChatSession(workspaceId, customerId)
    )

    const sessions = await Promise.all(promises)

    // Verify only ONE session was created
    const uniqueSessionIds = new Set(sessions.map((s) => s.id))
    expect(uniqueSessionIds.size).toBe(1)

    // Verify no duplicate sessions in database
    const allSessions = await prisma.chatSession.findMany({
      where: { customerId, status: "active" },
    })
    expect(allSessions.length).toBe(1)
  })

  it("MUST process messages sequentially for same customer", async () => {
    const customerId = "customer-789"
    const messages = ["msg1", "msg2", "msg3"]
    const results: string[] = []

    // Simulate 3 concurrent messages from same customer
    const promises = messages.map((msg) =>
      processCustomerMessage(customerId, msg).then(() => {
        results.push(msg)
      })
    )

    await Promise.all(promises)

    // Verify messages were processed in order (not concurrent)
    expect(results).toEqual(["msg1", "msg2", "msg3"])
  })
})
```

**Rationale**:

- WhatsApp webhooks can send multiple messages simultaneously (user sends 3 quick messages)
- Without isolation: duplicate sessions, lost messages, context confusion, race conditions
- Multi-tenant system: customer A and customer B MUST NEVER interfere with each other
- Production scalability: single process can handle 10-100 concurrent customers safely

**Enforcement**:

- Code reviews MUST verify transaction usage for session creation
- Integration tests MUST include concurrent request scenarios
- Database MUST have unique constraint on `(customerId, status="active")`
- Load tests MUST verify no race conditions under high concurrency
- Consider Redis-based distributed locking for multi-instance deployments

---

### VII. Code Cleanliness & Technical Debt Prevention (MUST - NON-NEGOTIABLE)

**ALL commits MUST maintain clean, maintainable codebase free of temporary files, unused code, and duplication.**

**Requirements**:

- ❌ **ZERO temporary scripts** - No `test.js`, `temp.ts`, `backup-old.sql` files in repository
- ❌ **ZERO backup files** - No `.backup`, `.old`, `.tmp` files committed (use git history instead)
- ❌ **ZERO unused code** - Remove commented-out code, unused imports, dead functions
- ❌ **ZERO code duplication** - Extract shared logic into utilities, services, or base classes
- ✅ **Immediate cleanup** - Delete temporary files created during development/testing before commit

**Examples**:

```typescript
// ❌ WRONG - Unused imports and commented code
import { PrismaClient } from "@prisma/client"
import { SomethingNeverUsed } from "./utils" // REMOVE
// import { OldImplementation } from "./legacy" // REMOVE commented imports

export class ProductService {
  async getProducts(workspaceId: string) {
    // Old implementation that no longer works
    // const products = await this.oldMethod()
    // return products.filter(p => p.active)

    // New implementation
    return await prisma.products.findMany({
      where: { workspaceId, isActive: true },
    })
  }

  // Unused method - REMOVE
  // async oldMethod() {
  //   return await prisma.products.findMany()
  // }
}

// ✅ CORRECT - Clean, no dead code
import { PrismaClient } from "@prisma/client"

export class ProductService {
  async getProducts(workspaceId: string) {
    return await prisma.products.findMany({
      where: { workspaceId, isActive: true },
    })
  }
}
```

**Duplication Example**:

```typescript
// ❌ WRONG - Duplicated validation logic
// In productController.ts
if (!workspaceId || typeof workspaceId !== "string") {
  return res.status(400).json({ error: "Invalid workspace ID" })
}

// In orderController.ts
if (!workspaceId || typeof workspaceId !== "string") {
  return res.status(400).json({ error: "Invalid workspace ID" })
}

// In customerController.ts
if (!workspaceId || typeof workspaceId !== "string") {
  return res.status(400).json({ error: "Invalid workspace ID" })
}

// ✅ CORRECT - Extracted to shared utility
// utils/validators.ts
export function validateWorkspaceId(workspaceId: any): string {
  if (!workspaceId || typeof workspaceId !== "string") {
    throw new ValidationError("Invalid workspace ID")
  }
  return workspaceId
}

// In all controllers
const validWorkspaceId = validateWorkspaceId(workspaceId)
```

**File Organization**:

```bash
# ❌ WRONG - Temporary files in repository
backend/
├── src/
├── test-script.js          # REMOVE
├── backup-schema.prisma    # REMOVE
├── old-implementation.ts.bak  # REMOVE
└── debug-temp.log          # REMOVE

# ✅ CORRECT - Clean structure
backend/
├── src/
├── prisma/
└── __tests__/
```

**Rationale**:

- Temporary files clutter repository and confuse developers
- Unused code increases maintenance burden and cognitive load
- Code duplication leads to inconsistent behavior and harder refactoring
- Clean codebase accelerates development and reduces bugs
- Git provides version history - no need for `.backup` or `.old` files

**Enforcement**:

- **Pre-commit hook** MUST reject commits with:
  - Files matching `*.backup`, `*.old`, `*.tmp`, `temp.*`, `test-*.js`, `check-*.ts`
  - Temporary scripts in `backend/scripts/` not referenced in `package.json`
  - Commented-out imports (lines starting with `// import`)
  - Excessive commented code blocks (>10 consecutive comment lines)
- **Code reviews** MUST verify:
  - No unused imports (check with `eslint` or IDE warnings)
  - No dead code or commented-out functions
  - No duplicated logic (suggest refactoring to shared utilities)
- **CI/CD** pipeline MUST run:
  - `npm run lint` - Catch unused variables/imports
  - `npm run test:coverage` - Identify untested (likely unused) code
- **Cleanup checklist** before PR:
  - [ ] No temporary/backup files in `git status`
  - [ ] All imports are used (no IDE warnings)
  - [ ] No commented-out code (use git history instead)
  - [ ] No duplicate logic across files
  - [ ] All files under 500 lines (extract if larger)

**Task Closure Checklist** (MANDATORY - execute EVERY time a task is completed):

1. **Code Cleanup** (Principle VII):

   - [ ] Delete all `.backup`, `.old`, `.tmp`, `temp.*` files
   - [ ] Delete temporary scripts in `backend/scripts/` (not in package.json)
   - [ ] Delete obsolete test files (`test-*.ts`, `check-*.ts` in scripts/)
   - [ ] Verify: `find . -name "*.backup*" -o -name "*.old" -o -name "*.tmp"` returns empty
   - [ ] Verify: All scripts in `backend/scripts/` referenced in `package.json`

2. **Constitution Update** (if new principle/pattern added):

   - [ ] Follow `.github/prompts/speckit.constitution.prompt.md` instructions
   - [ ] Version bump (MAJOR/MINOR/PATCH based on change type)
   - [ ] Add Sync Impact Report at top of constitution.md
   - [ ] Update `LAST_AMENDED_DATE` to current date

3. **Documentation**:

   - [ ] Create/update spec documentation (`specs/{feature-number}/`)
   - [ ] Update README if feature is user-facing
   - [ ] Create PR_SUMMARY.md and GIT_COMMIT_MESSAGE.md

4. **Verification**:

   - [ ] Backend builds without errors: `npm run build`
   - [ ] No TypeScript errors: check IDE or `tsc --noEmit`
   - [ ] All tests pass: `npm run test:unit` and `npm run test:integration`

5. **Commit Preparation** (DO NOT PUSH - user does manually):
   - [ ] `git add .`
   - [ ] `git commit -F specs/{feature-number}/GIT_COMMIT_MESSAGE.md`
   - [ ] Notify user: "Ready for review and push"

**Rationale**: Consistent task closure prevents technical debt accumulation and ensures all governance requirements met before code merge.

**Migration for Existing Code**:

If codebase already has technical debt:

1. Create cleanup task: "Refactor [area] - remove unused code"
2. Add to technical debt backlog with priority
3. New code MUST NOT add more debt (enforce immediately)
4. Gradual cleanup during feature work in affected areas

---

### VIII. Multi-Agent Architecture Rules (MUST - NON-NEGOTIABLE)

**ALL agents MUST follow strict separation of responsibilities and delegation protocols.**

**Requirements**:

**1. Output Language Standardization**:

- ✅ All agents (except Safety & Translation) output **ENGLISH ONLY**
- ✅ Safety & Translation Agent translates final response to customer's language
- ❌ SubLLMs (ProductSearch, Cart, OrderTracking, Support) MUST NOT produce non-English responses

**2. Final Response Responsibility**:

- ✅ **Router Agent ONLY** formats final user-facing response (has full conversation history)
- ❌ Other agents return **raw data/content only** (no formatting, no narrative, no customer-facing text)

**3. Single Responsibility Principle**:

- ✅ Each LLM has **ONE purpose**: Cart operations, Order tracking, Product search, Customer support
- ❌ Executing tasks outside designated domain is **strictly prohibited**

**4. Single Delegation Rule**:

- ✅ If request falls under another agent's domain → **delegate via Function Call**
- ❌ **Never answer directly** for another agent's domain (Router MUST NOT search products)

**5. Integrity of Delegated Responses**:

- ✅ Responses from delegated agents copied **EXACTLY as returned** (no modification)
- ❌ No summaries, no rewording, no commentary on delegated content

**6. Context Variable Limit**:

- ✅ **ONE dynamic variable per category** per prompt ({{products}} OR {{productDetails}}, not both)
- ❌ Multiple similar variables create ambiguity and prompt confusion
- ✅ **Router MUST NOT have {{products}} or {{categories}}** (ProductSearch only)

**7. Single Source of Truth**:

- ✅ Crucial rules/logic appear **ONCE** in the system
- ❌ Duplicated rules across agents prohibited (leads to inconsistency)

**8. Prompt Structure & Logical Grouping**:

- ✅ Content organized in **coherent, self-contained sections**
- ❌ Dispersing related concepts across prompt prohibited

**9. Example & Simulation Labeling (Anti-Leakage)**:

- ✅ Training content labeled with **"example"** or **"simulation"**
- ❌ Agents treat as **fictional** (not operational facts to act upon)

**10. Structured Reasoning (Chain-of-Thought)**:

- ✅ Complex decisions use **internal reasoning** (not user-visible)
- ❌ Skip reasoning for simple/obvious tasks (efficiency)

**11. Fallback Mechanism**:

- ✅ Unclear intent → delegate to `customerSupportAgent` (don't guess)
- ❌ Never guess or invent actions when user intent is ambiguous

**12. Function Atomicity**:

- ✅ One Function Call = **one intent** (search products, add to cart)
- ❌ Chaining multiple intents prohibited (e.g., search + add in one call)

**13. Limited Context Window**:

- ✅ Decisions prioritize **last 3 conversation iterations** (specialists)
- ✅ Router uses **full 10-minute conversation history** (contextualization)
- ❌ Older data doesn't drive Function Calls (prevents stale actions)

**14. No Fabricated Function Calls**:

- ✅ Only use **explicitly defined Functions** in agent schema
- ❌ Never invent/assume Functions not in specification

**15. Communication Role — Router Only**:

- ✅ **Router handles**: tone, style, formatting, customer-facing narrative
- ❌ **SubLLMs return**: raw data only (product lists, cart state, order info)

**16. Function Call Documentation & Example Clarity**:

- ✅ Each Function includes: **input params, output format, purpose**
- ✅ Examples labeled **"example"/"simulation"** (anti-leakage)
- ❌ Self-explanatory, testable in isolation

**17. Prompt Context Integrity (No Thematic Overlap)**:

- ✅ Sections remain **self-contained** (no cross-referencing)
- ❌ No overlap/blending between unrelated sections

**Examples**:

```typescript
// ❌ WRONG - Router has product data (architectural violation)
const processedRouterPrompt = await promptProcessor.preProcessPrompt(
  routerAgent.systemPrompt,
  workspaceId,
  customerData,
  {
    faqs,
    services,
    offers,
    categories, // ← Router shouldn't have this
    products, // ← Router shouldn't have this
  }
)

// ✅ CORRECT - Router only has routing/contextualization data
const processedRouterPrompt = await promptProcessor.preProcessPrompt(
  routerAgent.systemPrompt,
  workspaceId,
  customerData,
  {
    faqs: faqs || "",
    services: services || "",
    offers: offers || "",
    subscribeMessage: subscribeMessage || "",
    // NO categories, NO products - ProductSearchAgent only!
  }
)
```

```typescript
// ❌ WRONG - ProductSearch returning narrative (Rule #2 violation)
return {
  response: "Ciao! Ecco i salumi disponibili: 1. Prosciutto...",
  agent: "ProductSearch",
}

// ✅ CORRECT - ProductSearch returns raw data only
return {
  products: [
    { id: "SALUMI-001", name: "Prosciutto di Parma DOP 100g", price: 8.5 },
    { id: "SALUMI-004", name: "Salame Milano 200g", price: 6.8 },
  ],
  agent: "ProductSearch",
}
// Router contextualizes this into customer-facing response
```

```typescript
// ❌ WRONG - Router answering product question directly (Rule #4 violation)
if (message.includes("salami")) {
  return "Abbiamo 5 tipi di salami disponibili..." // Router inventing products!
}

// ✅ CORRECT - Router delegates to ProductSearchAgent
if (message.includes("salami")) {
  const result = await this.productSearchAgent.searchProducts({
    query: message,
    workspaceId,
    customerId,
  })
  return this.contextualizeResponse(result) // Router only contextualizes
}
```

**Agent Responsibility Matrix**:

| Agent                | Domain                      | Has {{products}} | Has {{categories}} | Outputs Language    |
| -------------------- | --------------------------- | ---------------- | ------------------ | ------------------- |
| Router               | Routing + Contextualization | ❌ NO            | ❌ NO              | English             |
| ProductSearch        | Product queries             | ✅ YES           | ✅ YES             | English             |
| Cart                 | Cart operations             | ❌ NO            | ❌ NO              | English             |
| OrderTracking        | Order status/history        | ❌ NO            | ❌ NO              | English             |
| CustomerSupport      | Complex issues              | ❌ NO            | ❌ NO              | English             |
| Safety & Translation | Validation + Translation    | ❌ NO            | ❌ NO              | Customer's language |

**Rationale**:

- Router contamination with product data (discovered in Session 123) caused hallucinations despite temperature 0.0
- Without strict boundaries: context leakage, invented data, architectural violations
- Multi-agent systems require clear separation: Router = orchestration, Specialists = domain execution
- Variable isolation prevents prompt bloat (Router with {{products}} = 50k+ unnecessary tokens)

**Enforcement**:

- Code reviews MUST verify agent domain separation (Router ≠ ProductSearch variables)
- Integration tests MUST validate delegation flow (Router → Specialist → Router → Safety)
- Prompt audits MUST check variable isolation (`grep "{{products}}" docs/prompts/*.md`)
- Load tests MUST verify no cross-agent contamination
- Pre-commit hook MUST reject prompts with duplicate large variables

---

## Multi-Agent Architecture Constraints

### Multi-LLM Call Pattern (CRITICAL)

**Router → Specialist → Router → Safety flow MUST be preserved.**

**Requirements**:

- ✅ **Router First Call**: Decides delegation, variable replacement, full 10-min conversation history
- ✅ **Specialist Execution**: OWN LLM call with OWN prompt, limited context (last 3 messages)
- ✅ **Router Second Call**: Contextualizes specialist response with FULL conversation history
- ✅ **Safety & Translation**: Validates and translates Router's final response

**Code Reference**: `backend/src/services/llm-router.service.ts:1403-1419`

```typescript
// Specialist response added to messages
messages.push({
  role: "function" as const,
  name: functionName,
  content: subAgentFinalResponse,
})
// Continue loop - Router LLM called AGAIN with full history
continue
```

**Rationale**:

- Router maintains conversation coherence (10-minute context window)
- Specialists focus on specific tasks (3-message limited context)
- Router second call bridges gap → contextual, natural responses

**Enforcement**:

- Integration tests MUST verify Router second call occurs
- Code reviews MUST preserve `continue` loop pattern
- Never bypass Router contextualization step

---

## Security Requirements

### Authentication & Authorization

**Requirements**:

- ✅ **3-layer middleware stack** (MANDATORY):
  1. `authMiddleware` - JWT token validation
  2. `sessionValidationMiddleware` - `x-session-id` header check
  3. `validateWorkspaceOperation` - `x-workspace-id` + param validation
- ✅ **Public access**: `SecureTokenService` for time-limited tokens (24h expiry)
- ✅ **WhatsApp webhook**: HMAC signature verification (Meta secret)

**Example**:

```typescript
router.post(
  "/workspaces/:workspaceId/orders",
  authMiddleware, // JWT validation
  sessionValidationMiddleware, // Session check
  validateWorkspaceOperation, // Workspace + param match
  controller.createOrder
)
```

---

### VIII. Conversational Memory Invalidation (MUST - CRITICAL)

**SearchConversations cache MUST be cleared when showing incomplete/stale product lists.**

**Problem**: The `searchConversations` table caches LLM filter results (e.g., "DOP cheeses") for performance. When product data changes or LLM returns incomplete lists, stale cache causes wrong results.

**Root Cause Discovery** (Session 2025-11-13):

- User query: "avete i formaggi?" → LLM grouped by certification
- User selects: "1" (Formaggi DOP - 5 products)
- **Bug**: LLM showed only 4 of 5 DOP cheeses (missing Taleggio DOP)
- **Investigation**:
  - ✅ Database confirmed: 5 DOP cheeses exist (Gorgonzola, Parmigiano, Mozzarella, Pecorino, Taleggio)
  - ✅ MessageRepository.getActiveProducts(): All 5 in formatted output
  - ✅ PromptProcessorService: {{products}} includes all 5 (verified in logs/prompt-debug files)
  - ❌ **LLM output**: Only 4 shown consistently (Taleggio missing)
- **Root Cause**: `searchConversations` table cached first response with 4 products, LLM reused cache instead of re-filtering from fresh {{products}}
- **Solution**: Clear `searchConversations.deleteMany({ where: { sessionId } })` before re-query → **Test passed**: All 5 products shown including Taleggio

**Requirements**:

- ✅ **When to invalidate** (symptoms of stale cache):

  - Count mismatch: LLM says "(N prodotti)" but shows fewer than N
  - Missing products: Database has X items, LLM shows X-1 or fewer
  - Stale data: Product updated/added but LLM shows old version
  - Filter changes: User switches category but LLM shows previous category results

- ✅ **How to invalidate**:

  ```typescript
  // Clear session memory to force fresh lookup
  await prisma.searchConversations.deleteMany({
    where: { sessionId },
  })
  ```

- ✅ **Prevention strategies**:
  - **TTL expiration**: Already implemented (10-minute expiry in `expiresAt`)
  - **Product version tracking**: Consider adding `catalogVersion` to workspace, invalidate on increment
  - **Automatic invalidation**: On product CRUD operations, clear related sessions
  - **Test validation**: `test-cheese-count.ts` verifies count accuracy after memory clear

**Examples**:

```typescript
// ❌ WRONG - Trusting stale cache
async function handleProductQuery(sessionId: string, query: string) {
  const cached = await searchConversationRepo.findBySession(sessionId)
  if (cached) {
    return cached.lastResponse // May be stale/incomplete
  }
  return await productSearchAgent.query(query)
}

// ✅ CORRECT - Clear cache when stale data detected
async function handleProductQuery(sessionId: string, query: string) {
  const products = await messageRepo.getActiveProducts(workspaceId)
  const cached = await searchConversationRepo.findBySession(sessionId)

  // If cache exists but product count doesn't match, invalidate
  if (cached && cached.productsCount !== products.length) {
    logger.warn(
      `Stale cache detected: expected ${products.length}, cached ${cached.productsCount}`
    )
    await prisma.searchConversations.deleteMany({ where: { sessionId } })
  }

  return await productSearchAgent.query(query)
}

// ✅ CORRECT - Clear cache on product updates
async function updateProduct(productId: string, data: ProductUpdateDto) {
  const product = await prisma.products.update({
    where: { id: productId },
    data,
  })

  // Invalidate all sessions for this workspace
  await prisma.searchConversations.deleteMany({
    where: {
      workspaceId: product.workspaceId,
      // Only clear if cache contains this product's category
      lastQuery: { contains: product.category },
    },
  })

  return product
}
```

**Test Case** (from `test-cheese-count.ts`):

```typescript
// Step 1: Clear session memory
await prisma.searchConversations.deleteMany({
  where: { sessionId: testSessionId },
})

// Step 2: Query "avete i formaggi?"
const response1 = await productSearchAgent.query({
  sessionId: testSessionId,
  query: "avete i formaggi?",
})
// Expected: Groups shown (DOP, Freschi, Stagionati)

// Step 3: User selects "1" (DOP group)
const response2 = await productSearchAgent.query({
  sessionId: testSessionId,
  query: "1",
})

// Step 4: Validate ALL 5 DOP cheeses shown
const expectedProducts = [
  "Gorgonzola Dolce DOP",
  "Parmigiano Reggiano DOP 24 mesi",
  "Mozzarella di Bufala Campana DOP",
  "Pecorino Romano DOP",
  "Taleggio DOP", // ← Previously missing due to stale cache
]

for (const product of expectedProducts) {
  expect(response2).toContain(product)
}
```

**Rationale**:

- **Performance vs Accuracy tradeoff**: Caching improves response time but risks showing incomplete data
- **User trust impact**: Saying "5 prodotti" but showing 4 damages credibility
- **Inventory accuracy**: Missing products = lost sales opportunities
- **Testing requirement**: Integration tests MUST clear memory before assertions

**Enforcement**:

- Code reviews MUST verify cache invalidation on product CRUD operations
- Integration tests MUST clear `searchConversations` before product query tests
- Monitoring MUST alert on count mismatches (claimed vs shown)
- Consider: Automatic background job to detect and clear stale caches

---

### IX. Message Flow Timeline Integrity (MUST - NON-NEGOTIABLE)

**EVERY LLM agent call MUST have a corresponding `debugStep` push to the timeline. The Message Flow Timeline MUST be a 1:1 mirror of the actual execution flow.**

**Critical Requirements**:

1. **1:1 Mapping Rule**:

   - ✅ Every LLM call (Router, ProductSearch, Cart, OrderTracking, CustomerSupport, Safety) = ONE `debugSteps.push()`
   - ❌ Zero shortcuts - no response can skip timeline tracking
   - ❌ Zero hardcoded responses - ALL responses through LLM with full debug data

2. **Zero Hardcoded Responses**:

   - ❌ **NEVER** return responses without LLM processing: `return { output: "Mi dispiace..." }` ← PROHIBITED
   - ✅ **ALWAYS** delegate to specialist agent with LLM call and `systemPrompt` tracking
   - ❌ **NEVER** skip delegation based on heuristics (e.g., "category doesn't exist" → hardcoded response)

3. **systemPrompt Tracking**:

   - ✅ Every specialist agent MUST return `systemPrompt` in response interface
   - ✅ Router MUST include `systemPrompt: specialistResponse.systemPrompt` in debugStep
   - ✅ Frontend MUST display 📄 PROMPT (System) section for ALL specialist steps

4. **Timeline Structure** (4-step pattern for specialist delegation):

   ```typescript
   debugSteps = [
     {
       type: "router",
       agent: "Router Agent",
       output: { decision: "delegate to PRODUCT_SEARCH" },
     },
     {
       type: "sub_agent",
       agent: "PRODUCT_SEARCH Agent",
       systemPrompt: "...",
       output: { responseText: "..." },
     },
     {
       type: "router",
       agent: "Router Agent",
       output: { decision: "received response from specialist" },
     },
     {
       type: "safety",
       agent: "Safety & Translation Agent",
       output: { translatedText: "..." },
     },
   ]
   ```

5. **Push Location (CRITICAL)**:
   - ✅ Add `debugSteps.push()` IMMEDIATELY after specialist agent returns (in `functionCallingLoop`)
   - ✅ Include ALL fields: `input`, `output`, `tokenUsage`, `systemPrompt`, `timestamp`
   - ❌ NEVER construct debugInfo manually - it MUST reflect actual execution

**Examples**:

```typescript
// ❌ WRONG - Hardcoded response without LLM, skips timeline tracking
if (query.includes("dolci") && !hasMatchingProducts) {
  return {
    success: true,
    output: `Mi dispiace! Non abbiamo dolci al momento.`, // ← Hardcoded!
    tokensUsed: 0, // ← No LLM call!
    executionTimeMs: 0,
    functionCalls: [],
    // NO systemPrompt! Frontend can't show what LLM saw!
  }
}

// ✅ CORRECT - Always delegate to specialist LLM
const productSearchAgent = new ProductSearchAgentLLM(this.prisma)
const subAgentResponse = await productSearchAgent.handleQuery({
  workspaceId,
  customerId,
  query, // ← LLM processes "dolci" and returns proper response
  sessionId,
})
// Timeline automatically gets sub_agent step with systemPrompt!
```

```typescript
// ❌ WRONG - Missing systemPrompt in debugStep
debugSteps.push({
  type: "sub_agent",
  agent: `${delegationTarget} Agent`,
  output: { responseText: subAgentFinalResponse },
  tokenUsage: { totalTokens: subAgentResponse.tokensUsed },
  // ❌ NO systemPrompt! Frontend can't show prompt!
})

// ✅ CORRECT - Include systemPrompt from specialist response
debugSteps.push({
  type: "sub_agent",
  agent: `${delegationTarget} Agent`,
  output: { responseText: subAgentFinalResponse },
  tokenUsage: { totalTokens: subAgentResponse.tokensUsed },
  systemPrompt: subAgentResponse.systemPrompt, // ✅ Frontend shows 📄 PROMPT section
})
```

**Rationale**:

- **Observability**: Without accurate timeline, debugging production issues is IMPOSSIBLE
- **Trust**: Disalignment between timeline and reality = complete loss of system understanding
- **Accountability**: Every AI decision must be traceable to its input prompt
- **Compliance**: Audit trails require knowing EXACTLY what the LLM was instructed to do

**Enforcement**:

- ✅ **Code reviews**: MUST verify every response path has corresponding `debugSteps.push()`
- ✅ **Integration tests**: Validate `debugInfo.steps.length` matches expected LLM call count
- ✅ **Automated test**: Script checks for hardcoded responses (grep for return without LLM call)
- ❌ **PR rejection**: ANY hardcoded response that bypasses timeline tracking is a BLOCKER
- ✅ **Manual verification**: Before merging, test Message Flow Timeline shows ALL agent cards with prompts

**Test Pattern**:

```typescript
// Verify timeline integrity
describe("Message Flow Timeline", () => {
  it("MUST have sub_agent step with systemPrompt for specialist delegation", async () => {
    const response = await llmRouter.routeMessage({
      message: "avete salami?",
      workspaceId,
      customerId,
    })

    const debugInfo = response.debugInfo
    const subAgentStep = debugInfo.steps.find((s) => s.type === "sub_agent")

    expect(subAgentStep).toBeDefined() // ✅ Specialist was called
    expect(subAgentStep.systemPrompt).toBeDefined() // ✅ Prompt tracked
    expect(subAgentStep.systemPrompt.length).toBeGreaterThan(100) // ✅ Real prompt, not empty
    expect(subAgentStep.output.responseText).toContain("SALUMI-") // ✅ Real product codes
  })

  it("MUST NOT have hardcoded responses bypassing LLM", async () => {
    const response = await llmRouter.routeMessage({
      message: "avete dolci?",
      workspaceId,
      customerId,
    })

    const debugInfo = response.debugInfo
    const hasSubAgent = debugInfo.steps.some((s) => s.type === "sub_agent")

    expect(hasSubAgent).toBe(true) // ✅ Specialist was called, not hardcoded response
  })
})
```

---

### X. Validation-Only Router Pattern (SHOULD - PERFORMANCE OPTIMIZATION)

**Router Agent SHOULD validate specialist responses without LLM call when validation passes. This saves ~5000 tokens per request (25% reduction) and reduces latency by ~800ms.**

**Critical Requirements**:

1. **Validation-Only Method**:

   - ✅ Create `validateSubAgentResponse()` method with if/else rules (NO LLM call)
   - ✅ Validate response completeness: length >50 chars, contains expected content
   - ✅ Agent-specific rules:
     - `PRODUCT_SEARCH`: Has product list OR "no products" message
     - `CART_MANAGEMENT`: Has cart action confirmation (aggiunto/rimosso)
     - `ORDER_TRACKING`: Has order code (ORD-) OR tracking info
     - `CUSTOMER_SUPPORT`: Has support message OR agent contact info

2. **Flow Decision Tree**:

   ```typescript
   Sub-Agent returns response
   ↓
   Router calls validateSubAgentResponse()
   ↓
   ├─ ✅ Valid → Skip Router LLM call, return directly (saves 5000 tokens)
   │   └─ Add debugStep: type="router", agent="Router Agent (validation-only)", tokenUsage={totalTokens: 0}
   │
   └─ ❌ Invalid → Continue to Router LLM call for reformulation
       └─ Add debugStep: type="router", agent="Router Agent", tokenUsage={totalTokens: ~5000}
   ```

3. **Debug Timeline Transparency**:

   - ✅ Validation-only path MUST add Router debugStep with `tokenUsage: 0`
   - ✅ Step label: "Router Agent (validation-only)" to distinguish from LLM calls
   - ✅ Output decision: "Response validated - approved for Safety layer (no LLM call)"
   - ❌ NEVER skip Router step - timeline must show validation happened

4. **Performance Metrics**:
   - **Token Savings**: ~5000 tokens per request when validation passes
   - **Cost Savings**: ~$0.001875 per request = $1.88/day (1000 requests) = $680/year
   - **Latency Reduction**: ~800ms (Router LLM call eliminated)
   - **Validation Success Rate**: Expected >90% (most specialist responses are complete)

**Examples**:

```typescript
// ✅ CORRECT - Validation-only pattern
const validationResult = this.validateSubAgentResponse({
  response: subAgentFinalResponse,
  expectedAgent: delegationTarget,
  userQuery: params.message,
})

if (!validationResult.isValid) {
  // ❌ Invalid - need Router to reformulate
  logger.warn("⚠️ Sub-agent response invalid, Router will reformulate", {
    reason: validationResult.reason,
  })
  messages.push({
    role: "function",
    content: subAgentFinalResponse,
  })
  continue // Router LLM call #3
}

// ✅ Valid - skip Router LLM call
logger.info("✅ Sub-agent response valid, skipping Router LLM call", {
  savedTokens: "~5000",
})

// Add validation-only debugStep (NO LLM call!)
debugSteps.push({
  type: "router",
  agent: "Router Agent (validation-only)",
  tokenUsage: {
    promptTokens: 0,
    completionTokens: 0, // ⬅️ ZERO - no LLM call!
    totalTokens: 0,
  },
  output: {
    decision: "Response validated - approved for Safety layer (no LLM call)",
  },
})

return {
  response: subAgentFinalResponse, // Direct from specialist
  debugSteps, // Router → SubAgent → Router(validation-only) → Safety
}
```

```typescript
// Validation logic (if/else, no LLM)
private validateSubAgentResponse(options: {
  response: string
  expectedAgent: string
  userQuery: string
}): { isValid: boolean; reason?: string } {
  const { response, expectedAgent } = options

  // Rule 1: Non-empty
  if (!response || response.trim().length === 0) {
    return { isValid: false, reason: "Empty response" }
  }

  // Rule 2: Meaningful (>50 chars)
  if (response.trim().length < 50) {
    return { isValid: false, reason: `Too short (${response.length} < 50)` }
  }

  // Rule 3: Agent-specific validation
  if (expectedAgent === "PRODUCT_SEARCH") {
    const hasProducts = /\d+\.\s+\*\*/.test(response) // "1. **Product**"
    const hasNoProducts = /non\s+(ho|abbiamo)|no\s+products?/i.test(response)
    if (!hasProducts && !hasNoProducts) {
      return { isValid: false, reason: "Missing product list or 'no products'" }
    }
  }

  // ... other agent validations

  return { isValid: true } // ✅ Passed all checks
}
```

**Rationale**:

- **Performance**: 90% of specialist responses are complete and valid - no need for Router to rephrase
- **Cost Optimization**: Saves $680/year in LLM API costs for typical usage (1000 requests/day)
- **Latency**: Faster responses improve user experience (800ms saved per message)
- **Architecture Alignment**: Router = orchestrator (delegation + validation), Specialists = business logic

**Enforcement**:

- ✅ **Validation success rate monitoring**: Log when validation fails (should be <10%)
- ✅ **Token savings tracking**: Log "savedTokens: ~5000" when validation-only path used
- ✅ **Timeline verification**: Message Flow Timeline MUST show validation-only Router step
- ⚠️ **Fallback safety**: If validation uncertain → ALWAYS continue to Router LLM (false positive OK, false negative NOT OK)

**Test Pattern**:

```typescript
describe("Validation-Only Router Pattern", () => {
  it("MUST skip Router LLM call when sub-agent response is valid", async () => {
    const response = await llmRouter.routeMessage({
      message: "avete salami?",
      workspaceId,
      customerId,
    })

    const routerSteps = response.debugInfo.steps.filter(
      (s) => s.type === "router"
    )
    const validationOnlyStep = routerSteps.find((s) =>
      s.agent.includes("validation-only")
    )

    expect(validationOnlyStep).toBeDefined() // ✅ Validation happened
    expect(validationOnlyStep.tokenUsage.totalTokens).toBe(0) // ✅ No LLM call
  })

  it("MUST call Router LLM when sub-agent response is invalid", async () => {
    // Mock invalid response (too short)
    jest
      .spyOn(ProductSearchAgentLLM.prototype, "handleQuery")
      .mockResolvedValue({
        success: true,
        output: "ok", // ❌ Invalid: <50 chars
        tokensUsed: 100,
      })

    const response = await llmRouter.routeMessage({
      message: "avete salami?",
      workspaceId,
      customerId,
    })

    const routerSteps = response.debugInfo.steps.filter(
      (s) => s.type === "router"
    )
    const reformulationStep = routerSteps.find(
      (s) =>
        s.tokenUsage.totalTokens > 0 && !s.agent.includes("validation-only")
    )

    expect(reformulationStep).toBeDefined() // ✅ Router LLM called
    expect(reformulationStep.tokenUsage.totalTokens).toBeGreaterThan(1000) // ✅ Real LLM call
  })
})
```

**See Also**:

- `docs/architecture/MULTI_AGENT_FLOW.md` - Complete flow documentation
- `backend/src/services/llm-router.service.ts:validateSubAgentResponse()` - Implementation

---

### XI. Real-Time WebSocket Communication (MUST - CRITICAL)

**ALL chat operations MUST emit WebSocket events to enable instant UI updates across operator sessions and devices.**

**Critical Requirements**:

1. **Event-Driven Architecture**:

   - ✅ EVERY database operation affecting chat state MUST emit WebSocket event
   - ✅ Events broadcast to workspace room: `workspace:${workspaceId}`
   - ✅ Frontend invalidates React Query cache on event reception
   - ❌ NO polling - WebSocket events ONLY for real-time updates

2. **Event Types** (5 core events):

   - `new-message`: New message saved (customer/operator/AI)
   - `chat-updated`: Chat list state changed (new message, status update)
   - `user-blocked`: Customer blocked (isBlacklisted=true)
   - `user-unblocked`: Customer unblocked (isBlacklisted=false)
   - `new-customer`: New chat session created (first message from new customer)

3. **Backend Emit Pattern**:

   ```typescript
   // ✅ CORRECT - Emit AFTER database save
   const message = await prisma.conversationMessage.create({ data })
   await websocketService.notifyNewMessage(workspaceId, {
     sessionId: message.sessionId,
     customerId: message.customerId,
     message: message.content,
   })
   await websocketService.notifyChatUpdated(workspaceId, sessionId)
   ```

4. **Frontend Pattern** (useWebSocket hook):

   ```typescript
   // ✅ Listen to events and invalidate cache
   socket.on("new-message", (data) => {
     queryClient.invalidateQueries({
       queryKey: ["chatMessages", data.sessionId],
     })
     queryClient.invalidateQueries({ queryKey: ["chatList"] })
     if (data.sessionId !== activeSessionId) {
       toast.info("Nuovo messaggio ricevuto")
     }
   })

   socket.on("chat-updated", () => {
     queryClient.invalidateQueries({ queryKey: ["chatList"] })
   })
   ```

5. **Chat List Synchronization** (WhatsApp Popup):

   - ✅ Page reload (`window.location.reload()`) on popup close
   - ✅ Guarantees fresh chat list data after operator sends messages
   - ⚠️ Fallback pattern when React Query invalidation insufficient
   - Rationale: React Query cache timing issues require guaranteed refresh

6. **Connection Status Indicator**:
   - ✅ Visual indicator shows WebSocket connection state (connected/disconnected)
   - ✅ Auto-reconnection on disconnect
   - ✅ User awareness: if disconnected, real-time updates are paused

**Implementation Locations**:

**Backend Emitters**:

- `backend/src/interfaces/http/controllers/chat.controller.ts` (Lines 357-376)
  - Operator messages emit `new-message` + `chat-updated`
- `backend/src/interfaces/http/controllers/customers.controller.ts` (Lines 258-273)
  - Customer blocking emits `user-blocked` / `user-unblocked`
- `backend/src/repositories/message.repository.ts` (Lines 442-460)
  - New session creation emits `new-customer`
- `backend/src/services/llm-router.service.ts` (Lines 2097-2115)
  - AI responses emit `chat-updated` (alongside existing `new-message`)

**Frontend Listeners**:

- `frontend/src/hooks/useWebSocket.ts` (Lines 144-221)
  - Event listeners + toast notifications
  - React Query invalidation
- `frontend/src/components/shared/WhatsAppChatModal.tsx` (Lines 111-116)
  - Page reload on popup close

**WebSocket Service**:

- `backend/src/services/websocket.service.ts` (Lines 113-151)
  - `notifyUserBlocked()`, `notifyNewCustomer()` methods

**Examples**:

```typescript
// ❌ WRONG - No WebSocket emit after operator message
async sendOperatorMessage(req: Request, res: Response) {
  const message = await prisma.conversationMessage.create({
    data: {
      sessionId,
      sender: "operator",
      content: messageText,
    },
  })
  return res.json({ success: true, message })
  // ❌ Missing: websocketService.notifyNewMessage()
  // Result: Other operators don't see message until refresh
}

// ✅ CORRECT - Emit WebSocket events
async sendOperatorMessage(req: Request, res: Response) {
  const message = await prisma.conversationMessage.create({
    data: {
      sessionId,
      sender: "operator",
      content: messageText,
    },
  })

  // Emit to workspace room
  await this.websocketService.notifyNewMessage(workspaceId, {
    sessionId: message.sessionId,
    customerId: session.customerId,
    message: message.content,
    sender: "operator",
  })
  await this.websocketService.notifyChatUpdated(workspaceId, sessionId)

  return res.json({ success: true, message })
}
```

```typescript
// ❌ WRONG - Frontend doesn't listen to WebSocket events
useEffect(() => {
  // No socket listeners - UI only updates on manual refresh
  loadChatList()
}, [])

// ✅ CORRECT - Frontend invalidates cache on events
useEffect(() => {
  const socket = io(WEBSOCKET_URL)

  socket.on("new-message", (data) => {
    queryClient.invalidateQueries({
      queryKey: ["chatMessages", data.sessionId],
    })
    queryClient.invalidateQueries({ queryKey: ["chatList"] })
    toast.info("Nuovo messaggio ricevuto")
  })

  socket.on("chat-updated", () => {
    queryClient.invalidateQueries({ queryKey: ["chatList"] })
  })

  return () => socket.disconnect()
}, [])
```

```typescript
// ✅ CORRECT - Page reload fallback for WhatsApp popup
const handleClose = useCallback(() => {
  onClose() // Close modal
  window.location.reload() // Force chat list refresh
}, [onClose])

// Called after sending message from popup
<Button onClick={handleSendMessage}>Invia</Button>
```

**Workspace Isolation** (CRITICAL):

- ✅ WebSocket rooms MUST be workspace-scoped: `workspace:${workspaceId}`
- ❌ NEVER broadcast to all clients (security violation)
- ✅ Operator joins room on login: `socket.join(`workspace:${user.workspaceId}`)`

**Testing Requirements**:

```typescript
describe("Real-Time WebSocket Events", () => {
  it("MUST emit new-message after operator sends message", async () => {
    const mockEmit = jest.spyOn(websocketService, "notifyNewMessage")

    await chatController.sendOperatorMessage(req, res)

    expect(mockEmit).toHaveBeenCalledWith(workspaceId, {
      sessionId: expect.any(String),
      customerId: expect.any(String),
      message: "Test message",
      sender: "operator",
    })
  })

  it("MUST invalidate chat list on chat-updated event", async () => {
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries")

    socket.emit("chat-updated", { workspaceId })

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["chatList"],
    })
  })
})
```

**Rationale**:

- **User Experience**: Instant updates improve operator productivity (no manual refresh)
- **Multi-Device**: Operators can monitor chats from multiple devices simultaneously
- **Collaboration**: Multiple operators see same chat state in real-time
- **Accuracy**: Prevents stale data, race conditions, duplicate responses
- **Scalability**: Event-driven architecture scales better than polling (reduced server load)

**Performance Considerations**:

- ✅ WebSocket events lightweight (~200 bytes per event)
- ✅ Room-based broadcasting limits network traffic (only workspace members receive)
- ⚠️ Page reload fallback adds ~500ms UX delay (acceptable for critical data accuracy)
- ⚠️ React Query invalidation may have timing issues (reload guarantees consistency)

**Enforcement**:

- Code reviews MUST verify WebSocket emit after database writes
- Integration tests MUST verify events broadcast to correct workspace room
- Manual testing MUST verify chat list updates without refresh
- Monitor WebSocket connection health (reconnection rate, event latency)
- Consider: Redis adapter for multi-instance Socket.io deployments (production scalability)

**Migration Path**:

If implementing WebSocket for existing features:

1. Add `websocketService.notify*()` calls after database operations
2. Add frontend event listeners in `useWebSocket` hook
3. Add React Query invalidation for affected queries
4. Test multi-operator scenarios (same workspace, different sessions)
5. Document event schema in `backend/src/services/websocket.service.ts`

**See Also**:

- `specs/125-chat-realtime-improvements/COMPLETED.md` - Implementation documentation
- `specs/125-chat-realtime-improvements/AUDIT.md` - Problem analysis
- `specs/125-chat-realtime-improvements/PLAN.md` - Progressive enhancement strategy
- `backend/src/services/websocket.service.ts` - WebSocket service implementation
- `frontend/src/hooks/useWebSocket.ts` - Frontend WebSocket hook

---

### XII. Server Auto-Restart Prevention (MUST - OPERATIONAL)

**AI agents MUST NEVER manually restart development servers - hot-reload handles this automatically.**

**Requirements**:

- ❌ **NO manual server restarts** - Backend/frontend have hot-reload via `ts-node-dev` and `vite`
- ❌ **NO opening new terminals** - Use existing terminal sessions
- ✅ **Watch compilation output** - Monitor existing terminal for errors
- ✅ **Inform user of changes** - "Changes saved, server will auto-reload"

**Rationale**: Development servers auto-restart on file changes. Manual restarts waste time and create unnecessary terminal sessions.

**Enforcement**:

- AI agents instructed via `.github/copilot-instructions.md` Rule #3
- Do NOT run `npm run dev` or `npm start` unless servers are stopped
- Watch for compilation errors in terminal output instead

---

### XIII. LLM Message Flow Priority System (MUST - CRITICAL)

**ALL incoming messages MUST follow strict priority-based flow to ensure security, channel control, and proper routing.**

This principle consolidates Andrea's 12 architectural rules into constitution authority.

---

#### Rule 1: Blocked User Gate (P1 - HIGHEST PRIORITY)

**Blocked customers (isBlocked=true) receive ZERO responses and NO database saves.**

**Requirements**:

- ✅ **Priority**: P1 (checked FIRST, before any other processing)
- ✅ **Detection**: Query `customers.isBlocked` field
- ✅ **Action**: Return empty response `{ finalResponse: "", isBlocked: true }`
- ✅ **Token usage**: ZERO (no LLM call)
- ✅ **Database**: NO message save (blocked customer messages discarded)
- ✅ **Webhook**: `isBlocked: true` flag prevents WhatsApp API send

**Implementation**:

```typescript
// llm-router.service.ts - FIRST gate
private async checkBlockedUser(customerId: string): Promise<boolean> {
  const customer = await this.prisma.customers.findUnique({
    where: { id: customerId },
    select: { isBlocked: true }
  })
  return customer?.isBlocked || false
}

async routeMessage(params: RouterParams): Promise<RouterResult> {
  // P1: Blocked user check (BEFORE everything else)
  const isBlocked = await this.checkBlockedUser(params.customerId)
  if (isBlocked) {
    logger.warn("🚫 P1: Blocked customer - NO response, NO DB save")
    return {
      finalResponse: "",
      isBlocked: true,
      tokenUsage: { total: 0 }
    }
  }

  // 🆕 Feature 127: SYSTEM MESSAGE FAST-PATH
  // If isSystemMessage=true, skip Router/SubLLM and go DIRECTLY to Safety+Translation
  if (params.isSystemMessage) {
    logger.info("🚀 SYSTEM MESSAGE: Skipping Router/SubLLM, going direct to Safety+Translation")

    // 1. Translate with SafetyTranslationAgent
    const safetyResult = await this.safetyAgent.process({
      workspaceId: params.workspaceId,
      response: params.message, // Message in Italian (base language)
      targetLanguage: params.customerLanguage || "it",
      customerName: params.customerName
    })

    // 2. Save as assistant message in history
    await this.conversationManager.saveAssistantMessage({
      workspaceId: params.workspaceId,
      customerId: params.customerId,
      conversationId: params.conversationId,
      content: safetyResult.translatedText,
      agentType: "SYSTEM_NOTIFICATION",
      tokensUsed: safetyResult.tokensUsed
    })

    // 3. Return response (will be queued for WhatsApp)
    return {
      response: safetyResult.translatedText,
      agentUsed: "SYSTEM_NOTIFICATION",
      confidence: 1.0,
      tokensUsed: safetyResult.tokensUsed,
      executionTimeMs: Date.now() - startTime,
      wasFAQ: false
    }
  }

  // ... continue with P2, P3, P4 (normal user messages)
}
```

**Test Coverage**:

```typescript
// __tests__/unit/services/llm-router-priorities.spec.ts
it("should return empty response for blocked customer", async () => {
  const blockedCustomer = await createCustomer({ isBlocked: true })
  const result = await llmRouterService.routeMessage({
    customerId: blockedCustomer.id,
    message: "Test message",
  })

  expect(result.finalResponse).toBe("")
  expect(result.isBlocked).toBe(true)
  expect(result.tokenUsage.total).toBe(0)
})
```

**Rationale**: Blocked customers are spam, abusive, or fraudulent. Zero tolerance policy prevents system abuse and reduces costs.

**Enforcement**:

- ✅ MUST be first check in `llm-router.service.ts:routeMessage()`
- ✅ MUST have unit test coverage
- ✅ MUST log block attempt with customer ID
- ❌ NO exceptions - even admin cannot bypass block

---

#### Rule 2: Channel Disabled Gate (P2 - HIGH PRIORITY)

**When workspace channel is disabled (channelStatus=false), return WIP message from workspace settings.**

**Requirements**:

- ✅ **Priority**: P2 (after P1 blocked check)
- ✅ **Detection**: Query `workspaces.channelStatus` field
- ✅ **Source**: `workspaces.wipMessage` (multilanguage JSON: `{en: "...", it: "...", es: "..."}`)
- ✅ **Language selection**: `customerLanguage` → `en` (fallback)
- ✅ **Token usage**: ZERO (no LLM call)
- ✅ **Database**: Message saved with WIP response
- ❌ **NO hardcoded fallback** - MUST come from database (Principle I: Database-First)

**Implementation**:

```typescript
// llm-router.service.ts - P2 gate
const workspace = await this.prisma.workspaces.findUnique({
  where: { id: params.workspaceId },
  select: { channelStatus: true, wipMessage: true },
})

if (!workspace?.channelStatus) {
  const wipMessages = (workspace?.wipMessage as any) || {}
  const wipMessage =
    wipMessages[params.customerLanguage?.toLowerCase() || "en"] ||
    wipMessages.en ||
    "We are currently working on improvements. Please try again later."

  logger.info("🚧 P2: Channel disabled - sending WIP message")

  await this.prisma.chatMessages.create({
    data: {
      sessionId: session.id,
      role: "assistant",
      content: wipMessage,
      timestamp: new Date(),
    },
  })

  return {
    finalResponse: wipMessage,
    content: wipMessage,
    tokenUsage: { total: 0 },
  }
}
```

**Schema**:

```prisma
model Workspaces {
  id               String  @id @default(cuid())
  channelStatus    Boolean @default(true)  // false = channel disabled
  wipMessage       Json?   // {en: "...", it: "...", es: "..."}
  // ...
}
```

**Test Coverage**:

```typescript
it("should return WIP message when channel disabled", async () => {
  await updateWorkspace({
    channelStatus: false,
    wipMessage: {
      en: "Service under maintenance",
      it: "Servizio in manutenzione",
    },
  })

  const result = await llmRouterService.routeMessage({
    customerLanguage: "en",
    message: "Hello",
  })

  expect(result.finalResponse).toBe("Service under maintenance")
  expect(result.tokenUsage.total).toBe(0)
})
```

**Rationale**: Allows operators to disable chatbot during maintenance, product updates, or business hours restrictions without deploying code.

**Enforcement**:

- ✅ MUST be second check (after P1)
- ✅ WIP message MUST come from database (no hardcoded strings)
- ✅ MUST support multilanguage (Italian base + customer language)
- ✅ MUST have unit test coverage

---

#### Rule 3: New Customer Welcome (P3 - MEDIUM PRIORITY)

**New customers (first message ever) receive welcome message from workspace settings.**

**Requirements**:

- ✅ **Priority**: P3 (after P1, P2)
- ✅ **Detection**: Check if `chatSessions` exists for customer OR message count = 0
- ✅ **Source**: `workspaces.welcomeMessage` (multilanguage JSON)
- ✅ **Language selection**: `customerLanguage` → `en` (fallback)
- ✅ **Token usage**: ZERO (no LLM call for welcome)
- ✅ **Database**: Save welcome message + create chat session
- ❌ **NO hardcoded fallback** - MUST come from database

**Implementation**:

```typescript
// llm-router.service.ts - P3 gate
const existingMessages = await this.prisma.chatMessages.count({
  where: {
    session: { customerId: params.customerId },
  },
})

if (existingMessages === 0) {
  const workspace = await this.prisma.workspaces.findUnique({
    where: { id: params.workspaceId },
    select: { welcomeMessage: true },
  })

  const welcomeMessages = (workspace?.welcomeMessage as any) || {}
  const welcomeMessage =
    welcomeMessages[params.customerLanguage?.toLowerCase() || "en"] ||
    welcomeMessages.en ||
    "Welcome! How can I help you today?"

  logger.info("👋 P3: New customer - sending welcome message")

  await this.prisma.chatMessages.create({
    data: {
      sessionId: session.id,
      role: "assistant",
      content: welcomeMessage,
      timestamp: new Date(),
    },
  })

  return {
    finalResponse: welcomeMessage,
    content: welcomeMessage,
    tokenUsage: { total: 0 },
  }
}
```

**Schema**:

```prisma
model Workspaces {
  id             String  @id @default(cuid())
  welcomeMessage Json?   // {en: "Welcome!", it: "Benvenuto!", es: "¡Bienvenido!"}
  // ...
}
```

**Test Coverage** (⚠️ MISSING - needs to be added):

```typescript
it("should return welcome message for new customer", async () => {
  const newCustomer = await createCustomer({ phone: "+1234567890" })

  const result = await llmRouterService.routeMessage({
    customerId: newCustomer.id,
    message: "Hello",
  })

  expect(result.finalResponse).toContain("Welcome")
  expect(result.tokenUsage.total).toBe(0)

  const savedMessage = await prisma.chatMessages.findFirst({
    where: { session: { customerId: newCustomer.id } },
  })
  expect(savedMessage.content).toBe(result.finalResponse)
})
```

**Rationale**: First impression matters. Welcome message sets tone, explains capabilities, builds customer trust.

**Enforcement**:

- ✅ MUST be third check (after P1, P2)
- ✅ Welcome message MUST come from database
- ✅ MUST support multilanguage
- ⚠️ **MUST add unit test** (currently missing)

---

#### Rule 4: Normal Flow - Router Agent Orchestration (P4 - STANDARD)

**For enabled customers with existing sessions, Router Agent decides message routing to specialist agents.**

**Requirements**:

- ✅ **Priority**: P4 (after P1, P2, P3)
- ✅ **Router role**: Pure orchestration (delegation ONLY)
- ✅ **Router has**: Conversation history (full chat session)
- ✅ **Router decides**: Which specialist agent to call (productSearchAgent, cartManagementAgent, etc.)
- ✅ **Router delegates**: Passes customer query to chosen specialist
- ❌ **Router does NOT**: Respond directly, have tone rules, format answers

**Implementation**:

```typescript
// llm-router.service.ts - P4 normal flow
const routerPrompt = await this.promptProcessor.buildRouterPrompt({
  workspaceId: params.workspaceId,
  customerLanguage: params.customerLanguage,
  conversationHistory: chatHistory,
})

const routerDecision = await this.llmService.chat({
  systemPrompt: routerPrompt,
  messages: conversationHistory,
  functions: routerFunctions, // Delegation functions only
  temperature: 0.3,
})

if (routerDecision.tool_calls) {
  const functionName = routerDecision.tool_calls[0].function.name
  const args = JSON.parse(routerDecision.tool_calls[0].function.arguments)

  // Delegate to specialist agent
  if (functionName === "productSearchAgent") {
    return await this.callProductSearchAgent(args.query, params)
  } else if (functionName === "cartManagementAgent") {
    return await this.callCartManagementAgent(args.query, params)
  }
  // ... other agents
}
```

**Router Functions** (delegation only):

```typescript
// agent-functions.config.ts - Router ONLY has delegation
export const ROUTER_FUNCTIONS: FunctionDefinition[] = [
  {
    type: "function",
    function: {
      name: "productSearchAgent",
      description:
        "Delega al Product & Services Search Agent per ricerca prodotti/servizi",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Query di ricerca del cliente",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cartManagementAgent",
      description: "Delega al Cart Management Agent per operazioni carrello",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Richiesta carrello del cliente",
          },
        },
        required: ["query"],
      },
    },
  },
  // ... other delegation functions
]
```

**Rationale**: Router is traffic cop, not customer service. Separation of concerns (Principle VIII: Multi-Agent Architecture).

**Enforcement**:

- ✅ Router prompt ≤ 3,500 tokens (pure orchestration)
- ❌ Router MUST NOT have tone rules ("warm", "friendly", emojis)
- ❌ Router MUST NOT have dialogue examples
- ❌ Router MUST NOT respond to customer directly
- ✅ MUST have conversation history (all previous messages)

---

#### Rule 5: Router Maintains Conversation History

**Router Agent MUST have access to FULL conversation history for context-aware delegation.**

**Requirements**:

- ✅ **History source**: `chatMessages` table (sessionId filter)
- ✅ **History format**: Array of `{role: "user" | "assistant", content: string, timestamp: Date}`
- ✅ **Order**: Chronological (oldest first)
- ✅ **Scope**: Current session only (workspace-isolated)
- ✅ **Passed to**: Router LLM call (provides context for delegation decision)

**Implementation**:

```typescript
const conversationHistory = await this.prisma.chatMessages.findMany({
  where: { sessionId: session.id },
  orderBy: { timestamp: "asc" },
  select: {
    role: true,
    content: true,
    timestamp: true,
  },
})

const routerDecision = await this.llmService.chat({
  systemPrompt: routerPrompt,
  messages: conversationHistory, // ✅ Full history passed
  functions: routerFunctions,
})
```

**Schema**:

```prisma
model ChatMessages {
  id        String   @id @default(cuid())
  sessionId String
  role      String   // "user" | "assistant" | "system"
  content   String   @db.Text
  timestamp DateTime @default(now())
  // ...
}
```

**Rationale**: Context enables better delegation decisions (e.g., "add that to cart" requires knowing "that" = last product discussed).

**Enforcement**:

- ✅ MUST query full session history before Router LLM call
- ✅ MUST order chronologically (oldest first)
- ✅ MUST include in Router LLM messages array

---

#### Rule 6: Product + Services Unified Agent

**Product Search Agent MUST handle BOTH products AND services in a single unified agent.**

**Requirements**:

- ✅ **Agent name**: "Product & Services Search Agent" (NOT "Product Search Agent")
- ✅ **Handles**: Product discovery + service discovery (unified flow)
- ✅ **Variables**: `{{products}}`, `{{services}}`, `{{categories}}`, `{{offers}}` (all in ONE agent)
- ❌ **NO separation**: Services NOT handled by Router or separate agent
- ✅ **Tone**: Warm, enthusiastic, highlights discounts, uses customer name

**Current State** (WRONG):

```typescript
// ❌ Agent name wrong
agentType: "PRODUCT_SEARCH"
name: "Product Search Agent"

// ❌ Services flow split between Router and ProductSearch
```

**Target State** (CORRECT):

```typescript
// ✅ Correct name
agentType: "PRODUCT_SEARCH"
name: "Product & Services Search Agent"

// ✅ Unified handling
// docs/prompts/product-services-search-agent.md:
// - Handles {{products}} AND {{services}}
// - Unified numbered list (products + services together)
// - Same confirmation flow for both
```

**Rationale**: Products and services are similar shopping entities. Unified agent provides consistent UX and simpler architecture.

**Enforcement**:

- ✅ Rename agent in `defaultAgents.ts`
- ✅ Rename prompt file: `product-search-agent.md` → `product-services-search-agent.md`
- ✅ Update database seed with correct name
- ✅ Verify {{services}} variable in this agent prompt (not Router)

---

#### Rule 7: Variable Uniqueness - One Usage Per Prompt

**Large variables ({{products}}, {{services}}, {{categories}}, {{offers}}) MUST appear at most ONCE per agent prompt.**

**Requirements**:

- ✅ **Already defined**: See Principle III: Variable Uniqueness Constraint
- ✅ **Enforcement**: Validation in `PromptProcessorService.replaceAllVariables()`
- ✅ **Current violations**:
  - ❌ {{services}} in Router prompt (8,000 tokens)
  - ❌ {{services}} in ProductSearch prompt (55,000 tokens)
  - = 5,000+ token waste per request
- ✅ **Target state**:
  - Router: {{faq}} ONLY (3,000 tokens)
  - Product & Services Search: {{products}}, {{services}}, {{categories}}, {{offers}} (60,000 tokens)

**Remediation**:

```markdown
<!-- docs/prompts/router-agent.md - REMOVE {{services}} -->
<!-- Target: 3,000 tokens (orchestration only) -->

<!-- docs/prompts/product-services-search-agent.md - KEEP {{services}} -->
<!-- Has: {{products}}, {{services}}, {{categories}}, {{offers}} -->
```

**Rationale**: See Principle III - prevents 50k+ token duplication, reduces API costs, prevents LLM context overflow.

**Enforcement**:

- ✅ Remove {{services}} from Router prompt (Issue A1 in audit report)
- ✅ Add validation test in `validate-agent-prompts.ts`
- ✅ Constitution Principle III already mandates this

---

#### Rule 8: Router Pure Orchestration (No Dialogue Logic)

**Router Agent prompt MUST contain ONLY intent classification and delegation logic - NO tone rules, NO examples, NO dialogue formatting.**

**Requirements**:

- ✅ **Router prompt contents**:
  - Intent classification rules
  - Delegation function descriptions
  - Edge case handling (5-10 examples MAX)
  - {{faq}} variable (small, <1000 tokens)
- ❌ **Router MUST NOT have**:
  - Tone rules ("warm", "friendly", "use emojis")
  - Customer name usage rules
  - Response formatting rules
  - Dialogue examples (>10 examples)
  - Service flow with confirmations
- ✅ **Target token count**: ≤ 3,500 tokens (from current 8,000)

**Current State** (WRONG):

```markdown
<!-- docs/prompts/router-agent.md (8,000 tokens) -->

## Tone

- Warm and friendly
- Use customer name
- Add emojis 😊
- Highlight discounts

## Examples (100+ lines)

User: "hai burrata?"
Router: "Ciao Andrea! 😊 Sì abbiamo..."
```

**Target State** (CORRECT):

```markdown
<!-- docs/prompts/router-agent.md (3,000 tokens) -->

## Role

You route customer messages to specialist agents. NO direct responses.

## Delegation Functions

- productSearchAgent(query) - Product/service search
- cartManagementAgent(query) - Cart operations
- orderTrackingAgent(query) - Order info/repeat
  ...

## Edge Cases (5 examples)

- Ambiguous: "aggiungi quello" → delegate to productSearchAgent (needs context)
- ...
```

**Specialist agents have tone**:

```markdown
<!-- docs/prompts/product-services-search-agent.md -->

## Tone

- Warm, enthusiastic 😊
- Use customer name: {{nome}}
- Highlight discounts 💰
- Add product emojis 🍖🧀🍷
```

**Rationale**: Router never responds to customer - specialists do. Tone rules in Router are dead code (11,000+ token waste).

**Enforcement**:

- ✅ Strip Router prompt from 8k to 3k tokens (Issue A3 in audit report)
- ✅ Move tone/examples to specialist agents
- ✅ Verify Router only has delegation logic
- ✅ Update constitution Principle VIII to forbid Router dialogue

---

#### Rule 9: Security Gate BEFORE Message Processing

**ALL incoming messages MUST pass through Security & Translation Agent BEFORE Router processing.**

**Requirements**:

- ✅ **Flow order**: WhatsApp → 🛡️ Security Gate → P1-P4 Priorities → Router → Specialist
- ✅ **Security checks**:
  - SQL injection patterns (`'; DROP TABLE`, `UNION SELECT`, etc.)
  - XSS patterns (`<script>`, `javascript:`, etc.)
  - Offensive content
  - Data breach attempts
- ✅ **Translation**:
  - Language detection
  - Translation to Italian (base language)
  - Final translation to customer language (after LLM response)
- ✅ **Action on threat**: Call `sendAlertEmail(reason, details)` + return safe rejection message

**Current State** (WRONG):

```typescript
// ❌ Security AFTER Router
WhatsApp → Priorities (P1-P4) → Router LLM → Specialist → Safety (if needed)
```

**Target State** (CORRECT):

```typescript
// ✅ Security FIRST
WhatsApp → 🛡️ Security Gate → Priorities → Router → Specialist

// Implementation in whatsapp-webhook.controller.ts
async handleIncomingMessage(req: Request, res: Response) {
  const { message, phone } = req.body

  // STEP 1: Security validation (FIRST!)
  const securityCheck = await this.securityService.validateMessage(message)
  if (securityCheck.threat) {
    await this.securityService.sendAlertEmail({
      reason: securityCheck.threatType, // "SQL_INJECTION", "XSS", etc.
      details: message,
      customerId: customer.id,
      workspaceId: workspace.id
    })
    return res.json({
      status: "blocked",
      message: "Invalid request"
    })
  }

  // STEP 2: Language detection + translation to Italian
  const translatedMessage = await this.translationService.toItalian(message)

  // STEP 3: Normal flow (priorities → router)
  const result = await this.llmRouterService.routeMessage({
    message: translatedMessage,
    customerLanguage: detectedLanguage,
    // ...
  })

  // STEP 4: Translate response back to customer language
  const finalResponse = await this.translationService.fromItalian(
    result.finalResponse,
    detectedLanguage
  )

  return res.json({ message: finalResponse })
}
```

**Security Agent Functions**:

```typescript
// docs/prompts/safety-translation-agent.md
sendAlertEmail(reason, details) // Notify admin of security threat
```

**Rationale**: Proactive security layer prevents malicious input from reaching LLM or database. Early detection reduces attack surface.

**Enforcement**:

- ✅ Add Security Gate as FIRST step in `whatsapp-webhook.controller.ts`
- ✅ Update constitution with Security Gate principle
- ✅ Add tests for SQL injection, XSS detection
- ⚠️ **CRITICAL**: Currently missing (Issue A4 in audit report)

---

#### Rule 10: Timeline Integrity

**Message flow timeline (debugInfo.steps[]) MUST be 1:1 mirror of actual LLM execution.**

**Requirements**:

- ✅ **Already defined**: See Principle IX: Message Flow Timeline Integrity
- ✅ **Every LLM call**: MUST push corresponding debugStep
- ✅ **No shortcuts**: NO hardcoded responses that bypass timeline
- ✅ **Observability**: Timeline enables debugging, auditing, performance monitoring

**Implementation**:

```typescript
// llm-router.service.ts - Push debug steps
debugInfo.steps.push({
  timestamp: new Date().toISOString(),
  agentType: "ROUTER",
  systemPrompt: routerPrompt.substring(0, 200),
  input: userMessage,
  decision: routerDecision,
  tokenUsage: routerTokens,
})

// Specialist agent also pushes
debugInfo.steps.push({
  timestamp: new Date().toISOString(),
  agentType: "PRODUCT_SEARCH",
  systemPrompt: specialistPrompt.substring(0, 200),
  input: query,
  response: specialistResponse,
  tokenUsage: specialistTokens,
})
```

**Rationale**: See Principle IX - timeline misalignment causes complete loss of observability.

**Enforcement**:

- ✅ Constitution Principle IX mandates this
- ✅ Already implemented and tested
- ✅ Verify after refactoring that all flows push debug steps

---

#### Rule 11: Single Product Display - All Fields

**When product search returns 1 product, display ALL product fields (name, description, price, code, category, origin, certifications, availability, stock).**

**Requirements**:

- ✅ **Trigger**: Search result = exactly 1 product
- ✅ **Format**: "Format C: Single Product Details" in ProductSearchAgent prompt
- ✅ **Mandatory fields**:
  - Name
  - Description
  - Price (with discount if applicable)
  - Product code
  - Category
  - Origin
  - Certifications (halal, bio, DOP, etc.)
  - Availability
  - Stock quantity
- ✅ **Action**: Ask "Vuoi aggiungerlo al carrello? 🛒"
- ❌ **NO partial display**: Cannot skip fields (show "N/A" if missing)

**Implementation**:

```markdown
<!-- docs/prompts/product-services-search-agent.md -->

### Format C: Single Product Details

When search returns 1 product OR customer selects number, show ALL fields:

🍖 **{{productName}}**
📝 **Descrizione**: {{description}}
💰 **Prezzo**: ~€{{originalPrice}}~ → €{{discountedPrice}} (sconto {{discount}}%)
📋 **Codice**: {{sku}}
🏷️ **Categoria**: {{category}}
🌍 **Origine**: {{origin}}
✅ **Certificazioni**: {{certifications}}
⏰ **Disponibilità**: {{availability}}
📦 **Stock**: {{stockQuantity}} disponibili

Vuoi aggiungerlo al carrello? 🛒 (sì/no)
```

**Rationale**: Customer needs complete information to make purchase decision. Partial details reduce conversion.

**Enforcement**:

- ✅ Defined in ProductSearchAgent prompt (docs/prompts/product-search-agent.md:280-350)
- ⚠️ **Soft requirement** - LLM could ignore, but examples guide behavior
- ⚠️ Consider: Add response validation (check all fields present)

---

#### Rule 12: addToCart Supports Products AND Services

**Cart addition function MUST accept both `type: "PRODUCT"` and `type: "SERVICE"` items.**

**Requirements**:

- ✅ **Function signature**: `addToCart(items: Array<{code, quantity, type, notes?}>)`
- ✅ **Type parameter**: `"PRODUCT" | "SERVICE"`
- ✅ **Single call supports mixed**: Can add products + services in same call
- ✅ **Quantity**: Products = user-defined, Services = always 1
- ✅ **Backend handler**: MUST process both types and save to cart

**Implementation**:

```typescript
// agent-functions.config.ts - Function definition
{
  type: "function",
  function: {
    name: "addToCart",
    description: "Aggiunge prodotti/servizi al carrello. SUPPORTA PRODOTTI E SERVIZI.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              code: { type: "string", description: "Codice prodotto o servizio" },
              quantity: { type: "number", description: "Quantità (default: 1)" },
              type: {
                type: "string",
                enum: ["PRODUCT", "SERVICE"],
                description: "Tipo: PRODUCT per prodotti, SERVICE per servizi"
              },
              notes: { type: "string", description: "Note opzionali" }
            },
            required: ["code", "type"]
          }
        }
      },
      required: ["items"]
    }
  }
}

// calling-functions.service.ts - Backend handler
async addToCart(args: { items: Array<{code: string, quantity?: number, type: "PRODUCT" | "SERVICE", notes?: string}> }) {
  for (const item of args.items) {
    if (item.type === "PRODUCT") {
      const product = await this.prisma.products.findUnique({
        where: { code: item.code, workspaceId }
      })
      // Add product to cart
    } else if (item.type === "SERVICE") {
      const service = await this.prisma.services.findUnique({
        where: { code: item.code, workspaceId }
      })
      // Add service to cart
    }
  }
}
```

**Examples**:

```json
// Single product
{ "items": [{ "code": "BUR-001", "type": "PRODUCT", "quantity": 2 }] }

// Single service
{ "items": [{ "code": "SRV-001", "type": "SERVICE", "quantity": 1 }] }

// Mixed (product + service)
{
  "items": [
    { "code": "PASTA-005", "type": "PRODUCT", "quantity": 3 },
    { "code": "SRV-001", "type": "SERVICE", "quantity": 1 }
  ]
}
```

**Rationale**: Products and services are both purchasable items. Unified cart flow simplifies UX.

**Enforcement**:

- ✅ Function definition includes `type` parameter (already implemented)
- ⚠️ **Needs verification**: Backend handler processes both types (Issue B2 in audit report)
- ⚠️ **Missing tests**: Add test for `addToCart([{type: "SERVICE", ...}])`

---

### Summary: Priority Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│  WhatsApp Message Received                          │
└─────────────────────┬───────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  🛡️ SECURITY GATE (NEW - Rule 9)                    │
│  - SQL injection check                              │
│  - XSS check                                        │
│  - Language detection                               │
│  - Translation to Italian (base)                    │
└─────────────────────┬───────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  P1: Blocked Customer Check (Rule 1)                │
│  isBlocked = true?                                  │
│    YES → Return empty (NO DB, NO LLM, 0 tokens)     │
│    NO  → Continue to P2                             │
└─────────────────────┬───────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  P2: Channel Disabled Check (Rule 2)                │
│  challengeStatus = false?                           │
│    YES → Return WIP message (DB source, 0 LLM)      │
│    NO  → Continue to P3                             │
└─────────────────────┬───────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  P3: New Customer Check (Rule 3)                    │
│  messageCount = 0?                                  │
│    YES → Return welcome message (DB source, 0 LLM)  │
│    NO  → Continue to P4                             │
└─────────────────────┬───────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  P4: Router Agent Orchestration (Rule 4)            │
│  - Load conversation history (Rule 5)               │
│  - Router LLM call (pure orchestration, Rule 8)     │
│  - Delegation decision                              │
│  - Push to debugInfo timeline (Rule 10)             │
└─────────────────────┬───────────────────────────────┘
                      ↓
        ┌─────────────┴──────────────┐
        ↓                            ↓
┌──────────────────┐    ┌────────────────────────────┐
│ Product/Service  │    │ Cart / Order / Support     │
│ Search Agent     │    │ Agents                     │
│ (Rules 6,11)     │    │ (Rule 12)                  │
└──────────────────┘    └────────────────────────────┘
        │                            │
        └─────────────┬──────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  Translation to Customer Language                   │
│  Italian (base) → ES/PT/FR/EN                       │
└─────────────────────┬───────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  WhatsApp Response Sent                             │
└─────────────────────────────────────────────────────┘
```

---

### Compliance Checklist

**Before deploying ANY LLM architecture changes**:

- [ ] **Rule 1**: Blocked customers return empty (test coverage ✅)
- [ ] **Rule 2**: Channel disabled returns WIP from DB (test coverage ✅)
- [ ] **Rule 3**: New customers get welcome from DB (⚠️ add test)
- [ ] **Rule 4**: Router delegates (never responds directly)
- [ ] **Rule 5**: Router has full conversation history
- [ ] **Rule 6**: Agent named "Product & Services Search Agent" (❌ wrong name, fix)
- [ ] **Rule 7**: {{services}} appears ONCE (❌ duplicated, fix)
- [ ] **Rule 8**: Router ≤ 3,500 tokens, no tone/examples (❌ 8k tokens, fix)
- [ ] **Rule 9**: Security Gate BEFORE priorities (❌ missing, add)
- [ ] **Rule 10**: Timeline has all LLM calls (✅ compliant)
- [ ] **Rule 11**: Single product shows all fields (⚠️ in prompt, not enforced)
- [ ] **Rule 12**: addToCart handles PRODUCT/SERVICE (⚠️ verify backend)

**Violations Block Deployment**: Rules 6, 7, 8, 9 are CRITICAL (marked ❌ above).

---

### XV. Router Agent Minimalism (MUST - CRITICAL)

**Router Agent prompt MUST be minimal: classify intent + answer FAQ. NO out-of-scope information.**

**Requirements**:

- ✅ **Max prompt size**: 100 lines (not 460!)
- ✅ **Only 2 responsibilities**:
  1. Classify customer intent → route to specialist agent
  2. Answer FAQ questions directly using {{faq}}
- ❌ **NO agent descriptions** - Router doesn't need to know what agents DO, only their NAMES
- ❌ **NO examples in prompt** - Examples confuse LLM, increase tokens, cause hallucinations
- ❌ **NO performance metrics** - Keep these in constitution, not in agent prompts
- ❌ **NO verbose explanations** - Router is a traffic cop, not customer service
- ❌ **NO metadata headers** - Agent Type, Temperature, Max Tokens → belong in seed config, not prompt

**Required Sections ONLY**:

1. **Role** (2 lines): "Classify intent and route. Answer FAQ directly."
2. **FAQ Knowledge Base**: `{{faq}}` variable
3. **Context Interpretation** (5 lines): How to handle short responses (SI/NO/1/2)
4. **Specialist Agents** (table): Agent name + when to use (1 line each)
5. **Response Format** (JSON schema): routerDecision, contextualizedMessage, confidence, reasoning
6. **Rules** (7 bullet points max): ONLY critical constraints

**Forbidden Sections**:

- ❌ Agent descriptions with examples ("When customer searches products..." → TOO VERBOSE)
- ❌ "You do NOT" lists (Router knows its job, don't over-specify)
- ❌ Performance optimization sections (belongs in constitution)
- ❌ Validation checklists (belongs in tests)
- ❌ Multiple example blocks per agent (1 example is enough IF needed)
- ❌ Context variables section (Router doesn't use {{nome}}, {{email}} for routing)

**Example - CORRECT Minimalist Format**:

```markdown
# Router Agent

## Role

Classify customer intent and route to specialist agents. Answer FAQ directly.

## FAQ Knowledge Base

{{faq}}

## Context Interpretation

When customer sends SHORT response (SI, NO, 1, 2):

1. Read last 3 messages from history
2. Extract context from previous question
3. Build explicit message for specialist agent

## Specialist Agents

| Agent              | When to use              |
| ------------------ | ------------------------ |
| PRODUCT_SEARCH     | Search products/services |
| CART_MANAGEMENT    | Cart operations          |
| ORDER_TRACKING     | Order status             |
| PROFILE_MANAGEMENT | Profile/notifications    |
| CUSTOMER_SUPPORT   | Human assistance         |

## Response Format (JSON)

{
"routerDecision": "PRODUCT_SEARCH"|"CART_MANAGEMENT"|...,
"contextualizedMessage": "...",
"confidence": 0.95,
"reasoning": "..."
}

## Rules

1. Return ONLY valid JSON
2. For short responses: build contextualizedMessage from history
3. For FAQ: answer directly from {{faq}}
4. When uncertain: route to CUSTOMER_SUPPORT
```

**Rationale**: Router is traffic cop, not customer service. Every extra line increases:

- Token cost (460 lines = 8k tokens vs 60 lines = 800 tokens)
- LLM confusion (more text = more hallucination opportunities)
- Maintenance burden (harder to update when business rules change)

**Enforcement**:

- Code review MUST reject prompts >150 lines
- Constitution violations logged and escalated
- Prompt refactoring MUST remove all out-of-scope sections

---

## Operational Configuration

### Debug Mode (SHOULD - RECOMMENDED)

**Workspace `debugMode` flag controls logging verbosity and usage tracking.**

**Requirements**:

- ✅ **When `debugMode = true`** (Development/Testing):
  - Skip usage tracking (`usageService.trackUsage()` NOT called)
  - Skip billing (`BillingService.trackMessage()` NOT called)
  - Enhanced LLM logging (prompt debug files in `backend/logs/`)
  - Disable rate limiting for testing
- ✅ **When `debugMode = false`** (Production):
  - Full usage tracking (€0.15 per message)
  - Full billing records (message + channel + push campaigns)
  - Standard LLM logging only
  - Rate limiting enforced

**Code Reference**: `backend/src/repositories/message.repository.ts:900-920`

```typescript
const workspace = await this.prisma.workspace.findUnique({
  where: { id: workspaceId },
  select: { debugMode: true },
})

// Environment-based fallback when debugMode is NULL (compliant with Database-First)
const effectiveDebugMode = workspace?.debugMode ?? (process.env.NODE_ENV === 'production' ? false : true)

if (!effectiveDebugMode) {
  // debugMode is false → Track usage
  await usageService.trackUsage({ ... })
  await billingService.trackMessage({ ... })
} else {
  // debugMode is true → Skip tracking
  logger.info("[DEBUG MODE] Skipping usage/billing tracking")
}
```

**Impact Analysis**:

| Feature                 | debugMode=true      | debugMode=false        |
| ----------------------- | ------------------- | ---------------------- |
| Usage Tracking          | ❌ Skipped          | ✅ Tracked (€0.15/msg) |
| Billing Records         | ❌ Skipped          | ✅ Created             |
| LLM Prompt Logs         | ✅ Full debug files | ⚠️ Standard logs only  |
| Token Monitoring        | ✅ Enabled          | ✅ Enabled             |
| Rate Limiting           | ❌ Disabled         | ✅ Enforced            |
| WebSocket Notifications | ✅ Enabled          | ✅ Enabled             |

**Default Behavior**: If `workspace.debugMode` is NULL, uses environment-based fallback:

- `NODE_ENV=production` → defaults to `false` (full tracking enabled)
- `NODE_ENV=development` → defaults to `true` (skip billing/usage tracking)
- `NODE_ENV` not set → defaults to `true` (safe default for local development)

**Implementation Pattern**:

```typescript
// Compliant with Principle I (Database-First) - uses environment context when DB value is NULL
const effectiveDebugMode = workspace?.debugMode ?? (process.env.NODE_ENV === 'production' ? false : true)

if (!effectiveDebugMode) {
  await usageService.trackUsage({ ... })
  await billingService.trackMessage({ ... })
} else {
  logger.info("[DEBUG MODE] Skipping usage/billing tracking")
}
```

**Rationale**: Development workspaces should not accumulate billing costs during testing. Production workspaces need full tracking for analytics and invoicing. Environment-based fallback respects Database-First principle (no hardcoded values) while providing safe defaults.

**Enforcement**:

- Seed script MUST create test workspaces with explicit `debugMode=true`
- Production deployment MUST set `NODE_ENV=production` environment variable
- Admin UI SHOULD display debug mode status prominently with indication if using fallback

---

## Testing Standards

### Coverage Requirements

**MUST have tests for**:

- ✅ Unit tests: Business logic, services, utilities (`npm run test:unit`)
- ✅ Security tests: Auth, workspace isolation, HMAC (`npm run test:security`)
- ✅ Integration tests: API endpoints, database operations (`npm run test:integration`)

**Target**: >80% coverage on critical paths (auth, workspace isolation, LLM flow)

**Example**:

```typescript
// Integration test pattern
describe("Workspace Isolation", () => {
  it("MUST NOT access other workspace data", async () => {
    const workspace1Product = await createProduct(workspace1Id)
    const response = await request(app)
      .get(`/workspaces/${workspace2Id}/products/${workspace1Product.id}`)
      .set("Authorization", `Bearer ${workspace2Token}`)
    expect(response.status).toBe(404) // Cannot access other workspace
  })
})
```

---

## Development Workflow

### Code Protection Mechanisms

**MUST implement**:

1. **Git pre-commit hooks**: Validate spec compliance, run linters
2. **Integration tests**: Verify critical behaviors (chatbot disable, workspace isolation)
3. **GitHub Actions CI/CD**: `spec-validation.yml` workflow
4. **Branch protection**: Require status checks + 1 approval + conversation resolution

### API Documentation

**MUST maintain**:

- ✅ Swagger/OpenAPI spec (`backend/src/swagger.yaml`)
- ✅ JSDoc comments with `@swagger` tags on all endpoints
- ✅ Run `npm run build` after API changes to regenerate `swagger.json`

---

## Governance

### Constitution Authority

- ✅ **Constitution supersedes** all coding preferences, shortcuts, or "quick fixes"
- ✅ **Violations are blockers** - PRs violating principles MUST be rejected
- ✅ **Amendments require**:
  1. Documentation of rationale
  2. User (Andrea) approval
  3. Migration plan for existing code
  4. Update to this constitution file

### Development Guidance

**Runtime development guidance**: See `.github/copilot-instructions.md` for:

- Architecture patterns
- Code conventions
- Common tasks
- Debugging tips

**Specification workflow**: Use Specify toolkit:

- `/speckit.analyze` - Validate spec quality
- `/speckit.plan` - Generate implementation plan
- `/speckit.tasks` - Break down into actionable tasks
- `/speckit.implement` - Generate code from spec

---

## Feature 127: System Message Fast-Path (Chatbot Reactivation Notification)

**FEATURE**: Admin can send system notifications (e.g., "Chatbot reactivated") that skip Router/SubLLM processing and go directly to Safety+Translation layer.

**Use Case**: When admin enables customer chatbot, optionally send WhatsApp notification "Il chatbot è di nuovo disponibile, come posso aiutarti oggi?"

**Key Innovation**: `isSystemMessage` flag in `routeMessage()` bypasses Router/SubLLM for 90% token savings (18k tokens → 2k tokens).

**Flow Diagram**:

```
Normal Message (user → system):
User → Security → P1(Blocked) → Router LLM → SubLLM → Router → Safety → History → WhatsApp
                                  (~5k tokens)  (~10k)   (~3k)   (~2k)

System Message (system → user):
Admin → Security → P1(Blocked) → [SKIP Router] → [SKIP SubLLM] → Safety → History → WhatsApp
                                                                    (~2k tokens only)
```

**Implementation**:

```typescript
// RouteMessageParams interface
export interface RouteMessageParams {
  workspaceId: string
  customerId: string
  conversationId: string
  messageId: string
  message: string
  customerLanguage?: string
  customerName?: string
  isSystemMessage?: boolean // 🆕 If true, skip Router/SubLLM
}

// llm-router.service.ts
async routeMessage(params: RouteMessageParams): Promise<RouteMessageResponse> {
  // P1: Blocked user check
  if (await this.checkBlockedUser(params.customerId)) {
    return { response: "", isBlocked: true, tokensUsed: 0 }
  }

  // 🆕 P1.5: SYSTEM MESSAGE FAST-PATH
  if (params.isSystemMessage) {
    logger.info("🚀 SYSTEM MESSAGE: Skip Router/SubLLM → Safety+Translation")

    // 1. Translate (Italian → customer language)
    const safetyResult = await this.safetyAgent.process({
      workspaceId: params.workspaceId,
      response: params.message, // Italian base
      targetLanguage: params.customerLanguage || "it",
      customerName: params.customerName,
    })

    // 2. Save as assistant message in history
    await this.conversationManager.saveAssistantMessage({
      workspaceId: params.workspaceId,
      customerId: params.customerId,
      conversationId: params.conversationId,
      content: safetyResult.translatedText,
      agentType: "SYSTEM_NOTIFICATION",
      tokensUsed: safetyResult.tokensUsed,
    })

    // 3. Return (queued for WhatsApp)
    return {
      response: safetyResult.translatedText,
      agentUsed: "SYSTEM_NOTIFICATION",
      tokensUsed: safetyResult.tokensUsed || 0,
      executionTimeMs: Date.now() - startTime,
      wasFAQ: false,
    }
  }

  // Normal flow continues...
}
```

**Usage Example**:

```typescript
// push.controller.ts
const result = await llmRouterService.routeMessage({
  workspaceId,
  customerId: customer.id,
  conversationId: chatSession.id,
  messageId: `system-notify-${Date.now()}`,
  message: `🤖 Ciao ${customer.name}, il chatbot è ora disponibile, come posso aiutarti oggi?`,
  customerLanguage: customer.language,
  customerName: customer.name,
  isSystemMessage: true, // 🚀 Fast-path enabled
})
```

**Performance Impact**:

| Metric      | Normal Message                  | System Message  | Savings |
| ----------- | ------------------------------- | --------------- | ------- |
| Tokens Used | ~20,000                         | ~2,000          | 90%     |
| API Cost    | $0.030                          | $0.003          | $0.027  |
| Latency     | ~3000ms                         | ~500ms          | 83%     |
| LLM Calls   | 4 (Router x2 + SubLLM + Safety) | 1 (Safety only) | 75%     |

**Enforcement**:

- ✅ MUST add `isSystemMessage?: boolean` to `RouteMessageParams`
- ✅ MUST check `isSystemMessage` AFTER P1 blocked check, BEFORE Router LLM
- ✅ MUST save with `agentType: "SYSTEM_NOTIFICATION"` for tracking
- ✅ MUST pass through SafetyTranslationAgent (security + translation mandatory)
- ✅ MUST save as `role: "assistant"` in `conversation_messages` table
- ✅ MUST have unit test coverage (token usage, history, translation)

**See Also**:

- `specs/127-chatbot-reactivation-notification/spec.md`
- `backend/src/services/llm-router.service.ts:363-447` (implementation)
- `backend/src/interfaces/http/controllers/push.controller.ts` (usage)

---

### XIV. Context Interpretation Pattern (MUST - CRITICAL)

**Router Agent MUST interpret short customer responses ("SI", "NO", "OK", "1", "2") by reading conversation history and converting them to explicit, self-contained messages for specialist agents.**

**Context**: When customer sends short responses like "SI" or "1", specialist agents receive these messages **without context** because they don't have conversation history. This causes:

- ❌ **Ambiguity**: "SI" could mean "yes add to cart", "yes disable notifications", "yes track order"
- ❌ **Lost intent**: Specialist doesn't know what customer confirmed
- ❌ **Poor UX**: LLM responds "Cosa intendi con 'SI'?"

**Solution**: Router reads last 3 messages from history, extracts context, and builds explicit message for specialist.

---

#### Pattern Requirements

**MUST apply to ALL specialist agents**:

- ✅ **CART_MANAGEMENT**: "SI" → "L'utente conferma l'aggiunta dei prodotti [PROD-001, PROD-002] al carrello"
- ✅ **ORDER_TRACKING**: "1" → "L'utente ha selezionato l'ordine #ORD-12345 per visualizzare i dettagli"
- ✅ **PRODUCT_SEARCH**: "2" → "L'utente ha selezionato il prodotto 'Parmigiano Reggiano DOP 24 mesi' (codice PARM-001)"
- ✅ **PROFILE_MANAGEMENT**: "SI" → "L'utente conferma di voler modificare il proprio indirizzo email"
- ✅ **NOTIFICATIONS**: "NO" → "L'utente rifiuta l'attivazione delle notifiche push promozionali"
- ✅ **CUSTOMER_SUPPORT**: "OK" → "L'utente conferma di aver ricevuto supporto e non ha altre domande"

**Trigger Conditions** (when to apply pattern):

1. Customer message is ≤ 5 characters
2. Customer message matches pattern: `/^(si|no|ok|sì|[0-9]{1,2})$/i`
3. Last assistant message contains question or action request

**Router Prompt Logic** (added to `docs/prompts/router-agent-CLEAN.md`):

```markdown
### Context Interpretation (CRITICAL)

When customer sends SHORT RESPONSES (≤5 chars: "SI", "NO", "OK", "1", "2"), you MUST:

1. Read last 3 messages from history
2. Extract context (what question/action was proposed)
3. Build EXPLICIT message for specialist

**Examples**:

**Cart Scenario**:
```

History:
Assistant: "Aggiungo questi prodotti al carrello: Parmigiano DOP (PARM-001), Prosciutto Crudo (PROS-002). Confermi?"
User: "SI"

Router Action:
routerDecision = "CART_MANAGEMENT"
contextualizedMessage = "L'utente conferma l'aggiunta dei prodotti Parmigiano DOP (PARM-001) e Prosciutto Crudo (PROS-002) al carrello"

```

**Notification Scenario**:

```

History:
Assistant: "Vuoi attivare le notifiche push per ricevere offerte esclusive?"
User: "NO"

Router Action:
routerDecision = "NOTIFICATIONS"
contextualizedMessage = "L'utente rifiuta l'attivazione delle notifiche push promozionali"

```

**Product Selection Scenario**:

```

History:
Assistant: "Ecco i risultati:

1. Parmigiano Reggiano DOP 24 mesi (PARM-001) - €35.00
2. Grana Padano DOP 18 mesi (GRAN-001) - €28.00

Quale preferisci?"
User: "1"

Router Action:
routerDecision = "PRODUCT_SEARCH"
contextualizedMessage = "L'utente ha selezionato il prodotto 'Parmigiano Reggiano DOP 24 mesi' (codice PARM-001)"

```

**Order Selection Scenario**:

```

History:
Assistant: "Ecco i tuoi ordini:

1. Ordine #ORD-12345 del 10/11/2024 - €45.00 (In transito)
2. Ordine #ORD-12344 del 05/11/2024 - €32.00 (Consegnato)

Quale vuoi tracciare?"
User: "1"

Router Action:
routerDecision = "ORDER_TRACKING"
contextualizedMessage = "L'utente ha selezionato l'ordine #ORD-12345 per visualizzare i dettagli di spedizione"

```

**Profile Update Scenario**:

```

History:
Assistant: "Vuoi modificare il tuo indirizzo email da mario.rossi@example.com?"
User: "SI"

Router Action:
routerDecision = "PROFILE_MANAGEMENT"
contextualizedMessage = "L'utente conferma di voler modificare il proprio indirizzo email"

```

```

---

#### Implementation Pattern

**Router Agent Prompt** (`docs/prompts/router-agent-CLEAN.md`):

```markdown
## Your Response Format (JSON)

{
"routerDecision": "CART_MANAGEMENT" | "ORDER_TRACKING" | "PRODUCT_SEARCH" | "PROFILE_MANAGEMENT" | "NOTIFICATIONS" | "CUSTOMER_SUPPORT",
"contextualizedMessage": "EXPLICIT MESSAGE WITH CONTEXT EXTRACTED FROM HISTORY",
"confidence": 0.95,
"reasoning": "Short response detected - contextualized as cart confirmation"
}

**CRITICAL**: When customer sends short response, `contextualizedMessage` MUST be explicit and self-contained!
```

**Backend Implementation** (`backend/src/application/services/llm-router.service.ts`):

```typescript
async routeMessage(params: RouteMessageParams): Promise<RouterResult> {
  // ... P1-P4 checks ...

  // STEP 1: Router LLM call (with full history)
  const routerDecision = await this.callRouterLLM({
    workspaceId: params.workspaceId,
    message: params.message,
    conversationHistory: params.conversationHistory, // MUST include last 3+ messages
  })

  // STEP 2: Delegate to specialist with contextualized message
  const specialistResult = await this.delegateToSpecialist({
    agentType: routerDecision.routerDecision,
    message: routerDecision.contextualizedMessage, // ✅ Use contextualized message!
    conversationHistory: [], // Specialist doesn't need history (message is explicit)
  })

  return specialistResult
}
```

---

#### Test Coverage Requirements

**MUST have tests for ALL agents**:

```typescript
describe("Context Interpretation Pattern", () => {
  it("CART: Should contextualize 'SI' as cart confirmation", async () => {
    const history = [
      {
        role: "assistant",
        content: "Aggiungo Parmigiano (PARM-001). Confermi?",
      },
      { role: "user", content: "SI" },
    ]

    const result = await llmRouterService.routeMessage({
      message: "SI",
      conversationHistory: history,
    })

    expect(result.agentUsed).toBe("CART_MANAGEMENT")
    expect(result.contextualizedMessage).toContain("conferma l'aggiunta")
    expect(result.contextualizedMessage).toContain("PARM-001")
  })

  it("NOTIFICATIONS: Should contextualize 'NO' as notification rejection", async () => {
    const history = [
      { role: "assistant", content: "Vuoi attivare le notifiche push?" },
      { role: "user", content: "NO" },
    ]

    const result = await llmRouterService.routeMessage({
      message: "NO",
      conversationHistory: history,
    })

    expect(result.agentUsed).toBe("NOTIFICATIONS")
    expect(result.contextualizedMessage).toContain("rifiuta")
    expect(result.contextualizedMessage).toContain("notifiche push")
  })

  it("PRODUCT: Should contextualize '1' as product selection", async () => {
    const history = [
      {
        role: "assistant",
        content:
          "1. Parmigiano DOP (PARM-001) €35\n2. Grana Padano (GRAN-001) €28\n\nQuale preferisci?",
      },
      { role: "user", content: "1" },
    ]

    const result = await llmRouterService.routeMessage({
      message: "1",
      conversationHistory: history,
    })

    expect(result.agentUsed).toBe("PRODUCT_SEARCH")
    expect(result.contextualizedMessage).toContain("Parmigiano DOP")
    expect(result.contextualizedMessage).toContain("PARM-001")
  })

  it("ORDER: Should contextualize '2' as order selection", async () => {
    const history = [
      {
        role: "assistant",
        content:
          "1. Ordine #ORD-001 (€45)\n2. Ordine #ORD-002 (€32)\n\nQuale vuoi tracciare?",
      },
      { role: "user", content: "2" },
    ]

    const result = await llmRouterService.routeMessage({
      message: "2",
      conversationHistory: history,
    })

    expect(result.agentUsed).toBe("ORDER_TRACKING")
    expect(result.contextualizedMessage).toContain("ORD-002")
  })

  it("PROFILE: Should contextualize 'SI' as profile update confirmation", async () => {
    const history = [
      {
        role: "assistant",
        content: "Vuoi modificare il tuo indirizzo email da mario@example.com?",
      },
      { role: "user", content: "SI" },
    ]

    const result = await llmRouterService.routeMessage({
      message: "SI",
      conversationHistory: history,
    })

    expect(result.agentUsed).toBe("PROFILE_MANAGEMENT")
    expect(result.contextualizedMessage).toContain("conferma")
    expect(result.contextualizedMessage).toContain("indirizzo email")
  })
})
```

---

#### Edge Cases & Validation

**NON-short responses**: Pattern does NOT apply to normal messages

```typescript
// ❌ NO contextualization needed
User: "Voglio aggiungere il Parmigiano al carrello"
Router: routerDecision = "CART_MANAGEMENT", contextualizedMessage = original message
```

**Ambiguous short responses**: If context unclear, Router defaults to FAQ/support

```typescript
// ⚠️ No clear question in history
History: [{ role: "assistant", content: "Ciao, come posso aiutarti?" }]
User: "SI"

Router Action:
routerDecision = "CUSTOMER_SUPPORT"
contextualizedMessage = "L'utente ha inviato una risposta ambigua 'SI' senza contesto chiaro"
```

**Multiple possible interpretations**: Router uses last question only

```typescript
// Multiple questions in history
History: [
  { role: "assistant", content: "Vuoi attivare le notifiche?" },
  { role: "assistant", content: "Oppure preferisci aggiungere prodotti al carrello?" },
]
User: "SI"

Router Action:
// ✅ Use LAST question
routerDecision = "CART_MANAGEMENT"
contextualizedMessage = "L'utente conferma di voler aggiungere prodotti al carrello"
```

---

#### Rationale

**Problem**: Specialist agents operate in isolation without conversation history. Short responses like "SI" are meaningless without context.

**Solution**: Router acts as **context bridge** - reads history, extracts intent, builds explicit message.

**Benefits**:

- ✅ **Zero ambiguity**: Specialists always receive explicit, self-contained messages
- ✅ **Better UX**: Customer can use natural short responses ("SI", "1", "OK")
- ✅ **Reduced errors**: LLM doesn't need to guess customer intent
- ✅ **Consistent pattern**: Works across ALL agents (Cart, Order, Product, Profile, Notifications)

**Impact**:

- Router token usage increases by ~500 tokens (history reading)
- Specialist token usage DECREASES by ~2k tokens (no history needed)
- Net savings: ~1.5k tokens per short response
- Error rate drops from ~15% to <2% (based on production data)

---

#### Compliance Checklist

**Before deploying contextualization pattern**:

- [ ] Router prompt includes context interpretation instructions
- [ ] Router reads at least last 3 messages from history
- [ ] Router outputs `contextualizedMessage` in JSON response
- [ ] Backend passes `contextualizedMessage` to specialist (not original short response)
- [ ] Tests cover ALL agents (Cart, Order, Product, Profile, Notifications, Support)
- [ ] Tests cover edge cases (ambiguous history, multiple questions)
- [ ] Production monitoring tracks contextualization success rate

**Violations Block Deployment**: Missing contextualization for ANY agent is CRITICAL bug.

---

### Principle XV: User Context Freedom (MUST - CRITICAL)

**Architectural Mandate**: Users can switch conversation context at **ANY** moment. The system MUST handle this gracefully without hardcoded phrase detection.

---

#### Core Philosophy

> "L'utente è LIBERO di cambiare contesto in qualsiasi momento."

Users are having natural conversations. They might:
- Be browsing products → suddenly ask about an order
- Be adding to cart → ask "come pago?"
- Be mid-checkout → ask "avete anche questo prodotto?"
- Be reviewing order → ask for shipping services

**The system MUST adapt, not force users into rigid flows.**

---

#### Input Classification Rules

**ONLY TWO input types are recognized deterministically:**

| Input Type | Detection Method | Action |
|------------|------------------|--------|
| **NUMBER** | Regex: `/^(\d+)$/` | USE previous context (list selection) |
| **TEXT** | Everything else | RESET state, fresh Intent Parser |

**Special Cases (allowed):**
- Yes/No confirmation: `/^(s[iì]|no|ok|yes)$/i`
- Quantity confirmation: "sì 3", "si, 2 pezzi"

**FORBIDDEN:**
- ❌ NO hardcoded phrase detection (if message.includes("ordine"))
- ❌ NO regex for specific phrases (if /mostra.*prodotti/.test())
- ❌ NO keyword arrays (const orderWords = ["ordine", "order", "pedido"])
- ❌ NO language-specific patterns (except yes/no/numbers)

---

#### State Reset Pattern

**Location**: `chat-engine.service.ts` STEP 0.55 (after preprocessing, before fast-paths)

```typescript
// STEP 0.55: Reset context when user writes FREE TEXT
if (preprocessResult.inputType === "text" || preprocessResult.inputType === "unknown") {
  // Clear previous list context
  await this.optionsMappingService.clearMapping(conversationId)
  
  // Reset FSM to IDLE - fresh start
  if (chatSession) {
    await this.conversationStateService.setState(chatSession.id, ConversationState.IDLE, {})
  }
  
  logger.info("🔄 [ChatEngine] TEXT input → Reset state to IDLE")
}
```

**Why this works:**
1. User writes "mostrami l'ordine" (TEXT) → state reset → Intent Parser → ORDER_TRACKING
2. User writes "2" (NUMBER) → keep context → use optionsMapping → select item #2

---

#### Flow Examples

**Example 1: Product browsing → Order question**
```
User: "mostra prodotti"           → TEXT → reset → PRODUCT_SEARCH → shows list
User: "2"                         → NUMBER → keep context → select product #2
User: "mostrami il mio ordine"    → TEXT → reset → ORDER_TRACKING → shows order
```

**Example 2: Mid-checkout context switch**
```
User: "aggiungi al carrello"      → TEXT → reset → CART_MANAGEMENT
Assistant: "Quale prodotto vuoi aggiungere? 1. Parmigiano 2. Salame"
User: "ma avete servizi?"         → TEXT → reset → SERVICE_SEARCH → shows services
```

**Example 3: Number selection preserves context**
```
Assistant: "Ecco i prodotti: 1. Pasta 2. Olio 3. Vino"
User: "2"                         → NUMBER → optionsMapping used → Olio selected
User: "voglio anche il 3"         → TEXT (has words!) → reset → Intent Parser
                                    → Intent: "voglio anche il 3" parsed fresh
```

---

#### Pattern Matcher Constraints

**File**: `pattern-matcher.ts`

```typescript
/**
 * CRITICAL: Avoid hardcoded multilingual patterns.
 * This module intentionally supports ONLY:
 * - Pure numeric selection ("1", "2", "3")
 * - Yes/No confirmation ("sì", "no", "ok")
 * - Quantity patterns ("sì 3", "2 pezzi")
 * 
 * ALL other intent detection goes to Intent Parser (LLM-based).
 */
export function matchAllPatterns(message: string, context: ConversationContext): Intent | null {
  // ONLY numeric selection - nothing else!
  return matchNumericSelection(message, context)
}
```

**Why minimal?**
- Multilingual support: "ordine", "order", "pedido", "encomenda" - can't hardcode all
- Natural language variance: "mostrami", "fammi vedere", "voglio", "dammi"
- LLM handles nuance: sarcasm, typos, context-dependent meaning

---

#### Anti-Patterns (VIOLATIONS)

**❌ WRONG - Hardcoded phrase detection:**
```typescript
// VIOLATION: Language-specific hardcoding
if (message.toLowerCase().includes("ordine")) {
  return { intent: "ORDER_TRACKING" }
}

// VIOLATION: Keyword arrays
const productKeywords = ["prodotto", "product", "producto"]
if (productKeywords.some(k => message.includes(k))) { ... }

// VIOLATION: Regex for phrases
if (/mostra.*ordini?/i.test(message)) { ... }
```

**✅ CORRECT - Let Intent Parser handle it:**
```typescript
// Only detect input TYPE, not content
if (preprocessResult.inputType === "text") {
  // Reset state, let Intent Parser figure out intent
  await this.optionsMappingService.clearMapping(conversationId)
}

// Intent Parser uses LLM to understand ANY language
const intent = await intentParserService.parseIntent(message, workspaceId)
```

---

#### Testing Requirements

**Unit Tests MUST verify:**

```typescript
describe("User Context Freedom", () => {
  it("TEXT input should reset state", async () => {
    // Setup: User was browsing products (state = BROWSING_PRODUCTS)
    await setState(chatSessionId, ConversationState.BROWSING_PRODUCTS)
    await setOptionsMapping(conversationId, productListMapping)
    
    // Action: User sends TEXT
    await chatEngine.routeMessage({ message: "mostrami l'ordine" })
    
    // Verify: State reset to IDLE
    const state = await getState(chatSessionId)
    expect(state).toBe(ConversationState.IDLE)
    
    // Verify: optionsMapping cleared
    const mapping = await getOptionsMapping(conversationId)
    expect(mapping).toBeNull()
  })
  
  it("NUMBER input should preserve context", async () => {
    // Setup: Product list shown
    await setState(chatSessionId, ConversationState.BROWSING_PRODUCTS)
    await setOptionsMapping(conversationId, { "1": "PROD-001", "2": "PROD-002" })
    
    // Action: User sends NUMBER
    await chatEngine.routeMessage({ message: "2" })
    
    // Verify: Context used (product selected)
    expect(response).toContain("PROD-002")
  })
  
  it("Mid-flow context switch should work", async () => {
    // User is in cart flow, asks about services
    await setState(chatSessionId, ConversationState.ADDING_TO_CART)
    
    await chatEngine.routeMessage({ message: "avete servizi di spedizione?" })
    
    // State reset, service search executed
    const state = await getState(chatSessionId)
    expect(state).toBe(ConversationState.IDLE) // Or SERVICE_BROWSING
  })
})
```

---

#### Rationale

**Problem**: Users don't follow rigid conversation flows. They context-switch constantly.

**Previous Approach (WRONG)**: Hardcoded phrase detection for "ordine", "carrello", etc.
- Breaks with typos, synonyms, other languages
- Maintenance nightmare (add every keyword in every language)
- Fails natural conversation patterns

**Current Approach (CORRECT)**: Detect input TYPE, not content
- NUMBER → Use context (list selection)
- TEXT → Reset state, fresh Intent Parser
- LLM handles language/nuance/context interpretation

**Benefits:**
- ✅ Works in any language (LLM is multilingual)
- ✅ Handles typos, synonyms, natural variation
- ✅ Zero maintenance for phrase lists
- ✅ Users feel free, not constrained

---

#### Compliance Checklist

**Before deploying context freedom pattern:**

- [ ] `pattern-matcher.ts` has ONLY numeric/yes-no matching
- [ ] `chat-engine.service.ts` has STEP 0.55 state reset for TEXT input
- [ ] NO `if (message.includes("keyword"))` anywhere in chat flow
- [ ] NO language-specific regex patterns for phrases
- [ ] Tests cover: TEXT→reset, NUMBER→preserve, mid-flow switch
- [ ] Intent Parser handles ALL phrase-based intent detection

**Violations Block Deployment**: Any hardcoded phrase detection is CRITICAL bug.

---

**Version**: 2.2.0 | **Ratified**: 2025-11-12 | **Last Amended**: 2025-12-15
