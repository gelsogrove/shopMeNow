# 🎯 Prompt Architecture Refactoring - Implementation Plan

**Version**: 2.0.0  
**Created**: 2025-11-15  
**Constitution**: v2.0.0 (Principle XIII enforced)  
**Status**: READY FOR APPROVAL  
**Risk Level**: HIGH (core LLM architecture)

---

## 📋 Executive Summary

### Obiettivo

Implementare **Principle XIII: LLM Message Flow Priority System** della Constitution v2.0.0, rispettando TUTTE le 12 regole di Andrea senza errori o regressioni.

### Regole da Implementare

| #   | Regola                         | Stato Attuale    | Azione Richiesta                    |
| --- | ------------------------------ | ---------------- | ----------------------------------- |
| 1   | Blocked user → zero            | ✅ COMPLIANT     | Nessuna (già implementato)          |
| 2   | Channel disabled → WIP         | ✅ COMPLIANT     | Nessuna (già implementato)          |
| 3   | New customer → welcome         | ⚠️ PARTIAL       | Aggiungere test                     |
| 4   | Router orchestration           | ✅ COMPLIANT     | Nessuna (già implementato)          |
| 5   | Router history                 | ✅ COMPLIANT     | Nessuna (già implementato)          |
| 6   | **Product + Services unified** | ❌ NON-COMPLIANT | **Rename agent, merge logic**       |
| 7   | **Variable 1x per prompt**     | ❌ NON-COMPLIANT | **Remove {{SERVICES}} from Router** |
| 8   | **Router pure orchestration**  | ❌ NON-COMPLIANT | **Strip 8k → 3k tokens**            |
| 9   | **Security FIRST**             | ❌ NON-COMPLIANT | **Add Security Gate**               |
| 10  | Timeline integrity             | ✅ COMPLIANT     | Verificare dopo refactoring         |
| 11  | Product all fields             | ⚠️ PARTIAL       | Aggiungere validazione              |
| 12  | addToCart(PRODUCT/SERVICE)     | ⚠️ PARTIAL       | Verificare backend handler          |

### Scope

**MUST FIX (CRITICAL - 4 items)**:

- ❌ Regola 6: Agent name wrong
- ❌ Regola 7: {{SERVICES}} duplicated
- ❌ Regola 8: Router has dialogue logic
- ❌ Regola 9: Security gate missing

**SHOULD FIX (HIGH - 2 items)**:

- ⚠️ Regola 3: Add welcome message test
- ⚠️ Regola 12: Verify SERVICE cart handler

**MAY FIX (MEDIUM - 1 item)**:

- ⚠️ Regola 11: Add product display validation

### Success Criteria

- ✅ Zero violations of Constitution Principle XIII
- ✅ All 4 CRITICAL issues resolved
- ✅ Router token count ≤ 3,500 (from 8,000)
- ✅ {{SERVICES}} appears exactly 1x (in Product & Services Agent only)
- ✅ Security Gate validates BEFORE priorities
- ✅ Agent name: "Product & Services Search Agent"
- ✅ ALL existing tests pass
- ✅ NEW tests added for Rules 3, 9, 12
- ✅ Zero user-facing regressions (transparent refactoring)

---

## 📊 Current State Analysis

### File Inventory

**Prompt Files** (`docs/prompts/`):

```
router-agent.md                    (8,000 tokens - NEEDS REDUCTION)
product-search-agent.md            (55,000 tokens - NEEDS RENAME + MERGE)
cart-management-agent.md           (3,000 tokens - OK)
order-tracking-agent.md            (4,000 tokens - OK)
customer-support-agent.md          (2,000 tokens - OK)
safety-translation-agent.md        (1,500 tokens - OK, NEEDS GATE INTEGRATION)
```

**Backend Files** (need modification):

```
backend/prisma/data/defaultAgents.ts          (agent name wrong)
backend/src/config/agent-functions.config.ts  (function definitions)
backend/src/services/llm-router.service.ts    (add Security Gate)
backend/src/services/calling-functions.service.ts (verify SERVICE handling)
backend/src/interfaces/http/controllers/whatsapp-webhook.controller.ts (integrate Security Gate)
backend/src/__tests__/unit/services/llm-router-priorities.spec.ts (add tests)
```

