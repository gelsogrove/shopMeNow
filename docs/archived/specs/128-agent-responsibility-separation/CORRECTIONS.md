# Correzioni al Plan.md - Usare SOLO Campi Database Esistenti

## 🎯 REALTÀ DEL DATABASE (Verificata 17 Nov 2025)

**Customer Model** - Campi ESISTENTI:

```prisma
model Customers {
  // ... existing fields
  push_notifications_consent    Boolean   @default(false)  ✅ ESISTE
  push_notifications_consent_at DateTime?                  ✅ ESISTE
  // ...
}
```

**AgentType Enum** - Valori ESISTENTI:

```prisma
enum AgentType {
  ROUTER                // ✅ ESISTE - order: 0 - Intent classification + FAQ
  PRODUCT_SEARCH        // ✅ ESISTE - order: 2 - Product search specialist
  CART_MANAGEMENT       // ✅ ESISTE - order: 3 - Cart operations
  ORDER_TRACKING        // ✅ ESISTE - order: 4 - Order viewing
  CUSTOMER_SUPPORT      // ✅ ESISTE - order: 5 - Support & escalation
  PROFILE_MANAGEMENT    // ✅ ESISTE - order: 6 - Profile modifications
  NOTIFICATIONS         // ✅ ESISTE - order: 7 - Push notifications
  SAFETY_TRANSLATION    // ✅ ESISTE - order: 99 - Safety + translation
  CUSTOM                // ✅ ESISTE - order: 1, 8-98 - Custom agents
}
```

---

## ❌ COSA NON FARE (Andrea's Rules!)

1. ❌ **NO creare `isSubscribed`** - campo NON esiste, usiamo `push_notifications_consent`
2. ❌ **NO creare `FAQ_AGENT`** - AgentType NON esiste, usiamo `ROUTER` per FAQ
3. ❌ **NO creare `PROFILE_AGENT`** - AgentType NON esiste, usiamo `PROFILE_MANAGEMENT` esistente
4. ❌ **NO migration Customer** - campi già esistono!
5. ❌ **NO migration AgentType** - valori già esistono!
6. ❌ **NO inventare tabelle nuove** - usiamo SOLO quello che c'è!

---

## ✅ COSA FARE (Usare Esistenti)

### 1. Agent Type Mapping (Use Existing!)

| Plan Originale (SBAGLIATO)      | Database REALE (CORRETTO)                           |
| ------------------------------- | --------------------------------------------------- |
| ❌ `FAQ_AGENT` (non esiste)     | ✅ `ROUTER` (esiste - already handles FAQ!)         |
| ❌ `PROFILE_AGENT` (non esiste) | ✅ `PROFILE_MANAGEMENT` (esiste - perfect match!)   |
| ❌ Notifications in Router      | ✅ `NOTIFICATIONS` agent type (esiste - dedicated!) |

### 2. Variable Names (Use Existing Fields!)

| Plan Originale (SBAGLIATO) | Database REALE (CORRETTO)                                        |
| -------------------------- | ---------------------------------------------------------------- |
| ❌ `{{isSubscribed}}`      | ✅ `{{pushNotificationsConsent}}`                                |
| -                          | ✅ `{{pushNotificationsConsentAt}}` (bonus - subscription date!) |

### 3. Database Changes

**ZERO MIGRATION NEEDED!** ✅

Everything already exists:

- ✅ Customer fields exist
- ✅ AgentType enum values exist
- ✅ No new tables needed

---

## 📝 Plan.md Corrections Summary

### Phase 1: NO Migration - Only Prompt Updates

**OLD (WRONG)**:

```
Phase 1: Constitution + DB Migration
- Add isSubscribed to Customer
- Add FAQ_AGENT to AgentType
- Add PROFILE_AGENT to AgentType
```

**NEW (CORRECT)**:

```
Phase 1: Constitution Update + Use Existing Agents
- Update Constitution with Principle XIV (Context Interpretation)
- Use ROUTER for FAQ (already exists!)
- Use PROFILE_MANAGEMENT for profile/subscriptions (already exists!)
- Use NOTIFICATIONS for push notifications (already exists!)
- NO DATABASE CHANGES - everything exists!
```

