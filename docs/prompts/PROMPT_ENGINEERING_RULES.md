# ShopME LLM Prompt Engineering Rules

**Version**: 3.0.0  
**Date**: 2025-11-17  
**Authority**: Andrea's Core Architectural Principles
**Updates**: Added Rules 16 (Pricing Display), 17 (Promotional Messaging), 18 (Numbered Lists)

---

## 🎯 PURPOSE

This document defines **NON-NEGOTIABLE rules** for creating and maintaining LLM agent prompts in ShopME. These rules ensure:

1. ✅ **Fluid conversation flow** - Natural customer experience
2. ✅ **Accurate responses** - Zero hallucinations, zero fake data
3. ✅ **Clear agent responsibilities** - No overlap, no confusion
4. ✅ **Debuggable architecture** - Message Flow Timeline reflects reality

---

## 📋 TABLE OF CONTENTS

1. [Safety & Translation Agent](#1-safety--translation-agent)
2. [Router Context Interpretation](#2-router-context-interpretation)
3. [Translation Happens ONLY at Final Step](#3-translation-happens-only-at-final-step)
4. [Router Responsibilities](#4-router-responsibilities)
5. [Keep Content On-Topic](#5-keep-content-on-topic)
6. [Tone & Formatting in Specialist Agents](#6-tone--formatting-in-specialist-agents)
7. [Cross-Agent Context Awareness](#7-cross-agent-context-awareness)
8. [Message Flow Timeline Synchronization](#8-message-flow-timeline-synchronization)
9. [Function Calling - Zero Hallucinations](#9-function-calling---zero-hallucinations)
10. [Product Data - Zero Hallucinations](#10-product-data---zero-hallucinations)
11. [Product Search Grouping Strategy](#11-product-search-grouping-strategy)
12. [Real-World Examples in Prompts](#12-real-world-examples-in-prompts)
13. [Agent Delegation Architecture](#13-agent-delegation-architecture)
14. [TONE & STYLE Standardization](#14-tone--style-standardization)
15. [Zero Hallucinations - Never Invent](#15-zero-hallucinations---never-invent)
16. [Pricing Display Strategy](#16-pricing-display-strategy)
17. [Promotional Messaging](#17-promotional-messaging)
18. [Numbered List Pattern](#18-numbered-list-pattern)

---

## 1. Safety & Translation Agent

### ✅ RULE

**Safety & Translation Agent is a REAL LLM** (not a simple function).

### 📋 Details

- **Model**: `openai/gpt-4o-mini`
- **Temperature**: `0.2` (deterministic)
- **Position**: **ULTIMO LLM della pipeline** (final layer before customer)
- **File**: `backend/src/application/agents/SafetyTranslationAgent.ts`
- **Prompt**: `docs/prompts/safety-translation-agent.md`

### 🎯 Responsibilities

1. ✅ **Safety validation** - Block harmful/inappropriate content
2. ✅ **Translation** - Convert specialist response to customer's language
3. ✅ **Variable replacement** - Final cleanup (`{{TOKEN_DURATION}}`, `{{nome}}`, etc.)

### 📊 Flow Position

```
Router → Specialist Agent → Safety Agent → Customer
(LLM #1) → (LLM #2-6)     → (LLM #7)   → WhatsApp
```

### ⚠️ Common Mistakes

❌ **WRONG**: "Safety is just a string replacement function"  
✅ **CORRECT**: "Safety is an LLM that validates, translates, and cleans responses"

---

## 2. Router Context Interpretation

### ✅ RULE

**Router MUST contextualize short responses** before delegating to specialist agents.

### 📋 Details

When customer sends short responses like:

- ✅ "SI"
- ✅ "NO"
- ✅ "OK"
- ✅ "1", "2", "3"

**Router CANNOT just pass "SI" to specialist agent** - specialist won't understand context!

### 🎯 Implementation Pattern

Router reads **last 3 messages from conversation history**, then builds explicit message with keyword **"CONFERMA"**.

#### Example 1: Cart Confirmation

```
History:
[assistant]: "Vuoi aggiungere Parmigiano Reggiano DOP 1kg al carrello?"
[user]: "SI"

❌ Router WRONG: cartManagementAgent({ query: "SI" })
→ CartAgent doesn't know what to confirm!

❌ Router WEAK: cartManagementAgent({ query: "aggiungi parmigiano al carrello" })
→ CartAgent may ask confirmation again (doesn't know user already said SI)

✅ Router CORRECT: cartManagementAgent({
  query: "L'utente CONFERMA aggiunta Parmigiano Reggiano DOP 1kg (PARM-001) al carrello"
})
→ CartAgent: [Calls addToCart()] ← ESEGUE subito senza chiedere di nuovo!
```

**🚨 CRITICAL KEYWORD**: Use **"CONFERMA"** when user replies "SI"/"OK"/"YES" to confirmation question!

#### Example 2: Notification Confirmation (CRITICAL!)

```
History:
[assistant]: "Vuoi disattivare le notifiche push? Rispondi SI"
[user]: "SI"

❌ Router WRONG: profileManagementAgent({ query: "SI" })
→ ProfileAgent loops: "Confermi di voler disattivare?" (chiede ancora!)

❌ Router WEAK: profileManagementAgent({ query: "disattiva notifiche offerte" })
→ ProfileAgent loops: "Sei sicuro? Rispondi SI" (non capisce che è CONFERMA!)

✅ Router CORRECT: profileManagementAgent({
  query: "L'utente CONFERMA di disattivare le notifiche push promozionali"
})
→ ProfileAgent: [Calls handlePushNotifications(false)] ← ESEGUE subito!
```

**🚨 CRITICAL**: Usa parola **"CONFERMA"** quando user risponde "SI" a domanda di conferma!

**Why it matters**:

- ❌ Without "CONFERMA": ProfileAgent thinks it's initial request → asks again
- ✅ With "CONFERMA": ProfileAgent knows user already confirmed → executes function

#### Example 3: Product Selection from List

```
History:
[assistant]: "Quale formaggio vuoi? 1) Parmigiano DOP 2) Grana Padano 3) Pecorino"
[user]: "1"

❌ Router WRONG: productSearchAgent({ query: "1" })
✅ Router CORRECT: productSearchAgent({
  query: "L'utente seleziona numero 1 dalla lista: Parmigiano Reggiano DOP 1kg (PARM-001)"
})
→ Product Agent shows full details → asks "Vuoi aggiungerla?"
```

#### Example 4: Product Confirmation → CART DELEGATION (🚨 CRITICAL!)

```
History:
[Product Agent]: "Ecco Mozzarella di Bufala DOP 250g - €8.50 (MOZZ-001). Vuoi aggiungerla al carrello?"
[user]: "SI"

❌ Router WRONG: productSearchAgent({ query: "SI" })
→ Product Agent confused: "SI per cosa?"

❌ Router WRONG: productSearchAgent({ query: "L'utente conferma aggiunta mozzarella" })
→ Product Agent loops: "Vuoi aggiungerla?" (asks again!)

❌ Router WEAK: cartManagementAgent({ query: "aggiungi mozzarella" })
→ Cart Agent: "Quale mozzarella?" (doesn't know which product!)

✅ Router CORRECT: cartManagementAgent({
  query: "L'utente CONFERMA che vuole mettere nel carrello il prodotto Mozzarella di Bufala Campana DOP 250g (MOZZ-001)"
})
→ Cart Agent: [Sees "CONFERMA" + product code]
→ Cart Agent: [Calls addToCart(productId="MOZZ-001", quantity=1)]
→ Success! ✅
```

**🚨 CRITICAL PATTERN**: When Product Agent asks "Vuoi aggiungerla?" and user says "SI":

- ✅ Router delegates to **CART_MANAGEMENT** (NOT productSearch!)
- ✅ Router includes "CONFERMA" keyword
- ✅ Router includes full product name + code (MOZZ-001)
- ✅ Cart Agent executes addToCart immediately

### 📊 Router JSON Response Examples

#### Response 1: Product Confirmation → Cart Delegation

```json
{
  "routerDecision": "CART_MANAGEMENT",
  "contextualizedMessage": "L'utente CONFERMA che vuole mettere nel carrello il prodotto Mozzarella di Bufala DOP 250g (MOZZ-001)",
  "confidence": 0.95,
  "reasoning": "User confirmed product addition - delegating to Cart (not Product!)"
}
```

#### Response 2: Notification Confirmation → Profile Management

```json
{
  "routerDecision": "PROFILE_MANAGEMENT",
  "contextualizedMessage": "L'utente CONFERMA di disattivare le notifiche push promozionali",
  "confidence": 0.95,
  "reasoning": "User confirmed notification disable request"
}
```

#### Response 3: Product Selection from List → Product Agent

```json
{
  "routerDecision": "PRODUCT_SEARCH",
  "contextualizedMessage": "L'utente seleziona numero 1 dalla lista: Parmigiano Reggiano DOP (PARM-001)",
  "confidence": 0.9,
  "reasoning": "User selected item from numbered list - staying with Product Agent"
}
```

### ⚠️ Why This Matters

**Without contextualization**:

- ❌ Specialist agent receives "SI" with no history
- ❌ Agent loops: "SI per cosa?" → customer frustrated
- ❌ Conversation breaks down

**With weak contextualization** (missing "CONFERMA"):

- ❌ Agent receives "disattiva notifiche" again
- ❌ Agent thinks it's NEW request → asks confirmation AGAIN
- ❌ Infinite loop: User says SI → Agent asks SI → User says SI → ...

**With STRONG contextualization** (includes "CONFERMA"):

- ✅ Specialist agent receives complete context
- ✅ Agent knows user ALREADY confirmed
- ✅ Agent executes function immediately (no re-asking)
- ✅ Fluid conversation flow

### 🔑 Magic Keyword: "CONFERMA"

When Router detects user replying to confirmation question:

```
Pattern to detect:
- Last assistant message contains: "Vuoi...?", "Sei sicuro?", "Confermi?", "Rispondi SI"
- User message is: "SI", "OK", "YES", "SÌ", "CONFERMA"

Router MUST include word "CONFERMA" in contextualized message!

✅ "L'utente CONFERMA che vuole mettere nel carrello il prodotto..."
✅ "L'utente CONFERMA di disattivare le notifiche..."
✅ "L'utente CONFERMA checkout del carrello..."
✅ "L'utente CONFERMA ripetizione ordine ORD-001..."
```

**Why "CONFERMA" is critical**:

- Specialist agents are trained to execute immediately when they see "CONFERMA"
- Without it, they treat message as new request → ask confirmation again
- With it, they skip confirmation step → call function directly

### 🔀 Agent Switching on Confirmation (CRITICAL!)

**When Product Agent asks confirmation and user says "SI"**:

```
❌ WRONG: Router delegates to productSearchAgent
→ Product Agent confused: "Cosa devo fare con SI?"

✅ CORRECT: Router delegates to cartManagementAgent
→ Cart Agent executes addToCart with product code from history
```

**Pattern**:

```
IF (last_agent == "Product Search" AND last_message_contains("Vuoi aggiungerla?") AND user_says("SI"))
THEN:
  delegate_to = "CART_MANAGEMENT"  ← Switch agent!
  query = "L'utente CONFERMA che vuole mettere nel carrello il prodotto [NAME] ([CODE])"
  extract_product_code_from_history()  ← Include code!
```

**Why switching is critical**:

- Product Agent's job: Search and show products
- Cart Agent's job: Execute cart operations (addToCart)
- Confirmation of "add to cart" = Cart Agent responsibility
- Product Agent cannot call addToCart → must delegate to Cart

### � Complete Flow: "avete mozzarella" → "SI"

```
Request 1: User asks for product
──────────────────────────────────
User: "avete la mozzarella?"
↓
Router: productSearchAgent({ query: "avete la mozzarella?" })
↓
Product Agent: [Searches {{PRODUCTS}}]
              [Finds: Mozzarella di Bufala DOP 250g (MOZZ-001) €8.50]
              [Shows full details]
              Response: "Sì! Ecco Mozzarella di Bufala DOP 250g - €8.50 (MOZZ-001). Vuoi aggiungerla al carrello?"
↓
Timeline Step 1: Router → Product → Safety

Request 2: User confirms
──────────────────────────────────
User: "SI"
↓
Router: [Reads last 3 messages]
        [Detects: Product asked "Vuoi aggiungerla?"]
        [Extracts: Product code MOZZ-001]
        [Switches agent: Product → Cart]

        cartManagementAgent({
          query: "L'utente CONFERMA che vuole mettere nel carrello il prodotto Mozzarella di Bufala DOP 250g (MOZZ-001)"
        })
↓
Cart Agent: [Sees "CONFERMA"]
            [Sees product code MOZZ-001]
            [Calls addToCart(productId="MOZZ-001", quantity=1)]
            Response: "Perfetto! ✅ Ho aggiunto Mozzarella di Bufala DOP 250g al carrello (€8.50)"
↓
Timeline Step 2: Router → Cart → Safety
```

**🚨 CRITICAL**: Router MUST switch from Product to Cart when user confirms add!

### �🔗 Constitution Reference

**Principle XIV: Context Interpretation Pattern** (v2.1.0)

---

## 3. Translation Happens ONLY at Final Step

### ✅ RULE

**ALL data injected into prompts is in ITALIAN** (base language). Translation happens **ONLY** in Safety Agent.

### 📋 Details

#### Data Flow

```
Database (Italian) → Router Prompt (Italian) → Specialist Prompt (Italian) → Safety Agent → Translated Response
```

#### Examples

**Products** (`{{PRODUCTS}}` variable):

```
✅ CORRECT in database: "Parmigiano Reggiano DOP - 1kg - €15.50"
✅ CORRECT in prompt: "Parmigiano Reggiano DOP - 1kg - €15.50"
❌ WRONG: Pre-translate to "Parmesan Cheese DOP - 1kg - €15.50"
```

**Categories** (`{{CATEGORIES}}` variable):

```
✅ CORRECT: "Formaggi", "Salumi", "Vini"
❌ WRONG: "Cheese", "Cold Cuts", "Wines"
```

**Offers** (`{{OFFERS}}` variable):

```
✅ CORRECT: "Sconto 20% su tutti i formaggi DOP"
❌ WRONG: "20% discount on all DOP cheeses"
```

### 🎯 Why This Architecture

1. ✅ **Single source of truth** - Database is authoritative (Italian)
2. ✅ **Consistent prompts** - All agents see same language
3. ✅ **LLM translation** - Safety Agent uses GPT-4 for natural translation
4. ✅ **No translation layer bugs** - Avoids pre-translation errors

### 📊 Translation Responsibility

```
Router Agent (LLM #1)         → Works in: Italian
Product Search Agent (LLM #2) → Works in: Italian
Cart Agent (LLM #3)           → Works in: Italian
Order Agent (LLM #4)          → Works in: Italian
Profile Agent (LLM #5)        → Works in: Italian
Support Agent (LLM #6)        → Works in: Italian
Safety Agent (LLM #7)         → Input: Italian → Output: Customer language
```

### ⚠️ Common Mistakes

❌ **WRONG**: "I'll pre-translate products to Spanish in variable replacement"  
✅ **CORRECT**: "Products stay Italian, Safety Agent translates final response"

### 🔗 Constitution Reference

**Principle I: Database-First Architecture** - Base language is Italian

---

## 4. Router Responsibilities

### ✅ RULE

**Router handles ONLY routing and FAQ**. Nothing else.

### 📋 Router Capabilities

| ✅ Router DOES                            | ❌ Router does NOT        |
| ----------------------------------------- | ------------------------- |
| Match FAQ and answer directly             | Search products           |
| Classify customer intent                  | Show offers               |
| Delegate to specialist agent              | Add to cart               |
| Contextualize short responses ("SI")      | Track orders              |
| Call `RESET_ACTIVE_AGENT` on topic change | Give discount information |

### 🎯 Router Function Calls (Delegation Only)

Router has **6 delegation functions** (NOT calling functions):

1. `productSearchAgent(query)`
2. `cartManagementAgent(query)`
3. `orderTrackingAgent(query)`
4. `profileManagementAgent(query)`
5. `customerSupportAgent(query)`
6. `RESET_ACTIVE_AGENT(reason)`

**These functions DO NOT execute actions** - they return:

```json
{ "delegateTo": "PRODUCT_SEARCH", "query": "..." }
```

### 📊 Token Budget

- **Target**: 2,400 tokens (router-agent-CLEAN.md)
- **Previous**: 8,000 tokens (router-agent.md - deprecated)
- **Savings**: -70% (-5,600 tokens per routing)

### 🎯 What Router Prompt Should Contain

```markdown
✅ INCLUDE:

- {{FAQ}} variable (for FAQ matching)
- Routing decision tree (intent → function mapping)
- Context interpretation examples (SI, NO, 1, 2, 3)
- Function call syntax examples

❌ REMOVE:

- {{PRODUCTS}} variable (moved to Product Agent)
- {{OFFERS}} variable (moved to Product Agent)
- {{SERVICES}} variable (moved to Product Agent)
- Product search examples (moved to Product Agent)
- Tone guidelines (moved to specialist agents)
- Formatting rules (moved to specialist agents)
- Cart logic (moved to Cart Agent)
```

### ⚠️ Why Router Must Stay Minimal

**Bloated Router Problems**:

- ❌ 8,000 tokens = slow response time
- ❌ Mixed responsibilities = confused routing decisions
- ❌ Duplicate data = violates Principle III (Variable Uniqueness)
- ❌ High cost = $153/year wasted

**Clean Router Benefits**:

- ✅ 2,400 tokens = fast routing
- ✅ Single purpose = accurate delegation
- ✅ No duplication = lower cost
- ✅ Easy to maintain = clear architecture

### 🔗 Constitution Reference

**Principle XIII, Rule 8: Router Pure Orchestration** - 3,500 token target

---

## 5. Keep Content On-Topic

### ✅ RULE

**NEVER include off-topic content** in LLM prompts or responses.

### 📋 Examples

#### ❌ WRONG: Off-Topic Content

```markdown
# Cart Management Agent

## Your Mission

Handle cart operations like adding products, removing items, and checkout.

## Fun Facts About Carts 🛒

Did you know shopping carts were invented in 1937?
The average cart holds 15 items!
```

**Problem**: "Fun facts" section is irrelevant - wastes tokens, confuses LLM.

#### ✅ CORRECT: On-Topic Content

```markdown
# Cart Management Agent

## Your Mission

Handle cart operations: add products, remove items, checkout, generate cart links.

## Available Functions

- addToCart(productId, quantity)
- removeFromCart(productId)
- clearCart()
- checkout()
```

### 🎯 What Belongs in Each Agent

| Agent              | ✅ Relevant Topics                                     | ❌ Irrelevant Topics                      |
| ------------------ | ------------------------------------------------------ | ----------------------------------------- |
| **Router**         | Intent classification, FAQ, delegation                 | Product descriptions, prices, cart logic  |
| **Product Search** | Products, categories, offers, services, certifications | Payment methods, shipping, order tracking |
| **Cart**           | Cart operations, checkout, totals                      | Product search, order history, profile    |
| **Order Tracking** | Order status, tracking, repeat orders                  | Cart operations, product catalog, FAQ     |
| **Profile**        | Name, email, phone, notifications                      | Products, orders, cart                    |
| **Support**        | Help, escalation, tickets                              | Product search, cart, orders              |

### ⚠️ Common Mistakes

❌ **WRONG**: Adding "company history" section to Product Agent  
❌ **WRONG**: Including "how WhatsApp works" in Router  
❌ **WRONG**: Adding emoji legends unrelated to agent purpose  
✅ **CORRECT**: Only include what agent needs to execute its role

### 📊 Token Impact

**Off-topic content example**:

- Company history: ~500 tokens
- Emoji legend: ~300 tokens
- Fun facts: ~200 tokens
- **Total waste**: ~1,000 tokens per request

**Cost impact** (10k requests/month):

- Wasted tokens: 10M/month
- Wasted cost: **$1.50/month = $18/year** per off-topic section

---

## 6. Tone & Formatting in Specialist Agents

### ✅ RULE

**Tone, emoji usage, and response formatting are managed by SPECIALIST AGENTS**, not Router.

### 📋 Details

Each specialist agent defines its own:

- ✅ Conversational tone
- ✅ Emoji usage patterns
- ✅ Response structure
- ✅ Formatting rules

### 🎯 Agent-Specific Tone Guidelines

#### Product Search Agent

```markdown
## Tone & Style

- 🎯 Professional but friendly
- Use 🔍 for search, 📦 for products, 🏷️ for prices
- Group products by category/region/format
- Show max 8 items in lists
```

#### Cart Management Agent

```markdown
## Tone & Style

- 😊 Enthusiastic and helpful
- Use 🛒 for cart, ✅ for success, ❌ for errors
- Always show cart total with discount applied
- Celebrate successful adds: "Perfetto! ✅"
```

#### Order Tracking Agent

```markdown
## Tone & Style

- 📋 Clear and informative
- Use 📦 for orders, 🚚 for shipping, ✅ for delivered
- Show order code prominently
- Include tracking link when available
```

#### Profile Management Agent

```markdown
## Tone & Style

- 👤 Respectful and private
- Use 📧 for email, 📞 for phone, 🔔 for notifications
- Always ask confirmation before changes
- Explain impact: "Non riceverai più messaggi promozionali"
```

#### Support Agent

```markdown
## Tone & Style

- 🆘 Empathetic and solution-oriented
- Use 💬 for chat, 📧 for email, 📞 for phone
- Offer escalation when needed
- Provide clear next steps
```

### ⚠️ Why Router Has NO Tone Rules

**Router's job**: Route to correct agent  
**Specialist's job**: Respond with appropriate tone

**Flow**:

```
User: "voglio ordinare parmigiano"
↓
Router: [Detects product search] → productSearchAgent(...)
↓
Product Agent: "Ecco i formaggi DOP disponibili! 🧀" ← Tone here
```

### 📊 Example: Cart Confirmation

```markdown
# Cart Management Agent Tone (CORRECT)

When adding to cart successfully:
"Perfetto! ✅ Ho aggiunto 2kg Parmigiano Reggiano DOP al carrello (€31.00).

Il totale è €31.00. Vuoi procedere al checkout? 🛒"
```

**Router does NOT define this** - Cart Agent owns the tone.

---

## 7. Cross-Agent Context Awareness

### ✅ RULE

**When modifying ANY agent prompt**, you MUST understand what ALL other agents do.

### 📋 Required Knowledge

Before editing any prompt, answer these questions:

1. **What does this agent do?** (core responsibility)
2. **What functions can it call?** (calling functions)
3. **What variables does it use?** ({{PRODUCTS}}, {{nome}}, etc.)
4. **Which agents does it delegate to?** (Router only)
5. **Which agents can delegate TO it?** (usually Router)
6. **What conversation history does it receive?** (last 3-5 messages)

### 🎯 Agent Interaction Map

```
┌──────────────────────────────────────────────────────┐
│                   ROUTER AGENT                       │
│  (Receives: All requests | Delegates: Everything)    │
└─────────┬────────────────────────────────────────────┘
          │
          ├─→ PRODUCT SEARCH AGENT
          │   Functions: searchProductByCertifications
          │   Delegates to: CART (when user confirms add)
          │
          ├─→ CART MANAGEMENT AGENT
          │   Functions: addToCart, removeFromCart, clearCart, checkout
          │   Receives delegation from: PRODUCT SEARCH (on confirmation)
          │
          ├─→ ORDER TRACKING AGENT
          │   Functions: getOrdersList, getOrderDetails, repeatOrder
          │   Delegates to: CART (on repeatOrder)
          │
          ├─→ PROFILE MANAGEMENT AGENT
          │   Functions: handlePushNotifications, getProfileLink
          │   No delegation (terminal agent)
          │
          └─→ CUSTOMER SUPPORT AGENT
              Functions: contactHumanOperator, createSupportTicket
              No delegation (escalation agent)
```

### 📊 Example: Modifying Product Search Agent

**Before changing Product Agent**, verify:

```markdown
✅ 1. What Router delegates to it:

- Product questions, discount questions, offer questions

✅ 2. What variables it uses:

- {{PRODUCTS}}, {{CATEGORIES}}, {{OFFERS}}, {{SERVICES}}
- {{nameUser}}, {{discountUser}}, {{languageUser}}

✅ 3. What it can delegate to:

- CART_MANAGEMENT (when user confirms "aggiungi")

✅ 4. What functions it calls:

- searchProductByCertifications (filters by bio/halal/vegan)

✅ 5. What conversation history it receives:

- Last 3 messages (for product selection context)
```

**Impact analysis**:

- ❓ If I add {{SERVICES}} variable, does Router also have it? (Violates Principle III!)
- ❓ If I change delegation pattern, does Cart Agent still work?
- ❓ If I modify tone, does it conflict with other agents?

### ⚠️ Common Mistakes

❌ **WRONG**: "I'll add {{OFFERS}} to Router without checking Product Agent"  
→ Result: Variable appears twice (Principle III violation)

❌ **WRONG**: "I'll change Cart Agent without checking Product delegation"  
→ Result: Product → Cart handoff breaks

✅ **CORRECT**: "I'll check ALL agents before modifying ANY agent"

### 🔗 Documentation

**Read these BEFORE editing prompts**:

- `docs/LLM_AGENTS_TREE.md` - Complete agent/function map
- `docs/MULTI_AGENT_FLOW_COMPLETE.md` - 13-step flow guide
- `.specify/memory/constitution.md` - Architectural rules

---

## 8. Message Flow Timeline Integrity

### ✅ RULE

**Message Flow Timeline MUST mirror EXACTLY the real execution flow** - every LLM call, every delegation, every agent switch.

**⚠️ NOTA**: Questa è una **regola di CODICE**, non di prompt (ma i prompt devono sapere che esiste per debug).

### 📋 What is Message Flow Timeline?

**Location**: ChatPage → MessageFlowDialog component  
**Purpose**: Admins see EXACTLY what happened step-by-step  
**Data source**: `debugInfo.steps[]` array in chat messages  
**Critical**: Timeline = Reality (no hidden steps, no fake steps)

### 🎯 Timeline MUST Show

1. ✅ **Router decisions** - Intent classification, context interpretation
2. ✅ **Agent switches** - When Router changes specialist (Product → Cart)
3. ✅ **Specialist agent calls** - Product Search, Cart, Orders, Profile, Support
4. ✅ **Delegations** - When one specialist delegates to another
5. ✅ **Function calls** - addToCart, handlePushNotifications, etc.
6. ✅ **Safety Agent** - Final validation + translation
7. ✅ **Token usage** - Exact tokens per step

### 📊 Timeline Structure (Complete Request)

```typescript
debugInfo: {
  steps: [
    // Step 1: Router receives message
    {
      type: "router",
      agent: "Router Agent",
      action: "Intent classification",
      input: { userMessage: "avete mozzarella?" },
      output: {
        decision: "PRODUCT_SEARCH",
        query: "avete mozzarella?"
      },
      tokenUsage: { total: 2400 }
    },

    // Step 2: Product Search shows product + asks confirmation
    {
      type: "sub_agent",
      agent: "Product Search Agent",
      action: "Search and display product",
      input: { query: "avete mozzarella?" },
      output: {
        response: "Sì! Mozzarella di Bufala DOP (MOZZ-001) €8.50. Vuoi aggiungerla?",
        productCode: "MOZZ-001"
      },
      tokenUsage: { total: 3500 }
    },

    // Step 3: Safety translates response
    {
      type: "safety",
      agent: "Safety & Translation Agent",
      action: "Validate + translate",
      input: { text: "...", targetLanguage: "it" },
      output: { translatedText: "...", safe: true },
      tokenUsage: { total: 2800 }
    }
  ],
  totalTokens: 8700,
  executionTime: "1.2s"
}
```

### 🔄 Timeline for Multi-Step Flow (Product → Cart)

**Complete example**: "avete mozzarella?" → "SI"

```typescript
// REQUEST 1: User asks for product
{
  steps: [
    { type: "router", agent: "Router Agent", action: "Route to Product" },
    {
      type: "sub_agent",
      agent: "Product Search Agent",
      action: "Show product + ask confirmation",
    },
    { type: "safety", agent: "Safety Agent", action: "Translate" },
  ]
}

// REQUEST 2: User confirms with "SI"
{
  steps: [
    // Step 1: Router interprets "SI" with context
    {
      type: "router_context",
      agent: "Router Agent",
      action: "Context Interpretation + Agent Switch",
      input: {
        userMessage: "SI",
        conversationHistory: [
          { role: "assistant", content: "Vuoi aggiungerla?" },
          { role: "user", content: "SI" },
        ],
      },
      output: {
        contextualizedMessage:
          "L'utente CONFERMA che vuole mettere nel carrello Mozzarella (MOZZ-001)",
        detectedPattern: "Product confirmation",
        agentSwitch: "PRODUCT_SEARCH → CART_MANAGEMENT",
        extractedProductCode: "MOZZ-001",
      },
      tokenUsage: { total: 2200 },
    },

    // Step 2: Cart executes addToCart
    {
      type: "sub_agent",
      agent: "Cart Management Agent",
      action: "Execute addToCart",
      input: {
        query:
          "L'utente CONFERMA che vuole mettere nel carrello Mozzarella (MOZZ-001)",
        productCode: "MOZZ-001",
      },
      output: {
        functionCalled: "addToCart",
        functionArgs: { productId: "MOZZ-001", quantity: 1 },
        functionResult: { success: true, cartTotal: "€8.50" },
        response: "Perfetto! ✅ Aggiunto al carrello",
      },
      tokenUsage: { total: 2900 },
    },

    // Step 3: Safety translates
    {
      type: "safety",
      agent: "Safety Agent",
      action: "Translate",
      tokenUsage: { total: 2600 },
    },
  ]
}
```

**🚨 CRITICAL**: Notice Step 1 shows **agent switch** (Product → Cart) and **extracted product code**!

### 📊 Required Debug Step Types

| Type             | When to Use                                   | Example                            |
| ---------------- | --------------------------------------------- | ---------------------------------- |
| `router`         | Router classifies intent or answers FAQ       | Initial routing decision           |
| `router_context` | Router interprets short response with history | "SI" → "L'utente CONFERMA..."      |
| `sub_agent`      | Specialist agent executes task                | Product Search, Cart, Orders       |
| `delegation`     | Agent delegates to another agent              | Product → Cart handoff             |
| `function_call`  | Agent executes calling function               | addToCart, handlePushNotifications |
| `safety`         | Safety Agent validates + translates           | Final step before customer         |

### 🚨 Critical Rules for Timeline Integrity

#### Rule 1: Every LLM Call = One Debug Step

```typescript
// ❌ WRONG: LLM called but no debug step
const response = await llm.chat(...)
// Missing: debugSteps.push({ ... })

// ✅ CORRECT: LLM call + immediate debug step
const response = await llm.chat(...)
debugSteps.push({
  type: "sub_agent",
  agent: "Product Search Agent",
  input: { query },
  output: { response: response.content },
  tokenUsage: { total: response.tokensUsed }
})
```

#### Rule 2: Agent Switches MUST Be Visible

```typescript
// ❌ WRONG: Switch happens silently
if (userSaysYes) {
  cartAgent.handleQuery(...) // No indication of switch!
}

// ✅ CORRECT: Switch documented in timeline
if (userSaysYes) {
  debugSteps.push({
    type: "router_context",
    agent: "Router Agent",
    action: "Agent Switch",
    output: {
      agentSwitch: "PRODUCT_SEARCH → CART_MANAGEMENT",
      reasoning: "User confirmed add to cart"
    }
  })

  cartAgent.handleQuery(...)
  debugSteps.push({ type: "sub_agent", agent: "Cart Management Agent", ... })
}
```

#### Rule 3: Delegations MUST Show Source + Target

```typescript
// When Product Agent delegates to Cart
debugSteps.push({
  type: "delegation",
  agent: "Product Search Agent",
  action: "Delegate to Cart Management",
  delegatedTo: "CART_MANAGEMENT",
  reasoning: "User confirmed product addition",
  extractedData: { productCode: "MOZZ-001", quantity: 1 },
})
```

#### Rule 4: Function Calls MUST Include Args + Results

```typescript
// ✅ CORRECT: Show what function was called with what args
debugSteps.push({
  type: "function_call",
  agent: "Cart Management Agent",
  functionName: "addToCart",
  functionArgs: { productId: "MOZZ-001", quantity: 1 },
  functionResult: { success: true, cartTotal: "€8.50" },
  executionTimeMs: 120,
})
```

### ⚠️ What Breaks Timeline Integrity

| Problem                           | Impact                            | Fix                                             |
| --------------------------------- | --------------------------------- | ----------------------------------------------- |
| Hidden LLM call (no debug step)   | Admin can't see what happened     | Add debugSteps.push() after EVERY LLM call      |
| Agent switch without notification | Timeline shows wrong agent        | Add router_context step when switching          |
| Delegation not logged             | Chain breaks, hard to debug       | Add delegation step before calling target agent |
| Function call not shown           | Can't see what actions were taken | Add function_call step with args + result       |
| Wrong token count                 | Cost tracking broken              | Use exact tokens from LLM response              |

### 📊 Complete Timeline Example (Real Flow)

**User Journey**: "avete mozzarella?" → Product shows → "SI" → Cart adds

```
┌─────────────────────────────────────────────────────────────┐
│ REQUEST 1: "avete mozzarella?"                              │
├─────────────────────────────────────────────────────────────┤
│ [Step 1] Router Agent - Intent Classification               │
│   Input: "avete mozzarella?"                                │
│   Output: decision="PRODUCT_SEARCH"                         │
│   Tokens: 2,400                                             │
├─────────────────────────────────────────────────────────────┤
│ [Step 2] Product Search Agent - Search Products             │
│   Input: query="avete mozzarella?"                          │
│   Output: "Sì! Mozzarella di Bufala DOP (MOZZ-001) €8.50.  │
│            Vuoi aggiungerla al carrello?"                   │
│   Extracted: productCode="MOZZ-001"                         │
│   Tokens: 3,500                                             │
├─────────────────────────────────────────────────────────────┤
│ [Step 3] Safety & Translation Agent                         │
│   Input: English response                                   │
│   Output: Italian translation                               │
│   Tokens: 2,800                                             │
└─────────────────────────────────────────────────────────────┘
Total: 8,700 tokens | Time: 1.2s

┌─────────────────────────────────────────────────────────────┐
│ REQUEST 2: "SI"                                             │
├─────────────────────────────────────────────────────────────┤
│ [Step 1] Router Agent - Context Interpretation + Switch     │
│   Input: "SI" + history (last 3 messages)                   │
│   Detected: Product asked "Vuoi aggiungerla?"               │
│   Extracted: productCode="MOZZ-001"                         │
│   Output: "L'utente CONFERMA che vuole mettere nel         │
│            carrello Mozzarella di Bufala DOP (MOZZ-001)"   │
│   Agent Switch: PRODUCT_SEARCH → CART_MANAGEMENT ⚡         │
│   Tokens: 2,200                                             │
├─────────────────────────────────────────────────────────────┤
│ [Step 2] Cart Management Agent - Execute Add                │
│   Input: "L'utente CONFERMA..." + productCode              │
│   Function Call: addToCart(MOZZ-001, qty=1)                │
│   Function Result: {success: true, total: "€8.50"}         │
│   Output: "Perfetto! ✅ Aggiunto Mozzarella al carrello"   │
│   Tokens: 2,900                                             │
├─────────────────────────────────────────────────────────────┤
│ [Step 3] Safety & Translation Agent                         │
│   Input: English response                                   │
│   Output: Italian translation                               │
│   Tokens: 2,600                                             │
└─────────────────────────────────────────────────────────────┘
Total: 7,700 tokens | Time: 1.0s

GRAND TOTAL: 16,400 tokens | 2.2s
```

**🎯 KEY FEATURES**:

1. ✅ Every step numbered and labeled
2. ✅ Agent switch visible (⚡ icon)
3. ✅ Product code extracted and passed
4. ✅ Function call documented with args + result
5. ✅ Token usage per step
6. ✅ Timeline = Reality (no hidden steps)

### 🔧 Implementation Checklist

**Before deploying ANY LLM changes**:

```markdown
✅ 1. Count LLM calls in code
✅ 2. Count debugSteps.push() calls
✅ 3. Verify counts MATCH (1 LLM call = 1 debug step)
✅ 4. Check step order matches execution order
✅ 5. Verify agent switches are visible
✅ 6. Verify delegations show source + target
✅ 7. Verify function calls show args + results
✅ 8. Verify tokenUsage sum = totalTokens
✅ 9. Test in ChatPage → MessageFlowDialog
✅ 10. Verify timeline shows COMPLETE flow (no hidden steps)
```

### ⚠️ Common Timeline Bugs

#### Bug 1: Missing Router Context Interpretation

```typescript
// ❌ WRONG: Router interprets "SI" but doesn't log it
const contextualizedMessage = interpretContext(userMessage, history)
await cartAgent.handleQuery({ query: contextualizedMessage })

// Timeline shows: Cart step only (WHERE did contextualized message come from?)
```

```typescript
// ✅ CORRECT: Router logs context interpretation
const contextualizedMessage = interpretContext(userMessage, history)

debugSteps.push({
  type: "router_context",
  agent: "Router Agent",
  action: "Context Interpretation",
  input: { userMessage, history },
  output: { contextualizedMessage, agentSwitch: "PRODUCT → CART" },
})

await cartAgent.handleQuery({ query: contextualizedMessage })
// Timeline shows: Router context step + Cart step ✅
```

#### Bug 2: Hidden Delegation (Product → Cart)

```typescript
// ❌ WRONG: Product delegates silently
if (response.includes("DELEGATE_TO_CART")) {
  const cartResponse = await cartAgent.handleQuery(...)
  // Missing: delegation step!
}

// Timeline shows: Product → [mystery gap] → Cart (WHY did Cart get called?)
```

```typescript
// ✅ CORRECT: Delegation visible in timeline
if (response.includes("DELEGATE_TO_CART")) {
  debugSteps.push({
    type: "delegation",
    agent: "Product Search Agent",
    action: "Delegate to Cart Management",
    delegatedTo: "CART_MANAGEMENT",
    reasoning: "User confirmed add to cart"
  })

  const cartResponse = await cartAgent.handleQuery(...)
  // Timeline shows: Product → Delegation step → Cart ✅
}
```

#### Bug 3: Function Call Hidden in Agent

```typescript
// ❌ WRONG: Cart calls addToCart but doesn't show in timeline
const result = await addToCart(productId, quantity)
return { success: true, message: "Added to cart" }

// Timeline shows: Cart Agent responded (WHAT did it do? Can't see addToCart!)
```

```typescript
// ✅ CORRECT: Function call visible
const result = await addToCart(productId, quantity)

debugSteps.push({
  type: "function_call",
  agent: "Cart Management Agent",
  functionName: "addToCart",
  functionArgs: { productId, quantity },
  functionResult: result,
  executionTimeMs: 120,
})

return { success: true, message: "Added to cart" }
// Timeline shows: Cart Agent → addToCart(MOZZ-001, 1) → Success ✅
```

### � Backend Implementation Files

**Where to add debug steps**:

- `backend/src/services/llm-router.service.ts` - Main orchestration + delegation
- `backend/src/application/agents/ProductSearchAgentLLM.ts` - Product Agent steps
- `backend/src/application/agents/CartManagementAgentLLM.ts` - Cart Agent steps
- `backend/src/application/agents/ProfileManagementAgentLLM.ts` - Profile Agent steps
- `backend/src/application/agents/SafetyTranslationAgent.ts` - Safety Agent step

**Debug step array location**:

```typescript
const debugSteps: DebugStep[] = [] // llm-router.service.ts line ~1390

// Add steps throughout execution:
debugSteps.push({ type: "router", ... })
debugSteps.push({ type: "sub_agent", ... })
debugSteps.push({ type: "safety", ... })

// Return at end:
return {
  response: finalResponse,
  debugInfo: {
    steps: debugSteps,
    totalTokens: totalTokens,
    executionTime: `${executionTimeMs}ms`
  }
}
```

### 🔗 Constitution Reference

**Principle IX: Message Flow Timeline Integrity** (MUST - NON-NEGOTIABLE)

---

## 9. Function Calling - Zero Hallucinations

### ✅ RULE

**LLM agents can ONLY call functions that EXIST in `agent-functions.ts`**. Never invent functions.

### 📋 Function Registry

**File**: `backend/src/config/agent-functions.ts`

All available functions are defined in `AGENT_FUNCTIONS` array:

```typescript
export const AGENT_FUNCTIONS: AgentFunction[] = [
  // Router delegation functions (6)
  { name: "productSearchAgent", type: "Router", ... },
  { name: "cartManagementAgent", type: "Router", ... },
  { name: "orderTrackingAgent", type: "Router", ... },
  { name: "profileManagementAgent", type: "Router", ... },
  { name: "customerSupportAgent", type: "Router", ... },
  { name: "RESET_ACTIVE_AGENT", type: "Router", ... },

  // Product Search calling functions (2)
  { name: "searchProductByCertifications", type: "ProductSearch", ... },
  { name: "searchProductForStatistics", type: "ProductSearch", ... },

  // Cart calling functions (7)
  { name: "addToCart", type: "Cart", ... },
  { name: "removeFromCart", type: "Cart", ... },
  { name: "clearCart", type: "Cart", ... },
  { name: "viewCart", type: "Cart", ... },
  { name: "checkout", type: "Cart", ... },
  { name: "getCartLink", type: "Cart", ... },
  { name: "repeatOrder", type: "Cart", ... },

  // Order calling functions (4)
  { name: "getOrdersList", type: "Order", ... },
  { name: "getOrderDetails", type: "Order", ... },
  { name: "getOrdersListLink", type: "Order", ... },
  { name: "repeatOrder", type: "Order", ... },

  // Profile calling functions (2)
  { name: "handlePushNotifications", type: "Profile", ... },
  { name: "getProfileLink", type: "Profile", ... },

  // Support calling functions (3)
  { name: "contactHumanOperator", type: "Support", ... },
  { name: "createSupportTicket", type: "Support", ... },
  { name: "sendEmailToSupport", type: "Support", ... }
]
```

### 🎯 Prompt Function Declaration

**In each agent prompt**, declare ONLY the functions that agent can use:

#### Example: Cart Management Agent

```markdown
## Available Functions

You can call these functions to perform actions:

1. **addToCart(productId, quantity, notes?)**

   - Adds product to cart
   - Parameters: productId (string), quantity (number), notes (optional string)

2. **removeFromCart(productId)**

   - Removes product from cart
   - Parameters: productId (string)

3. **clearCart()**

   - Empties entire cart
   - No parameters

4. **viewCart()**

   - Shows current cart contents
   - No parameters

5. **checkout()**

   - Converts cart to order
   - No parameters

6. **getCartLink()**

   - Generates secure cart URL
   - No parameters

7. **repeatOrder(orderCode)**
   - Clones previous order to cart
   - Parameters: orderCode (string)
```

### ⚠️ Common Hallucination Mistakes

❌ **WRONG**: Agent calls `updateProduct(productId, price)`

- Function doesn't exist in `agent-functions.ts`
- LLM invented it based on similar patterns
- Result: Function executor crashes

❌ **WRONG**: Agent calls `getProductDetails(productId)`

- Function doesn't exist (product details in `{{PRODUCTS}}` variable)
- LLM assumed it should exist
- Result: "Function not found" error

❌ **WRONG**: Agent calls `sendWhatsAppMessage(phone, message)`

- Function doesn't exist (WhatsApp handled by backend)
- LLM invented it
- Result: Execution fails

✅ **CORRECT**: Agent only calls functions declared in its prompt AND registered in `agent-functions.ts`

### 📊 Preventing Hallucinations

**In every agent prompt, add this section**:

```markdown
## ⚠️ CRITICAL - Function Calling Rules

**YOU CAN ONLY CALL THESE FUNCTIONS** (listed above).

**YOU CANNOT**:

- ❌ Invent new functions
- ❌ Call functions from other agents
- ❌ Modify function parameters
- ❌ Call functions not listed in this prompt

**IF YOU NEED A FUNCTION THAT DOESN'T EXIST**:

- Respond with text explaining limitation
- Suggest customer contact support
- Example: "Mi dispiace, non posso modificare i prezzi. Contatta il supporto."
```

### 🔗 Constitution Reference

**Principle I: Database-First Architecture** - No invented functionality

---

## 10. Product Data - Zero Hallucinations

### ✅ RULE

**LLM agents can ONLY show products that exist in `{{PRODUCTS}}` variable**. Never invent products or prices.

### 📋 Data Source

**Variable**: `{{PRODUCTS}}`  
**Content**: Complete product catalog from database  
**Injected by**: `PromptProcessorService.replaceAllVariables()`  
**Format**:

```
CODICE: PARM-001
NOME: Parmigiano Reggiano DOP 24 mesi
CATEGORIA: Formaggi
PREZZO: €15.50/kg
CERTIFICAZIONI: DOP, Biologico
REGIONE: Emilia-Romagna
FORMATO: 1kg
DESCRIZIONE: Stagionato 24 mesi, sapore intenso e deciso
TEMPERATURA: Fresco (4-8°C)
---
CODICE: GRANA-001
NOME: Grana Padano DOP 16 mesi
CATEGORIA: Formaggi
PREZZO: €12.80/kg
CERTIFICAZIONI: DOP
REGIONE: Lombardia
FORMATO: 1kg
DESCRIZIONE: Stagionato 16 mesi, gusto delicato
TEMPERATURA: Fresco (4-8°C)
---
```

### 🎯 Product Response Rules

**When user asks for products**:

1. ✅ **Search in `{{PRODUCTS}}`** - Find matching items
2. ✅ **Copy EXACT values** - Names, prices, codes as-is
3. ✅ **Show what exists** - If 3 products match, show 3
4. ✅ **Group if >8 items** - By category/region/format
5. ❌ **NEVER invent** - No products outside `{{PRODUCTS}}`
6. ❌ **NEVER approximate** - No "around €15" (use exact €15.50)

### ⚠️ Common Hallucination Mistakes

#### Mistake 1: Inventing Products

```
❌ WRONG:
User: "avete salami?"
Agent: "Sì! Ecco i nostri salami:
1. Salame Toscano Classico - €8.50/kg
2. Salame Milano Dolce - €7.20/kg
3. Salame Napoli Piccante - €9.00/kg"

Problem: These products were copied from prompt EXAMPLES, not {{PRODUCTS}}!
```

✅ **CORRECT**:

```
User: "avete salami?"
Agent: [Searches {{PRODUCTS}} variable]
Agent: "Ecco i salami disponibili:
1. Salame Felino IGP 300g - €12.50 (SALAM-001)
2. Salame Ungherese Piccante 400g - €10.80 (SALAM-002)"

[Shows ONLY products from {{PRODUCTS}} variable]
```

#### Mistake 2: Inventing Prices

```
❌ WRONG:
User: "quanto costa il parmigiano?"
Agent: "Il Parmigiano Reggiano costa circa €14-16 al kg"

Problem: "circa" is NOT allowed - must show EXACT price from database!
```

✅ **CORRECT**:

```
User: "quanto costa il parmigiano?"
Agent: "Parmigiano Reggiano DOP 24 mesi: €15.50/kg (PARM-001)"

[Shows EXACT price from {{PRODUCTS}} variable]
```

#### Mistake 3: Count Mismatch

```
❌ WRONG:
Agent: "Ecco 5 formaggi DOP disponibili:
1. Parmigiano Reggiano - €15.50
2. Grana Padano - €12.80
3. Pecorino Romano - €18.00
4. Taleggio DOP - €14.20"

Problem: Said "5 formaggi" but showed only 4!
```

✅ **CORRECT**:

```
Agent: "Ecco 5 formaggi DOP disponibili:
1. Parmigiano Reggiano DOP - €15.50/kg
2. Grana Padano DOP - €12.80/kg
3. Pecorino Romano DOP - €18.00/kg
4. Taleggio DOP - €14.20/kg
5. Gorgonzola DOP - €13.50/kg"

[Count matches items shown - ALL 5 listed]
```

### 📊 Preventing Product Hallucinations

**In Product Search Agent prompt, add**:

```markdown
## ⚠️ ABSOLUTE PROHIBITIONS

**YOU CANNOT**:

- ❌ Invent product names not in {{PRODUCTS}}
- ❌ Invent prices or use "circa €X"
- ❌ Copy example products from this prompt (they are FAKE)
- ❌ Say "(N items)" then show fewer
- ❌ Use training data (only {{PRODUCTS}} variable)

**WARNING**: Examples in this prompt use FAKE products like [EXAMPLE_PRODUCT].
These are placeholders ONLY. NEVER copy them to responses.

**IF PRODUCT DOESN'T EXIST**:

- Say: "Non abbiamo [product] al momento"
- Suggest alternatives from {{PRODUCTS}}
- Example: "Non abbiamo prosciutto San Daniele, ma abbiamo Prosciutto Parma DOP"
```

### 🔗 Constitution Reference

**Principle III: Variable Replacement, Section 4** - Example Products Prevention

---

## 11. Product Search Grouping Strategy

### ✅ RULE

**Use progressive filtering to guide customers from broad categories to specific products** - avoid overwhelming customers with long product lists.

### 📋 Philosophy

**Non è un listato di prodotti - è una conversazione guidata** per capire cosa vuole il cliente!

Il Product Agent deve:

1. ✅ **Capire l'esigenza** del cliente ("cerchi formaggi freschi o stagionati?")
2. ✅ **Filtrare progressivamente** con domande intelligenti
3. ✅ **Arrivare al prodotto giusto** passo dopo passo in base alle sue esigenze
4. ❌ **MAI** fare un dump di 30 prodotti in una volta

### 🎯 Progressive Filtering Strategy

#### Livello 1: Categoria Principale (>8 prodotti)

```
User: "che prodotti avete?"
→ 49 prodotti totali

✅ CORRECT Response - Raggruppa per categoria:
"Ciao! Abbiamo diversi prodotti disponibili. Ecco le categorie:

🧀 Formaggi
🥓 Salumi
🍝 Pasta
🍷 Vini
🫒 Olio e Condimenti

Quale categoria ti interessa?"
```

#### Livello 2: Sotto-Categoria (>8 prodotti nella categoria)

```
User: "formaggi"
→ 15 formaggi totali

✅ CORRECT Response - Filtra per tipo:
"Perfetto! Abbiamo diversi formaggi:

1. Formaggi freschi (mozzarella, ricotta, burrata)
2. Formaggi stagionati (parmigiano, grana, pecorino)
3. Formaggi a pasta molle (taleggio, stracchino)
4. Formaggi DOP certificati

Quale tipo preferisci?"
```

#### Livello 3: Formato/Dettaglio (≤8 prodotti)

```
User: "stagionati"
→ 6 formaggi stagionati

✅ CORRECT Response - Lista prodotti:
"Ecco i formaggi stagionati:

1. Parmigiano Reggiano DOP 24 mesi - €15.50/kg
2. Grana Padano DOP 16 mesi - €12.80/kg
3. Pecorino Romano DOP - €18.00/kg
4. Pecorino Toscano - €16.00/kg
5. Provolone Valpadana - €14.50/kg
6. Caciocavallo Silano - €17.00/kg

Quale ti interessa?"
```

#### Livello 4: Dettaglio Completo (1 prodotto)

```
User: "1" o "parmigiano"
→ Cliente ha scelto

✅ CORRECT Response - Tutti i dettagli:
"Perfetto! Ecco i dettagli completi:

🧀 **Parmigiano Reggiano DOP 24 mesi**

📦 Codice: PARM-001
💰 Prezzo: €15.50/kg
🏷️ Certificazioni: DOP, Biologico
🌍 Regione: Emilia-Romagna
📏 Formato: 1kg
🌡️ Temperatura: Fresco (4-8°C)
📝 Descrizione: Stagionato 24 mesi in cantine tradizionali. Sapore intenso e deciso.

Vuoi aggiungerlo al carrello?"
```

### 🎯 Logica di Filtraggio Progressivo

```
Prodotti che matchano query: N

if N == 1:
  → Mostra TUTTI i dettagli del prodotto
  → Chiedi: "Vuoi aggiungerlo al carrello?"

elif N <= 8:
  → Lista diretta (codice, nome, prezzo)
  → Chiedi: "Quale preferisci?"

elif N > 8:
  → FILTRA progressivamente:
     - Per categoria (Formaggi, Salumi, Vini...)
     - Per tipo (freschi, stagionati, DOP...)
     - Per regione (Emilia, Toscana, Veneto...)
     - Per formato (500g, 1kg, 2kg...)
  → Chiedi domanda intelligente per restringere

Dopo selezione cliente:
  → Ripeti il processo con subset filtrato
  → Continua fino ad avere 1-8 prodotti
  → Mostra dettagli completi quando resta 1 solo prodotto
```

### 💡 Esempi di Domande Intelligenti

Il prompt deve essere **intelligente** e fare domande per capire l'esigenza:

```
✅ "Cerchi formaggi freschi o stagionati?"
✅ "Preferisci DOP certificato o produzione artigianale?"
✅ "Che formato ti serve? Porzione piccola o grande?"
✅ "Per quale occasione? Aperitivo, cucina, o da tavola?"
✅ "Che zona preferisci? Emilia, Toscana, Veneto?"
```

❌ **MAI** fare dump:

```
"Ecco tutti i 30 formaggi:
1. Parmigiano 500g...
2. Parmigiano 1kg...
3. Parmigiano 2kg...
[...27 more lines...]
```

### ⚠️ Common Mistakes

❌ **WRONG**: Raggruppare artificialmente quando hai solo 3 prodotti

```
User: "formaggi DOP"
→ Solo 3 prodotti

Agent: "Formaggi per stagionatura:
**12-18 mesi**: Grana
**24+ mesi**: Parmigiano, Pecorino"

Problema: Inutile! Lista direttamente i 3 prodotti!
```

✅ **CORRECT**: Lista diretta quando ≤8 prodotti

```
Agent: "Ecco 3 formaggi DOP:
1. Parmigiano Reggiano - €15.50/kg
2. Grana Padano - €12.80/kg
3. Pecorino Romano - €18.00/kg

Quale ti interessa?"
```

---

## 12. Real-World Examples in Prompts

### ✅ RULE

**ALL examples in LLM prompts MUST use REAL data from the workspace**, not fake placeholder data.

### 📋 Why Real Examples Matter

**LLMs learn by imitation**. If prompt examples are:

- ❌ Fake → LLM copies fake patterns
- ✅ Real → LLM copies correct patterns

### 🎯 Example Types

#### Example 1: Product Examples

❌ **WRONG (Fake data)**:

```markdown
## Example: Product Search

User: "cerco pasta bio"
Agent: "Ecco pasta biologica:

1. Pasta Fusilli Bio 500g - €3.20
2. Pasta Penne Bio 500g - €2.80
3. Pasta Spaghetti Bio 1kg - €5.00"
```

**Problem**: These are invented products - not from database!

✅ **CORRECT (Real data from Bell'Italia workspace)**:

```markdown
## Example: Product Search

User: "cerco formaggi DOP"
Agent: "Ecco i formaggi DOP disponibili:

1. Parmigiano Reggiano DOP 24 mesi 1kg - €15.50 (PARM-001)
2. Grana Padano DOP 16 mesi 1kg - €12.80 (GRANA-001)
3. Pecorino Romano DOP 800g - €18.00 (PECOR-001)
4. Taleggio DOP 1kg - €14.20 (TALEG-001)
5. Gorgonzola DOP Dolce 1kg - €13.50 (GORG-001)"
```

**Benefit**: LLM sees real product codes, real prices, real names → copies correctly

#### Example 2: Customer Context

❌ **WRONG (Generic placeholders)**:

```markdown
## Customer Variables

- {{nome}}: [CUSTOMER_NAME]
- {{email}}: [EMAIL]
- {{discountUser}}: [DISCOUNT]%
```

✅ **CORRECT (Real example from seed data)**:

```markdown
## Customer Variables

- {{nome}}: Mario Rossi
- {{email}}: mario.rossi@example.com
- {{discountUser}}: 15%
- {{languageUser}}: it
- {{telefono}}: +39 333 1234567
```

**Benefit**: LLM understands format, language, structure

#### Example 3: Function Calling

❌ **WRONG (Abstract example)**:

```markdown
## Example: Add to Cart

User: "aggiungi prodotto X"
Agent: [Calls addToCart(productId="PRODUCT-X", quantity=1)]
```

✅ **CORRECT (Real product from catalog)**:

```markdown
## Example: Add to Cart

User: "aggiungi 2kg parmigiano"
Agent: [Calls addToCart(productId="PARM-001", quantity=2, notes="")]
Response: "✅ Aggiunto 2kg Parmigiano Reggiano DOP al carrello (€31.00)"
```

**Benefit**: LLM learns exact productId format, quantity handling, response pattern

#### Example 4: Conversation Flow

❌ **WRONG (Simplified example)**:

```markdown
## Example: Confirmation Flow

User: "voglio prodotto"
Agent: "Confermi?"
User: "si"
Agent: [Adds to cart]
```

✅ **CORRECT (Real multi-turn conversation)**:

```markdown
## Example: Confirmation Flow

User: "cerco parmigiano stagionato"
Agent: "Ecco Parmigiano Reggiano DOP 24 mesi 1kg - €15.50 (PARM-001). Vuoi aggiungerlo al carrello?"
User: "SI"
Agent: [Calls addToCart(productId="PARM-001", quantity=1)]
Response: "Perfetto! ✅ Ho aggiunto 1kg Parmigiano Reggiano DOP al carrello (€15.50).

Il totale è €15.50 (sconto 15% già applicato). Vuoi procedere al checkout?"
```

**Benefit**: LLM learns:

- Product detail verbosity level
- Confirmation question phrasing
- Cart response format
- Discount handling

### 📊 Creating Real Examples

**Step-by-step process**:

1. ✅ **Check database** - Use Prisma Studio or seed data
2. ✅ **Copy exact values** - Product codes, names, prices as-is
3. ✅ **Use real customer** - Mario Rossi (test customer from seed)
4. ✅ **Test in production** - Run example through system
5. ✅ **Verify response** - Copy actual LLM response to prompt

### ⚠️ Common Mistakes

❌ **WRONG**: Using fake examples "to keep prompt generic"

- Problem: LLM copies fake patterns → hallucinations

❌ **WRONG**: Using old examples after product changes

- Problem: LLM shows discontinued products

❌ **WRONG**: Using simplified examples "for clarity"

- Problem: LLM doesn't learn real-world complexity

✅ **CORRECT**: Real examples from current workspace database

### 🔗 How to Get Real Examples

**Database queries**:

```sql
-- Get real products
SELECT code, name, price, category FROM products WHERE workspaceId = 'cm9hj...' LIMIT 5;

-- Get real customer
SELECT name, email, discount FROM customers WHERE email = 'mario.rossi@example.com';

-- Get real order
SELECT code, total, status FROM orders WHERE customerId = '...' ORDER BY createdAt DESC LIMIT 1;
```

**Seed data location**:

```
backend/prisma/seed.ts
  → Products (lines 400-650)
  → Customers (lines 700-800)
  → Categories (lines 300-400)
```

---

## 📚 APPENDIX: Quick Reference

### Agent Responsibilities Matrix

| Agent              | Variables Used                                                           | Functions                       | Delegates To       |
| ------------------ | ------------------------------------------------------------------------ | ------------------------------- | ------------------ |
| **Router**         | {{FAQ}}, {{nome}}, {{email}}                                             | 6 delegation functions          | All specialists    |
| **Product Search** | {{PRODUCTS}}, {{CATEGORIES}}, {{OFFERS}}, {{SERVICES}}, {{discountUser}} | searchProductByCertifications   | CART               |
| **Cart**           | {{PRODUCTS}}, {{discountUser}}                                           | 7 cart functions                | None               |
| **Order Tracking** | {{lastordercode}}                                                        | 4 order functions               | CART (repeatOrder) |
| **Profile**        | {{nome}}, {{email}}, {{telefono}}, {{pushNotificationsConsent}}          | 2 profile functions             | None               |
| **Support**        | {{agentName}}, {{agentPhone}}, {{agentEmail}}                            | 3 support functions             | None               |
| **Safety**         | All variables (final cleanup)                                            | None (validation + translation) | Customer           |

### Variable Uniqueness Check

### Variable Uniqueness Check

| Variable         | Allowed In (Max 1)                  | Currently In          | Violation? |
| ---------------- | ----------------------------------- | --------------------- | ---------- |
| {{FAQ}}          | Router only                         | Router                | ✅ OK      |
| {{PRODUCTS}}     | **Product Search ONLY** (NOT Cart!) | Product Search        | ✅ OK      |
| {{CATEGORIES}}   | Product Search only                 | Product Search        | ✅ OK      |
| {{OFFERS}}       | Product Search only                 | Product Search        | ✅ OK      |
| {{SERVICES}}     | Product Search only                 | Product Search        | ✅ OK      |
| {{discountUser}} | Product Search + Cart (both OK)     | Product Search + Cart | ✅ OK      |

**🚨 CRITICAL RULE**: `{{PRODUCTS}}` MUST be in Product Search Agent ONLY!

**Why Cart Agent does NOT need {{PRODUCTS}}**:

- ✅ Cart receives `productId` (UUID) from Router's contextualized message
- ✅ Cart calls `addToCart(productId)` → backend fetches product details from database
- ❌ Cart does NOT search products → no need for full catalog
- ❌ Including {{PRODUCTS}} in Cart violates Principle III (Variable Uniqueness)

### Prompt Token Budget

| Agent              | Target Tokens | Current Tokens | Status     |
| ------------------ | ------------- | -------------- | ---------- |
| Router             | 2,400         | 2,400          | ✅ Optimal |
| Product Search     | 3,500         | 3,200          | ✅ Good    |
| Cart Management    | 2,500         | 2,800          | ⚠️ Review  |
| Order Tracking     | 2,000         | 1,900          | ✅ Good    |
| Profile Management | 1,500         | 1,400          | ✅ Good    |
| Support            | 2,000         | 1,800          | ✅ Good    |
| Safety Translation | 1,500         | 1,300          | ✅ Good    |

---

## 🔄 Maintenance Schedule

### Weekly Tasks

- [ ] Verify all examples use real products (check against latest seed)
- [ ] Check variable uniqueness (no duplicates across prompts)
- [ ] Validate function definitions match `agent-functions.ts`

### Monthly Tasks

- [ ] Review token usage per agent (optimize if >20% over budget)
- [ ] Update examples if product catalog changes significantly
- [ ] Audit Message Flow Timeline alignment with actual execution

### Quarterly Tasks

- [ ] Full prompt refactoring review (remove deprecated patterns)
- [ ] Cross-agent consistency check (tone, formatting, structure)
- [ ] Constitution compliance audit (all 14 principles)

---

## 13. Agent Delegation Architecture

### ✅ RULE

**ONLY the Router can call other agents** - Specialist agents NEVER call each other directly.

### 📋 The Problem

❌ **WRONG Architecture** (specialist agents calling each other):

```
Product Agent → calls cartManagementAgent()
Cart Agent → calls productSearchAgent()
Order Agent → calls cartManagementAgent()
```

**Problems with this approach**:

- ❌ Violates single responsibility (agents become routers)
- ❌ Creates circular dependencies
- ❌ Makes debugging impossible (who called who?)
- ❌ Breaks Message Flow Timeline (hidden delegation)
- ❌ No centralized control flow

✅ **CORRECT Architecture** (delegation patterns):

```
Specialist Agent → Returns special pattern
Router → Intercepts pattern → Delegates to target agent
```

### 🎯 Delegation Pattern

When specialist agent needs another specialist:

**Step 1**: Specialist returns response with **special pattern**

```
Response: "🛒 DELEGATE_TO_CART: add PARM-001 quantity 2"
```

**Step 2**: Router intercepts pattern (regex detection)

```typescript
if (response.includes("🛒 DELEGATE_TO_CART:")) {
  // Extract delegation query
  const cartQuery = response.match(/🛒 DELEGATE_TO_CART:\s*(.+)/)[1]

  // Delegate to Cart Agent
  await cartManagementAgent.handleQuery({
    query: `L'utente CONFERMA che vuole mettere nel carrello...`,
  })
}
```

**Step 3**: Router calls target agent with **contextualized message**

```
Cart Agent receives: "L'utente CONFERMA che vuole mettere nel carrello il prodotto Parmigiano (PARM-001) quantità 2"
```

### 📊 Current Delegation Patterns

| From Agent  | Pattern                        | To Agent | Router Action                                      |
| ----------- | ------------------------------ | -------- | -------------------------------------------------- |
| **Product** | `� DELEGATE_TO_CART: ...`      | Cart     | Extracts product code + quantity, calls Cart Agent |
| **Orders**  | `🔁 DELEGATE_TO_CART: ...`     | Cart     | Repeat order delegation                            |
| **Profile** | (none currently)               | -        | -                                                  |
| **Cart**    | (none - Cart doesn't delegate) | -        | -                                                  |
| **Support** | (none currently)               | -        | -                                                  |

### 🔧 Implementation in Prompts

**Product Agent prompt** (correct):

```markdown
## Cart Delegation

When customer confirms, return:

🛒 DELEGATE_TO_CART: add [PRODUCT_CODE] quantity [N]

❌ NEVER call cartManagementAgent() yourself
✅ Router will intercept and delegate automatically
```

**Cart Agent prompt** (needs fix):

```markdown
## Product Search Delegation

When customer asks "what's available?", return:

🔍 DELEGATE_TO_PRODUCT: [customer query]

❌ NEVER call productSearchAgent() yourself
✅ Router will intercept and delegate automatically
```

### ⚠️ Common Mistakes

❌ **WRONG**: Specialist agent calls another agent directly

```javascript
// In Product Agent prompt
cartManagementAgent({ query: "add PARM-001" }) // ❌ FORBIDDEN!
```

❌ **WRONG**: Specialist agent tries to route

```javascript
// In Cart Agent prompt
if (query.includes("search")) {
  productSearchAgent({ query }) // ❌ FORBIDDEN!
}
```

✅ **CORRECT**: Return delegation pattern

```javascript
// In Product Agent prompt
Response: "🛒 DELEGATE_TO_CART: add PARM-001 quantity 2"
```

✅ **CORRECT**: Router handles all delegation

```typescript
// In llm-router.service.ts (already implemented)
if (response.includes("🛒 DELEGATE_TO_CART:")) {
  // Router extracts, contextualizes, delegates
}
```

### 📋 Prompt Cleanup Checklist

For each specialist agent prompt, verify:

- [ ] ❌ NO calls to other specialist agents (cartManagementAgent, productSearchAgent, etc.)
- [ ] ✅ Uses delegation pattern (🛒 DELEGATE_TO_CART:, 🔍 DELEGATE_TO_PRODUCT:, etc.)
- [ ] ✅ Documents: "Router will intercept and delegate"
- [ ] ✅ Explains: "NEVER call [otherAgent]() yourself"

### 🎯 Benefits of Delegation Pattern

1. ✅ **Single Router**: All inter-agent calls go through Router
2. ✅ **Message Flow Timeline**: Every delegation appears in timeline
3. ✅ **Contextualized Messages**: Router adds "CONFERMA" keyword for clarity
4. ✅ **Debug Visibility**: Can trace exact flow Router → Agent A → Router → Agent B
5. ✅ **No Circular Dependencies**: Specialist agents don't know about each other

### 🔗 Code Implementation

**File**: `backend/src/services/llm-router.service.ts`

**Product → Cart delegation** (lines 1890-1940):

```typescript
if (
  delegationTarget === "PRODUCT_SEARCH" &&
  subAgentFinalResponse.includes("🛒 DELEGATE_TO_CART:")
) {
  const cartQuery = subAgentFinalResponse.match(
    /🛒 DELEGATE_TO_CART:\s*(.+)/
  )[1]

  // Add delegation debug step
  debugSteps.push({
    type: "delegation",
    fromAgent: "PRODUCT_SEARCH",
    toAgent: "CART_MANAGEMENT",
  })

  // Call Cart Agent
  await cartManagementAgent.handleQuery({
    query: `CONFIRMED: ${cartQuery}`,
  })
}
```

---

## 14. TONE & STYLE Standardization

### ✅ RULE

**ALL specialist agent prompts MUST have standardized TONE & STYLE section** at the beginning.

### 📋 Details

Every specialist agent (Product, Cart, Orders, Profile, Support) must start with consistent greeting and tone definition.

### 🎯 Implementation Pattern

**Standard TONE & STYLE Template**:

```markdown
## 🎨 TONE & STYLE

- **[Agent Personality]**: [Brief description] [Emoji]
- **Greeting**: Start with "Ciao {{nome}}!" when [context]
- **[Key Characteristic]**: [Behavior guideline]
- **Response Language**: ALWAYS respond in English (Translation Layer handles localization)
```

### 📊 Agent-Specific Tones

| Agent                    | Tone                           | Greeting Pattern                           | Key Trait                   |
| ------------------------ | ------------------------------ | ------------------------------------------ | --------------------------- |
| **Router**               | Neutral & Professional         | ❌ NO greetings (orchestrator only)        | No customer interaction     |
| **Product Search**       | Friendly & Helpful 🛍️          | ✅ ALWAYS "Ciao {{nome}}!"                 | Enthusiastic guide          |
| **Cart Management**      | Efficient & Friendly 🛒        | ✅ "Ciao {{nome}}!" when appropriate       | Quick confirmations         |
| **Order Tracking**       | Precise & Reassuring 📦        | ✅ "Ciao {{nome}}!" when showing details   | Professional trust          |
| **Profile Management**   | Helpful & Privacy-Conscious 🔒 | ✅ "Ciao {{nome}}!" when showing info      | Respectful security         |
| **Customer Support**     | Empathetic & Professional 🤝   | ✅ "Ciao {{nome}}!" when addressing issues | Caring problem-solving      |
| **Safety & Translation** | Firm but Polite 🛡️             | ✅ Use {{nameUser}} even in warnings       | Security without aggression |

### ⚠️ Critical Rules

1. ✅ **Router NEVER greets** - It's an orchestrator, not a conversationalist
2. ✅ **All specialists greet with {{nome}}** - Personalized customer experience
3. ✅ **Response Language = English** - Translation Layer converts to customer's language
4. ✅ **Consistent emoji usage** - Each agent has signature emoji

### 🔗 Variable Replacement

- **{{nome}}** / **{{nameUser}}** → Customer's actual name (e.g., "Mario")
- Replaced by `PromptProcessorService.replaceCustomerVariables()` **BEFORE** sending to LLM
- Happens at line 249 in `backend/src/services/prompt-processor.service.ts`

---

## 15. Zero Hallucinations - Never Invent

### ✅ RULE

**Agents MUST NEVER invent data, functions, or other agents that don't exist.**

### 📋 Details

LLM agents can only use what exists in the codebase. No creativity allowed for:

- Function names
- Agent names
- Product data
- Customer data
- URLs or links

### 🎯 What Agents CAN Use

**Router Agent** can call ONLY these 5 specialist agents:

1. ✅ `productSearchAgent({ query: "..." })`
2. ✅ `cartManagementAgent({ query: "..." })`
3. ✅ `orderTrackingAgent({ query: "..." })`
4. ✅ `profileManagementAgent({ query: "..." })`
5. ✅ `customerSupportAgent({ query: "..." })`

**NO OTHER AGENTS EXIST** - Router cannot invent `paymentAgent`, `shippingAgent`, etc.

### 🎯 Function Registry

**Source of Truth**: `backend/src/config/agent-functions.config.ts`

Each agent has LIMITED function set. Check config file before calling ANY function.

### ⚠️ Common Violations

❌ **WRONG**: Router invents non-existent agent

```javascript
paymentAgent({ query: "metodi di pagamento" }) // ❌ DOESN'T EXIST!
```

✅ **CORRECT**: Router uses FAQ or delegates to existing agent

```javascript
// Check FAQ for payment info OR delegate to customerSupportAgent
```

❌ **WRONG**: Product Agent invents function

```javascript
addToCart({ code: "PARM-001" }) // ❌ Product Agent doesn't have this function!
```

✅ **CORRECT**: Product Agent uses delegation pattern

```javascript
🛒 DELEGATE_TO_CART: add PARM-001 quantity 1
// Router intercepts and calls cartManagementAgent
```

### 📋 Validation Rules

1. ✅ **Check agent-functions.config.ts** - Only call functions listed for your agent type
2. ✅ **Check defaultAgents.ts** - Only 7 agents exist (Router + 5 specialists + Safety)
3. ✅ **Use delegation patterns** - Specialists never call each other directly
4. ✅ **Return error** - If function doesn't exist, tell user it's not possible

---

## �📖 Related Documentation

````

- `.specify/memory/constitution.md` - Complete project constitution (14 principles)
- `docs/LLM_AGENTS_TREE.md` - Agent architecture tree with all functions
- `docs/MULTI_AGENT_FLOW_COMPLETE.md` - 13-step request flow guide
- `backend/src/config/agent-functions.ts` - Function registry (source of truth)
- `docs/prompts/*.md` - Individual agent prompts

---

**End of Prompt Engineering Rules v1.0.0**

## 16. Pricing Display Strategy

### ✅ RULE

**Product Agent MUST ALWAYS show discounted prices when available, with clear visual hierarchy.**

### �� Details

When displaying products with discounts:
1. ✅ Show original price **strikethrough**: ~~€25.00~~
2. ✅ Show discounted price **bold**: **€20.00**
3. ✅ Show discount percentage: (20% OFF)
4. ✅ Use emoji 💰 or 🏷️

**Personal Discount {{discountUser}}%**:
- Explain ONLY when customer asks "che sconto ho?" OR sparingly (max 1/5 interactions)

### ⚠️ Critical: ALWAYS show both original + discounted prices

---

## 17. Promotional Messaging

### ✅ RULE

**Product Agent suggests offers SPARINGLY** (max 1 every 8 responses, only in natural contexts).

### 📋 When to Promote

✅ Generic questions: "cosa mi consigli?", "novità?"
✅ After showing products with active offers
❌ NEVER when customer asks specific product
❌ NEVER when customer frustrated

---

## 18. Numbered List Pattern

### ✅ RULE

**When showing 2-8 items: ALWAYS use numbered lists.**

### 📋 Why

1. Customer replies with "1", "2", "3"
2. Router interprets via CONFERMA pattern
3. Natural UX

### 🎯 Pattern

```markdown
1. **Parmigiano Reggiano DOP 1kg** - ~~€25.00~~ **€20.00** 💰 (20% OFF)
2. **Grana Padano DOP 1kg** - ~~€22.00~~ **€17.60** 💰

Reply with 1 or 2!
```

**>8 items**: Progressive filtering first (Regola 11) → then numbered list
````
