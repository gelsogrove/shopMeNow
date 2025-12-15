# Spec: Agent Responsibility Separation (LLM Architecture Refactoring)

**Feature ID**: 128  
**Created**: 2025-11-17  
**Status**: Draft  
**Priority**: CRITICAL  
**Estimated Effort**: 3 days  
**Owner**: Andrea

---

## 📋 Overview

Refactor the LLM agent architecture to enforce **strict separation of responsibilities** per the constitution's Principle XIII. Current Router Agent is overloaded with business logic (FAQ, offers, subscriptions) that should be delegated to specialist agents.

**Core Problem**: Router Agent has ~8k token prompts with {{OFFERS}}, FAQ logic, and subscription management → violates "Pure Orchestration" principle.

**Solution**: Split responsibilities across dedicated agents:

- **Router Agent** → ONLY routing + conversation history (target: 2k tokens)
- **FAQ Agent** → Handles general questions (NEW)
- **Profile Agent** → Manages user preferences, subscriptions, profile links (NEW)
- **Product & Services Agent** → Expands to include {{OFFERS}} (currently only products/services)

---

## 🎯 Goals

### Primary Goals

1. **Router Agent Cleanup**: Strip Router to pure orchestration (routing + history only)
2. **FAQ Separation**: Create dedicated FAQ Agent for general questions
3. **Profile Management**: Create Profile Agent for user preferences/subscriptions
4. **Offers Consolidation**: Move {{OFFERS}} from Router to Product & Services Agent
5. **Constitution Alignment**: Update Principle XIII with new architecture rules

### Success Metrics

- Router Agent prompt size: **< 2.5k tokens** (currently ~8k)
- FAQ Agent response time: **< 1.5s** average
- Profile Agent subscription flow: **100% confirmation before action**
- Zero {{OFFERS}} duplication across agents
- All 12 rules from Principle XIII enforced

---

## 👥 User Stories

### Story 1: Clean Router Delegation

**As a** system architect  
**I want** Router Agent to ONLY route and maintain history  
**So that** each specialist agent has clear, non-overlapping responsibilities

**Acceptance Criteria**:

- [ ] Router Agent prompt contains ZERO business logic variables (no {{OFFERS}}, no {{FAQ}})
- [ ] Router Agent temperature = 0.2 (deterministic routing)
- [ ] Router delegates FAQ questions to FAQ Agent
- [ ] Router delegates profile/subscription to Profile Agent
- [ ] Conversation history includes last 5 minutes per customer

### Story 2: FAQ Agent Handling

**As a** customer  
**I want** quick answers to general questions (hours, contact, policies)  
**So that** I don't need to wait for human support

**Acceptance Criteria**:

- [ ] FAQ Agent has {{FAQ}} variable from database
- [ ] FAQ Agent temperature = 0.3 (slightly creative but precise)
- [ ] FAQ Agent has ZERO calling functions (text responses only)
- [ ] Router delegates FAQ-type questions to FAQ Agent
- [ ] FAQ responses in customer's language (translation layer)

### Story 3: Profile & Subscription Management

**As a** customer  
**I want** to manage my notification preferences and profile  
**So that** I can control what messages I receive

**Acceptance Criteria**:

- [ ] Profile Agent has `{{isSubscribed}}` variable (yes/no)
- [ ] Profile Agent has `handlePushNotification(value: boolean)` CF
- [ ] Profile Agent has `getProfileLink(token)` CF
- [ ] Subscription flow: LLM asks confirmation → user confirms → CF called
- [ ] Profile Agent shows "already subscribed" if `{{isSubscribed}} = yes`
- [ ] Profile Agent temperature = 0.5 (conversational but precise)

### Story 4: Offers in Product Search

**As a** customer searching products  
**I want** to see active offers related to my search  
**So that** I can take advantage of promotions

**Acceptance Criteria**:

