# ShopME - Message Flow Architecture

## 📋 Complete Message Flow (CORRECT)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. WEBHOOK RECEIVES MESSAGE                                         │
│    - WhatsApp/Frontend sends POST /api/whatsapp/webhook            │
│    - HMAC verification (skippable in dev)                           │
│    - Find customer in database                                      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. VARIABLE REPLACEMENT (Pre-processing)                           │
│    - Load customer data (name, discount, company, etc.)            │
│    - Load dynamic content (products, categories, offers, FAQs)     │
│    - Replace {{nameUser}}, {{PRODUCTS}}, etc. in system prompt     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. ROUTER LLM (First Level Decision)                               │
│    - Receives processed prompt with real data                      │
│    - Analyzes customer message with conversation history           │
│    - Decides which specialist agent to call                        │
│    - Uses Function Calling to delegate                             │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. SPECIALIST AGENT (SubLLM with OWN prompt from DB)               │
│    Options:                                                         │
│    - ProductSearchAgentLLM (search products/categories)            │
│    - CartManagementAgentLLM (add/remove/view cart)                │
│    - OrderTrackingAgentLLM (track orders/history)                 │
│    - CustomerSupportAgentLLM (FAQ/support tickets)                │
│                                                                     │
│    Each agent:                                                      │
│    - Has OWN LLM instance                                          │
│    - Loads OWN system prompt from database (agentConfig table)     │
│    - Executes function calls (searchProducts, addToCart, etc.)    │
│    - Returns English response with [LINK_xxx] tokens              │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5. RETURN TO ROUTER LLM (Loop continues)                           │
│    - Router receives SubLLM response                               │
│    - Router decides:                                               │
│      ✅ Response complete → exit loop                              │
│      ❌ Need another agent → call another SubLLM (max 5 iter)     │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 6. TOKEN REPLACEMENT                                                │
│    - LinkReplacementService replaces [LINK_ORDER], etc.            │
│    - Generates secure JWT tokens with expiry                       │
│    - Builds real URLs: /orders-public/ORD-048?token=xxx           │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 7. SECURITY & TRANSLATION LAYER                                     │
│    - SafetyTranslationAgent validates content                      │
│    - Blocks offensive/phishing content                             │
│    - Translates from English to customer's language (it/es/pt/en) │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 8. SAVE TO DATABASE                                                 │
│    - Save INBOUND message (customer question)                      │
│    - Save OUTBOUND message (bot response)                          │
│    - Save debugInfo (timeline with all steps)                      │
│    - Table: conversation_messages                                  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 9. EMIT TO WHATSAPP QUEUE                                           │
│    - WhatsAppQueueService.enqueue()                                │
│    - Message ready for sending via WhatsApp API                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 Debug Timeline Structure

Every message saved in DB contains `debugInfo` with execution steps:

```json
{
  "steps": [
    {
      "type": "router",
      "agent": "Router Agent",
      "model": "openai/gpt-4o-mini",
      "timestamp": "2025-11-11T14:00:00Z",
      "input": {
        "userMessage": "cerca arancini",
        "conversationHistory": [...]
      },
      "output": {
        "decision": "call_function",
        "functionCall": "callProductSearchAgent"
      },
      "tokenUsage": { "totalTokens": 500 }
    },
    {
      "type": "sub_agent",
      "agent": "PRODUCT_SEARCH Agent",
      "model": "openai/gpt-4o-mini",
      "timestamp": "2025-11-11T14:00:01Z",
      "input": {
        "delegatedFrom": "ROUTER",
        "query": "arancini"
      },
      "output": {
        "responseText": "Ho trovato 1 prodotto...",
        "language": "en"
      },
      "isSubAgent": true,
      "parentAgent": "ROUTER",
      "tokenUsage": { "totalTokens": 380 }
    },
    {
      "type": "token-replacement",
      "agent": "Link Replacement Service",
      "timestamp": "2025-11-11T14:00:02Z",
      "input": {
        "responseWithTokens": "Click [LINK_ORDER]",
        "tokensDetected": ["[LINK_ORDER]"]
      },
      "output": {
        "message": "Click http://localhost:3000/orders-public?token=xxx"
      }
    },
    {
      "type": "safety",
      "agent": "Safety & Translation Agent",
      "model": "openai/gpt-4o-mini",
      "timestamp": "2025-11-11T14:00:03Z",
      "input": {
        "textToValidate": "Ho trovato 1 prodotto...",
        "previousResponse": "Router response with links"
      },
      "output": {
        "safe": true,
        "translatedText": "Ho trovato 1 prodotto per \"arancini\"...",
        "decision": "approved"
      },
      "safe": true,
      "language": "it"
    }
  ],
  "totalTokens": 1170,
  "totalCost": 0.000176,
  "executionTimeMs": 1200,
  "timestamp": "2025-11-11T14:00:03Z"
}
```

---

## ❌ WRONG Flow (Current Implementation - TO FIX)

```
❌ 1. FAQ Check FIRST (bypasses Router!)
   ↓
❌ 2. Router LLM (only if FAQ not found)
   ↓
❌ 3. Save INBOUND message (TOO EARLY - before LLM processing!)
   ❌ If LLM fails → message saved without response → broken conversation
   ↓
4. SubLLM delegation
   ↓
5. Token Replacement
   ↓
6. Security Layer
   ❌ 7. debugInfo.steps.push(safety) - pushed to WRONG array!
   ↓
8. Save OUTBOUND message (with debugInfo)
   ❌ 9. NO WhatsApp queue emission!
```

---

## 📋 TODO List (Priority Order)

### ✅ TODO #4: Remove HMAC Verification (BLOCKS EVERYTHING)

