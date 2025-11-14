<!--
  SYNC IMPACT REPORT

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

# ShopME Constitution

**Version**: 1.10.0 (MINOR - Server Auto-Restart Prevention)  
**Last Updated**: 2025-11-14

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

**The variables `{{PRODUCTS}}`, `{{OFFERS}}`, `{{SERVICES}}`, `{{CATEGORIES}}` MUST appear at most ONCE per prompt.**

**Requirements**:

- ❌ **ZERO duplicate usage** - Each large variable (PRODUCTS/OFFERS/SERVICES/CATEGORIES) can only appear ONCE in the same prompt
- ✅ **Token explosion prevention** - Prevents accidental duplication that causes 50k+ token prompts
- ✅ **Validation on save** - Admin UI MUST validate prompts before saving to `agentConfig`
- ✅ **Runtime detection** - `PromptProcessorService` MUST throw error if duplicates detected (prevents LLM API failure)

**Examples**:

```typescript
// ❌ WRONG - Duplicate {{PRODUCTS}} variable
const badPrompt = `
Ecco i nostri prodotti: {{PRODUCTS}}
...
Se vuoi vedere di nuovo, ecco i prodotti: {{PRODUCTS}}
`
// Result: Products list injected TWICE → 100k+ tokens → API failure

// ✅ CORRECT - Single usage of {{PRODUCTS}}
const goodPrompt = `
Ecco il nostro catalogo completo: {{PRODUCTS}}
Puoi chiedermi dettagli su qualsiasi prodotto.
`
// Result: Products list injected ONCE → ~50k tokens → works properly

// ✅ CORRECT - Multiple DIFFERENT variables allowed
const mixedPrompt = `
Categorie disponibili: {{CATEGORIES}}
Offerte attive: {{OFFERS}}
Prodotti in catalogo: {{PRODUCTS}}
`
// Result: Each variable used once → valid prompt
```

**Rationale**:

- `{{PRODUCTS}}` can contain 1000+ products → ~50k tokens per injection
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
  const largeVariables = ["PRODUCTS", "OFFERS", "SERVICES", "CATEGORIES"]

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

**LLMs MUST NOT copy product names from prompt examples - only from `{{PRODUCTS}}` variable.**

**Problem**: Agent prompts contain examples with fake product names (e.g., "Salame Toscano", "Parmigiano Reggiano 24 mesi"). LLMs can hallucinate and copy these examples instead of reading actual catalog data.

**Requirements**:

- ✅ **Warning at prompt start**: ALL agent prompts MUST have warning box: "⚠️ EXAMPLE PRODUCTS ARE FAKE - DON'T COPY THEM"
- ✅ **Generic placeholders**: Use `[PRODUCT_NAME]`, `[CATEGORY]` instead of real-looking names in examples
- ✅ **Explicit instruction**: "NEVER copy product names from examples - extract from {{PRODUCTS}} only"
- ✅ **"Maximum 5" clarification**: "Maximum 5 is a LIMIT (not a target) - if catalog has 2 products, show 2"
- ❌ **NO realistic fake examples**: Never use "Salame Milano 200g €6.80" in examples (LLM will copy it)

**Implementation Pattern**:

```markdown
# ProductSearchAgent Prompt

## ⚠️⚠️⚠️ CRITICAL WARNING ⚠️⚠️⚠️

**ALL EXAMPLE PRODUCTS IN THIS PROMPT ARE FAKE!**

Examples like "Parmigiano Reggiano", "Salame Toscano" are NOT in your catalog.

🚨 NEVER copy product names from examples
✅ ONLY use exact names from {{PRODUCTS}} variable
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

- Manual: Ask "avete salami?" and verify response only contains products from `{{PRODUCTS}}`
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

- ✅ **ONE dynamic variable per category** per prompt ({{PRODUCTS}} OR {{PRODUCT_DETAILS}}, not both)
- ❌ Multiple similar variables create ambiguity and prompt confusion
- ✅ **Router MUST NOT have {{PRODUCTS}} or {{CATEGORIES}}** (ProductSearch only)

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

| Agent                | Domain                      | Has {{PRODUCTS}} | Has {{CATEGORIES}} | Outputs Language    |
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
- Variable isolation prevents prompt bloat (Router with {{PRODUCTS}} = 50k+ unnecessary tokens)

**Enforcement**:

- Code reviews MUST verify agent domain separation (Router ≠ ProductSearch variables)
- Integration tests MUST validate delegation flow (Router → Specialist → Router → Safety)
- Prompt audits MUST check variable isolation (`grep "{{PRODUCTS}}" docs/prompts/*.md`)
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
  - ✅ PromptProcessorService: {{PRODUCTS}} includes all 5 (verified in logs/prompt-debug files)
  - ❌ **LLM output**: Only 4 shown consistently (Taleggio missing)
- **Root Cause**: `searchConversations` table cached first response with 4 products, LLM reused cache instead of re-filtering from fresh {{PRODUCTS}}
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

**Version**: 1.9.1 | **Ratified**: 2025-11-12 | **Last Amended**: 2025-11-14
