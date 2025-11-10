# ShopME Hierarchical Product Filtering Constitution

## Core Principles

### I. Database-First Architecture (NON-NEGOTIABLE)

**Rule:**

- ALL configuration, prompts, product data, and metadata MUST come from database
- ZERO hardcoded values, fallback data, or mock constants in business logic
- If data missing → return proper error, NEVER invent defaults
- Every database query MUST filter by `workspaceId` (multi-tenant isolation)

**Rationale:**  
Multi-tenant system requires workspace isolation. Hardcoded values break tenant separation and prevent runtime updates without deployment.

**Enforcement:**

- Code review MUST reject PRs with hardcoded prompts/categories/product data
- Tests MUST verify database queries include `workspaceId` filter
- NO files in `src/constants/` for business data (only technical constants)

### II. Clean Architecture Separation (NON-NEGOTIABLE)

**Rule:**

```
backend/src/
├── application/        # Business logic orchestration (NO database calls)
├── repositories/       # Database access ONLY (Prisma queries)
├── interfaces/http/    # Controllers, routes, middleware (thin layer)
├── services/           # External integrations (LLM, email)
```

- Controllers call Services
- Services call Repositories
- Repositories call Prisma
- NEVER skip layers (Controller → Prisma directly = VIOLATION)

**Rationale:**  
Maintainability, testability, clear responsibilities. Database changes should not require controller changes.

**Enforcement:**

- Import analyzer: Controllers cannot import Prisma directly
- Each layer tested independently

### III. LLM Prompt Isolation (NON-NEGOTIABLE)

**Rule:**

- Each LLM agent has ONE prompt in database (`agentConfig` table)
- Prompt source: `docs/prompts/{agent}.md` → sync via `npm run update:prompts`
- Prompts use variable replacement (`{{nameUser}}`, `{{CATEGORIES}}`)
- NEVER embed prompt instructions in TypeScript code
- Router LLM cannot execute other agents' functions (security)

**Rationale:**  
Prompts evolve frequently. Code deployments expensive. Separation enables A/B testing.

**Enforcement:**

- `update:prompts` validates markdown
- Runtime: Agent loads from DB, logs error if missing
- Security middleware blocks cross-agent calls

### IV. Progressive Filtering State (NON-NEGOTIABLE)

**Rule:**

```typescript
// SearchConversations (10 min TTL)
{
  activeAgent: "PRODUCT_SEARCH" | "CART" | null,
  metadata: {
    filteredProducts: [],  // Cached for refinement
    grouping: {}           // Smart grouping metadata
  }
}
```

**Flow:**

1. `searchProducts()` → `{ products, grouping }`
2. If `grouping.canGroup` → Show groups, NOT products
3. User selects group → Call `searchProducts(keywords)` → Filter in memory
4. User refines → Continue filtering same `filteredProducts` (NO DB)
5. **RESET when:** (see below)

**WHEN TO RESET `filteredProducts` (3 scenarios):**

**Scenario 1: Context Switch (activeAgent changes)**

```typescript
// llm-router.service.ts
const previousAgent = currentConversation?.activeAgent
const isLeavingProductSearch =
  previousAgent === "PRODUCT_SEARCH" && delegationTarget !== "PRODUCT_SEARCH"

if (isLeavingProductSearch) {
  metadata.filteredProducts = null // RESET
}
```

**Example:** User in ProductSearch → says "carrello" → Router delegates to Cart → RESET filteredProducts

**Scenario 2: New Search (isRefinement = false)**

```typescript
// ProductSearchAgentLLM.ts - searchProducts function
if (analysisResult.isRefinement && hasFilteredList) {
  // Use existing filteredProducts
} else {
  // NEW SEARCH → Database query → RESET with new list
  filteredProducts = newSearchResults
}
```

**Example:** User searched "formaggi" → then "pasta" → New category = new search → RESET

**Scenario 3: Timeout (10 min TTL)**

```typescript
// SearchConversations schema
expiresAt: datetime // Auto-cleanup after 10 min
```

**Example:** User abandons conversation → 10 min later → SearchConversation deleted → RESET

**DELEGATION FLOW:**

**Router → ProductSearch (FORCE delegation when activeAgent set):**

```typescript
// llm-router.service.ts
if (activeAgent === "PRODUCT_SEARCH") {
  const exitKeywords = ["carrello", "cart", "ordini", "help", "operatore"]
  const isExitQuery = exitKeywords.some(kw => query.includes(kw))

  if (isExitQuery) {
    // Let Router LLM decide new context
  } else {
    // FORCE delegate ALL queries to ProductSearch (bypass Router LLM)
    return delegateToActiveAgent(...)
  }
}
```

**QueryAnalyzer → isRefinement detection:**

