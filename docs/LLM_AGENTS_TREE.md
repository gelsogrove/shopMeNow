# LLM Agents & Functions Tree

## 🌳 Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SHOPME MULTI-AGENT SYSTEM                    │
│                   (Router + 5 Specialists + Safety)              │
└─────────────────────────────────────────────────────────────────┘

📌 ROOT: WhatsApp Customer Message
    │
    ↓

🤖 [LLM #1] ROUTER AGENT (Orchestrator)
│   Model: openai/gpt-4o-mini
│   Temp: 0.2 (deterministic routing)
│   Max Tokens: 500 (JSON only)
│   Prompt: docs/prompts/router-agent-CLEAN.md
│   File: backend/src/services/llm-router.service.ts
│
│   Variables:
│   ├─ {{FAQ}} - Active FAQ list
│   ├─ {{nome}} - Customer name
│   ├─ {{email}} - Customer email
│   ├─ {{lingua}} - Customer language
│   ├─ {{agentName}} - Assigned sales agent
│   └─ {{agentPhone}} - Sales agent contact
│
│   Available Functions (DELEGATION ONLY):
│   ├─ 📦 productSearchAgent(query)
│   │   └─→ Delegates to: PRODUCT_SEARCH Agent
│   │
│   ├─ 🛒 cartManagementAgent(query)
│   │   └─→ Delegates to: CART_MANAGEMENT Agent
│   │
│   ├─ 📋 orderTrackingAgent(query)
│   │   └─→ Delegates to: ORDER_TRACKING Agent
│   │
│   ├─ 👤 profileManagementAgent(query)
│   │   └─→ Delegates to: PROFILE_MANAGEMENT Agent
│   │
│   ├─ 🆘 customerSupportAgent(query)
│   │   └─→ Delegates to: CUSTOMER_SUPPORT Agent
│   │
│   └─ 🔄 RESET_ACTIVE_AGENT(reason)
│       └─→ Clears conversation context (topic change)
│
├──────────────────────────────────────────────────────────────────
│
├─→ 🤖 [LLM #2] PRODUCT & SERVICES SEARCH AGENT
│   Model: openai/gpt-4o-mini
│   Temp: 0.3 (creative product matching)
│   Max Tokens: 2048
│   Prompt: docs/prompts/product-services-search-agent-MINIMAL.md
│   File: backend/src/application/agents/ProductSearchAgentLLM.ts
│
│   Variables:
│   ├─ {{PRODUCTS}} - Complete product catalog (50k+ chars)
│   ├─ {{CATEGORIES}} - Product categories
│   ├─ {{OFFERS}} - Active promotions
│   ├─ {{SERVICES}} - Available services
│   ├─ {{nameUser}} - Customer name
│   ├─ {{discountUser}} - Customer's personal discount %
│   ├─ {{languageUser}} - Customer's language
│   └─ {{companyName}} - Workspace company name
│
│   Available Functions (CALLING FUNCTIONS):
│   ├─ 🔍 searchProductByCertifications(certifications, category?, minPrice?, maxPrice?)
│   │   └─→ Filter products by bio/halal/vegan/vegetarian
│   │
│   ├─ 📊 searchProductForStatistics(query)
│   │   └─→ Save search query for analytics (internal only)
│   │
│   └─ 🛒 DELEGATE_TO_CART (special pattern)
│       └─→ When customer confirms "aggiungi", delegates to CartManagement
│
├──────────────────────────────────────────────────────────────────
│
├─→ 🤖 [LLM #3] CART MANAGEMENT AGENT
│   Model: openai/gpt-4o-mini
│   Temp: 0.3
│   Max Tokens: 2048
│   Prompt: docs/prompts/cart-management-agent.md
│   File: backend/src/application/agents/CartManagementAgentLLM.ts
│
│   Variables:
│   ├─ {{PRODUCTS}} - Product catalog for cart operations
│   ├─ {{nameUser}} - Customer name
│   ├─ {{discountUser}} - Personal discount %
│   ├─ {{languageUser}} - Customer language
│   └─ {{selectedProductCode}} - Product from previous search (Feature 123)
│
│   Available Functions (CALLING FUNCTIONS):
│   ├─ ➕ addToCart(productId, quantity, notes?)
│   │   └─→ Add product to customer's cart
│   │
│   ├─ ➖ removeFromCart(productId)
│   │   └─→ Remove product from cart
│   │
│   ├─ 🗑️ clearCart()
│   │   └─→ Empty entire cart
│   │
│   ├─ 👀 viewCart()
│   │   └─→ Show current cart with totals
│   │
│   ├─ 💳 checkout()
│   │   └─→ Convert cart to order
│   │
│   ├─ 🔗 getCartLink()
│   │   └─→ Generate secure cart URL (JWT token)
│   │
│   └─ 🔄 repeatOrder(orderCode)
│       └─→ Clone previous order to cart
│
├──────────────────────────────────────────────────────────────────
│
├─→ 🤖 [LLM #4] ORDER TRACKING AGENT
│   Model: openai/gpt-4o-mini
│   Temp: 0.3
│   Max Tokens: 2048
│   Prompt: docs/prompts/order-tracking-agent.md
│   File: backend/src/application/agents/OrderTrackingAgentLLM.ts
│
│   Variables:
│   ├─ {{nameUser}} - Customer name
│   ├─ {{lastordercode}} - Most recent order code
│   ├─ {{languageUser}} - Customer language
│   └─ {{companyName}} - Workspace name
│
│   Available Functions (CALLING FUNCTIONS):
│   ├─ 📜 getOrdersList()
│   │   └─→ List all customer orders (last 10)
│   │
│   ├─ 🔍 getOrderDetails(orderCode)
│   │   └─→ Full order info with items and status
│   │
│   ├─ 🔗 getOrdersListLink(orderCode?)
│   │   └─→ Generate secure orders URL (JWT token)
│   │
│   └─ 🔄 repeatOrder(orderCode)
│       └─→ Re-order same items (delegates to CartManagement)
│
├──────────────────────────────────────────────────────────────────
│
├─→ 🤖 [LLM #5] PROFILE MANAGEMENT AGENT
│   Model: openai/gpt-4o-mini
│   Temp: 0.3
│   Max Tokens: 2048
│   Prompt: docs/prompts/profile-management-agent.md
│   File: backend/src/application/agents/ProfileManagementAgentLLM.ts
│
│   Variables:
│   ├─ {{nameUser}} - Customer name
│   ├─ {{email}} - Customer email
│   ├─ {{telefono}} - Customer phone (WhatsApp)
│   ├─ {{languageUser}} - Preferred language
│   ├─ {{pushNotificationsConsent}} - Push enabled? (true/false)
│   └─ {{pushNotificationsConsentAt}} - Last preference change date
│
│   Available Functions (CALLING FUNCTIONS):
│   ├─ 🔔 handlePushNotifications(value: boolean)
│   │   └─→ Enable/disable promotional notifications
│   │       └─→ Maps to: ManageNotifications domain function
│   │           └─→ Updates: customers.push_notifications_consent
│   │
│   └─ 🔗 getProfileLink()
│       └─→ Generate secure profile URL (JWT token)
│       └─→ [FUTURE] updateProfile(field, value)
│
├──────────────────────────────────────────────────────────────────
│
├─→ 🤖 [LLM #6] CUSTOMER SUPPORT AGENT
│   Model: openai/gpt-4o-mini
│   Temp: 0.3
│   Max Tokens: 2048
│   Prompt: docs/prompts/customer-support-agent.md
│   File: backend/src/application/agents/CustomerSupportAgentLLM.ts
│
│   Variables:
│   ├─ {{nameUser}} - Customer name
│   ├─ {{agentName}} - Assigned sales agent
│   ├─ {{agentPhone}} - Sales agent phone
│   ├─ {{agentEmail}} - Sales agent email
│   └─ {{languageUser}} - Customer language
│
│   Available Functions (CALLING FUNCTIONS):
│   ├─ 📞 contactHumanOperator(reason)
│   │   └─→ Escalate to human support
│   │
│   ├─ 💬 createSupportTicket(subject, description)
│   │   └─→ Create support case in CRM
│   │
│   └─ 📧 sendEmailToSupport(message)
│       └─→ Email notification to support team
│
├──────────────────────────────────────────────────────────────────
│
└─→ 🤖 [LLM #7] SAFETY & TRANSLATION AGENT (Final Layer)
    Model: openai/gpt-4o-mini
    Temp: 0.2 (conservative)
    Max Tokens: 2048
    Prompt: docs/prompts/safety-translation-agent.md
    File: backend/src/application/agents/SafetyTranslationAgent.ts

    Input:
    └─→ Specialist agent response (any language)

    Tasks:
    ├─ ✅ Safety Validation (block harmful/inappropriate content)
    ├─ ✅ Translation (convert to customer's language)
    ├─ ✅ Variable Replacement ({{nameUser}}, {{TOKEN_DURATION}})
    └─ ✅ Final Cleanup (punctuation on URLs)

    Output:
    └─→ Customer-facing message (validated + translated)
```

---

## 📊 Function Types Summary

### 🔀 Router Functions (DELEGATION)

These functions **DO NOT execute actions** - they only return `{ delegateTo: "AGENT_TYPE" }`

```typescript
productSearchAgent(query)          → { delegateTo: "PRODUCT_SEARCH" }
cartManagementAgent(query)         → { delegateTo: "CART_MANAGEMENT" }
orderTrackingAgent(query)          → { delegateTo: "ORDER_TRACKING" }
profileManagementAgent(query)      → { delegateTo: "PROFILE_MANAGEMENT" }
customerSupportAgent(query)        → { delegateTo: "CUSTOMER_SUPPORT" }
RESET_ACTIVE_AGENT(reason)         → Clears activeAgent state
```

**Config**: `backend/src/config/agent-functions.ts` (lines 19-104)

---

### ⚡ Specialist Functions (CALLING FUNCTIONS)

These functions **EXECUTE ACTIONS** - they interact with database/services

#### 📦 Product & Services Agent Functions

```typescript
searchProductByCertifications(certifications, category?, minPrice?, maxPrice?)
  → Filters products by bio/halal/vegan/vegetarian certifications
  → Returns: Filtered product list with prices

searchProductForStatistics(query)
  → Saves search query to analytics (automatic, internal only)
  → Returns: { success: true }
```

**Config**: `backend/src/config/agent-functions.ts` (lines 127-188)

---

#### 🛒 Cart Management Agent Functions

```typescript
addToCart(productId, quantity, notes?)
  → Adds product to cart (creates cart if missing)
  → Returns: Cart summary with totals
  → Domain: backend/src/domain/calling-functions/AddToCart.ts

removeFromCart(productId)
  → Removes product from cart
  → Returns: Updated cart summary
  → Domain: backend/src/domain/calling-functions/RemoveFromCart.ts

clearCart()
  → Empties entire cart
  → Returns: Confirmation message
  → Domain: backend/src/domain/calling-functions/ClearCart.ts

viewCart()
  → Shows current cart with items and totals
  → Returns: Cart details with discount applied
  → Domain: backend/src/domain/calling-functions/ViewCart.ts

checkout()
  → Converts cart to order (CONFIRMED status)
  → Returns: Order code + order details link
  → Domain: backend/src/domain/calling-functions/Checkout.ts

getCartLink()
  → Generates secure cart URL with JWT token
  → Returns: https://.../ s/CART_TOKEN (1h expiry)
  → Service: backend/src/application/services/link-generator.service.ts

repeatOrder(orderCode)
  → Clones previous order items to cart
  → Returns: Cart summary with copied items
  → Domain: backend/src/domain/calling-functions/RepeatOrder.ts
```

**Config**: `backend/src/config/agent-functions.ts` (lines 190-325)

---

#### 📋 Order Tracking Agent Functions

```typescript
getOrdersList()
  → Lists all customer orders (last 10)
  → Returns: Order list with codes, dates, totals
  → Domain: backend/src/domain/calling-functions/GetOrdersList.ts

getOrderDetails(orderCode)
  → Full order info with items, status, tracking
  → Returns: Order summary with line items
  → Domain: backend/src/domain/calling-functions/GetOrderDetails.ts

getOrdersListLink(orderCode?)
  → Generates secure orders URL with JWT token
  → Returns: https://.../s/ORDERS_TOKEN (1h expiry)
  → Service: backend/src/application/services/link-generator.service.ts

repeatOrder(orderCode)
  → Re-order same items (clones to cart)
  → Returns: Cart summary
  → Domain: backend/src/domain/calling-functions/RepeatOrder.ts
```

**Config**: `backend/src/config/agent-functions.ts` (lines 327-423)

---

#### 👤 Profile Management Agent Functions

```typescript
handlePushNotifications(value: boolean)
  → Enable/disable promotional push notifications
  → Updates: customers.push_notifications_consent = value
  → Updates: customers.push_notifications_consent_at = NOW()
  → Returns: { success: true, currentStatus: value }
  → Domain: backend/src/domain/calling-functions/ManageNotifications.ts

getProfileLink()
  → Generates secure profile URL with JWT token
  → Returns: https://.../s/PROFILE_TOKEN (1h expiry)
  → Service: backend/src/application/services/link-generator.service.ts

[FUTURE] updateProfile(field, value)
  → Update customer profile fields (name, email, phone)
  → Not implemented yet
```

**Config**: `backend/src/config/agent-functions.ts` (lines 105-125)

---

#### 🆘 Customer Support Agent Functions

```typescript
contactHumanOperator(reason)
  → Escalates to human support
  → Creates support ticket with priority flag
  → Returns: Confirmation + estimated response time
  → Domain: backend/src/domain/calling-functions/ContactHumanOperator.ts

createSupportTicket(subject, description)
  → Creates support case in CRM
  → Returns: Ticket ID + tracking link
  → Domain: backend/src/domain/calling-functions/CreateSupportTicket.ts

sendEmailToSupport(message)
  → Sends email notification to support team
  → Returns: Confirmation message
  → Domain: backend/src/domain/calling-functions/SendEmailToSupport.ts
```

**Config**: `backend/src/config/agent-functions.ts` (lines 425-512)

---

## 🔗 Domain Functions Location

All **calling functions** are implemented in:

```
backend/src/domain/calling-functions/
├── AddToCart.ts               (Cart: add product)
├── RemoveFromCart.ts          (Cart: remove product)
├── ClearCart.ts               (Cart: empty cart)
├── ViewCart.ts                (Cart: show contents)
├── Checkout.ts                (Cart → Order conversion)
├── RepeatOrder.ts             (Orders: clone to cart)
├── GetOrdersList.ts           (Orders: list all)
├── GetOrderDetails.ts         (Orders: single order info)
├── ManageNotifications.ts     (Profile: push consent)
├── ContactHumanOperator.ts    (Support: escalation)
├── CreateSupportTicket.ts     (Support: ticket creation)
└── SendEmailToSupport.ts      (Support: email notification)
```

---

## 📋 Function Executor Routing

**File**: `backend/src/services/function-executor.service.ts`

Maps function names to execution logic:

```typescript
switch (functionName) {
  // DELEGATION FUNCTIONS (Router)
  case "productSearchAgent":
    return { delegateTo: "PRODUCT_SEARCH", query, ... }
  case "cartManagementAgent":
    return { delegateTo: "CART_MANAGEMENT", query, ... }
  case "orderTrackingAgent":
    return { delegateTo: "ORDER_TRACKING", query, ... }
  case "profileManagementAgent":
    return { delegateTo: "PROFILE_MANAGEMENT", query, ... }
  case "customerSupportAgent":
    return { delegateTo: "CUSTOMER_SUPPORT", query, ... }

  // CALLING FUNCTIONS (Specialists execute directly in their LLM)
  // Product Search Agent
  case "searchProductByCertifications":
    return await callingFunctionsService.searchProductByCertifications(...)
  case "searchProductForStatistics":
    return await callingFunctionsService.searchProductForStatistics(...)

  // Cart Management Agent (executes in CartManagementAgentLLM)
  // Order Tracking Agent (executes in OrderTrackingAgentLLM)
  // Profile Management Agent (executes in ProfileManagementAgentLLM)
  // Customer Support Agent (executes in CustomerSupportAgentLLM)
}
```

---

## 🎯 Execution Flow Examples

### Example 1: Product Search (No Functions)

```
Customer: "cerco pasta bio"
  ↓
Router LLM → productSearchAgent("cerco pasta bio")
  ↓
ProductSearch LLM → Uses {{PRODUCTS}} variable (NO function call)
  ↓
Response: "Ecco 3 prodotti bio: Pasta Fusilli Bio €3.20..."
```

### Example 2: Add to Cart (Calling Function)

```
Customer: "aggiungi 2kg pasta fusilli"
  ↓
Router LLM → cartManagementAgent("aggiungi 2kg pasta fusilli")
  ↓
CartManagement LLM → Calls addToCart(productId="...", quantity=2)
  ↓
AddToCart domain function → Updates database
  ↓
Response: "✅ Aggiunto 2 kg Pasta Fusilli al carrello (€6.40)"
```

### Example 3: Disable Notifications (Confirmation + Function)

```
Customer: "non voglio più ricevere offerte"
  ↓
Router LLM → profileManagementAgent("disattiva notifiche")
  ↓
ProfileManagement LLM (iteration 1) → NO function call
  ↓
Response: "Vuoi disattivare le notifiche? Rispondi SI"

Customer: "SI"
  ↓
Router LLM → profileManagementAgent("SI") + conversation history
  ↓
ProfileManagement LLM (iteration 2) → Calls handlePushNotifications(false)
  ↓
ManageNotifications domain function → UPDATE customers SET push_notifications_consent = false
  ↓
Response: "✅ Notifiche disattivate. Non riceverai più messaggi promozionali."
```

---

## 📊 LLM Call Statistics

### Typical Request Breakdown

| Scenario                            | Router Calls | Specialist Calls | Safety Calls | Total LLM | Total Tokens |
| ----------------------------------- | ------------ | ---------------- | ------------ | --------- | ------------ |
| Simple FAQ                          | 1            | 0                | 0            | 1         | ~1,500       |
| Product search                      | 1            | 1                | 1            | 3         | ~8,000       |
| Add to cart                         | 1            | 1                | 1            | 3         | ~8,500       |
| Notification disable (with confirm) | 2            | 2                | 2            | 6         | ~16,700      |
| Multi-step cart (3 steps)           | 3            | 3                | 3            | 9         | ~25,000      |

**Average Cost** (GPT-4o-mini @ €0.15/1M tokens):

- Simple request: €0.0012
- Confirmation flow: €0.0025
- Multi-step flow: €0.0038

---

## 🚨 Critical Architecture Notes

### 1. Router NEVER Executes Business Logic

- ✅ Routes to specialists via function calls
- ✅ Handles FAQ directly (no delegation needed)
- ❌ NEVER adds to cart, searches products, or manages profile

### 2. Specialists Have Own LLM + Function Calling

- ✅ Each specialist = independent LLM instance
- ✅ Own system prompt from database
- ✅ Own calling functions (execute domain logic)
- ✅ Own conversation memory (via conversationHistory param)

### 3. Function Calling Patterns

**Router Functions** → Return `{ delegateTo: "AGENT" }` (no execution)
**Specialist Functions** → Execute in specialist's LLM loop (database updates)

### 4. Conversation Memory

- ✅ Router passes last 5 messages (5-min window) to specialists
- ✅ Enables multi-step flows (cart guided search, confirmations)
- ✅ Each specialist sees relevant context from previous interactions

### 5. Safety Layer (Always Final)

- ✅ EVERY response goes through Safety & Translation
- ✅ Validates + translates + replaces variables
- ✅ Applied AFTER specialist completes work

---

## 📁 Key Files Reference

| Component               | File                                                          | Lines     |
| ----------------------- | ------------------------------------------------------------- | --------- |
| Router Agent            | `backend/src/services/llm-router.service.ts`                  | 2640      |
| ProductSearch Agent     | `backend/src/application/agents/ProductSearchAgentLLM.ts`     | 1053      |
| CartManagement Agent    | `backend/src/application/agents/CartManagementAgentLLM.ts`    | ~900      |
| OrderTracking Agent     | `backend/src/application/agents/OrderTrackingAgentLLM.ts`     | ~800      |
| ProfileManagement Agent | `backend/src/application/agents/ProfileManagementAgentLLM.ts` | 341       |
| CustomerSupport Agent   | `backend/src/application/agents/CustomerSupportAgentLLM.ts`   | ~700      |
| Safety Agent            | `backend/src/application/agents/SafetyTranslationAgent.ts`    | ~400      |
| Function Definitions    | `backend/src/config/agent-functions.ts`                       | 582       |
| Function Executor       | `backend/src/services/function-executor.service.ts`           | 1133      |
| Domain Functions        | `backend/src/domain/calling-functions/*.ts`                   | ~200 each |

---

**Total System**: 7 LLM Agents + 25+ Calling Functions + 5 Delegation Functions