- [ ] Product & Services Agent has {{OFFERS}} variable
- [ ] {{OFFERS}} removed from Router Agent
- [ ] Zero duplication: {{OFFERS}} appears ONLY in Product & Services Agent
- [ ] Offers shown contextually during product search
- [ ] Validate-prompts script catches {{OFFERS}} duplication

---

## 🏗️ Architecture

### Agent Responsibility Matrix

| Agent                  | Responsibilities           | Variables                                              | Calling Functions                                                   | Temperature |
| ---------------------- | -------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------- | ----------- |
| **Router**             | Routing, History           | (none)                                                 | productServicesAgent, cartAgent, orderAgent, faqAgent, profileAgent | 0.2         |
| **FAQ** (NEW)          | General questions          | {{FAQ}}                                                | (none)                                                              | 0.3         |
| **Profile** (NEW)      | Preferences, Subscriptions | {{isSubscribed}}, {{nameUser}}, {{email}}              | handlePushNotification, getProfileLink                              | 0.5         |
| **Product & Services** | Products, Services, Offers | {{PRODUCTS}}, {{SERVICES}}, {{CATEGORIES}}, {{OFFERS}} | searchProducts, addToCart                                           | 0.7         |
| **Cart Management**    | Cart operations            | (cart data)                                            | addProduct, resetCart, getCartLink                                  | 0.5         |
| **Order Tracking**     | Order status               | (order data)                                           | getOrderStatus, getOrderLink                                        | 0.5         |
| **Customer Support**   | Complex support            | (support data)                                         | createTicket                                                        | 0.6         |

### Data Flow

```
Customer Message
    ↓
Router Agent (history + routing decision)
    ↓
┌───────────────┬─────────────┬──────────────┬─────────────┐
│   FAQ Agent   │   Profile   │  Product &   │    Cart     │
│               │   Agent     │   Services   │  Management │
└───────────────┴─────────────┴──────────────┴─────────────┘
    ↓
Response (via Router validation)
    ↓
Customer
```

### New Database Fields

```prisma
model Customer {
  // ... existing fields
  isSubscribed Boolean @default(false)  // NEW: Push notification subscription status
}
```

### New Calling Functions

```typescript
// Profile Agent CF
interface HandlePushNotificationParams {
  value: boolean // true = subscribe, false = unsubscribe
}

// Returns: { success: boolean, message: string, isSubscribed: boolean }
```

---

## 📝 Functional Requirements

### FR-1: Router Agent Refactoring

**Priority**: CRITICAL  
**Description**: Strip Router Agent to pure routing logic

**Requirements**:

1. Remove {{OFFERS}} from Router prompt
2. Remove {{FAQ}} from Router prompt
3. Remove manageNotifications CF from Router
4. Keep ONLY conversation history (5 min window per customer)
5. Add delegation to faqAgent and profileAgent
6. Set temperature to 0.2
7. Target prompt size: < 2.5k tokens

### FR-2: FAQ Agent Creation

**Priority**: HIGH  
**Description**: Create dedicated FAQ Agent for general questions

**Requirements**:

1. Create `docs/prompts/faq-agent.md` with {{FAQ}} variable
2. Agent type: FAQ_AGENT (new enum value)
3. Temperature: 0.3
4. Zero calling functions (text responses only)
5. Add to `defaultAgents.ts` seed data
6. Router delegates "general question" pattern to FAQ Agent

### FR-3: Profile Agent Creation

**Priority**: CRITICAL  
**Description**: Create Profile Agent for user preferences/subscriptions

**Requirements**:

1. Create `docs/prompts/profile-agent.md`
2. Variables: {{isSubscribed}}, {{nameUser}}, {{email}}
3. Calling Functions:
   - `handlePushNotification(value: boolean)`
   - `getProfileLink(token: string)`
4. Agent type: PROFILE_AGENT (new enum value)
5. Temperature: 0.5
6. Add to `defaultAgents.ts` seed data
7. Implement confirmation flow: ask → user confirms → CF call

### FR-4: Product & Services Agent Expansion