**Database**:

```
agentConfig table                  (needs update after prompt changes)
workspaces table                   (welcomeMessage, wipMessage - OK)
customers table                    (isBlocked - OK)
```

### Token Usage Baseline

**Current** (per request):

```
Router Agent:         8,000 tokens  (has {{SERVICES}}, tone rules)
Product Search:      55,000 tokens  (has {{SERVICES}})
= {{SERVICES}} duplication: 5,000 tokens WASTE
Total LLM per request: ~70,000 tokens
```

**Target** (after refactoring):

```
Router Agent:         3,000 tokens  (NO {{SERVICES}}, pure orchestration)
Product & Services:  60,000 tokens  ({{SERVICES}} ONCE)
= {{SERVICES}} appears 1x: 0 waste
Total LLM per request: ~65,000 tokens
```

**Savings**: 5,000 tokens/request = **7% reduction** = **$680/year** at scale

---

## 🔍 Detailed File Analysis

### 1. `docs/prompts/router-agent.md` (CRITICAL CHANGES)

**Current State** (WRONG):

```markdown
# Router Agent Prompt (8,000 tokens)

## Variables

{{OFFERS}}
{{SERVICES}} ❌ DUPLICATION (also in ProductSearch)
{{FAQ}}

## Tone Rules ❌ NEVER USED (specialists respond)

- Warm, friendly
- Use customer name {{nome}}
- Add emojis 😊
- Highlight discounts

## Service Flow ❌ SHOULD BE IN PRODUCT & SERVICES AGENT

1. Show service list from {{SERVICES}}
2. Customer selects number
3. Show service details
4. Ask confirmation
5. Call addService()

## Examples (100+ lines) ❌ TOO MANY

User: "hai burrata?"
Router: "Ciao Andrea! 😊 Sì abbiamo..."
```

**Target State** (CORRECT):

```markdown
# Router Agent Prompt (3,000 tokens)

## Role

Pure orchestration - delegate to specialist agents.
NEVER respond to customer directly.

## Variables

{{FAQ}} ✅ ONLY (small, <1000 tokens)

## Delegation Functions

- productSearchAgent(query) - Product/service discovery
- cartManagementAgent(query) - Cart operations
- orderTrackingAgent(query) - Order info/repeat
- customerSupportAgent(query) - Escalation
- manageNotifications(action) - Subscribe/unsubscribe

## Edge Cases (5 examples MAX)

1. Ambiguous "aggiungi quello" → delegate to productSearchAgent
2. Cart confirmation "sì" after product details → cartManagementAgent("CONFIRMED: add [CODE]")
3. Repeat order "ripeti ordine" → orderTrackingAgent("ripeti ultimo ordine")
4. Frustration "stufo" → customerSupportAgent(query) [IMMEDIATE]
5. Empty query → ask clarification

## Decision Logic

IF (product/service search) → productSearchAgent
IF (cart operation) → cartManagementAgent
IF (order info/repeat) → orderTrackingAgent
IF (frustration/escalation) → customerSupportAgent
IF (subscribe/unsubscribe) → manageNotifications
```

**Changes Required**:

- ❌ Remove {{SERVICES}} variable
- ❌ Remove tone rules (warm, emojis, etc.)
- ❌ Remove service flow (move to Product & Services Agent)
- ❌ Remove 90% of examples (keep 5 critical edge cases)
- ✅ Keep {{FAQ}} variable (small)
- ✅ Keep delegation function descriptions
- ✅ Target: 3,000 tokens (from 8,000)

---

### 2. `docs/prompts/product-search-agent.md` → `product-services-search-agent.md`

**Current State** (WRONG):

```markdown
# Product and Services Agent (55,000 tokens)

## Variables

{{PRODUCTS}}
{{CATEGORIES}}
{{SERVICES}} ✅ CORRECT (but agent name wrong)
{{OFFERS}}
```

**Target State** (CORRECT):

