<!--
  SYNC IMPACT REPORT
  
  Version Change: 1.0.0 → 1.1.0 (MINOR)
  Rationale: Added new principle "360-Degree Thinking" - materially expanded development guidance
  Date: 2025-11-12
  
  Modified Principles:
  - NONE (existing principles unchanged)
  
  Added Sections:
  - Principle V: 360-Degree Thinking (Full-Stack Change Analysis)
  
  Removed Sections:
  - NONE
  
  Templates Requiring Updates:
  - ✅ plan-template.md: Constitution Check section updated with all 5 principles + detailed checklist
  - ✅ spec-template.md: User Stories now include 360-Degree Validation checklist (8 categories)
  - ✅ tasks-template.md: Task descriptions include 360-degree impact notes (FE/BE/DB/Security/Tests layers)
  - ✅ .github/copilot-instructions.md: Added Rule #9 "360-Degree Thinking" with complete checklist reference
  
  Follow-up TODOs:
  - Consider adding 360-degree checklist to PR template
  - Update code review guidelines to enforce full-stack validation
-->

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

### V. 360-Degree Thinking (MUST - NON-NEGOTIABLE)

**EVERY change MUST consider the complete stack: FE → API → Middleware → Controller → Service → Repository → Database.**

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

if (!(workspace?.debugMode ?? true)) {
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

**Default Behavior**: If `workspace.debugMode` is NULL, defaults to `true` (development-friendly).

**Rationale**: Development workspaces should not accumulate billing costs during testing. Production workspaces need full tracking for analytics and invoicing.

**Enforcement**:

- Environment variable `NODE_ENV=production` SHOULD set `debugMode=false` for all workspaces
- Seed script SHOULD create test workspaces with `debugMode=true`
- Admin UI SHOULD display debug mode status prominently

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

**Version**: 1.1.0 | **Ratified**: 2025-11-12 | **Last Amended**: 2025-11-12