**Priority**: HIGH  
**Description**: Add {{OFFERS}} to Product & Services Agent

**Requirements**:

1. Add {{OFFERS}} variable to `product-services-search-agent.md`
2. Verify no {{OFFERS}} duplication (validate-prompts check)
3. Show offers contextually during product search
4. Keep existing {{PRODUCTS}}, {{SERVICES}}, {{CATEGORIES}}
5. No temperature change (stays 0.7)

### FR-5: Constitution Update

**Priority**: CRITICAL  
**Description**: Update constitution Principle XIII with new architecture

**Requirements**:

1. Document new agent responsibilities matrix
2. Add "FAQ Agent Separation" rule
3. Add "Profile Agent Subscription Pattern" rule
4. Update "Router Pure Orchestration" rule (now delegates FAQ + Profile)
5. Version bump: 2.0.0 → 2.1.0 (MINOR - adds agents, doesn't break existing)

### FR-6: Database Schema Update

**Priority**: MEDIUM  
**Description**: Add isSubscribed field to Customer model

**Requirements**:

1. Migration: Add `isSubscribed Boolean @default(false)` to Customer
2. Seed update: Set existing customers to `isSubscribed: false`
3. Update CustomerRepository to expose isSubscribed
4. Add to customer variables replacement in PromptProcessorService

---

## 🚫 Non-Functional Requirements

### NFR-1: Performance

- FAQ Agent response time: < 1.5s (p95)
- Profile Agent subscription flow: < 2s total (confirmation + CF call)
- Router delegation overhead: < 200ms
- Zero latency regression vs current system

### NFR-2: Token Optimization

- Router Agent: < 2.5k tokens per request (currently ~8k)
- Total system tokens: -20% reduction (remove duplication)
- {{OFFERS}} appears EXACTLY once (Product & Services Agent)
- Validate-prompts script catches violations

### NFR-3: Reliability

- Subscription confirmation: 100% user confirmation before action
- Profile Agent shows correct {{isSubscribed}} status
- Zero CF calls without explicit user confirmation
- Timeline integrity: every agent call logged in debugInfo

### NFR-4: Maintainability

- Each agent prompt in separate file (docs/prompts/\*.md)
- Agent configs in `defaultAgents.ts` (single source of truth)
- Constitution Principle XIII documents architecture
- Agent responsibility matrix in constitution

---

## 🧪 Test Requirements

### Unit Tests

- [ ] `router-agent-delegation.spec.ts`: Router delegates FAQ to FAQ Agent
- [ ] `router-agent-delegation.spec.ts`: Router delegates subscription to Profile Agent
- [ ] `faq-agent.spec.ts`: FAQ Agent handles general questions with {{FAQ}}
- [ ] `profile-agent-subscription.spec.ts`: Profile Agent asks confirmation before CF
- [ ] `profile-agent-subscription.spec.ts`: Profile Agent shows "already subscribed" if true
- [ ] `product-services-offers.spec.ts`: Product Agent includes {{OFFERS}} in response
- [ ] `validate-prompts.spec.ts`: Catches {{OFFERS}} duplication across agents

### Integration Tests

- [ ] `subscription-flow.integration.spec.ts`: Full subscription flow (Router → Profile → CF → DB)
- [ ] `faq-flow.integration.spec.ts`: FAQ question flow (Router → FAQ → response)
- [ ] `offers-display.integration.spec.ts`: Offers shown during product search

### Manual Tests

- [ ] User asks "what are your hours?" → FAQ Agent responds
- [ ] User says "I want offers" → Profile Agent asks confirmation → subscribes
- [ ] User already subscribed says "subscribe" → Profile Agent says "already subscribed"
- [ ] User searches products → sees {{OFFERS}} in Product Agent response
- [ ] Router prompt validated: < 2.5k tokens, zero {{OFFERS}}/{{FAQ}}

---

## 🔄 Migration Strategy

### Phase 1: Constitution & Schema (Day 1)

1. Update constitution Principle XIII
2. Add isSubscribed migration
3. Run migration + seed update
4. Deploy schema changes

### Phase 2: New Agents (Day 2)

1. Create FAQ Agent prompt + seed
2. Create Profile Agent prompt + CF + seed
3. Update Product & Services Agent (add {{OFFERS}})
4. Deploy new agent configs

### Phase 3: Router Refactoring (Day 2-3)

1. Strip Router Agent prompt
2. Add FAQ Agent delegation
3. Add Profile Agent delegation
4. Set temperature to 0.2
5. Deploy Router changes

### Phase 4: Testing & Validation (Day 3)

1. Run unit tests
2. Run integration tests
3. Manual WhatsApp flow tests
4. Validate prompt sizes (< 2.5k Router)
5. Validate zero {{OFFERS}} duplication

---

## 📊 Validation Checklist

Before deployment:

- [ ] Constitution updated (Principle XIII v2.1.0)
- [ ] Router Agent prompt < 2.5k tokens
- [ ] FAQ Agent created with {{FAQ}}
- [ ] Profile Agent created with {{isSubscribed}}, handlePushNotification CF
- [ ] Product & Services Agent has {{OFFERS}}
- [ ] Zero {{OFFERS}} duplication (validate-prompts passes)
- [ ] Migration adds isSubscribed to Customer
- [ ] Seed populates new agents (FAQ + Profile)
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual subscription flow works (confirmation required)
- [ ] Timeline integrity maintained (debugInfo shows all agents)

---

## 🚨 Edge Cases

1. **User already subscribed tries to subscribe again**

   - Profile Agent checks {{isSubscribed}}
   - Response: "You're already subscribed to our notifications! 📬"
   - No CF call, no duplicate subscription

2. **User asks FAQ during product search**

   - Router detects FAQ pattern
   - Delegates to FAQ Agent (NOT Product Agent)
   - Ensures FAQ takes priority

3. **User says "yes" after Profile Agent confirmation**

   - Profile Agent calls handlePushNotification(true)
   - Updates Customer.isSubscribed = true
   - Response: "✅ Subscription confirmed!"

4. **User asks about offers during product search**

   - Router delegates to Product & Services Agent
   - Product Agent shows {{OFFERS}} contextually
   - Zero Router involvement (delegated entirely)

5. **Migration for existing customers**
   - All existing customers: isSubscribed = false (default)
   - First subscription request updates to true
   - Rollback strategy: set all to previous state

---

## 📚 References

- Constitution Principle XIII: LLM Message Flow Priority System
- Constitution Principle III: Variable Uniqueness Constraint
- AGENT_ARCHITECTURE_RULES.md: Regola III (Router Responsibility)
- `docs/prompts/router-agent-REFACTORED.md`: Current Router implementation
- `backend/src/application/services/llm-router.service.ts`: Router orchestration logic

---

## 🔗 Dependencies

- Prisma migration for isSubscribed field
- New CF implementation: handlePushNotification
- Seed data update: defaultAgents.ts
- PromptProcessorService: Add {{isSubscribed}} variable replacement
- Validate-prompts script: Check {{OFFERS}} duplication

---

## ✅ Definition of Done

- [ ] Constitution Principle XIII updated (v2.1.0)
- [ ] Router Agent < 2.5k tokens, temperature 0.2
- [ ] FAQ Agent created, seeded, functional
- [ ] Profile Agent created with CFs, seeded, functional
- [ ] Product & Services Agent has {{OFFERS}}
- [ ] isSubscribed migration applied
- [ ] All tests pass (unit + integration + manual)
- [ ] Validate-prompts script passes (zero duplication)
- [ ] Debug timeline shows all agent interactions
- [ ] Deployment successful
- [ ] Andrea approves architecture changes

---

**Notes**: This is a CRITICAL architectural refactoring. Every agent must have clear, non-overlapping responsibilities per constitution rules. Zero room for ambiguity or shared logic between agents.