### Phase 2: FAQ Handling (NO New Agent!)

**OLD (WRONG)**:

```
Create FAQ Agent (NEW)
- Create faq-agent.md prompt
- Create FAQAgentLLM class
- Seed FAQ_AGENT in database
```

**NEW (CORRECT)**:

```
Router Agent Already Handles FAQ! ✅
- Router AgentType comment: "order: 0 - Intent classification + FAQ"
- Router already has {{FAQ}} variable
- NO new agent needed - Router does this!
```

### Phase 3: Profile Management (Use Existing Agent!)

**OLD (WRONG)**:

```
Create Profile Agent (NEW)
- Create profile-agent.md prompt
- Create ProfileAgentLLM class
- Add PROFILE_AGENT to AgentType enum
- Seed PROFILE_AGENT in database
```

**NEW (CORRECT)**:

```
Use PROFILE_MANAGEMENT Agent (ALREADY EXISTS!) ✅
- AgentType: PROFILE_MANAGEMENT (order: 6)
- Update existing profile-management-agent.md prompt
- Add {{pushNotificationsConsent}} variable
- Add {{pushNotificationsConsentAt}} variable (bonus!)
- NO new agent - update existing one!
```

### Phase 4: Notifications (Use Existing Agent!)

**OLD (WRONG)**:

```
handlePushNotification CF in Profile Agent
```

**NEW (CORRECT)**:

```
Use NOTIFICATIONS Agent (ALREADY EXISTS!) ✅
- AgentType: NOTIFICATIONS (order: 7)
- Create notifications-agent.md prompt (if not exists)
- Add handlePushNotification CF
- Router delegates notification requests to NOTIFICATIONS agent
```

---

## 🔄 Revised Architecture

### Agent Responsibility Matrix (REAL)

| Agent Type                      | Responsibilities                                   | Variables                                                    | Calling Functions                   |
| ------------------------------- | -------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------- |
| **ROUTER** (exists)             | Intent classification, FAQ, Context interpretation | {{FAQ}}, {{CUSTOMER_INFO}}                                   | All delegation functions            |
| **PRODUCT_SEARCH** (exists)     | Product/service search, {{OFFERS}}                 | {{PRODUCTS}}, {{OFFERS}}, {{CATEGORIES}}                     | searchProducts, getCategoryDetails  |
| **CART_MANAGEMENT** (exists)    | Cart operations                                    | {{CART_ITEMS}}                                               | addToCart, removeFromCart, viewCart |
| **PROFILE_MANAGEMENT** (exists) | Profile updates, preferences                       | {{pushNotificationsConsent}}, {{pushNotificationsConsentAt}} | updateProfile, getProfileLink       |
| **NOTIFICATIONS** (exists)      | Push notification management                       | {{pushNotificationsConsent}}, {{pushNotificationsConsentAt}} | handlePushNotification              |

---

## 🚀 Implementation Steps (CORRECTED)

### Step 1: Update Constitution (NO DB Changes!)

- File: `.specify/memory/constitution.md`
- Add Principle XIV (Context Interpretation Pattern)
- NO migration needed!

### Step 2: Update ROUTER Agent Prompt

- File: `docs/prompts/router-agent.md` (exists - update it!)
- Keep {{FAQ}} variable (already has it!)
- Add context interpretation logic
- Temperature: 0.2 (from 0.3)
- Size target: < 2.5k tokens

### Step 3: Update PROFILE_MANAGEMENT Agent Prompt

- File: `docs/prompts/profile-management-agent.md` (check if exists, or create)
- Add {{pushNotificationsConsent}} variable
- Add {{pushNotificationsConsentAt}} variable (bonus!)
- Add link to NOTIFICATIONS agent for subscription changes

### Step 4: Create/Update NOTIFICATIONS Agent Prompt

- File: `docs/prompts/notifications-agent.md` (create if not exists)
- Handle push notification subscription/unsubscription
- Add handlePushNotification CF
- Variables: {{pushNotificationsConsent}}, {{pushNotificationsConsentAt}}

### Step 5: Update Prompt Processor

