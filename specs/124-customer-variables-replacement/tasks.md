# Implementation Tasks: Customer Variables Replacement

## Phase 1: Setup & Audit

### Task 1.1: Audit All Variable Usage
**Type**: Analysis  
**Priority**: CRITICAL  
**Dependencies**: None  
**Parallel**: No

**Description**: Search entire codebase for ALL customer variable usage to ensure complete replacement coverage.

**Files**:
- `backend/src/domain/calling-functions/*.ts`
- `backend/src/services/*.service.ts`

**Actions**:
1. Grep search for `{{nameUser}}`, `{{email}}`, `{{phone}}`, `{{discountUser}}`, `{{TOKEN_DURATION}}`
2. Document all locations where variables are used
3. Verify variable names are consistent
4. Identify any unknown/undocumented variables

**Acceptance Criteria**:
- [ ] Complete list of all variables used in codebase
- [ ] No duplicate or inconsistent variable names
- [ ] All variables documented in plan.md

**Estimated Time**: 10 minutes

---

### Task 1.2: Load Current Customer Data Structure
**Type**: Analysis  
**Priority**: HIGH  
**Dependencies**: None  
**Parallel**: Yes [P]

**Description**: Verify customer data structure in llm-router.service.ts to ensure all required fields are available.

**Files**:
- `backend/src/services/llm-router.service.ts` (line ~390-420)

**Actions**:
1. Check `customer` object loading from database
2. Verify fields: `nome`, `email`, `phone`, `discount`
3. Confirm `params.customerName` availability
4. Document data flow for replacement

**Acceptance Criteria**:
- [ ] Customer object has all required fields
- [ ] Data available before replacement call site (line 665)
- [ ] No additional database queries needed

**Estimated Time**: 5 minutes

---

## Phase 2: Core Implementation

### Task 2.1: Implement replaceCustomerVariables() Method
**Type**: Development  
**Priority**: CRITICAL  
**Dependencies**: Task 1.1, Task 1.2  
**Parallel**: No

**Description**: Add new method to PromptProcessorService for replacing customer-specific variables in any text.

**Files**:
- `backend/src/services/prompt-processor.service.ts`

**Implementation**:
```typescript
/**
 * Replace customer-specific variables in ANY text (prompts or responses)
 * Handles: {{nameUser}}, {{email}}, {{phone}}, {{discountUser}}, {{TOKEN_DURATION}}
 * 
 * @param text - Text with potential {{variables}}
 * @param customerData - Customer data from database
 * @returns Text with all variables replaced
 * 
 * @see Constitution Principle I - Database-First Architecture
 * @see spec.md FR-2 - Centralized Replacement Logic
 */
public replaceCustomerVariables(
  text: string,
  customerData: {
    nome: string
    email: string
    phone: string
    discountUser: number
  }
): string {
  return text
    .replace(/\{\{nameUser\}\}/g, customerData.nome || "Cliente")
    .replace(/\{\{email\}\}/g, customerData.email || "")
    .replace(/\{\{phone\}\}/g, customerData.phone || "")
    .replace(/\{\{discountUser\}\}/g, String(customerData.discountUser || 0))
    .replace(
      /\{\{TOKEN_DURATION\}\}/g,
      this.formatTokenDuration(process.env.TOKEN_EXPIRATION || "1h")
    )
}

/**
 * Format token duration from env var
 * Examples: "15m" → "15 minutes", "1h" → "1 hour"
 */
private formatTokenDuration(duration: string): string {
  const match = duration.match(/^(\d+)([mh])$/)
  if (!match) return "15 minutes"
  
  const value = parseInt(match[1])
  const unit = match[2]
  
  if (unit === "m") return value === 1 ? "1 minute" : `${value} minutes`
  if (unit === "h") return value === 1 ? "1 hour" : `${value} hours`
  
  return "15 minutes"
}
```

**Acceptance Criteria**:
- [ ] Method signature matches plan.md specification
- [ ] All 5 variables handled (nameUser, email, phone, discountUser, TOKEN_DURATION)
- [ ] Global regex flag `/g` used (replaces ALL occurrences)
- [ ] Graceful fallbacks for missing data (e.g., discount → 0)
- [ ] JSDoc comments with references to Constitution and spec.md
- [ ] TypeScript compiles without errors

**Estimated Time**: 15 minutes

---

### Task 2.2: Integrate Replacement into Multi-Agent Flow
**Type**: Development  
**Priority**: CRITICAL  
**Dependencies**: Task 2.1  
**Parallel**: No

**Description**: Call `replaceCustomerVariables()` in llm-router.service.ts after specialist response, before Safety layer.

**Files**:
- `backend/src/services/llm-router.service.ts` (line 665-670)

