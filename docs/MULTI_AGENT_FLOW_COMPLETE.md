# Multi-Agent System Flow - Complete Guide

## 🎯 Overview

ShopME uses a **Router + Specialist Agents** architecture where:

- **Router Agent** = Orchestrator (routes requests, handles FAQ)
- **5 Specialist Agents** = Domain experts (Product, Cart, Orders, Profile, Support)
- **Safety Agent** = Final validation + translation layer

---

## 📊 Complete Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: Customer sends WhatsApp message                         │
│ Input: "non voglio più ricevere offerte"                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: Router Agent (LLM #1) - Intent Classification           │
│ Model: openai/gpt-4o-mini                                        │
│ Temp: 0.2 (deterministic)                                        │
│ Max Tokens: 500                                                  │
│                                                                  │
│ System Prompt: router-agent-CLEAN.md                            │
│ Variables: {{FAQ}} (NO products/categories)                     │
│                                                                  │
│ Decision Logic:                                                 │
│ - Check FAQ match → Return answer directly                      │
│ - Otherwise → Call function to delegate:                        │
│                                                                  │
│   | Request Type                  | Function Call               │
│   |-------------------------------|----------------------------|│
│   | Products, discounts, offers   | productSearchAgent(...)    ││
│   | Cart operations               | cartManagementAgent(...)   ││
│   | Orders, tracking              | orderTrackingAgent(...)    ││
│   | Profile, email, notifications | profileManagementAgent(...)││
│   | Help, complex issues          | customerSupportAgent(...)  ││
│                                                                  │
│ Output: profileManagementAgent({ query: "disattiva notifiche" })│
│ Tokens: ~2300                                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: Function Executor - Delegation to Specialist            │
│                                                                  │
│ 1. Router calls profileManagementAgent function                 │
│ 2. function-executor.service.ts detects delegation              │
│ 3. Returns: { delegateTo: "PROFILE_MANAGEMENT", query: "..." } │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: Profile Management Agent (LLM #2) - 1st Iteration       │
│ Model: openai/gpt-4o-mini                                        │
│ Temp: 0.3                                                        │
│ Max Tokens: 2048                                                 │
│                                                                  │
│ System Prompt: profile-management-agent.md                      │
│ Variables: {{nameUser}}, {{email}}, {{pushNotificationsConsent}}│
│                                                                  │
│ Available Functions:                                            │
│ - handlePushNotifications(value: boolean)                       │
│                                                                  │
│ Input:                                                          │
│ - Query: "disattiva notifiche offerte"                         │
│ - Conversation History: [] (empty - first request)             │
│                                                                  │
│ Decision: Ask confirmation BEFORE calling function             │
│                                                                  │
│ Output (Text Response):                                         │
│ "Mario Rossi, vuoi disattivare le notifiche push? 📭           │
│  Non riceverai più messaggi promozionali.                      │
│  Rispondi SI per confermare."                                  │
│                                                                  │
│ Tokens: ~2800                                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 5: Safety & Translation Agent (LLM #3)                     │
│ Model: openai/gpt-4o-mini                                        │
│ Temp: 0.2                                                        │
│                                                                  │
│ Input: ProfileManagement response (Italian)                     │
│ Target Language: it (Italian)                                   │
│                                                                  │
│ Tasks:                                                          │
│ 1. ✅ Validate response is safe (no harmful content)            │
│ 2. ✅ Translate to customer's language (if needed)              │
│ 3. ✅ Replace {{TOKEN_DURATION}} and customer variables         │
│                                                                  │
│ Output: Same Italian text (already correct language)            │
│ Tokens: ~3200                                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 6: Save to Database                                        │
│                                                                  │
│ 1. Save user message (INBOUND)                                  │
│    - Content: "non voglio più ricevere offerte"                │
│    - Role: USER                                                 │
│                                                                  │
│ 2. Save assistant response (OUTBOUND)                           │
│    - Content: "Mario Rossi, vuoi disattivare..."               │
│    - Role: ASSISTANT                                            │
│    - AgentType: PROFILE_MANAGEMENT                              │
│    - DebugInfo: Full execution trace (Router → Profile → Safety)│
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 7: Send via WhatsApp                                       │
│ Output: "Mario Rossi, vuoi disattivare le notifiche push? 📭   │
│          Rispondi SI per confermare."                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 🔄 USER CONFIRMS                                                 │
│ Customer replies: "SI"                                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 8: Router Agent (LLM #4) - 2nd Request                     │
│                                                                  │
│ Input:                                                          │
│ - User Message: "SI"                                            │
│ - Conversation History: Last 5 messages (5 min window)         │
│   [assistant: "vuoi disattivare...", user: "SI"]               │
│                                                                  │
│ Decision: Context-aware routing                                │
│ - Detects "SI" is confirmation for ProfileManagement context   │
│ - Calls: profileManagementAgent({ query: "SI" })               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 9: Profile Management Agent (LLM #5) - 2nd Iteration       │
│                                                                  │
│ Input:                                                          │
│ - Query: "SI"                                                   │
│ - Conversation History: ✅ NOW INCLUDES PREVIOUS MESSAGES       │
│   [system: "...", assistant: "vuoi disattivare?", user: "SI"] │
│                                                                  │
│ 🧠 Agent sees history → understands "SI" = confirm disable      │
│                                                                  │
│ Decision: CALL FUNCTION                                         │
│ Function: handlePushNotifications(false)                        │
│                                                                  │
│ Arguments: { value: false }                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 10: Execute handlePushNotifications Function               │
│                                                                  │
│ 1. ProfileManagement calls executeFunction()                   │
│ 2. Maps to ManageNotifications domain function                 │
│ 3. Updates database:                                            │
│    UPDATE customers                                             │
│    SET push_notifications_consent = false,                      │
│        push_notifications_consent_at = NOW()                    │
│    WHERE id = 'customer-id' AND workspaceId = 'workspace-id'    │
│                                                                  │
│ Result: { success: true, message: "...", currentStatus: false } │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 11: Profile Management Agent (LLM #5 - continued)          │
│                                                                  │
│ Function result added to conversation:                          │
│ [function: { success: true, currentStatus: false }]             │
│                                                                  │
│ LLM generates final response:                                   │
│ "✅ Perfetto Mario Rossi! Le notifiche push sono state          │
│  DISATTIVATE. Non riceverai più messaggi promozionali."        │
│                                                                  │
│ Tokens: ~2900                                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 12: Safety & Translation (LLM #6)                          │
│ Output: "✅ Perfetto Mario Rossi!..." (validated + translated)  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ STEP 13: Save & Send Final Response                             │
│ Database: push_notifications_consent = false ✅                 │
│ WhatsApp: Success message sent to customer ✅                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Technical Components

### 1. Router Agent (ORCHESTRATOR)

**File**: `backend/src/services/llm-router.service.ts`
**Prompt**: `docs/prompts/router-agent-CLEAN.md`

**Responsibilities**:

- ✅ FAQ matching (direct answer)
- ✅ Intent classification (which specialist to call)
- ✅ Context interpretation (short replies like "SI", "NO", "1")
- ❌ NO product knowledge (delegates to ProductSearchAgent)
- ❌ NO business logic (delegates to specialists)

**Available Functions** (delegation only):

```typescript
;-productSearchAgent(query) -
  cartManagementAgent(query) -
  orderTrackingAgent(query) -
  profileManagementAgent(query) -
  customerSupportAgent(query) -
  RESET_ACTIVE_AGENT(reason) // Context reset
```

---

### 2. Profile Management Agent (SPECIALIST)

**File**: `backend/src/application/agents/ProfileManagementAgentLLM.ts`
**Prompt**: `docs/prompts/profile-management-agent.md`

**Responsibilities**:

- ✅ Manage notification preferences
- ✅ Update customer profile
- ✅ Generate secure profile links
- ❌ NO product search
- ❌ NO cart/order operations

**Available Functions** (calling functions):

```typescript
- handlePushNotifications(value: boolean)
  // Maps to: ManageNotifications domain function
  // Updates: push_notifications_consent in database
```

**Critical Pattern**: ALWAYS ask confirmation BEFORE calling function

```
User: "disattiva notifiche"
Agent: "Vuoi disattivare? Rispondi SI" ← Ask first
User: "SI"
Agent: [CALL handlePushNotifications(false)] ← Then execute
```

---

### 3. Safety & Translation Agent

**File**: `backend/src/application/agents/SafetyTranslationAgent.ts`

**Responsibilities**:

- ✅ Validate response safety (no harmful content)
- ✅ Translate to customer's language
- ✅ Replace remaining variables ({{TOKEN_DURATION}}, {{nameUser}})

**Flow**:

```
Input: Specialist agent response (any language)
↓
Safety Check: Block harmful/inappropriate content
↓
Translation: Convert to customer's preferred language
↓
Variable Replacement: {{nameUser}} → "Mario Rossi"
↓
Output: Final customer-facing message
```

---

## 🔍 Key Architectural Decisions

### 1. Database-First Architecture

- ✅ ALL prompts stored in database (`agentConfig` table)
- ✅ Loaded from `docs/prompts/*.md` via seed
- ❌ NO hardcoded prompts in code

### 2. Workspace Isolation

- ✅ EVERY query filtered by `workspaceId`
- ✅ Multi-tenant security enforced at database level

### 3. Conversation Memory

- ✅ Last 5 messages (5-minute window)
- ✅ Passed to specialists for context-aware responses
- ✅ Enables confirmation flows ("SI" after "vuoi disattivare?")

### 4. Token Efficiency

- ✅ Router: 500 max tokens (JSON only)
- ✅ Specialists: 2048 max tokens (detailed responses)
- ✅ Validation-Only Router Pattern (skips LLM when sub-agent response is valid)

### 5. Function Calling Patterns

**Router Functions** = **DELEGATION** (pass to specialist)

```typescript
// Router NEVER executes business logic
// Only routes to appropriate specialist

productSearchAgent({ query: "..." })
↓
Returns: { delegateTo: "PRODUCT_SEARCH", query: "..." }
```

**Specialist Functions** = **CALLING FUNCTIONS** (execute actions)

```typescript
// Specialist executes domain logic

handlePushNotifications({ value: false })
↓
Executes: ManageNotifications domain function
↓
Updates: Database (push_notifications_consent = false)
```

---

## 🎯 Example Flows

### Flow 1: Product Search

```
User: "cerco pasta bio"
→ Router: productSearchAgent("cerco pasta bio")
→ ProductSearch: Uses {{PRODUCTS}} variable from prompt
→ Response: "Ecco 3 prodotti bio: Pasta Fusilli Bio..."
```

### Flow 2: Add to Cart (Multi-Step)

```
User: "aggiungi al carrello"
→ Router: cartManagementAgent("aggiungi al carrello")
→ Cart: "Quale prodotto vuoi aggiungere?"

User: "pasta fusilli"
→ Router: (sees activeAgent=CART) → cartManagementAgent("pasta fusilli")
→ Cart: "Quanti kg?"

User: "2"
→ Router: (sees activeAgent=CART) → cartManagementAgent("2")
→ Cart: [CALL addToCart(productId="...", quantity=2)]
→ Response: "✅ Aggiunto 2 kg Pasta Fusilli"
```

### Flow 3: Notification Disable (Confirmation Flow)

```
User: "non voglio più ricevere offerte"
→ Router: profileManagementAgent("disattiva notifiche")
→ Profile: "Vuoi disattivare? Rispondi SI" (NO function call yet)

User: "SI"
→ Router: (context-aware) → profileManagementAgent("SI")
→ Profile: (sees history) → [CALL handlePushNotifications(false)]
→ Response: "✅ Notifiche disattivate"
```

---

## 📊 Token Usage Example

**Request**: "non voglio più ricevere offerte" + "SI" confirmation

| Step                 | Agent           | Tokens     | Cost (€0.15/1M) |
| -------------------- | --------------- | ---------- | --------------- |
| 1. Router (intent)   | Router          | 2,300      | €0.00035        |
| 2. Profile (ask)     | Profile         | 2,800      | €0.00042        |
| 3. Safety (validate) | Safety          | 3,200      | €0.00048        |
| 4. Router (confirm)  | Router          | 2,300      | €0.00035        |
| 5. Profile (execute) | Profile         | 2,900      | €0.00044        |
| 6. Safety (final)    | Safety          | 3,200      | €0.00048        |
| **TOTAL**            | **6 LLM calls** | **16,700** | **€0.00252**    |

**Average**: ~8,350 tokens per complete confirmation flow

---

## 🚨 Critical Rules

### Rule 1: Router = Pure Orchestration

- ✅ Route to specialists
- ✅ Handle FAQ
- ❌ NEVER answer product questions directly
- ❌ NEVER execute business logic

### Rule 2: Specialists = Domain Experts

- ✅ Own LLM instance
- ✅ Own system prompt
- ✅ Own calling functions
- ❌ NEVER handle other domains

### Rule 3: Always Pass Context

- ✅ Conversation history to specialists
- ✅ Customer data (name, discount, language)
- ✅ Active agent state (for multi-step flows)

### Rule 4: Confirmation Flows

- ✅ ALWAYS ask confirmation BEFORE destructive actions
- ✅ Use conversation history to detect confirmations
- ✅ Example: "disattiva notifiche" → ask "SI?" → then execute

---

## 🔧 Debugging Tips

### View Message Flow Timeline

Frontend: Click debug icon → See all LLM calls with inputs/outputs

### Check Logs

```bash
# Backend logs
tail -f backend/logs/combined.log

# Prompt debugging (if DEBUG_MODE=true)
ls backend/logs/prompt-debug-*.txt
```

### Verify Database State

```sql
-- Check agent prompts
SELECT name, type, isActive FROM agentConfig WHERE workspaceId = '...';

-- Check conversation history
SELECT role, content, createdAt FROM messages
WHERE conversationId = '...'
ORDER BY createdAt DESC LIMIT 10;

-- Check notification preference
SELECT name, push_notifications_consent, push_notifications_consent_at
FROM customers WHERE id = '...';
```

---

## 📝 Summary

**Architecture**: Router → Specialists → Safety → Customer

**Key Benefits**:

- ✅ Separation of concerns (each agent = one domain)
- ✅ Scalable (add new specialists without touching Router)
- ✅ Testable (each agent can be tested independently)
- ✅ Cost-effective (only relevant agents called)
- ✅ Context-aware (conversation memory enables multi-step flows)

**Files to Remember**:

- Router logic: `backend/src/services/llm-router.service.ts`
- Specialist agents: `backend/src/application/agents/*AgentLLM.ts`
- Prompts: `docs/prompts/*.md`
- Functions: `backend/src/config/agent-functions.ts`
- Domain functions: `backend/src/domain/calling-functions/*.ts`