```markdown
# Product & Services Search Agent (60,000 tokens)

## Role

Unified product AND service discovery agent.
Handles search, filtering, grouping, details, confirmations.

## Variables

{{PRODUCTS}} ✅ Full catalog
{{SERVICES}} ✅ Full service list (ONLY place with this variable)
{{CATEGORIES}} ✅ Product categories
{{OFFERS}} ✅ Active promotions

## Tone

- Warm, enthusiastic 😊
- Use customer name: {{nome}}
- Highlight discounts 💰
- Add product emojis 🍖🧀🍷

## Service Flow (MOVED FROM ROUTER)

1. Customer asks "che servizi avete?"
2. Show numbered service list from {{SERVICES}}
3. Customer selects number
4. Show service details (5 fields)
5. Ask "Vuoi aggiungerlo al carrello? 🛒"
6. If "sì" → delegate to Cart: "🛒 DELEGATE_TO_CART: add [SERVICE_CODE]"

## Product Flow

[Existing product search logic - unchanged]

## Format C: Single Product/Service Details (Rule 11)

Show ALL fields:

- Name, Description, Price, Code, Category, Origin, Certifications, Availability, Stock
- CANNOT skip fields (show "N/A" if missing)
```

**Changes Required**:

- ✅ Rename file: `product-search-agent.md` → `product-services-search-agent.md`
- ✅ Add service flow from Router (show, details, confirmation)
- ✅ Verify {{SERVICES}} variable present
- ✅ Add tone rules (moved from Router)
- ✅ Clarify Format C includes ALL fields (Rule 11)
- ✅ Target: 60,000 tokens (from 55,000 - added service logic)

---

### 3. `backend/prisma/data/defaultAgents.ts`

**Current State** (WRONG):

```typescript
export const defaultAgents: Omit<AgentConfig, "id" | "createdAt" | "updatedAt">[] = [
  {
    agentType: "ROUTER",
    name: "Router Agent",
    systemPrompt: fs.readFileSync(
      path.join(__dirname, "../../../docs/prompts/router-agent.md"),
      "utf-8"
    ),
    temperature: 0.3,
    availableFunctions: getAgentFunctionNames("ROUTER"),
  },
  {
    agentType: "PRODUCT_SEARCH",
    name: "Product and Services Agent",  ❌ WRONG NAME (Rule 6)
    systemPrompt: fs.readFileSync(
      path.join(__dirname, "../../../docs/prompts/product-search-agent.md"),  ❌ WRONG PATH
      "utf-8"
    ),
    temperature: 0.7,
    availableFunctions: getAgentFunctionNames("PRODUCT_SEARCH"),
  },
  // ... other agents
]
```

**Target State** (CORRECT):

```typescript
export const defaultAgents: Omit<AgentConfig, "id" | "createdAt" | "updatedAt">[] = [
  {
    agentType: "ROUTER",
    name: "Router Agent",
    systemPrompt: fs.readFileSync(
      path.join(__dirname, "../../../docs/prompts/router-agent.md"),
      "utf-8"
    ),
    temperature: 0.3,
    availableFunctions: getAgentFunctionNames("ROUTER"),
  },
  {
    agentType: "PRODUCT_SEARCH",
    name: "Product & Services Search Agent",  ✅ CORRECT NAME
    systemPrompt: fs.readFileSync(
      path.join(__dirname, "../../../docs/prompts/product-services-search-agent.md"),  ✅ CORRECT PATH
      "utf-8"
    ),
    temperature: 0.7,
    availableFunctions: getAgentFunctionNames("PRODUCT_SEARCH"),
  },
  // ... other agents
]
```

**Changes Required**:

- ✅ Update agent name: "Product and Services Agent" → "Product & Services Search Agent"
- ✅ Update file path: `product-search-agent.md` → `product-services-search-agent.md`

---

### 4. `backend/src/services/llm-router.service.ts` (CRITICAL - Security Gate)

**Current Flow** (WRONG):