**Implementation**:
```typescript
// STEP 4.5: Replace {{TOKEN_DURATION}} variable (EXISTING)
const tokenDuration = this.formatTokenDuration(
  process.env.TOKEN_EXPIRATION || "1h"
)
responseWithLinks = responseWithLinks.replace(
  /\{\{TOKEN_DURATION\}\}/g,
  tokenDuration
)
logger.info(`✅ Replaced {{TOKEN_DURATION}} with: ${tokenDuration}`)

// 🆕 STEP 4.6: Replace customer-specific variables
// CRITICAL FIX: Variables from calling functions (RepeatOrder.ts, ResetCart.ts)
// were not being replaced, showing {{discountUser}} to customers
// @see Constitution Principle I - Database-First Architecture
// @see spec.md FR-1, FR-3 - Replace Customer Variables
const customerData = {
  nome: params.customerName,
  email: customer.email,
  phone: customer.phone,
  discountUser: customer.discount || 0,
}

responseWithLinks = this.promptProcessor.replaceCustomerVariables(
  responseWithLinks,
  customerData
)

logger.info("✅ Replaced customer variables in response", {
  nameUser: customerData.nome,
  discountUser: customerData.discountUser,
  hasEmail: !!customerData.email,
  hasPhone: !!customerData.phone,
  responseLength: responseWithLinks.length,
  responsePreview: responseWithLinks.substring(0, 150),
})

// STEP 5: Apply Safety & Translation Layer (EXISTING)
// Now processes the response WITH customer variables already replaced
logger.info("Step 5: Applying Safety & Translation Layer")
```

**Acceptance Criteria**:
- [ ] Replacement called AFTER specialist response (after link replacement)
- [ ] Replacement called BEFORE Safety layer
- [ ] Customer data object correctly constructed from `customer` and `params`
- [ ] Comprehensive logging added
- [ ] TypeScript compiles without errors
- [ ] No breaking changes to existing flow

**Estimated Time**: 10 minutes

---

## Phase 3: Testing

### Task 3.1: Write Unit Tests for replaceCustomerVariables()
**Type**: Testing  
**Priority**: HIGH  
**Dependencies**: Task 2.1  
**Parallel**: Yes [P]

**Description**: Comprehensive unit tests for the new method covering all variables and edge cases.

**Files**:
- `backend/__tests__/unit/prompt-processor.test.ts` (NEW or add to existing)

**Test Cases**:
```typescript
describe("PromptProcessorService.replaceCustomerVariables", () => {
  let service: PromptProcessorService

  beforeEach(() => {
    service = new PromptProcessorService(prisma)
  })

  it("should replace {{nameUser}} with customer name", () => {
    const result = service.replaceCustomerVariables("Hello {{nameUser}}!", {
      nome: "Mario Rossi",
      email: "",
      phone: "",
      discountUser: 0,
    })
    expect(result).toBe("Hello Mario Rossi!")
  })

  it("should replace {{discountUser}} with discount value", () => {
    const result = service.replaceCustomerVariables(
      "You have {{discountUser}}% discount",
      { nome: "", email: "", phone: "", discountUser: 15 }
    )
    expect(result).toBe("You have 15% discount")
  })

  it("should replace ALL occurrences of same variable", () => {
    const result = service.replaceCustomerVariables(
      "{{nameUser}}, discount: {{discountUser}}%. Thanks {{nameUser}}!",
      { nome: "Mario", email: "", phone: "", discountUser: 10 }
    )
    expect(result).toBe("Mario, discount: 10%. Thanks Mario!")
  })

  it("should handle missing discount (default to 0)", () => {
    const result = service.replaceCustomerVariables(
      "Discount: {{discountUser}}%",
      { nome: "", email: "", phone: "", discountUser: 0 }
    )
    expect(result).toBe("Discount: 0%")
  })

  it("should replace {{email}} with customer email", () => {
    const result = service.replaceCustomerVariables("Email: {{email}}", {
      nome: "",
      email: "mario@example.com",
      phone: "",
      discountUser: 0,
    })
    expect(result).toBe("Email: mario@example.com")
  })

  it("should replace {{phone}} with customer phone", () => {
    const result = service.replaceCustomerVariables("Phone: {{phone}}", {
      nome: "",
      email: "",
      phone: "+39 123 456 7890",
      discountUser: 0,
    })
    expect(result).toBe("Phone: +39 123 456 7890")
  })

  it("should replace {{TOKEN_DURATION}} from env", () => {
    process.env.TOKEN_EXPIRATION = "15m"
    const result = service.replaceCustomerVariables(
      "Link valid for {{TOKEN_DURATION}}",
      { nome: "", email: "", phone: "", discountUser: 0 }
    )
    expect(result).toBe("Link valid for 15 minutes")
  })

  it("should handle 1 hour duration (singular)", () => {
    process.env.TOKEN_EXPIRATION = "1h"
    const result = service.replaceCustomerVariables(
      "Valid for {{TOKEN_DURATION}}",
      { nome: "", email: "", phone: "", discountUser: 0 }
    )
    expect(result).toBe("Valid for 1 hour")
  })

  it("should handle invalid duration format (fallback)", () => {
    process.env.TOKEN_EXPIRATION = "invalid"
    const result = service.replaceCustomerVariables(
      "Valid for {{TOKEN_DURATION}}",
      { nome: "", email: "", phone: "", discountUser: 0 }
    )
    expect(result).toBe("Valid for 15 minutes")
  })

  it("should replace multiple different variables in one text", () => {
    const result = service.replaceCustomerVariables(
      "Hi {{nameUser}} ({{email}}), you have {{discountUser}}% off!",
      {
        nome: "Mario",
        email: "mario@test.com",
        phone: "",
        discountUser: 20,
      }
    )
    expect(result).toBe("Hi Mario (mario@test.com), you have 20% off!")
  })
})
```

