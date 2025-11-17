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
  → Filters products by bio/halal/vegan/vegetarian
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