**File:** `backend/src/interfaces/http/controllers/whatsapp-webhook.controller.ts`  
**Issue:** HMAC signature check blocks frontend messages (not WhatsApp API)  
**Action:** Remove HMAC check or add flag to distinguish frontend vs WhatsApp

---

### ✅ TODO #3: Remove FAQ Pre-check (WRONG ARCHITECTURE)

**File:** `backend/src/services/llm-router.service.ts` (lines 348-425)  
**Issue:** FAQ check bypasses Router LLM → Router loses control  
**Action:**

- Remove FAQ check from `routeMessage()` start
- Move FAQ search into a function that Router LLM can call via delegation
- Let Router decide WHEN to check FAQ, not hardcoded pre-check

---

### ✅ TODO #2: Fix Message Save Timing (CRITICAL)

**File:** `backend/src/services/llm-router.service.ts` (line 360)  
**Issue:** INBOUND message saved BEFORE LLM processing → if fails, orphan message  
**Action:**

- Remove `saveUserMessage()` from line 360
- Move BOTH saves (INBOUND + OUTBOUND) AFTER line 545 (after safety layer)
- Save them together in atomic operation

---

### ✅ TODO #5: Fix debugInfo.steps Array (BUG)

**File:** `backend/src/services/llm-router.service.ts` (lines 529-545)  
**Issue:** `debugSteps` array constructed during loop, then `debugInfo` created, then safety step pushed to `debugInfo.steps` → inconsistent!  
**Action:**

- Use SINGLE array (`debugInfo.steps`) from start
- Don't create separate `debugSteps` variable
- All steps push to same array

---

### ✅ TODO #1: Add WhatsApp Queue Emission (MISSING FEATURE)

**File:** `backend/src/services/llm-router.service.ts` (after line 545)  
**Issue:** Messages saved in DB but NEVER sent via WhatsApp  
**Action:**

- After saving OUTBOUND message (line 545)
- Call `whatsappQueueService.enqueue({...})`
- Emit message to queue for WhatsApp sending

---

## 🎯 Correct Flow (After Fixes)

```
1. Webhook receives message
   ↓
2. Variable replacement ({{nameUser}}, {{PRODUCTS}}, etc.)
   ↓
3. Router LLM (FIRST DECISION - no FAQ bypass!)
   ↓
4. Router delegates to SubLLM (ProductSearch/Cart/Order/Support)
   ↓
5. SubLLM executes, returns English response with [LINK_xxx]
   ↓
6. Router receives response, decides if complete (loop max 5 times)
   ↓
7. Token Replacement ([LINK_ORDER] → real URL with JWT)
   ↓
8. Security & Translation Layer (validate + translate to customer language)
   ↓
9. Save BOTH messages (INBOUND + OUTBOUND) with debugInfo
   ↓
10. Emit to WhatsApp queue for sending
```

---

## 📊 Function Calling Loop Explained

**Why loop needed?** Router LLM uses function calling pattern:

```
Iteration 1:
  Router → "I need product search" → function_call: callProductSearchAgent
  Execute → ProductSearch returns "1 prodotto trovato"
  Add to messages → CONTINUE loop

Iteration 2:
  Router receives "1 prodotto trovato" → analyzes
  Router decides → "Complete! Return to customer"
  No function_call → EXIT loop

Final: Return response to customer
```

**Max 5 iterations** prevents infinite loops if Router keeps delegating.

---

## 🔐 Security Layers

1. **HMAC Verification** (Webhook level)

   - Validates message comes from WhatsApp (not attacker)
   - Can skip in dev with `SKIP_HMAC_VERIFICATION=true`

2. **Workspace Isolation** (Database level)

   - Every query filters by `workspaceId`
   - Multi-tenant security

3. **Safety & Translation Agent** (LLM level)

   - Blocks offensive/phishing content
   - Validates before sending to customer

4. **JWT Tokens** (Public links)
   - Time-limited access (1h default)
   - No login required for order view links

---

## 📝 Database Schema

### `conversation_messages` table

```sql
{
  id: string
  chatSessionId: string
  direction: "INBOUND" | "OUTBOUND"
  content: string (final text)
  metadata: {
    debugInfo: DebugInfoSteps (timeline with all steps)
    customerId: string
    workspaceId: string
  }
  createdAt: DateTime
}
```

### `searchConversations` table (state management)

```sql
{
  sessionId: string (conversationId)
  workspaceId: string
  customerId: string
  activeAgent: "PRODUCT_SEARCH" | "CART_MANAGEMENT" | etc.
  metadata: {
    filteredProducts: [] (cached search results)
    selectedProductCode: string (confirmed product)
  }
  expiresAt: DateTime (10 min TTL)
}
```

---

## 🚀 Next Steps

1. Implement TODO #4 (remove HMAC - unblocks testing)
2. Implement TODO #3 (fix FAQ architecture)
3. Implement TODO #2 (fix save timing)
4. Implement TODO #5 (fix debugInfo array)
5. Implement TODO #1 (add WhatsApp queue)
6. Test complete flow end-to-end
7. Verify timeline shows all steps in frontend

---

## 📚 Related Files

- **LLMRouterService**: `backend/src/services/llm-router.service.ts`
- **Webhook Controller**: `backend/src/interfaces/http/controllers/whatsapp-webhook.controller.ts`
- **Specialist Agents**: `backend/src/application/agents/`
- **Message Repository**: `backend/src/repositories/message.repository.ts`
- **Conversation Manager**: `backend/src/services/conversation-manager.service.ts`
- **Link Replacement**: `backend/src/application/services/link-replacement.service.ts`
- **Safety Agent**: `backend/src/application/agents/SafetyTranslationAgent.ts`