**Acceptance Criteria**:
- [ ] 10+ test cases covering all variables
- [ ] Edge cases tested (missing data, invalid format, multiple occurrences)
- [ ] All tests pass with `npm run test:unit`
- [ ] Test coverage >95% for new method

**Estimated Time**: 20 minutes

---

### Task 3.2: Integration Test - Repeat Order Flow
**Type**: Testing  
**Priority**: CRITICAL  
**Dependencies**: Task 2.2  
**Parallel**: No

**Description**: End-to-end test verifying variables are replaced in actual multi-agent flow.

**Files**:
- `backend/__tests__/integration/customer-variables.test.ts` (NEW)

**Test Implementation**:
```typescript
import { PrismaClient } from "@prisma/client"
import { LLMRouterService } from "../../src/services/llm-router.service"

const prisma = new PrismaClient()

describe("Multi-Agent Flow - Customer Variables Replacement", () => {
  let llmRouter: LLMRouterService
  let testCustomer: any
  let testWorkspace: any

  beforeAll(async () => {
    // Setup test workspace and customer
    testWorkspace = await prisma.workspace.findFirst()
    testCustomer = await prisma.customer.create({
      data: {
        workspaceId: testWorkspace.id,
        nome: "Test Mario",
        email: "test@example.com",
        phone: "+39 123 456 7890",
        discount: 15,
        phoneNumber: "+39123456789",
      },
    })

    llmRouter = new LLMRouterService(prisma)
  })

  afterAll(async () => {
    await prisma.customer.delete({ where: { id: testCustomer.id } })
    await prisma.$disconnect()
  })

  it("should replace {{discountUser}} in repeat order response", async () => {
    const response = await llmRouter.routeMessage({
      message: "I want to repeat my last order",
      customerId: testCustomer.id,
      workspaceId: testWorkspace.id,
      customerName: testCustomer.nome,
      customerLanguage: "en",
      conversationId: "test-conversation",
    })

    // Assert: Variables replaced
    expect(response.finalResponse).toContain("15%")
    expect(response.finalResponse).not.toContain("{{discountUser}}")

    // Assert: Other variables also work
    expect(response.finalResponse).not.toContain("{{nameUser}}")
    expect(response.finalResponse).not.toContain("{{email}}")
  })

  it("should replace {{TOKEN_DURATION}} in cart link messages", async () => {
    const response = await llmRouter.routeMessage({
      message: "Add 2x Mozzarella to cart",
      customerId: testCustomer.id,
      workspaceId: testWorkspace.id,
      customerName: testCustomer.nome,
      customerLanguage: "en",
      conversationId: "test-conversation",
    })

    // Assert: Token duration replaced
    expect(response.finalResponse).toMatch(/\d+ minutes/)
    expect(response.finalResponse).not.toContain("{{TOKEN_DURATION}}")
  })
})
```

**Acceptance Criteria**:
- [ ] Test creates real customer with discount
- [ ] Test calls actual llmRouter.routeMessage()
- [ ] Response verified to have no `{{variables}}`
- [ ] Test passes with `npm run test:integration`

**Estimated Time**: 15 minutes

---

## Phase 4: Validation & Polish

### Task 4.1: Manual E2E Test
**Type**: Testing  
**Priority**: CRITICAL  
**Dependencies**: Task 2.2  
**Parallel**: No

**Description**: Manual test with real backend to verify complete flow works as expected.

**Test Procedure**:
1. Restart backend: `cd backend && npm run dev`
2. Open frontend: http://localhost:3000
3. Login as admin
4. Send message: "I want to repeat my last order please"
5. Verify response shows actual discount (e.g., "15%") not `{{discountUser}}`
6. Click "View Flow" button
7. Verify Message Flow Timeline:
   - Router Agent → ORDER_TRACKING → Safety & Translation
   - NO "Router (validation-only)" step visible
   - PROMPT section appears BEFORE INPUT section
   - systemPrompt present in all steps