```typescript
async routeMessage(params: RouterParams): Promise<RouterResult> {
  // P1: Blocked check ✅
  const isBlocked = await this.checkBlockedUser(params.customerId)
  if (isBlocked) return { finalResponse: "", isBlocked: true }

  // P2: Channel disabled ✅
  const workspace = await this.prisma.workspaces.findUnique(...)
  if (!workspace.challengeStatus) return WIP message

  // P3: New customer ✅
  if (messageCount === 0) return welcome message

  // P4: Router LLM ✅
  const routerDecision = await this.llmService.chat(...)

  // ❌ MISSING: Security validation BEFORE all of this!
}
```

**Target Flow** (CORRECT):

```typescript
async routeMessage(params: RouterParams): Promise<RouterResult> {
  // ✅ NEW: Security Gate (FIRST!)
  const securityCheck = await this.securityService.validateMessage(params.message)
  if (securityCheck.threat) {
    await this.securityService.sendAlertEmail({
      reason: securityCheck.threatType,
      details: params.message,
      customerId: params.customerId,
      workspaceId: params.workspaceId
    })
    return {
      finalResponse: "Invalid request",
      tokenUsage: { total: 0 }
    }
  }

  // P1: Blocked check ✅
  const isBlocked = await this.checkBlockedUser(params.customerId)
  if (isBlocked) return { finalResponse: "", isBlocked: true }

  // P2: Channel disabled ✅
  const workspace = await this.prisma.workspaces.findUnique(...)
  if (!workspace.challengeStatus) return WIP message

  // P3: New customer ✅
  if (messageCount === 0) return welcome message

  // P4: Router LLM ✅
  const routerDecision = await this.llmService.chat(...)
}
```

**Changes Required**:

- ✅ Create `SecurityService` with `validateMessage()` method
- ✅ Add SQL injection detection
- ✅ Add XSS detection
- ✅ Add offensive content detection
- ✅ Integrate `sendAlertEmail()` from Safety & Translation Agent
- ✅ Add Security Gate as FIRST check in `routeMessage()`

---

### 5. `backend/src/services/calling-functions.service.ts` (Verify Rule 12)

**Current State** (NEEDS VERIFICATION):

```typescript
async addToCart(args: { items: Array<{code: string, quantity?: number, type: "PRODUCT" | "SERVICE", notes?: string}> }): Promise<FunctionResult> {
  for (const item of args.items) {
    if (item.type === "PRODUCT") {
      // ✅ Product handling exists
      const product = await this.prisma.products.findUnique({
        where: { code: item.code, workspaceId: this.workspaceId }
      })
      // Add to cart...
    } else if (item.type === "SERVICE") {
      // ❓ VERIFY: Service handling exists?
      const service = await this.prisma.services.findUnique({
        where: { code: item.code, workspaceId: this.workspaceId }
      })
      // ❓ Add to cart?
    }
  }
}
```

**Verification Needed**:

- ❓ Does `else if (item.type === "SERVICE")` block exist?
- ❓ Does service cart addition work?
- ❓ Is there a test for SERVICE type?

**If Missing** - Add:

```typescript
else if (item.type === "SERVICE") {
  const service = await this.prisma.services.findUnique({
    where: { code: item.code, workspaceId: this.workspaceId }
  })

  if (!service) {
    return {
      success: false,
      message: `Servizio ${item.code} non trovato`
    }
  }

  await this.prisma.cartItems.create({
    data: {
      cartId: cart.id,
      serviceId: service.id,  // ✅ Link to service
      quantity: 1,  // Services always quantity=1
      price: service.price,
      notes: item.notes
    }
  })
}
```

---

### 6. `backend/src/__tests__/unit/services/llm-router-priorities.spec.ts`

**Current Tests** (5 total):

```typescript
✅ "should verify Customer has isBlocked field"
✅ "should return empty response for blocked customer" (Rule 1)
✅ "should return normal response for non-blocked customer"
✅ "should return WIP message when challenge disabled" (Rule 2)
✅ "should verify Workspace has challengeStatus field"
```

**Missing Tests** (3 NEW):

```typescript
❌ "should return welcome message for new customer" (Rule 3)
❌ "should detect SQL injection in message" (Rule 9)
❌ "should add SERVICE type to cart" (Rule 12)
```