```typescript
// QueryAnalyzerAgentLLM.ts
const refinementKeywords = ["solo", "voglio", "dop", "24 mesi", "economico"]
const newSearchKeywords = ["avete", "cerca", "vorrei", "quale"]

if (hasFilteredList && hasRefinementKeywords && !hasNewSearchKeywords) {
  isRefinement = true // Filter in memory
} else {
  isRefinement = false // New database search
}
```

**Rationale:**  
Database expensive. Progressive filtering needs cached results. Clear reset rules prevent stale data.

**Enforcement:**

- Test: "formaggi → DOP → 24 mesi" = MAX 1 database query
- Test: "formaggi → DOP → carrello" = filteredProducts RESET when entering Cart
- Test: "formaggi → pasta" = NEW search, filteredProducts replaced
- Logs show "REFINEMENT MODE: Filtering X in memory" OR "NEW SEARCH: Querying database"
- Logs show "🧹 Leaving PRODUCT_SEARCH context → Resetting filteredProducts"

### V. Smart Grouping Priority (NON-NEGOTIABLE)

**Rule:**  
`ProductSearchAgent.analyzeGrouping()` priority:

1. CERTIFICATION (DOP, IGP, Bio + "Senza certificazione")
2. TYPE (freschi, stagionati, pasta molle/dura)
3. FORMAT (sizes)
4. REGION (last resort)

**Criteria:**

- Requires >= 2 groups
- LLM checks `grouping.canGroup` BEFORE response

**Enforcement:**

- Test: 7 formaggi → CERTIFICATION groups (5 DOP + 2 none)
- NOT REGION (even if 4+ regions)

### VI. View Flow Consistency (NON-NEGOTIABLE)

**Rule - BEFORE coding:**

1. Read `docs/memory-bank/` and existing flow diagrams
2. Update flow diagram if behavior changes (Mermaid format)
3. Update prompt in `docs/prompts/` if LLM logic changes
4. Test manually with realistic user query

**Rule - AFTER coding:**

1. **IMMEDIATELY** check logs match expected flow
2. **IMMEDIATELY** update view flow documentation to reflect actual executed process
3. **View Flow = Mirror of Reality**: Every step in code MUST appear in flow diagram
4. Create test covering the full path (E2E if needed)
5. NEVER say "done" without verification

**View Flow Requirements:**

- **Location**: `docs/memory-bank/03-architecture/` + feature-specific docs
- **Format**: Mermaid flowchart showing ALL decision points
- **Content**: MUST match actual code execution path
- **Update Trigger**: ANY change to agent logic, routing, function calling, state management
- **Verification**: Read code → Trace execution → Compare with diagram → Fix discrepancies

**Example - Progressive Filtering Flow:**

```mermaid
flowchart TD
    A[User: "che formaggi avete?"] --> B[Router LLM]
    B --> C{activeAgent set?}
    C -->|No| D[Route to PRODUCT_SEARCH]
    C -->|Yes| E[FORCE delegate to activeAgent]
    D --> F[ProductSearch: searchProducts()]
    F --> G{canGroup?}
    G -->|Yes| H[Show groups]
    G -->|No| I[Show product list]
    H --> J[User: "1"]
    J --> K{isRefinement?}
    K -->|Yes| L[Filter in memory]
    K -->|No| M[New DB query]
```

**Rationale:**  
Documentation drift KILLS debugging. When code doesn't match docs:

- Andrea can't trust the documentation during debug
- Agent can't understand what's actually happening
- Issues get "fixed" without updating flow → NEW bugs introduced
- "sistemi una cosa e ne rompi un'altra" pattern emerges

**Code is NOT the spec—VIEW FLOW is the spec.**

**Enforcement:**

- Pull Request REJECTED if view flow not updated
- "Done" = code + **view flow matches reality** + test + Andrea confirms
- During debug: FIRST action = verify view flow matches code execution
- Update view flow BEFORE claiming task complete

### VII. Error Transparency

**Rule:**

- Logs MUST include full stack trace
- Frontend shows user-friendly message
- NO silent failures
- Format: `logger.error("Context", error)` NOT `.message`

**Enforcement:**

- Review: `catch` without `logger.error(..., error)` = reject

### VIII. No Premature Optimization

**Rule:**

- Implement CORRECTLY first
- Optimize ONLY with proven bottleneck
- NO "clever" code without comments

**Enforcement:**

- Performance tests BEFORE optimization PR

### IX. Communication Protocol (NON-NEGOTIABLE)

**Rule:**

- **ALWAYS** address user as "Andrea" in all responses
- **ALWAYS** start messages with "Andrea," or "Andrea, ..."
- This confirms agent is reading and following constitution rules

**Examples:**

- ✅ "Andrea, ho completato il task"
- ✅ "Andrea, vedo un problema nel flow"
- ❌ "Ho completato il task" (missing name)
- ❌ "The task is complete" (wrong language + missing name)