8. Check backend logs for "✅ Replaced customer variables"

**Acceptance Criteria**:
- [ ] No `{{variables}}` visible in final response
- [ ] Discount shows correct percentage from database
- [ ] Message Flow Timeline clean (no validation-only Router step)
- [ ] PROMPT before INPUT in all steps
- [ ] Backend logs show replacement success

**Estimated Time**: 10 minutes

---

### Task 4.2: Verify TypeScript Compilation
**Type**: Validation  
**Priority**: HIGH  
**Dependencies**: Task 2.1, Task 2.2  
**Parallel**: Yes [P]

**Description**: Ensure all TypeScript changes compile without errors.

**Commands**:
```bash
cd backend
npm run build
```

**Acceptance Criteria**:
- [ ] TypeScript compilation succeeds
- [ ] No type errors or warnings
- [ ] Prisma client generated successfully
- [ ] Build output in `dist/` folder

**Estimated Time**: 2 minutes

---

### Task 4.3: Update Documentation
**Type**: Documentation  
**Priority**: MEDIUM  
**Dependencies**: Task 4.1  
**Parallel**: Yes [P]

**Description**: Document the new variable replacement pattern in architecture docs.

**Files**:
- `docs/architecture/MULTI_AGENT_FLOW.md` (UPDATE - add variable replacement step)
- `.specify/memory/constitution.md` (VERIFY - Principle I compliance documented)

**Changes to MULTI_AGENT_FLOW.md**:
```markdown
## Step 4: Token & Variable Replacement (NEW - v1.8.1)

**Purpose**: Replace placeholders with actual values BEFORE Safety layer validation.

**Sub-Steps**:
1. **Link Token Replacement**: Replace `[LINK_XXX]` with actual URLs (JWT-secured)
2. **Customer Variables**: Replace `{{nameUser}}`, `{{discountUser}}`, etc. with database values
3. **Duration Tokens**: Replace `{{TOKEN_DURATION}}` with formatted expiration time

**Implementation**: `llm-router.service.ts` lines 665-685

**Example**:
```
INPUT:  "Hi {{nameUser}}, you have {{discountUser}}% off! Link: [LINK_CART]"
OUTPUT: "Hi Mario Rossi, you have 15% off! Link: http://localhost:3000/s/abc123"
```

**Why Before Safety?**: Safety layer needs to validate actual content, not placeholder tokens.
```

**Acceptance Criteria**:
- [ ] MULTI_AGENT_FLOW.md updated with Step 4 details
- [ ] Constitution references verified (Principle I)
- [ ] Examples added for clarity
- [ ] Markdown syntax correct

**Estimated Time**: 10 minutes

---

## Phase 5: Completion

### Task 5.1: Mark Tasks as Complete
**Type**: Housekeeping  
**Priority**: LOW  
**Dependencies**: All previous tasks  
**Parallel**: No

**Description**: Update tasks.md to mark all completed tasks with [X].

**Files**:
- `specs/124-customer-variables-replacement/tasks.md`

**Acceptance Criteria**:
- [ ] All completed tasks marked [X]
- [ ] Any blocked/pending tasks documented
- [ ] Final status summary added

**Estimated Time**: 2 minutes

---

### Task 5.2: Final Verification Checklist
**Type**: Validation  
**Priority**: CRITICAL  
**Dependencies**: All previous tasks  
**Parallel**: No

**Description**: Complete pre-PR checklist to ensure all requirements met.

**Checklist**:
- [ ] Unit tests pass (`npm run test:unit`)
- [ ] Integration tests pass (`npm run test:integration`)
- [ ] TypeScript compiles (`npm run build`)
- [ ] Manual E2E test successful
- [ ] No `{{variables}}` in production responses
- [ ] Backend logs show replacement success
- [ ] Message Flow Timeline clean (PROMPT before INPUT, no validation-only Router)
- [ ] Documentation updated
- [ ] Constitution compliance verified
- [ ] Zero hardcoded values in responses

**Estimated Time**: 5 minutes

---

## Summary

**Total Tasks**: 13  
**Estimated Total Time**: ~2 hours  
**Critical Path**: Task 1.1 → 1.2 → 2.1 → 2.2 → 4.1 → 5.2  
**Parallel Tasks**: 3 (Task 1.2, 3.1, 4.2, 4.3)

**Risk Assessment**:
- **LOW RISK**: Changes are localized to PromptProcessorService and one call site
- **HIGH IMPACT**: Fixes critical Constitution violation (Principle I)
- **BLOCKING**: Must be completed before PR for v1.8.0 (Validation-Only Router Pattern)

---

## Version

- Tasks Version: 1.0.0
- Created: 2025-11-13
- Feature ID: 124
- Related Spec: spec.md v1.0.0
- Related Plan: plan.md v1.0.0