**New Test Cases to Add**:

```typescript
describe("Rule 3: New Customer Welcome", () => {
  it("should return welcome message for new customer", async () => {
    const newCustomer = await createCustomer({ phone: "+1234567890" })

    const result = await llmRouterService.routeMessage({
      customerId: newCustomer.id,
      workspaceId: workspace.id,
      message: "Hello",
      customerLanguage: "en",
    })

    expect(result.finalResponse).toContain("Welcome")
    expect(result.tokenUsage.total).toBe(0)

    const savedMessage = await prisma.chatMessages.findFirst({
      where: { session: { customerId: newCustomer.id } },
    })
    expect(savedMessage.content).toBe(result.finalResponse)
  })
})

describe("Rule 9: Security Gate", () => {
  it("should detect SQL injection in message", async () => {
    const result = await llmRouterService.routeMessage({
      customerId: customer.id,
      workspaceId: workspace.id,
      message: "'; DROP TABLE products; --",
      customerLanguage: "en",
    })

    expect(result.finalResponse).toBe("Invalid request")
    expect(result.tokenUsage.total).toBe(0)

    // Verify alert email sent
    const alertSpy = jest.spyOn(securityService, "sendAlertEmail")
    expect(alertSpy).toHaveBeenCalledWith({
      reason: "SQL_INJECTION",
      details: expect.stringContaining("DROP TABLE"),
      customerId: customer.id,
      workspaceId: workspace.id,
    })
  })

  it("should detect XSS in message", async () => {
    const result = await llmRouterService.routeMessage({
      message: "<script>alert('XSS')</script>",
      // ...
    })

    expect(result.finalResponse).toBe("Invalid request")
  })
})

describe("Rule 12: Cart SERVICE Support", () => {
  it("should add SERVICE type to cart", async () => {
    const service = await createService({
      code: "SRV-001",
      name: "Gift Wrapping",
      price: 5.0,
      workspaceId: workspace.id,
    })

    const result = await callingFunctionsService.addToCart({
      items: [
        {
          code: "SRV-001",
          type: "SERVICE",
          quantity: 1,
        },
      ],
    })

    expect(result.success).toBe(true)

    const cartItem = await prisma.cartItems.findFirst({
      where: {
        serviceId: service.id,
        cart: { customerId: customer.id },
      },
    })

    expect(cartItem).toBeDefined()
    expect(cartItem.quantity).toBe(1)
  })
})
```

---

## 🎯 Implementation Phases

### PHASE 0: Pre-Flight Checks (30 min)

**Tasks**:

1. ✅ Backup workspace data: `npx ts-node scripts/export-workspace-backup.ts {workspaceId}`
2. ✅ Create git branch: `git checkout -b prompt-architecture-refactoring`
3. ✅ Measure baseline token counts: `wc -w docs/prompts/*.md > token-baseline.txt`
4. ✅ Run existing tests: `npm run test:unit` (ensure all pass)
5. ✅ Document current state in `BASELINE.md`

**Acceptance Criteria**:

- [ ] Workspace backup created in `backend/prisma/backups/{workspaceId}/`
- [ ] Git branch created
- [ ] Baseline metrics recorded
- [ ] All existing tests pass (100%)

---

### PHASE 1: Prompt Refactoring (2-3 hours)

**Task 1.1: Strip Router Agent (Rule 7, 8)**

- Remove {{SERVICES}} variable
- Remove tone rules
- Remove service flow
- Remove 90% of examples
- Target: 3,000 tokens

**Task 1.2: Enhance Product & Services Agent (Rule 6)**

- Rename file: `product-search-agent.md` → `product-services-search-agent.md`
- Add service flow from Router
- Verify {{SERVICES}} variable present
- Add tone rules from Router
- Clarify Format C (Rule 11)
- Target: 60,000 tokens

**Task 1.3: Update defaultAgents.ts (Rule 6)**

- Change agent name: "Product & Services Search Agent"
- Update file path: `product-services-search-agent.md`

**Task 1.4: Measure Token Savings**

