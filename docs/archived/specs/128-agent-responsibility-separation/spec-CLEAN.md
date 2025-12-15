# Spec - Agent Responsibility Separation (CLEAN VERSION)

**Feature**: Agent Responsibility Separation & Context Interpretation Pattern  
**Branch**: `174-router`  
**Status**: Ready for Implementation  
**Last Updated**: 17 November 2025  
**Database Changes**: ZERO (uses existing fields and AgentTypes)

---

## 🎯 Overview

Refactor LLM agent architecture to enforce strict separation of responsibilities using **ONLY existing database resources**. No new agents, no new tables, no new fields.

### Current Problems

1. **Router Agent Overload** - Router has {{FAQ}}, {{OFFERS}}, manageNotifications CF (8k tokens)
2. **Short Response Ambiguity** - Sub-agents receive "SI" without context
3. **Scattered Responsibilities** - Profile/notification logic mixed in Router
4. **Non-Deterministic Routing** - Temperature 0.3 causes inconsistent delegations

### Solution (Using Existing Resources!)

1. **Strip Router to Pure Orchestration** - Keep {{FAQ}}, remove {{OFFERS}}, remove manageNotifications
2. **Use NOTIFICATIONS Agent** - AgentType already exists (order: 7)
3. **Use PROFILE_MANAGEMENT Agent** - AgentType already exists (order: 6)
4. **Context Interpretation Pattern** - Universal pattern for all agents
5. **ZERO Database Changes** - Use existing fields: `push_notifications_consent`, `push_notifications_consent_at`

---

## 📊 Agent Responsibility Matrix (REAL - Using Existing AgentTypes!)

| Agent                  | AgentType (DB)       | Current State                                       | Target State                                    | Variables                                                    | Calling Functions                   |
| ---------------------- | -------------------- | --------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------ | ----------------------------------- |
| **Router**             | `ROUTER`             | 8k tokens, {{FAQ}}, {{OFFERS}}, manageNotifications | 2k tokens, {{FAQ}} only, context interpretation | {{FAQ}}, {{CUSTOMER_INFO}}                                   | All delegation functions            |
| **Product & Services** | `PRODUCT_SEARCH`     | {{PRODUCTS}}, {{CATEGORIES}}, {{SERVICES}}          | Add {{OFFERS}}                                  | {{PRODUCTS}}, {{OFFERS}}, {{CATEGORIES}}, {{SERVICES}}       | searchProducts, getCategoryDetails  |
| **Profile Management** | `PROFILE_MANAGEMENT` | Basic profile updates                               | Add notification variables                      | {{pushNotificationsConsent}}, {{pushNotificationsConsentAt}} | updateProfile, getProfileLink       |
| **Notifications**      | `NOTIFICATIONS`      | Not fully utilized                                  | Push notification management                    | {{pushNotificationsConsent}}, {{pushNotificationsConsentAt}} | handlePushNotification              |
| **Cart Management**    | `CART_MANAGEMENT`    | Working correctly                                   | No changes                                      | {{CART_ITEMS}}                                               | addToCart, removeFromCart, viewCart |
| **Order Tracking**     | `ORDER_TRACKING`     | Working correctly                                   | No changes                                      | {{RECENT_ORDERS}}                                            | getOrderStatus, getOrderTracking    |
| **Customer Support**   | `CUSTOMER_SUPPORT`   | Working correctly                                   | No changes                                      | -                                                            | escalateToHuman                     |

---

## 👥 User Stories

### US1: Context Interpretation Pattern (Universal)

**As a** customer  
**I want** the chatbot to understand my short responses ("SI", "NO", "2")  
**So that** I don't have to repeat full context every time

**Acceptance Criteria**:

- ✅ Router reads conversation history (last 10 minutes)
- ✅ Router extracts context from last assistant message
- ✅ Router builds explicit message: "L'utente conferma che vuole aggiungere LATT-042 al carrello"
- ✅ Router delegates to SAME agent that asked the question
- ✅ Pattern applies to ALL agents (Cart, Order, Product, Profile, Notifications)