- File: `backend/src/services/prompt-processor.service.ts`
- Add {{pushNotificationsConsent}} replacement (use `customer.push_notifications_consent`)
- Add {{pushNotificationsConsentAt}} replacement (use `customer.push_notifications_consent_at`)

### Step 6: Update Seed (Use Existing AgentTypes!)

- File: `backend/prisma/data/defaultAgents.ts`
- Update ROUTER agent config (temperature 0.2, new prompt)
- Update PROFILE_MANAGEMENT agent config (add variables)
- Update/Create NOTIFICATIONS agent config (handlePushNotification CF)
- NO new AgentType values - use existing ones!

---

## ✅ Final Checklist

- [ ] NO `isSubscribed` field creation (use `push_notifications_consent`)
- [ ] NO `FAQ_AGENT` enum value (use `ROUTER`)
- [ ] NO `PROFILE_AGENT` enum value (use `PROFILE_MANAGEMENT`)
- [ ] NO database migration needed
- [ ] Use existing AgentType values only
- [ ] Update existing agent prompts, not create new ones
- [ ] Clean database - zero new tables/fields/enums

---

**Created**: 17 November 2025  
**Updated**: 17 November 2025 (after Andrea's correction)  
**Status**: VERIFIED against real database schema  
**Rule**: **NEVER invent what already exists!** ✅

---

## 📝 Modifiche da Applicare al Plan.md

### 1. Phase 1 - Database Migration

**RIMUOVERE**:

```prisma
isSubscribed Boolean @default(false)  // ❌ Campo NON necessario
```

**MANTENERE SOLO**:

```prisma
enum AgentType {
  ROUTER
  PRODUCT_SEARCH
  CART_MANAGEMENT
  ORDER_TRACKING
  CUSTOMER_SUPPORT
  FAQ_AGENT        // ✅ ADD THIS
  PROFILE_AGENT    // ✅ ADD THIS
}
```

**Migration**: Solo per AgentType enum, NO Customer model changes

---

### 2. Variable Names - Find & Replace

**In TUTTO il plan.md e spec.md**:

| ❌ OLD Variable    | ✅ NEW Variable                  | Description                              |
| ------------------ | -------------------------------- | ---------------------------------------- |
| `{{isSubscribed}}` | `{{pushNotificationsConsent}}`   | Current subscription status              |
| -                  | `{{pushNotificationsConsentAt}}` | Date when user subscribed (NEW - bonus!) |

**Esempi di sostituzione**:

```typescript
// ❌ OLD CODE (in plan.md)
if (customer?.isSubscribed !== undefined) {
  prompt = prompt.replace(
    /\{\{isSubscribed\}\}/g,
    customer.isSubscribed ? "yes" : "no"
  )
}

// ✅ NEW CODE
if (customer?.push_notifications_consent !== undefined) {
  prompt = prompt.replace(
    /\{\{pushNotificationsConsent\}\}/g,
    customer.push_notifications_consent ? "yes" : "no"
  )
}

// 🆕 BONUS - Add subscription date
if (customer?.push_notifications_consent_at) {
  prompt = prompt.replace(
    /\{\{pushNotificationsConsentAt\}\}/g,
    customer.push_notifications_consent_at.toLocaleDateString("it-IT")
  )
} else {
  prompt = prompt.replace(/\{\{pushNotificationsConsentAt\}\}/g, "mai")
}
```

---

### 3. HandlePushNotification CF - Database Field Update

**In Phase 3.3** (CallingFunctionsService):

```typescript
// ❌ OLD (in plan.md)
data: { isSubscribed: request.value }

// ✅ NEW
data: { push_notifications_consent: request.value, push_notifications_consent_at: request.value ? new Date() : null }
```

**CRITICAL**: When user **activates** notifications → set both fields:

- `push_notifications_consent: true`
- `push_notifications_consent_at: new Date()` (save timestamp!)

When user **deactivates** → set:

- `push_notifications_consent: false`
- `push_notifications_consent_at: null` (clear timestamp)

---

### 4. Profile Agent Prompt - Variables Update

**In Phase 3.1** (profile-agent.md prompt):

```markdown
## CUSTOMER INFO

- Name: {{nameUser}}
- Email: {{email}}
- Subscribed to notifications: {{pushNotificationsConsent}} (yes/no) ← UPDATED
- Subscription date: {{pushNotificationsConsentAt}} (if subscribed) ← NEW!

### When to Use Subscription Date:

- User asks: "When did I subscribe?"
- Personalization: "You subscribed on {{pushNotificationsConsentAt}}, want to continue?"
```

---

### 5. Prompt Processor Service - Variable Replacement Logic

**In Phase 3.9** (prompt-processor.service.ts):

```typescript
// ✅ Replace {{pushNotificationsConsent}}
if (customer?.push_notifications_consent !== undefined) {
  prompt = prompt.replace(
    /\{\{pushNotificationsConsent\}\}/g,
    customer.push_notifications_consent ? "yes" : "no"
  )
} else {
  prompt = prompt.replace(/\{\{pushNotificationsConsent\}\}/g, "no")
}

// ✅ Replace {{pushNotificationsConsentAt}} (NEW!)
if (customer?.push_notifications_consent_at) {
  const dateStr = customer.push_notifications_consent_at.toLocaleDateString(
    "it-IT",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  )
  prompt = prompt.replace(/\{\{pushNotificationsConsentAt\}\}/g, dateStr)
} else {
  prompt = prompt.replace(/\{\{pushNotificationsConsentAt\}\}/g, "mai iscritto")
}
```

---

### 6. Frontend Display - Variable Names

**In Phase 3.12** (Agents.tsx):

```tsx
{
  agent.agentType === "PROFILE_AGENT" && (
    <div className="mt-2 flex flex-wrap gap-1">
      <Badge variant="outline">{{ pushNotificationsConsent }}</Badge>{" "}
      {/* Updated */}
      <Badge variant="success">{{ pushNotificationsConsentAt }}</Badge> {/* NEW */}
    </div>
  )
}
```

---

### 7. Test Updates - Field Names

**All test files** mentioning `isSubscribed`:

```typescript
// ❌ OLD
await prisma.customer.update({
  where: { id: customerId },
  data: { isSubscribed: true },
})

// ✅ NEW
await prisma.customer.update({
  where: { id: customerId },
  data: {
    push_notifications_consent: true,
    push_notifications_consent_at: new Date(),
  },
})
```

---

## ✅ Summary of Changes

| Component             | OLD                    | NEW                                                |
| --------------------- | ---------------------- | -------------------------------------------------- |
| **DB Field (status)** | `isSubscribed`         | `push_notifications_consent` (exists!)             |
| **DB Field (date)**   | -                      | `push_notifications_consent_at` (exists!)          |
| **Variable (status)** | `{{isSubscribed}}`     | `{{pushNotificationsConsent}}`                     |
| **Variable (date)**   | -                      | `{{pushNotificationsConsentAt}}` (NEW feature!)    |
| **Migration**         | Add isSubscribed field | ❌ NO migration for Customer (only AgentType enum) |
| **CF Update Logic**   | Set isSubscribed only  | Set both consent + consent_at with timestamp       |

---

## 🎁 Bonus Feature - Subscription Date

Andrea's idea is **BRILLIANT**! We can use `push_notifications_consent_at` to:

1. **Personalization**: "Hai attivato le notifiche il 12 novembre 2025, vuoi continuare?"
2. **Transparency**: Show user when they subscribed
3. **GDPR Compliance**: Track consent timestamp (required by law!)
4. **Analytics**: Know when users opt-in/out

**Example Profile Agent Response**:

> "Ciao Andrea! Attualmente **sei iscritto** alle notifiche promozionali. Ti sei registrato il **12 novembre 2025**. Vuoi disattivare le notifiche?"

---

## 🚀 Next Steps

1. **Update plan.md**: Replace all `isSubscribed` → `push_notifications_consent`
2. **Update spec.md**: Same variable name changes
3. **Add bonus feature**: `{{pushNotificationsConsentAt}}` in Profile Agent prompt
4. **Proceed with implementation**: No DB migration needed (fields exist!)

---

**Created**: 17 November 2025  
**By**: Copilot (after Andrea's correction)  
**Status**: Ready to apply changes
