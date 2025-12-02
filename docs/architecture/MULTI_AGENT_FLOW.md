# Multi-Agent Flow Architecture

**Version**: 1.0.0  
**Last Updated**: 2025-11-13  
**Related**: Constitution v1.8.0 Principles IX, X

---

## 🎯 Overview

eChatbot uses a **multi-agent architecture** with Router Agent orchestrating specialist agents (ProductSearch, Cart, OrderTracking, CustomerSupport) and Safety Agent for final validation/translation.

**Key Innovation**: **Validation-Only Router Pattern** - Router validates specialist responses WITHOUT making expensive LLM call, saving 25% tokens (~5000 per request) and 800ms latency.

---

## 📊 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER MESSAGE: "avete salami?"                               │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. ROUTER AGENT (LLM Call #1)                                  │
│    - Model: gpt-4o-mini                                         │
│    - Temperature: 0.5                                           │
│    - System Prompt: Router prompt with {{PRODUCTS}} replaced   │
│    - Input: "avete salami?" + conversation history             │
│    - Decision: "Delegate to PRODUCT_SEARCH"                    │
│    - Tokens: ~5000                                              │
│    - debugStep: type="router", systemPrompt="..."              │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. PRODUCT_SEARCH AGENT (LLM Call #2)                          │
│    - Model: gpt-4o-mini                                         │
│    - Temperature: 0.3                                           │
│    - System Prompt: ProductSearch prompt with {{PRODUCTS}}     │
│    - Input: "avete salami?"                                     │
│    - Output: "Ciao Mario! Ecco i salumi: 1. **Prosciutto..."  │
│    - Tokens: ~8000                                              │
│    - debugStep: type="sub_agent", systemPrompt="..."           │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. ROUTER VALIDATION (NO LLM CALL - Validation-Only Pattern)   │
│    ┌─────────────────────────────────────────────────────────┐ │
│    │ validateSubAgentResponse():                             │ │
│    │ ✅ Response length: 250 chars (>50 ✓)                  │ │
│    │ ✅ Has product list: /\d+\.\s+\*\*/ match found ✓       │ │
│    │ ✅ Agent-specific check: PRODUCT_SEARCH validation ✓   │ │
│    │ 🎯 Decision: VALID → Skip Router LLM call!             │ │
│    └─────────────────────────────────────────────────────────┘ │
│    - Tokens: 0 (no LLM call!)                                   │
│    - Saved: ~5000 tokens (25% reduction)                       │
│    - Saved: ~800ms latency                                     │
│    - debugStep: type="router", agent="Router (validation-only)"│
│                 tokenUsage: {totalTokens: 0}                   │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. TOKEN REPLACEMENT (Backend Processing)                      │
│    - Replace: [LINK_ORDER_12345] → https://...?token=xxx      │
│    - Replace: [LINK_CART] → https://...cart?token=xxx         │
│    - Tokens: 0 (backend string manipulation)                   │
│    - debugStep: type="token-replacement"                       │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. SAFETY & TRANSLATION AGENT (LLM Call #3)                    │
│    - Model: gpt-4o-mini                                         │
│    - Temperature: 0.2                                           │
│    - System Prompt: Safety prompt with allowed domains         │
│    - Input: "Ciao Mario! Ecco i salumi..." (Italian)           │
│    - Output: "Hola Mario! Aquí están los embutidos..." (Spanish)│
│    - Safety Check: ✅ No PII, profanity, phishing              │
│    - Tokens: ~3000                                              │
│    - debugStep: type="safety", systemPrompt="..."              │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. FINAL RESPONSE TO CUSTOMER                                  │
│    "Hola Mario! Aquí están los embutidos..."                  │
│    Total Tokens: ~16,000 (Router + ProductSearch + Safety)     │
│    Total Cost: ~$0.006 per message                             │
│    Latency: ~2.5s                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔀 Flow Decision Points

### When Router Calls LLM (Expensive Path)

Router makes LLM call #3 when:

1. **Validation Fails**: `validateSubAgentResponse()` returns `isValid: false`

   - Response too short (<50 chars)
   - Missing expected content (e.g., PRODUCT_SEARCH without product list)
   - Generic/unclear response needing reformulation

2. **Manual Override**: Explicit request to reformulate
   - User says "spiega meglio" (explain better)
   - Response quality issues detected

**Example (Invalid Response)**:

```typescript
// Sub-agent returns: "ok"
const validationResult = validateSubAgentResponse({
  response: "ok", // ❌ Only 2 chars, <50 minimum
  expectedAgent: "PRODUCT_SEARCH",
  userQuery: "avete salami?",
})
// → { isValid: false, reason: "Too short (2 < 50 chars)" }
// → Router makes LLM call to reformulate
```

### When Router Skips LLM (Validation-Only Path - MOST COMMON)

Router skips LLM call when:

1. **Validation Passes**: `validateSubAgentResponse()` returns `isValid: true`

   - Response length >50 chars ✅
   - Contains expected content ✅
   - Agent-specific checks pass ✅

2. **Performance Benefit**:
   - Saves ~5000 tokens (25% reduction)
   - Saves ~800ms latency
   - Reduces API costs by $0.001875 per message

**Example (Valid Response)**:

```typescript
// Sub-agent returns: "Ciao Mario! Ecco i salumi: 1. **Prosciutto di Parma DOP** €8.50..."
const validationResult = validateSubAgentResponse({
  response: "Ciao Mario! Ecco i salumi: 1. **Prosciutto...", // ✅ 250 chars
  expectedAgent: "PRODUCT_SEARCH",
  userQuery: "avete salami?",
})
// → { isValid: true }
// → Router skips LLM call, passes directly to Safety
// → Saves 5000 tokens!
```

---

## 🧪 Validation Rules (Agent-Specific)

### PRODUCT_SEARCH Validation

```typescript
if (expectedAgent === "PRODUCT_SEARCH") {
  const hasProducts = /\d+\.\s+\*\*/.test(response) // "1. **Product Name**"
  const hasCategories = /categori/i.test(response)
  const hasNoProducts = /non\s+(ho|abbiamo)|no\s+products?/i.test(response)

  if (!hasProducts && !hasCategories && !hasNoProducts) {
    return {
      isValid: false,
      reason: "Missing product list or 'no products' message",
    }
  }
}
```

**Valid Examples**:

- ✅ "Ecco i salumi: 1. **Prosciutto** €8.50, 2. **Salame** €12.00"
- ✅ "Abbiamo 3 categorie: Salumi, Formaggi, Dolci"
- ✅ "Mi dispiace, non abbiamo dolci al momento"

**Invalid Examples**:

- ❌ "ok" (too short, no products)
- ❌ "Posso aiutarti con qualcos'altro?" (no product info)

### CART_MANAGEMENT Validation

```typescript
if (expectedAgent === "CART_MANAGEMENT") {
  const hasCartAction = /aggiunt|rimoss|carrell|cart|added|removed/i.test(
    response
  )
  if (!hasCartAction) {
    return { isValid: false, reason: "Missing cart action confirmation" }
  }
}
```

**Valid Examples**:

- ✅ "✅ Ho aggiunto 2 x Prosciutto al tuo carrello!"
- ✅ "Removed 1 x Salame from cart"

**Invalid Examples**:

- ❌ "Done" (no cart action mentioned)

### ORDER_TRACKING Validation

```typescript
if (expectedAgent === "ORDER_TRACKING") {
  const hasOrderInfo = /ORD-|ordine|order|tracking/i.test(response)
  if (!hasOrderInfo) {
    return { isValid: false, reason: "Missing order code or tracking info" }
  }
}
```

**Valid Examples**:

- ✅ "Il tuo ordine ORD-048-2025-9 è stato spedito!"
- ✅ "Your order status: In Transit"

---

## 📋 Message Flow Timeline Structure

### Complete Timeline (4-5 Steps)

```json
{
  "steps": [
    {
      "type": "router",
      "agent": "Router Agent",
      "model": "gpt-4o-mini",
      "temperature": 0.5,
      "timestamp": "2025-11-13T18:40:09.100Z",
      "systemPrompt": "# 🔀 ROUTER AGENT...", // ✅ Processed prompt
      "tokenUsage": { "totalTokens": 5234 },
      "input": { "userMessage": "avete salami?" },
      "output": {
        "decision": "call_function",
        "functionCall": "callProductSearchAgent"
      }
    },
    {
      "type": "sub_agent",
      "agent": "PRODUCT_SEARCH Agent",
      "timestamp": "2025-11-13T18:40:11.200Z",
      "systemPrompt": "# Product and Services Agent...", // ✅ With {{PRODUCTS}} replaced
      "tokenUsage": { "totalTokens": 8120 },
      "input": { "query": "avete salami?" },
      "output": {
        "responseText": "Ciao Mario! Ecco i salumi: 1. **Prosciutto..."
      }
    },
    {
      "type": "router",
      "agent": "Router Agent (validation-only)", // ⬅️ NOTE: validation-only label
      "model": "gpt-4o-mini",
      "temperature": 0,
      "timestamp": "2025-11-13T18:40:11.250Z",
      "tokenUsage": { "totalTokens": 0 }, // ⬅️ ZERO tokens - no LLM call!
      "input": { "specialistResponse": "Ciao Mario! Ecco i salumi..." },
      "output": {
        "decision": "Response validated - approved for Safety layer (no LLM call)"
      }
    },
    {
      "type": "token-replacement",
      "agent": "Link Replacement Service",
      "timestamp": "2025-11-13T18:40:11.300Z",
      "input": { "tokensDetected": ["[LINK_CART]"] },
      "output": { "message": "Replaced 1 token(s)" }
    },
    {
      "type": "safety",
      "agent": "Safety & Translation Agent",
      "model": "gpt-4o-mini",
      "temperature": 0.2,
      "timestamp": "2025-11-13T18:40:12.500Z",
      "systemPrompt": "# 🛡️ SAFETY & TRANSLATION...", // ✅ Safety prompt
      "tokenUsage": { "totalTokens": 3012 },
      "input": { "textToValidate": "Ciao Mario! Ecco i salumi..." },
      "output": { "safe": true, "translatedText": "Hola Mario! Aquí están..." }
    }
  ],
  "totalTokens": 16366,
  "totalCost": 0.00614
}
```

### Timeline Integrity Checks

✅ **MUST have**:

1. Router step (LLM call #1) with `systemPrompt`
2. Sub-agent step with `systemPrompt`
3. Router validation step (validation-only OR LLM call) - distinguishable by `tokenUsage`
4. Safety step with `systemPrompt`

❌ **MUST NOT have**:

1. Missing `systemPrompt` in any agent step
2. Steps without timestamp
3. Zero-token steps without "(validation-only)" label
4. Hardcoded responses bypassing agents

---

## 🚨 Critical Rules for Modifications

### ⚠️ WHEN MODIFYING MULTI-AGENT FLOW

**BEFORE** making ANY changes to:

- `llm-router.service.ts`
- Specialist agents (ProductSearchAgentLLM, CartManagementAgentLLM, etc.)
- `functionCallingLoop()` method

**YOU MUST**:

1. **Read This Document** - Understand current flow completely
2. **Check Constitution** - Verify compliance with Principles IX (Timeline Integrity) and X (Validation-Only)
3. **Update Tests** - Modify test expectations to match new flow
4. **Update This Doc** - Keep flow diagram and examples current
5. **Manual Test** - Verify Message Flow Timeline shows correct steps

### 🛡️ Protected Patterns (DO NOT BREAK)

#### Pattern 1: systemPrompt Tracking (Principle IX)

```typescript
// ✅ CORRECT - Every specialist agent returns systemPrompt
export interface ProductSearchLLMResponse {
  success: boolean
  output: string
  tokensUsed: number
  executionTimeMs: number
  functionCalls?: any[]
  systemPrompt?: string // ⬅️ MUST include!
}

// ❌ WRONG - Missing systemPrompt
return {
  success: true,
  output: "Ecco i prodotti...",
  tokensUsed: 5000,
  // ❌ NO systemPrompt! Frontend can't show 📄 PROMPT section!
}
```

#### Pattern 2: Validation-Only Router (Principle X)

```typescript
// ✅ CORRECT - Call validation, then decide
const validationResult = this.validateSubAgentResponse({...})

if (!validationResult.isValid) {
  // Invalid → Router LLM call
  continue
}

// Valid → Skip LLM, add validation-only debugStep
debugSteps.push({
  type: "router",
  agent: "Router Agent (validation-only)",
  tokenUsage: { totalTokens: 0 }, // ⬅️ ZERO!
})

return { response: subAgentFinalResponse, debugSteps }

// ❌ WRONG - Always calling Router LLM (wastes 5000 tokens)
messages.push({ role: "function", content: subAgentFinalResponse })
continue // ⬅️ Always goes to Router LLM call #3
```

#### Pattern 3: debugStep Push Locations

```typescript
// ✅ CORRECT - Push IMMEDIATELY after each LLM call
const llmResponse = await this.callRouterLLM({...})
debugSteps.push({ type: "router", ... }) // ⬅️ Push here!

const subAgentResponse = await productSearchAgent.handleQuery({...})
debugSteps.push({ type: "sub_agent", ... }) // ⬅️ Push here!

const safeResponse = await this.safetyAgent.process({...})
debugSteps.push({ type: "safety", ... }) // ⬅️ Push here!

// ❌ WRONG - Batching debugSteps at the end
// (Loses ordering, makes debugging impossible)
```

---

## 📊 Performance Metrics

### Token Usage Breakdown

| Step | Agent                | Tokens                  | Cost     | Can Skip?     |
| ---- | -------------------- | ----------------------- | -------- | ------------- |
| 1    | Router LLM call      | ~5000                   | $0.00188 | ❌ Never      |
| 2    | Specialist LLM call  | ~8000                   | $0.00300 | ❌ Never      |
| 3    | Router validation    | **0** (validation-only) | **$0**   | ✅ If valid   |
| 3    | Router reformulation | ~5000                   | $0.00188 | ⚠️ If invalid |
| 4    | Token replacement    | 0 (backend)             | $0       | ❌ Never      |
| 5    | Safety LLM call      | ~3000                   | $0.00113 | ❌ Never      |

**Total (Validation-Only Path)**:

- Tokens: ~16,000
- Cost: ~$0.006 per message
- Latency: ~2.5s

**Total (Reformulation Path)**:

- Tokens: ~21,000 (+31% more)
- Cost: ~$0.0079 (+32% more)
- Latency: ~3.3s (+32% slower)

### Success Rates (Expected)

- **Validation Success Rate**: >90% (most specialist responses are complete)
- **Token Savings (Annual)**: ~$680/year (1000 messages/day)
- **Latency Improvement**: ~800ms average per message

---

## 🧪 Testing Guidelines

### Manual Test Checklist

Before merging changes:

1. **Send test message**: "avete salami?"
2. **Open Message Flow Timeline** (frontend UI)
3. **Verify 4-5 steps** shown:
   - Step 1: Router Agent (LLM call)
   - Step 2: PRODUCT_SEARCH Agent
   - Step 3: Router Agent (validation-only) OR Router Agent (reformulation)
   - Step 4: Token Replacement (optional)
   - Step 5: Safety & Translation Agent
4. **Expand each step**:
   - ✅ 📄 PROMPT (System) section present
   - ✅ PROMPT appears BEFORE INPUT (order: PROMPT → INPUT → OUTPUT)
   - ✅ systemPrompt shows processed prompt (variables replaced)
   - ✅ Token usage shows correct counts
5. **Check backend logs**:
   - ✅ "Sub-agent response valid, skipping Router LLM call" (validation-only path)
   - ✅ "savedTokens: ~5000" logged
   - ❌ NO "Sub-agent response invalid, Router will reformulate" (unless intentional)

### Automated Test Pattern

```typescript
describe("Multi-Agent Flow", () => {
  it("MUST use validation-only path when specialist response is valid", async () => {
    const response = await llmRouter.routeMessage({
      message: "avete salami?",
      workspaceId,
      customerId,
    })

    // Check timeline structure
    expect(response.debugInfo.steps).toHaveLength(5) // Router → Sub → Router(val) → Token → Safety

    const validationStep = response.debugInfo.steps.find(
      (s) => s.type === "router" && s.agent.includes("validation-only")
    )
    expect(validationStep).toBeDefined()
    expect(validationStep.tokenUsage.totalTokens).toBe(0) // No LLM call!

    // Check token savings
    expect(response.debugInfo.totalTokens).toBeLessThan(20000) // Should be ~16k, not ~21k
  })
})
```

---

## 📚 Related Documentation

- **Constitution v1.8.0**: `.specify/memory/constitution.md`
  - Principle IX: Message Flow Timeline Integrity
  - Principle X: Validation-Only Router Pattern
- **Implementation**: `backend/src/services/llm-router.service.ts`
  - `validateSubAgentResponse()` method (lines 203-290)
  - `functionCallingLoop()` validation logic (lines 1550-1650)
- **Frontend UI**: `frontend/src/components/shared/MessageFlowDialog.tsx`
  - 📄 PROMPT section display (lines 398-413)
- **Specialist Agents**:
  - `backend/src/application/agents/ProductSearchAgentLLM.ts`
  - `backend/src/application/agents/CartManagementAgentLLM.ts`
  - `backend/src/application/agents/OrderTrackingAgentLLM.ts`
  - `backend/src/application/agents/CustomerSupportAgentLLM.ts`

---

**Version**: 1.0.0 | **Created**: 2025-11-13 | **Maintained By**: Architecture Team