**Example Flow**:

```
1. Product Agent: "Vuoi aggiungere Burrata 250g (LATT-042) al carrello?"
2. Customer: "SI"
3. Router: Reads history, extracts product LATT-042, action "add to cart"
4. Router → Cart Agent: "L'utente conferma che vuole aggiungere il prodotto LATT-042 (Burrata 250g) al carrello"
5. Cart Agent: Adds product and confirms
```

---

### US2: Push Notification Management (Use Existing NOTIFICATIONS Agent)

**As a** customer  
**I want** to subscribe/unsubscribe from push notifications  
**So that** I control promotional messages

**Acceptance Criteria**:

- ✅ Router delegates notification requests to NOTIFICATIONS agent (AgentType exists!)
- ✅ NOTIFICATIONS agent shows current status using {{pushNotificationsConsent}}
- ✅ NOTIFICATIONS agent shows subscription date using {{pushNotificationsConsentAt}}
- ✅ NOTIFICATIONS agent asks confirmation before changing subscription
- ✅ handlePushNotification CF updates `push_notifications_consent` and `push_notifications_consent_at` (fields exist!)
- ✅ After change, provides profile link: [LINK_PROFILE_WITH_TOKEN]

**Example Flow**:

```
1. Customer: "Voglio disattivare le notifiche"
2. Router → Notifications Agent: "L'utente vuole disattivare le notifiche"
3. Notifications Agent: "Attualmente sei iscritto dal 12 novembre 2025. Confermi di voler disattivare?"
4. Customer: "SI"
5. Router → Notifications Agent: "L'utente conferma che vuole disattivare le notifiche promozionali"
6. Notifications Agent: Calls handlePushNotification(value: false)
7. Database: push_notifications_consent = false, push_notifications_consent_at = null
8. Notifications Agent: "Notifiche disattivate. Link profilo: [LINK_PROFILE_WITH_TOKEN]"
```

---

### US3: Profile Preference Display (Use Existing PROFILE_MANAGEMENT Agent)

**As a** customer  
**I want** to view my notification preferences in my profile  
**So that** I know my current subscription status

**Acceptance Criteria**:

- ✅ PROFILE_MANAGEMENT agent displays {{pushNotificationsConsent}} (yes/no)
- ✅ PROFILE_MANAGEMENT agent displays {{pushNotificationsConsentAt}} (date or "mai iscritto")
- ✅ For notification changes, PROFILE_MANAGEMENT redirects to NOTIFICATIONS agent
- ✅ Variables use existing fields: `push_notifications_consent`, `push_notifications_consent_at`

---

### US4: Router FAQ Handling (Keep Existing Behavior)

**As a** customer  
**I want** to ask general questions (hours, contact, policies)  
**So that** I get quick answers from FAQ database

**Acceptance Criteria**:

- ✅ Router keeps {{FAQ}} variable (no delegation needed!)
- ✅ Router answers FAQ questions directly (no sub-agent call)
- ✅ Router remains under 2.5k tokens with FAQ included

---

### US5: Product Offers Display (Move from Router)

**As a** customer  
**I want** to see active offers when searching products  
**So that** I don't miss promotional deals

**Acceptance Criteria**:

- ✅ {{OFFERS}} removed from Router
- ✅ {{OFFERS}} added to Product & Services Agent
- ✅ Product Agent shows offers only when relevant to query
- ✅ Variable uniqueness enforced ({{OFFERS}} appears only once per prompt)

---

## ⚙️ Functional Requirements

### FR1: Context Interpretation Logic (Router)

**Requirement**: Router MUST interpret short user responses before delegation

**Implementation**:

1. Detect short response patterns: "SI", "yes", "ok", "no", "1", "2", "3", "grazie"
2. Read conversation history (last 10 minutes)
3. Extract context:
   - Last assistant message
   - Agent that sent message
   - Action being confirmed (add to cart, disable notifications, etc.)
   - Product/order/setting details