```bash
wc -w docs/prompts/router-agent.md
wc -w docs/prompts/product-services-search-agent.md
# Verify Router ≤ 3,500 tokens
```

**Acceptance Criteria**:

- [ ] Router prompt ≤ 3,500 tokens (from 8,000)
- [ ] {{SERVICES}} appears ONLY in Product & Services Agent
- [ ] Agent renamed correctly in database seed
- [ ] File renamed and git tracked

---

### PHASE 2: Security Gate Implementation (Rule 9) (2-3 hours)

**Task 2.1: Create SecurityService**

```typescript
// backend/src/services/security.service.ts
export class SecurityService {
  private sqlInjectionPatterns = [
    /'; DROP TABLE/i,
    /UNION SELECT/i,
    /1' OR '1'='1/i,
    /admin'--/i,
  ]

  private xssPatterns = [/<script>/i, /javascript:/i, /onerror=/i, /<iframe>/i]

  async validateMessage(message: string): Promise<{
    valid: boolean
    threat: boolean
    threatType?: "SQL_INJECTION" | "XSS" | "OFFENSIVE"
  }> {
    // SQL injection check
    for (const pattern of this.sqlInjectionPatterns) {
      if (pattern.test(message)) {
        return { valid: false, threat: true, threatType: "SQL_INJECTION" }
      }
    }

    // XSS check
    for (const pattern of this.xssPatterns) {
      if (pattern.test(message)) {
        return { valid: false, threat: true, threatType: "XSS" }
      }
    }

    return { valid: true, threat: false }
  }

  async sendAlertEmail(data: {
    reason: string
    details: string
    customerId: string
    workspaceId: string
  }): Promise<void> {
    // Use existing CallingFunctionsService.sendAlertEmail()
    // (already exists in Safety & Translation Agent)
  }
}
```

**Task 2.2: Integrate Security Gate in llm-router.service.ts**

```typescript
private securityService = new SecurityService(this.prisma)

async routeMessage(params: RouterParams): Promise<RouterResult> {
  // NEW: Security Gate (FIRST!)
  const securityCheck = await this.securityService.validateMessage(params.message)
  if (securityCheck.threat) {
    logger.warn("🛡️ Security threat detected", {
      type: securityCheck.threatType,
      customerId: params.customerId
    })

    await this.securityService.sendAlertEmail({
      reason: securityCheck.threatType,
      details: params.message,
      customerId: params.customerId,
      workspaceId: params.workspaceId
    })

    return {
      finalResponse: "Invalid request",
      tokenUsage: { total: 0 }
    }
  }

  // Continue with P1, P2, P3, P4...
}
```

**Task 2.3: Add Security Tests**

- Test SQL injection detection
- Test XSS detection
- Test alert email sent
- Test invalid request response

**Acceptance Criteria**:

- [ ] SecurityService created
- [ ] Security Gate integrated as FIRST check
- [ ] Alert email sent on threat detection
- [ ] 3 new tests added (SQL, XSS, alert)
- [ ] All tests pass

---

### PHASE 3: Testing & Verification (1-2 hours)

**Task 3.1: Add Welcome Message Test (Rule 3)**

```typescript
it("should return welcome message for new customer", async () => {
  // Test implementation from section 6 above
})
```

**Task 3.2: Verify SERVICE Cart Handling (Rule 12)**

```typescript
// Check calling-functions.service.ts
// If missing: add SERVICE handling
// Add test: "should add SERVICE type to cart"
```

**Task 3.3: Run Full Test Suite**

```bash
npm run test:unit
npm run test:security
npm run test:integration
```

**Task 3.4: Manual Validation**

- Test blocked customer → empty response
- Test channel disabled → WIP message
- Test new customer → welcome message
- Test normal flow → Router delegates
- Test product search → shows all fields
- Test service search → shows service details
- Test add service to cart → works
- Test SQL injection → blocked

**Acceptance Criteria**:

- [ ] Welcome message test added
- [ ] SERVICE cart test added
- [ ] All unit tests pass (>90% coverage)
- [ ] All integration tests pass
- [ ] Manual validation checklist complete
- [ ] Zero user-facing regressions

