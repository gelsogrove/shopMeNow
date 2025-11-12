# ShopME Constitution

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

**EVERY database query MUST filter by `workspaceId` for multi-tenant security.**

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

**Version**: 1.0.0 | **Ratified**: 2025-11-12 | **Last Amended**: 2025-11-12