4. Build explicit message combining context + user response
5. Delegate to SAME specialist agent with complete message

**Edge Cases**:

- If no conversation history → Treat as new query, delegate normally
- If ambiguous context → Ask clarification before delegating
- If multiple actions in history → Use most recent (chronological order)

---

### FR2: Push Notification Subscription (NOTIFICATIONS Agent)

**Requirement**: NOTIFICATIONS agent manages subscription using existing database fields

**Database Fields** (EXIST!):

```prisma
model Customers {
  // ... existing fields
  push_notifications_consent    Boolean   @default(false)  // ✅ EXISTS
  push_notifications_consent_at DateTime?                  // ✅ EXISTS
  // ...
}
```

**Variables**:

- `{{pushNotificationsConsent}}` → "yes" if `push_notifications_consent === true`, else "no"
- `{{pushNotificationsConsentAt}}` → Italian date format "12 novembre 2025" if `push_notifications_consent_at` exists, else "mai iscritto"

**Calling Function**:

```typescript
handlePushNotification(value: boolean)
// value = true → Subscribe (set consent = true, consent_at = new Date())
// value = false → Unsubscribe (set consent = false, consent_at = null)
```

**Workspace Isolation**: All queries filtered by `workspaceId`

---

### FR3: Router Prompt Optimization

**Requirement**: Router prompt MUST be < 2.5k tokens

**Current**: ~8k tokens (too large!)
**Target**: < 2.5k tokens

**Removals**:

- ❌ {{OFFERS}} → Move to Product Agent
- ❌ manageNotifications CF → Move to Notifications Agent
- ❌ Verbose examples → Keep only essential ones

**Additions**:

- ✅ Context interpretation logic
- ✅ Delegation to profileManagementAgent
- ✅ Delegation to notificationsAgent

**Keep**:

- ✅ {{FAQ}} variable (Router answers FAQ directly)
- ✅ Customer info variables

---

### FR4: Variable Uniqueness Enforcement (Principle XI)

**Requirement**: Large variables ({{PRODUCTS}}, {{OFFERS}}, {{FAQ}}) MUST appear only once per prompt

**Validation Script**: `backend/scripts/validate-agent-prompts.ts`

**Logic**:

```typescript
const largeVariables = ['PRODUCTS', 'OFFERS', 'SERVICES', 'CATEGORIES', 'FAQ']
for each prompt file:
  for each large variable:
    if variable appears > 1 time:
      throw error "Variable {{X}} appears multiple times"
```

**Why**: Each variable can inject 50k+ tokens. Duplicates cause 100k+ prompts → LLM API failure

---

## 🔒 Non-Functional Requirements

### NFR1: Security - Workspace Isolation

**Requirement**: ALL database queries MUST filter by `workspaceId`

**Pattern**:

```typescript
await prisma.customers.update({
  where: {
    id: customerId,
    workspaceId // ✅ ALWAYS include this!
  },
  data: { ... }
})
```

**Enforcement**:

- Security tests verify workspace isolation
- 3-layer middleware: authMiddleware → sessionValidationMiddleware → validateWorkspaceOperation

---

### NFR2: Performance - Router Determinism

**Requirement**: Router MUST be deterministic for consistent routing

**Implementation**:

- Temperature: 0.2 (from 0.3)
- Max tokens: 2048
- Model: gpt-4o-mini (fast, low-cost)

**Why**: Temperature 0.2 ensures same query → same delegation (predictable behavior)

---

### NFR3: Maintainability - Zero Database Inventions

**Requirement**: Use ONLY existing database resources

**Forbidden**:

- ❌ Creating new fields (isSubscribed, etc.)
- ❌ Creating new AgentType enum values (FAQ_AGENT, PROFILE_AGENT)
- ❌ Creating new tables
- ❌ Creating new migrations

**Allowed**:

- ✅ Using existing fields (push_notifications_consent, push_notifications_consent_at)
- ✅ Using existing AgentTypes (ROUTER, PROFILE_MANAGEMENT, NOTIFICATIONS, PRODUCT_SEARCH)
- ✅ Updating existing agent prompts
- ✅ Adding new variables that map to existing fields

---

### NFR4: Testability - Comprehensive Coverage

**Requirement**: Test coverage >80% on new code

**Test Types**:

1. **Unit Tests**:

   - Router context interpretation logic
   - Variable replacement ({{pushNotificationsConsent}}, {{pushNotificationsConsentAt}})
   - handlePushNotification CF

2. **Integration Tests**:

   - End-to-end context interpretation flow
   - Notification subscription flow
   - Profile preference display

3. **Security Tests**:
   - Workspace isolation in all agents
   - handlePushNotification CF validation

---

## 🧪 Test Requirements

### Test Case 1: Context Interpretation - Cart Confirmation

**Given**: Product Agent asked "Vuoi aggiungere Burrata 250g al carrello?"  
**When**: Customer replies "SI"  
**Then**:

- Router reads conversation history
- Router extracts: Agent = Product, Action = add to cart, Product = LATT-042
- Router delegates to Cart Agent: "L'utente conferma che vuole aggiungere il prodotto LATT-042 (Burrata 250g) al carrello"
- Cart Agent adds product successfully

---

### Test Case 2: Context Interpretation - Number Selection

**Given**: Product Agent shows list "1. Parmigiano, 2. Grana, 3. Pecorino"  
**When**: Customer replies "2"  
**Then**:

- Router reads conversation history
- Router extracts: Selection = number 2 (Grana Padano)
- Router delegates to Product Agent: "L'utente ha scelto il numero 2 dalla lista precedente: Grana Padano DOP"
- Product Agent provides Grana Padano details

---

### Test Case 3: Push Notification Subscription

**Given**: Customer is NOT subscribed (push_notifications_consent = false)  
**When**: Customer says "Voglio attivare le notifiche"  
**Then**:

- Router delegates to Notifications Agent
- Notifications Agent shows current status: "Attualmente NON sei iscritto"
- Notifications Agent asks confirmation: "Vuoi attivare le notifiche?"
- Customer replies "SI"
- Router interprets: "L'utente conferma che vuole attivare le notifiche"
- Notifications Agent calls handlePushNotification(value: true)
- Database updated: push_notifications_consent = true, push_notifications_consent_at = now()
- Response includes profile link

---

### Test Case 4: Push Notification Unsubscription

**Given**: Customer IS subscribed (push_notifications_consent = true, consent_at = "12 novembre 2025")  
**When**: Customer says "Disattiva notifiche"  
**Then**:

- Router delegates to Notifications Agent
- Notifications Agent shows: "Sei iscritto dal 12 novembre 2025"
- Notifications Agent asks confirmation
- After "SI", calls handlePushNotification(value: false)
- Database updated: push_notifications_consent = false, push_notifications_consent_at = null

---

### Test Case 5: Workspace Isolation

**Given**: Two customers in different workspaces  
**When**: Customer A tries to access Customer B's notification settings  
**Then**:

- handlePushNotification CF validates workspaceId
- Query fails: `Customer not found in workspace`
- No cross-workspace data leakage

---

## 🔄 Migration Strategy

### NO DATABASE MIGRATION NEEDED! ✅

Everything already exists:

- ✅ `push_notifications_consent` field (Customers table)
- ✅ `push_notifications_consent_at` field (Customers table)
- ✅ `ROUTER` AgentType
- ✅ `PROFILE_MANAGEMENT` AgentType
- ✅ `NOTIFICATIONS` AgentType
- ✅ `PRODUCT_SEARCH` AgentType

**Only Code Changes**:

1. Update agent prompts
2. Update seed data (defaultAgents.ts)
3. Add variable replacement logic
4. Implement handlePushNotification CF (may already exist)
5. Update LLM Router delegation

