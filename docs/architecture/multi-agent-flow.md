# Multi-Agent Flow Architecture

**Version**: 1.1.0  
**Last Updated**: 2025-01-XX  
**Related**: Constitution v1.8.0 Principles IX, X

---

## 🎯 Overview

eChatbot uses a **multi-agent architecture** with two distinct message processing flows:

### 1. Router Flow (`llm-router.service.ts`)
- **Agents**: Router → Specialist Agents → Translation Layer → Security Layer
- **Translation Layer** handles language conversion; **Widget Security** validates safety (widget-only)
- WhatsApp messages: Widget Security runs in Scheduler; translation happens before queue
- Used for: complex routing, multiple agent coordination

### 2. ChatEngine Flow (`chat-engine.service.ts`) ⬅️ **NEW**
- **Pattern**: Wrapper (routeMessage → processMessageInternal → applyTranslation)
- **TranslationAgent** is separate: ONLY translation
- Used for: code-first LLM processing
- **Key Innovation**: Single translation point via wrapper pattern (see section below)

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
│ 4. TOKEN REPLACEMENT (Backend Processing)                      │
│    - Replace: [LINK_ORDER_WITH_TOKEN] → https://...?token=xxx │
│    - Replace: [LINK_CHECKOUT_WITH_TOKEN] → https://...cart?token=xxx │
│    - Tokens: 0 (backend string manipulation)                   │
│    - debugStep: type="token-replacement"                       │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. SAFETY & TRANSLATION AGENT (LLM Call #3)                    │
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
│ 6. FINAL RESPONSE TO CUSTOMER                                  │
│    "Hola Mario! Aquí están los embutidos..."                  │
│    Total Tokens: ~16,000 (Router + ProductSearch + Safety)     │
│    Total Cost: ~$0.006 per message                             │
│    Latency: ~2.5s                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

---

## 🍝 Category Shortcut (Code-First Flow)

Some user queries are explicitly asking for **existing catalog categories** (e.g., “pasta e formaggi”, “avete vino o olio?”).  
To avoid triggering a full product search + LLM grouping in these situations we added a lightweight shortcut inside the code-first flow:

1. **Tokenize & Normalize** – the raw text is lowercased, accents removed, punctuation stripped, and split into tokens (min 3 chars). Common verbs/conjunctions (“cerco”, “voglio”, “o”, “and”...) are ignored via a stopword list.
2. **Category Matching** – tokens are compared against the normalized category names fetched from DB. Each match gets a score (exact match > prefix > contains) and we keep only categories with score > 0.
3. **All Tokens Covered?** – if every meaningful token maps to at least one category, we short-circuit `SEARCH_PRODUCTS` and directly return a `CATEGORIES` data payload with just those matches.
4. **ResponseBuilder Ranking** – the existing category ranking (based on userMessage) still runs, so order is stable across the pipeline.

Result: questions like “avete pasta o formaggi?” now produce only those categories, without hitting the expensive product search grouping flow, keeping latency and token usage low.

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
      "type": "token-replacement",
      "agent": "Link Replacement Service",
      "timestamp": "2025-11-13T18:40:11.300Z",
      "input": { "tokensDetected": ["[LINK_CHECKOUT_WITH_TOKEN]"] },
      "output": { "message": "Replaced 1 token(s)" }
    },
    {
      "type": "safety",
      "agent": "Translation Layer",
      "model": "gpt-4o-mini",
      "temperature": 0.2,
      "timestamp": "2025-11-13T18:40:12.500Z",
      "systemPrompt": "# 🌍 TRANSLATION...", // ✅ Translation prompt
      "tokenUsage": { "totalTokens": 3012 },
      "input": { "previousResponse": "Ciao Mario! Ecco i salumi..." },
      "output": { "translatedText": "Hola Mario! Aquí están...", "decision": "translated" }
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
3. Translation step with `systemPrompt`

❌ **MUST NOT have**:

1. Missing `systemPrompt` in any agent step
2. Steps without timestamp
3. Hardcoded responses bypassing agents

---

## 🚨 Critical Rules for Modifications

### ⚠️ WHEN MODIFYING MULTI-AGENT FLOW

**BEFORE** making ANY changes to:

- `llm-router.service.ts`
- Specialist agents (ProductSearchAgentLLM, CartManagementAgentLLM, etc.)
- `functionCallingLoop()` method

**YOU MUST**:

1. **Read This Document** - Understand current flow completely
2. **Check Constitution** - Verify compliance with Principle IX (Timeline Integrity)
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

#### Pattern 2: debugStep Push Locations

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

| Step | Agent                | Tokens      | Cost     |
| ---- | -------------------- | ----------- | -------- |
| 1    | Router LLM call      | ~5000       | $0.00188 |
| 2    | Specialist LLM call  | ~8000       | $0.00300 |
| 3    | Token replacement    | 0 (backend) | $0       |
| 4    | Translation LLM call | ~3000       | $0.00113 |

**Total**:

- Tokens: ~16,000
- Cost: ~$0.006 per message
- Latency: ~2.5s

---

## 🧪 Testing Guidelines

### Manual Test Checklist

Before merging changes:

1. **Send test message**: "avete salami?"
2. **Open Message Flow Timeline** (frontend UI)
3. **Verify 4 steps** shown:
   - Step 1: Router Agent (LLM call)
   - Step 2: PRODUCT_SEARCH Agent
   - Step 3: Token Replacement (optional)
   - Step 4: Translation Layer
4. **Expand each step**:
   - ✅ 📄 PROMPT (System) section present
   - ✅ PROMPT appears BEFORE INPUT (order: PROMPT → INPUT → OUTPUT)
   - ✅ systemPrompt shows processed prompt (variables replaced)
   - ✅ Token usage shows correct counts
5. **Check backend logs**:
   - ✅ Flow completes without errors
   - ✅ Token usage shows correct counts for each LLM call

### Automated Test Pattern

```typescript
describe("Multi-Agent Flow", () => {
  it("MUST complete multi-agent flow with correct timeline", async () => {
    const response = await llmRouter.routeMessage({
      message: "avete salami?",
      workspaceId,
      customerId,
    })

    // Check timeline structure (Router → Sub-agent → Token → Safety)
    expect(response.debugInfo.steps.length).toBeGreaterThanOrEqual(4)

    // Verify each agent in flow
    const routerStep = response.debugInfo.steps.find((s) => s.type === "router")
    const subAgentStep = response.debugInfo.steps.find((s) => s.type === "sub_agent")
    const safetyStep = response.debugInfo.steps.find((s) => s.type === "safety")

    expect(routerStep).toBeDefined()
    expect(subAgentStep).toBeDefined()
    expect(safetyStep).toBeDefined()
  })
})
```

---

## 📚 Related Documentation

- **Constitution v1.8.0**: `.specify/memory/constitution.md`
  - Principle IX: Message Flow Timeline Integrity
- **Implementation**: `backend/src/services/llm-router.service.ts`
  - `functionCallingLoop()` method
- **Frontend UI**: `frontend/src/components/shared/MessageFlowDialog.tsx`
  - 📄 PROMPT section display (lines 398-413)
- **Specialist Agents**:
  - `backend/src/application/agents/ProductSearchAgentLLM.ts`
  - `backend/src/application/agents/CartManagementAgentLLM.ts`
  - `backend/src/application/agents/OrderTrackingAgentLLM.ts`
  - `backend/src/application/agents/CustomerSupportAgentLLM.ts`

---

## 🌍 Translation Layer Architecture (Updated 2025-01)

### ChatEngine Wrapper Pattern

The `ChatEngineService` uses a **Decorator/Wrapper Pattern** to ensure ALL responses pass through translation:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ChatEngine Translation Flow                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  External Call: routeMessage(input)                              │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────┐                    │
│  │  routeMessage() - PUBLIC WRAPPER        │                    │
│  │  • Calls processMessageInternal()       │                    │
│  │  • Applies applyTranslation() ONCE      │                    │
│  │  • Returns translated message           │                    │
│  └─────────────────┬───────────────────────┘                    │
│                    │                                             │
│       ┌────────────┴────────────┐                               │
│       ▼                         ▼                                │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ processMessage  │    │ applyTranslation│                     │
│  │ Internal()      │    │ ()              │                     │
│  │ PRIVATE         │    │                 │                     │
│  │ • All business  │    │ • TranslationAgent                    │
│  │   logic         │    │ • Push debug step                     │
│  │ • Returns       │    │ • "🌍 Translation                     │
│  │   Italian       │    │    Agent" in timeline                 │
│  │   response      │    │                 │                     │
│  └─────────────────┘    └─────────────────┘                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Why Wrapper Pattern?

**Problem**: `processMessageInternal()` has 20+ early return statements. Adding translation to each return would be:
- ❌ Error-prone (easy to miss one)
- ❌ Code duplication
- ❌ Hard to maintain

**Solution**: Single translation point in wrapper:
```typescript
// PUBLIC wrapper - ONLY entry point
async routeMessage(input: RouteMessageInput): Promise<RouteMessageResult> {
  // 1. Process message (returns Italian)
  const result = await this.processMessageInternal(input)
  
  // 2. Apply translation ONCE (to customer's language)
  const translatedMessage = await this.applyTranslation(
    result.message,
    customer.preferredLanguage,
    result.debugSteps
  )
  
  return { ...result, message: translatedMessage }
}
```

### Translation & Security Layers

| Layer | Location | Purpose | Channel |
|-------|----------|---------|---------|
| **Translation Layer** | `llm-router.service.ts`, `chat-engine.service.ts` | Translation ONLY - converts base response to customer language | All channels |
| **Security Layer** | `SecurityAgent.ts` (backend) | Safety validation AFTER translation | All channels |
| **WhatsApp Security Layer** | `security-agent.service.ts` (scheduler) | Safety validation BEFORE WhatsApp send | WhatsApp only |

**Important**: Translation happens before queueing. Widget security runs only for widget responses. WhatsApp security runs in the scheduler to avoid double LLM costs.

### Debug Step in Message Flow Timeline

The translation step appears as:
```json
{
  "type": "safety",
  "agent": "Translation Layer",
  "input": { "previousResponse": "Risposta in italiano..." },
  "output": { "translatedText": "Response in customer's language...", "decision": "translated" }
}
```

### Key Files

| File | Responsibility |
|------|----------------|
| `chat-engine.service.ts` | `routeMessage()` wrapper, `applyTranslation()` |
| `TranslationAgent.ts` | LLM-based translation to customer's `preferredLanguage` |
| `MessageFlowDialog.tsx` | Frontend displays "🌍 Translation Agent" step |

---

**Version**: 1.1.0 | **Created**: 2025-11-13 | **Updated**: 2025-01-XX | **Maintained By**: Architecture Team