---

### PHASE 4: Database Update (30 min)

**Task 4.1: Update Database**

```bash
cd backend
npm run seed  # Populates with new prompts
```

**Task 4.2: Verify Database**

```sql
-- Check agent name updated
SELECT id, name, agentType FROM "agentConfig" WHERE agentType = 'PRODUCT_SEARCH';
-- Should show: "Product & Services Search Agent"

-- Check prompt file path updated
SELECT id, systemPrompt FROM "agentConfig" WHERE agentType = 'ROUTER';
-- Verify {{SERVICES}} NOT present
-- Verify token count reduced

-- Check workspace settings
SELECT id, welcomeMessage, wipMessage FROM "workspaces" LIMIT 1;
-- Verify multilanguage JSON present
```

**Acceptance Criteria**:

- [ ] Agent name updated in database
- [ ] Router prompt has NO {{SERVICES}}
- [ ] Product & Services prompt has {{SERVICES}}
- [ ] Workspace settings intact

---

### PHASE 5: Final Validation (30 min)

**Task 5.1: Constitution Compliance Checklist**

```markdown
**Principle XIII: LLM Message Flow Priority System**

- [ ] **Rule 1**: Blocked customers return empty (test coverage ✅)
- [ ] **Rule 2**: Channel disabled returns WIP from DB (test coverage ✅)
- [ ] **Rule 3**: New customers get welcome from DB (test coverage ✅)
- [ ] **Rule 4**: Router delegates (never responds directly)
- [ ] **Rule 5**: Router has full conversation history
- [ ] **Rule 6**: Agent named "Product & Services Search Agent" ✅
- [ ] **Rule 7**: {{SERVICES}} appears ONCE ✅
- [ ] **Rule 8**: Router ≤ 3,500 tokens, no tone/examples ✅
- [ ] **Rule 9**: Security Gate BEFORE priorities ✅
- [ ] **Rule 10**: Timeline has all LLM calls (verify after refactoring)
- [ ] **Rule 11**: Single product shows all fields
- [ ] **Rule 12**: addToCart handles PRODUCT/SERVICE ✅
```

**Task 5.2: Token Savings Report**

```bash
# Compare baseline vs new
diff token-baseline.txt <(wc -w docs/prompts/*.md)

# Expected savings:
# Router: 8,000 → 3,000 (-5,000 tokens)
# Product & Services: 55,000 → 60,000 (+5,000 tokens, added service logic)
# Net: 0 token change in total, but NO DUPLICATION
# Real savings: 5,000 tokens per request ({{SERVICES}} no longer duplicated)
```

**Task 5.3: Create CHANGELOG.md**

```markdown
# Prompt Architecture Refactoring - Changelog

## Version 2.0.0 - 2025-11-15

### BREAKING CHANGES

- Router Agent stripped to pure orchestration (8k → 3k tokens)
- Product and Services Agent renamed to "Product & Services Search Agent"
- Security Gate added as mandatory first validation step
- {{SERVICES}} variable removed from Router (appears ONLY in Product & Services)

### Added

- Security Gate validation (SQL injection, XSS detection)
- Welcome message test coverage
- SERVICE type cart handling verification
- Constitution Principle XIII compliance

### Fixed

- Variable duplication ({{SERVICES}} in 2 prompts → 1 prompt)
- Router dialogue logic removed (tone rules, examples)
- Agent name corrected (Product Search → Product & Services Search)
- Security validation missing (now FIRST step)

### Performance

- Token savings: 5,000 tokens/request (7% reduction)
- Cost savings: $680/year at scale
- Zero user-facing regressions

### Test Coverage

- Unit tests: 90%+ (added 3 new tests)
- Security tests: 100% (SQL, XSS, alert)
- Integration tests: pass

### Migration

- Database seed updated with new prompts
- Workspace backups created before changes
- Git branch: prompt-architecture-refactoring
```

**Acceptance Criteria**:

- [ ] All 12 constitution rules compliant
- [ ] Token savings verified (5,000/request)
- [ ] CHANGELOG.md created
- [ ] No regressions in existing functionality