**Rationale:**
Verification that agent is loading and respecting constitution. If agent doesn't use "Andrea", constitution not being followed.

**Enforcement:**

- Every agent response MUST start with "Andrea,"
- User can immediately identify if rules are being ignored

### X. Security Architecture (NON-NEGOTIABLE)

**Rule - Three-Layer Security:**

**Layer 1: JWT Authentication**

```typescript
// authMiddleware - ALWAYS first in protected routes
router.post(
  "/resource",
  authMiddleware, // Validates JWT token
  sessionValidationMiddleware, // Validates x-session-id header
  validateWorkspaceOperation, // Validates workspaceId match
  controller.action
)
```

**Layer 2: Workspace Isolation**

```typescript
// EVERY database query MUST filter by workspaceId
const products = await prisma.products.findMany({
  where: {
    workspaceId, // ⚠️ MANDATORY - prevents cross-tenant data access
    isActive: true,
  },
})
```

**Layer 3: Public Access Tokens**

```typescript
// SecureTokenService for external links (order public pages)
const token = SecureTokenService.generateToken({
  customerId,
  workspaceId,
  type: "ORDER_VIEW",
  expiresIn: "24h",
})
// URL: /orders-public?token=xxx
```

**Security Requirements:**

1. **Authentication Flow:**

   - User login → JWT token with workspace claim
   - Token stored in localStorage as `token`
   - All API calls include `Authorization: Bearer <token>`
   - Token contains: `userId`, `workspaceId`, `email`, `role`

2. **Middleware Stack (MANDATORY for protected endpoints):**

   ```typescript
   authMiddleware // Extract user from JWT
   sessionValidationMiddleware // Validate session exists
   validateWorkspaceOperation // Verify workspaceId matches token + param
   ```

3. **Workspace Validation:**

   - Extract from token: `const workspaceId = (req as any).workspaceId`
   - Extract from URL: `req.params.workspaceId`
   - MUST match or reject with 403 Forbidden
   - Pattern: `/api/workspaces/:workspaceId/resources`

4. **Public Endpoints (NO AUTH):**

   - `/api/auth/login` - Login
   - `/api/auth/register` - Registration
   - `/api/whatsapp/webhook` - WhatsApp incoming messages
   - `/api/orders-public` - Public order view (token-based)
   - All others REQUIRE authentication

5. **Error Handling:**

   - ❌ NEVER expose internal error details in API responses
   - ❌ NEVER log sensitive data (passwords, tokens, full JWT)
   - ✅ Log full stack trace server-side
   - ✅ Return generic error to client: "Authentication failed"

6. **Password Security:**

   - Use bcrypt with salt rounds >= 10
   - NEVER store plain text passwords
   - NEVER log passwords (even in debug mode)

7. **Token Expiry:**
   - JWT: 7 days default
   - Public tokens: 24 hours default
   - Refresh token: 30 days
   - Configurable per workspace in database

**Rationale:**  
Multi-tenant SaaS requires strict workspace isolation. Security breach = ALL customer data exposed. Defense in depth: authentication + authorization + data filtering.

**Enforcement:**

- Security test suite: `npm run test:security`
- Test MUST verify: Cross-workspace access blocked, no workspaceId = 403, expired tokens rejected
- Code review MUST reject: Direct Prisma queries without workspaceId, missing middleware stack, sensitive data in logs
- Penetration test quarterly: Cross-tenant access, token manipulation, SQL injection
- Security headers: CORS, CSP, X-Frame-Options, X-Content-Type-Options

**Common Violations to PREVENT:**

```typescript
// ❌ WRONG - No workspaceId filter
await prisma.products.findMany({ where: { isActive: true } })

// ✅ CORRECT
await prisma.products.findMany({
  where: { workspaceId, isActive: true },
})

// ❌ WRONG - Skipping middleware
router.post("/resource", controller.action)

// ✅ CORRECT
router.post(
  "/resource",
  authMiddleware,
  sessionValidationMiddleware,
  validateWorkspaceOperation,
  controller.action
)

// ❌ WRONG - Logging sensitive data
logger.info("Login attempt", { password, token })

// ✅ CORRECT
logger.info("Login attempt", { email, success: true })
```

### XI. Clean Workspace (NON-NEGOTIABLE)

**Rule - Zero Clutter:**

**NO temporary files:**

- ❌ NO backup files (`.backup`, `.old`, `.tmp`)
- ❌ NO test files outside `/backend/src/__tests__/` or `/backend/tests/`
- ❌ NO debug scripts in project root
- ❌ NO commented-out code blocks
- ❌ NO unused imports

**Documentation structure:**