---

## 📋 Implementation Checklist

### Constitution & Architecture

- [ ] Update `.specify/memory/constitution.md` to v2.1.0 (Principle XIV)
- [ ] NO database migration (confirm fields exist)

### Router Agent

- [ ] Create `router-agent-CLEAN.md` prompt (<2.5k tokens)
- [ ] Remove {{OFFERS}} from Router
- [ ] Keep {{FAQ}} in Router
- [ ] Add context interpretation logic
- [ ] Set temperature to 0.2
- [ ] Add delegation to profileManagementAgent
- [ ] Add delegation to notificationsAgent
- [ ] Remove manageNotifications CF

### Notifications Agent

- [ ] Create/update `notifications-agent.md` prompt
- [ ] Add {{pushNotificationsConsent}} variable
- [ ] Add {{pushNotificationsConsentAt}} variable
- [ ] Implement handlePushNotification CF (use existing fields!)
- [ ] Register CF in CallingFunctionsService
- [ ] Seed NOTIFICATIONS agent (AgentType exists!)

### Profile Management Agent

- [ ] Create/update `profile-management-agent.md` prompt
- [ ] Add {{pushNotificationsConsent}} variable
- [ ] Add {{pushNotificationsConsentAt}} variable
- [ ] Redirect notification changes to Notifications Agent
- [ ] Seed PROFILE_MANAGEMENT agent (AgentType exists!)

### Product & Services Agent

- [ ] Add {{OFFERS}} section to prompt
- [ ] Validate variable uniqueness (only one {{OFFERS}})

### Variable Replacement

- [ ] Add {{pushNotificationsConsent}} replacement logic (PromptProcessorService)
- [ ] Add {{pushNotificationsConsentAt}} replacement logic
- [ ] Use existing fields: `push_notifications_consent`, `push_notifications_consent_at`

### Testing

- [ ] Unit tests: Router context interpretation
- [ ] Unit tests: Variable replacement
- [ ] Unit tests: handlePushNotification CF
- [ ] Integration tests: Context interpretation flow
- [ ] Integration tests: Notification subscription flow
- [ ] Security tests: Workspace isolation
- [ ] Security tests: CF validation

### Documentation

- [ ] Create NOTIFICATIONS_AGENT.md architecture doc
- [ ] Create PROFILE_MANAGEMENT_AGENT.md architecture doc
- [ ] Create CONTEXT_INTERPRETATION_PATTERN.md
- [ ] Update PRD with new architecture
- [ ] Update README with agent list

---

## ✅ Success Criteria

1. ✅ **Router prompt < 2.5k tokens** - Validated by script
2. ✅ **Router temperature = 0.2** - Deterministic routing
3. ✅ **Context interpretation works** - All agents receive explicit messages
4. ✅ **Notification subscription works** - handlePushNotification CF updates database
5. ✅ **Variable replacement works** - {{pushNotificationsConsent}}, {{pushNotificationsConsentAt}}
6. ✅ **Zero database changes** - No new fields, no new AgentTypes, no migrations
7. ✅ **All tests pass** - Unit + Integration + Security >80% coverage
8. ✅ **Workspace isolation enforced** - All queries filtered by workspaceId

---

## 🚀 Rollback Plan

If critical issues arise:

1. **Revert Router Prompt**:

   ```sql
   UPDATE agentConfig SET systemPrompt = '<old-router-prompt>', temperature = 0.3 WHERE type = 'ROUTER';
   ```

2. **Restore {{OFFERS}} to Router** (if needed):

   - Re-add {{OFFERS}} to Router prompt
   - Remove from Product Agent

3. **No Database Rollback Needed** - We didn't change anything! ✅

---

**Spec Status**: Ready for Implementation ✅  
**Database Changes**: ZERO ✅  
**Uses Only Existing Resources**: Verified ✅  
**Created**: 17 November 2025