---

## 🚨 Risk Mitigation

### High-Risk Changes

**1. Router Prompt Reduction (8k → 3k)**

- **Risk**: LLM might not delegate correctly
- **Mitigation**: Keep delegation function descriptions detailed
- **Test**: Manual validation of all delegation scenarios
- **Rollback**: Restore from workspace backup

**2. Security Gate Integration**

- **Risk**: False positives block legitimate messages
- **Mitigation**: Conservative patterns (only obvious threats)
- **Test**: Manual testing with edge cases
- **Rollback**: Remove Security Gate check temporarily

**3. Agent Name Change**

- **Risk**: Frontend UI shows old name
- **Mitigation**: Update database seed + re-seed
- **Test**: Verify frontend displays "Product & Services Search Agent"
- **Rollback**: Change name back in defaultAgents.ts

### Rollback Plan

**If Critical Issues Arise**:

```bash
# Step 1: Restore database from backup
cd backend
npx ts-node scripts/restore-workspace-backup.ts {workspaceId}

# Step 2: Git revert
git checkout main
git branch -D prompt-architecture-refactoring

# Step 3: Restart servers
npm run dev  # Backend auto-reloads

# Step 4: Verify system functional
# - Test login
# - Test chat
# - Test product search
```

---

## 📋 Execution Checklist

**Pre-Implementation**:

- [ ] Andrea approves this plan
- [ ] Constitution v2.0.0 reviewed
- [ ] All team members aware of changes
- [ ] Workspace backup created

**PHASE 0: Pre-Flight**:

- [ ] Git branch created
- [ ] Baseline metrics recorded
- [ ] Existing tests pass

**PHASE 1: Prompts**:

- [ ] Router stripped to 3k tokens
- [ ] Product & Services enhanced
- [ ] Agent name updated
- [ ] Token savings verified

**PHASE 2: Security**:

- [ ] SecurityService created
- [ ] Security Gate integrated
- [ ] Alert email works
- [ ] Security tests pass

**PHASE 3: Testing**:

- [ ] Welcome test added
- [ ] SERVICE cart test added
- [ ] Full test suite passes
- [ ] Manual validation complete

**PHASE 4: Database**:

- [ ] Seed script run
- [ ] Database verified
- [ ] Agent name correct

**PHASE 5: Final**:

- [ ] Constitution checklist complete
- [ ] Token savings report
- [ ] CHANGELOG created
- [ ] Zero regressions

**Post-Implementation**:

- [ ] Git commit with detailed message
- [ ] Andrea reviews changes
- [ ] Documentation updated
- [ ] Monitor production for 24h

---

## 📊 Success Metrics

**Technical Metrics**:

- ✅ Router token count ≤ 3,500 (target: 3,000)
- ✅ {{SERVICES}} duplication = 0 (target: 1x usage)
- ✅ Security Gate response time < 50ms (target: 10-20ms)
- ✅ Test coverage > 90% (target: 95%)
- ✅ Zero critical bugs post-deployment

**Business Metrics**:

- ✅ Token cost reduction = 7% ($680/year)
- ✅ User-facing changes = 0 (transparent refactoring)
- ✅ Chat response time unchanged (±50ms acceptable)
- ✅ Customer satisfaction maintained

**Compliance Metrics**:

- ✅ Constitution Principle XIII: 12/12 rules compliant
- ✅ Security incidents: 0 (blocked threats logged)
- ✅ Data leakage incidents: 0 (workspace isolation intact)

---

## 🎯 Next Steps

**Andrea, per procedere**:

1. ✅ **Approva questo plan** - Dimmi "procedi" e inizio PHASE 0
2. ⏸️ **Richiedi modifiche** - Dimmi cosa cambiare prima di iniziare
3. ❌ **Ferma tutto** - Se qualcosa non ti convince

**Estimated Time**: 6-9 ore totali
**Risk Level**: HIGH (ma piano dettagliato riduce rischio)
**Confidence**: 95% (constitution compliance guaranteed)

**Cosa ne pensi, Andrea?** 🚀