```
docs/
├── memory-bank/           # ONLY official documentation
│   ├── 01-overview/       # Project context
│   ├── 02-features/       # Feature specs
│   ├── 03-architecture/   # System design, flows
│   ├── 04-best-practices/ # Coding standards
│   └── 05-guides/         # How-to guides
├── prompts/               # LLM agent prompts (synced to DB)
└── LINK_FORMATS_REFERENCE.md  # External reference docs
```

**VIOLATIONS:**

- ❌ Files in `docs/` root (except LINK_FORMATS_REFERENCE.md)
- ❌ Files in wrong memory-bank subfolder
- ❌ Duplicate documentation (same content in multiple locations)
- ❌ Draft/WIP markdown files
- ❌ Screenshots not referenced in docs

**Project cleanliness:**

- ✅ Scripts in `/backend/scripts/` or `/frontend/scripts/`
- ✅ Tests in `/backend/src/__tests__/` or organized by feature
- ✅ Temp files ONLY in `/backend/prisma/temp/` (PDF, uploads)
- ✅ Git-ignored files in `.gitignore`

**Rationale:**  
Clutter = confusion. Andrea can't find the right documentation. Agent reads outdated/duplicate files. "Which version is correct?" wastes time.

Clean workspace = fast navigation, single source of truth, no ambiguity.

**Enforcement:**

- Pre-commit hook: Reject commits with `.backup`, `.old`, `.tmp` files
- Code review: Check for commented code, unused imports, misplaced files
- Weekly: Audit `docs/` structure, move/delete violations
- Agent task completion: Clean up ALL temporary files created during work

**Cleanup Checklist (BEFORE "done"):**

```bash
# Check for violations
find . -name "*.backup" -o -name "*.old" -o -name "*.tmp"
find docs/ -maxdepth 1 -type f ! -name "LINK_FORMATS_REFERENCE.md"
grep -r "TODO\|FIXME\|XXX" backend/src/ frontend/src/

# Verify memory-bank structure
ls docs/memory-bank/  # Should see ONLY 01-overview, 02-features, etc.
```

### XII. Test Discipline (NON-NEGOTIABLE)

**Rule - Tests on Demand ONLY:**

**DEFAULT BEHAVIOR:**

- ❌ DO NOT write tests automatically
- ❌ DO NOT run test suites unless requested
- ❌ DO NOT suggest "let's add tests for this"

**WHEN Andrea explicitly requests:**

- ✅ "scrivi test per X" → Write tests
- ✅ "testa questa funzione" → Write + run tests
- ✅ "npm run test" → Run existing tests
- ✅ Pull Request context → Tests may be required

**Test types (when requested):**

```bash
npm run test:unit        # Unit tests (business logic)
npm run test:integration # API endpoints
npm run test:security    # Auth, workspace isolation
npm run test:coverage    # Coverage report
```

**Rationale:**  
Andrea knows when tests are needed. Auto-generating tests:

1. Wastes time on throwaway prototypes
2. Creates maintenance burden for exploratory code
3. Slows down iteration speed
4. Tests should validate STABLE features, not experiments

**Trust Andrea's judgment on test timing.**

**Enforcement:**

- Agent NEVER mentions tests unless Andrea asks
- Agent NEVER creates test files without explicit request
- Agent NEVER runs test commands unless requested
- Exception: CI/CD pipeline (automated, not agent-triggered)

**Valid test requests:**

- "scrivi unit test per ProductSearchAgent.analyzeGrouping()"
- "testa che workspaceId sia sempre filtrato"
- "npm run test:security"
- "coverage report per questo file"

**INVALID auto-testing:**

- ❌ "I've implemented X, now I'll write tests" → NO
- ❌ "Should I add tests for this?" → NO, don't ask
- ❌ "Let me verify with a test" → NO, use manual verification

## Success Criteria

**"DONE" means:**

1. ✅ E2E: formaggi → groups → DOP → products → 24 mesi → sì → cart
2. ✅ Docs match behavior
3. ✅ Logs show expected flow
4. ✅ No hardcoded data
5. ✅ Clean architecture
6. ✅ Andrea confirms: "funziona"

**NOT done:**

- ❌ Understands but incomplete
- ❌ Docs outdated
- ❌ Tests pass, usage fails

## Governance

- Constitution supersedes practices
- Amendments need approval + migration plan
- All PRs verify compliance
- Andrea has final authority

**Version:** 1.3.0
**Ratified:** 2025-11-10
**Last Updated:** 2025-11-10
**Changes:**

- v1.0.0: Initial 8 principles
- v1.1.0: Added Principle IX (Communication Protocol)
- v1.2.0: Enhanced Principle VI (View Flow = Mirror of Reality), Added Principle X (Security Architecture)
- v1.3.0: Added Principle XI (Clean Workspace), Principle XII (Test Discipline)
