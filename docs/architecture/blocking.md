# 🚫 eChatbot Blocking System - Complete Documentation

**Version**: 1.1.0  
**Last Updated**: January 20, 2025  
**Feature**: 185-subscription-billing-system  

---

## 📊 Overview

eChatbot implements multiple blocking mechanisms to ensure:
1. **Revenue Protection** - No free usage beyond limits
2. **Fair Usage** - Plan limits enforced
3. **Security** - Block malicious users
4. **Service Quality** - Prevent abuse

---

## 🚨 All Blocking Codes

| Code | HTTP Status | Trigger | User Impact |
|------|-------------|---------|-------------|
| `PAUSED` | - | Owner paused subscription | Chatbot silently ignores messages |
| `PAYMENT_FAILED` | - | Monthly payment failed (tracking only) | **No automatic block** (admin disables user manually if needed) |
| `CREDIT_EXHAUSTED` | - | Credit < -€10 | Chatbot blocked |
| `CHANNEL_DISABLED` | - | channelStatus = false | Total shutdown (blocked at webhook) |
| `WORKSPACE_INACTIVE` | - | Workspace deleted | Full block |
| `NO_OWNER` | - | Workspace has no owner | Full block |
| `TRIAL_EXPIRED` | 402 | Trial 14 days passed | Full service block |
| `INSUFFICIENT_CREDIT` | 402 | Credit < operation cost | Operation blocked |
| `CUSTOMER_LIMIT_REACHED` | 403 | Customers >= plan max | New customers blocked |
| `PLAN_LIMIT_REACHED` | 403 | Products/Channels >= max | Creation blocked |
| `CHANNEL_LIMIT_EXCEEDED` | 403 | Channels >= plan max | New channel blocked |
| `OWNER_REQUIRED` | 403 | Non-owner billing action | Action blocked |
| `BLACKLISTED` | 410* | Admin manually blocks customer | Silent block (no customer reply) |
| `WORKSPACE_REQUIRED` | 400 | Missing workspaceId | Request rejected |

*Returns 410 in the webhook (no customer reply) to avoid retry loops while keeping the block silent to the user.

---

## ⏸️ PAUSED - Owner Paused Subscription (IMMEDIATE)

**When it triggers:**
- Owner clicks "Pause Subscription" in BillingPage
- `owner.subscriptionStatus = 'PAUSED'`

**Effect:**
- **IMMEDIATE** - Chatbot stops responding instantly
- No subscription fee for months fully paused; pause month still bills the subscription fee and usage only until `pausedAt`
- Affects ALL workspaces owned by this user

**Checked by:**
- `WorkspaceAccessService.canProcessMessages()`
- `WhatsApp webhook` → before LLM processing

**Resume:**
- Owner clicks "Resume Subscription"
- `subscriptionStatus = 'ACTIVE'`
- Chatbot resumes immediately

---

## 💳 PAYMENT_FAILED - Payment Failed (Tracking Only)

**When it triggers:**
- `owner.subscriptionStatus = 'PAYMENT_FAILED'`
- `owner.paymentFailureCount >= 3`

**Effect:**
- Used for reporting/visibility only
- **Does not block** chatbots automatically
- If needed, admin disables the user manually (cascades to all workspaces)

**Notes:**
- `paymentFailureCount` is stored on the `User` record
- Counter should be reset on successful payment

---

## 📋 Detailed Block Descriptions

### 1. TRIAL_EXPIRED

**When it triggers:**
- `plan = FREE_TRIAL` AND `trialEndsAt < now()`

**Where it's checked:**
- `billing.middleware.ts` → `checkTrialValid`
- `whatsapp-webhook.controller.ts` → before processing messages
- `whatsapp.routes.ts` → before processing new users

**Code location:**
```typescript
// backend/src/interfaces/http/middlewares/billing.middleware.ts
const trialStatus = await billingService.isTrialValid(workspaceId)

if (trialStatus.isTrialPlan && !trialStatus.isValid) {
  res.status(402).json({
    error: "Trial scaduto",
    code: "TRIAL_EXPIRED",
    message: "Il tuo periodo di prova è scaduto. Scegli un piano per continuare."
  })
}
```

**User experience:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    TRIAL EXPIRED BLOCK                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  WhatsApp Customer:                                              │
│  ┌────────────────────────────────┐                             │
│  │ "Ciao, vorrei ordinare..."     │ → NO RESPONSE               │
│  └────────────────────────────────┘   (Silent block)            │
│                                                                  │
│  Admin Panel:                                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ⚠️ Trial Scaduto                                          │ │
│  │                                                             │ │
│  │  Il tuo periodo di prova è scaduto.                        │ │
│  │  Scegli un piano per continuare ad usare eChatbot.           │ │
│  │                                                             │ │
│  │  [Scegli Piano Basic €29/mese]  [Premium €49/mese]        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Recovery:**
- Upgrade to BASIC or PREMIUM plan
- Service resumes immediately after upgrade

---

### 2. INSUFFICIENT_CREDIT

**When it triggers:**
- `creditBalance < operationCost`

**Where it's checked:**
- `billing.middleware.ts` → `checkCredit` (before processing)
- `whatsapp-webhook.controller.ts` → before welcome message
- `whatsapp.routes.ts` → before processing messages
- `whatsapp-queue.service.ts` → `deductMessageCredit` (after successful send)

**💰 Important Billing Logic:**
- Credit is checked BEFORE processing (to avoid wasted LLM costs)
- Credit is DEDUCTED only AFTER successful WhatsApp delivery
- If `debugMode=true` → message stays pending → NO billing
- If WhatsApp fails → status "error" → NO billing

**Code location:**
```typescript
// backend/src/interfaces/http/middlewares/billing.middleware.ts
const cost = await billingService.getOperationCost(workspaceId, operation)
const creditCheck = await billingService.checkCredit(workspaceId, cost)

if (!creditCheck.hasSufficientCredit) {
  res.status(402).json({
    error: "Credito insufficiente",
    code: "INSUFFICIENT_CREDIT",
    details: {
      currentBalance: creditCheck.currentBalance,
      requiredAmount: creditCheck.requiredAmount,
      deficit: creditCheck.deficit
    },
    message: `Credito insufficiente. Saldo: €${creditCheck.currentBalance.toFixed(2)}`
  })
}
```

**User experience:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    INSUFFICIENT CREDIT BLOCK                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  WhatsApp Customer:                                              │
│  ┌────────────────────────────────┐                             │
│  │ "Quanto costa la pizza?"       │ → NO RESPONSE               │
│  └────────────────────────────────┘   (Silent block)            │
│                                                                  │
│  Admin Panel Header:                                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  💰 €0.005  ⚠️ CREDITO BASSO                               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Admin Panel Alert:                                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ⚠️ Credito Insufficiente                                  │ │
│  │                                                             │ │
│  │  Saldo attuale: €0.005                                     │ │
│  │  Richiesto: €0.10 per messaggio                            │ │
│  │                                                             │ │
│  │  Il chatbot non può rispondere ai clienti.                 │ │
│  │                                                             │ │
│  │  [Ricarica €25]  [Ricarica €50]  [Ricarica €100]          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Recovery:**
- Recharge credit via "Ricarica" button
- Messages in queue will be processed after recharge

---

### 3. CUSTOMER_LIMIT_REACHED

**When it triggers:**
- New customer tries to contact
- Current customers >= plan limit (50 for BASIC, 100 for PREMIUM)

**Where it's checked:**
- `whatsapp-webhook.controller.ts` → line 395
- `whatsapp.routes.ts` → line 217

**Code location:**
```typescript
// backend/src/interfaces/http/controllers/whatsapp-webhook.controller.ts
const customerLimitCheck = await billingService.checkPlanLimits(workspaceId, "customers")

if (!customerLimitCheck.withinLimits) {
  logger.warn("[WEBHOOK] 📊 Customer limit reached - SILENT BLOCK")
  res.status(403).json({
    status: "limit_reached",
    code: "CUSTOMER_LIMIT_REACHED",
    message: `Customer limit reached (${customerLimitCheck.current}/${customerLimitCheck.max}).`
  })
  return
}
```

**User experience:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    CUSTOMER LIMIT BLOCK                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  NEW WhatsApp Customer (51st for BASIC):                         │
│  ┌────────────────────────────────┐                             │
│  │ "Ciao!"                        │ → NO RESPONSE               │
│  └────────────────────────────────┘   (Silent block)            │
│                                       Customer NOT saved         │
│                                                                  │
│  Existing Customers:                                             │
│  ┌────────────────────────────────┐                             │
│  │ "Come stai?"                   │ → Normal response           │
│  └────────────────────────────────┘   (they're already saved)   │
│                                                                  │
│  Admin Panel - Workspace Selection:                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  📊 Utilizzo                                               │ │
│  │                                                             │ │
│  │  Clienti   ██████████  50/50  ⚠️ LIMIT                     │ │
│  │                                                             │ │
│  │  Nuovi clienti non possono contattarti!                    │ │
│  │                                                             │ │
│  │  [Upgrade a Premium → 100 clienti]                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Recovery:**
- Upgrade to PREMIUM (100 customers) or ENTERPRISE (unlimited)
- OR delete inactive customers to make room

---

### 4. PLAN_LIMIT_REACHED (Products)

**When it triggers:**
- Admin tries to add product
- Current products >= plan limit (50 for BASIC, 100 for PREMIUM)

**Where it's checked:**
- `products.routes.ts` → `checkPlanLimits("products")` middleware

**Code location:**
```typescript
// backend/src/interfaces/http/routes/products.routes.ts
router.post(
  "/:workspaceId/products",
  authMiddleware,
  sessionValidationMiddleware,
  validateWorkspaceOperation,
  checkPlanLimits("products"),  // ← Middleware here
  upload.single("image"),
  productController.createProduct.bind(productController)
)
```

**User experience:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCT LIMIT BLOCK                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Admin clicks "Aggiungi Prodotto":                               │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ❌ Limite Piano Raggiunto                                  │ │
│  │                                                             │ │
│  │  Hai raggiunto il limite massimo di prodotti               │ │
│  │  per il tuo piano (50/50).                                 │ │
│  │                                                             │ │
│  │  Passa a Premium per aggiungere fino a 100 prodotti.       │ │
│  │                                                             │ │
│  │  [Upgrade a Premium]  [Annulla]                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Recovery:**
- Upgrade to PREMIUM (100 products) or ENTERPRISE (unlimited)
- OR delete inactive products

---

### 5. CHANNEL_LIMIT_EXCEEDED

**When it triggers:**
- Owner tries to add new workspace/channel
- Current channels >= plan limit (1 for BASIC, 2 for PREMIUM)

**Where it's checked:**
- `workspace.controller.ts` → `createWorkspace()` method

**Code location:**
```typescript
// backend/src/interfaces/http/controllers/workspace.controller.ts
const limitCheck = await this.billingService.checkPlanLimits(firstWorkspaceId, "channels")

if (!limitCheck.withinLimits) {
  return res.status(403).json({
    error: "Limite canali raggiunto",
    code: "CHANNEL_LIMIT_EXCEEDED",
    message: `Hai raggiunto il limite di canali (${limitCheck.current}/${limitCheck.max}).`
  })
}
```

**User experience:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    CHANNEL LIMIT BLOCK                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Owner clicks "Aggiungi Canale":                                 │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ❌ Limite Canali Raggiunto                                 │ │
│  │                                                             │ │
│  │  Hai raggiunto il limite di canali WhatsApp                │ │
│  │  per il tuo piano (1/1).                                   │ │
│  │                                                             │ │
│  │  Passa a Premium per avere 2 canali.                       │ │
│  │                                                             │ │
│  │  [Upgrade a Premium]  [Annulla]                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Recovery:**
- Upgrade to PREMIUM (2 channels) or ENTERPRISE (unlimited)

---

### 6. OWNER_REQUIRED

**When it triggers:**
- Non-owner user tries to access billing functions

**Where it's checked:**
- `billing.middleware.ts` → `requireOwnerForBilling`

**Code location:**
```typescript
// backend/src/interfaces/http/middlewares/billing.middleware.ts
if (userWorkspace.role !== "SUPER_ADMIN") {
  res.status(403).json({
    error: "Solo il proprietario può modificare le impostazioni di billing",
    code: "OWNER_REQUIRED",
    message: "Questa operazione richiede i permessi di proprietario."
  })
}
```

**User experience:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    OWNER REQUIRED BLOCK                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Team member (ADMIN role) tries to recharge:                     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ❌ Permessi Insufficienti                                  │ │
│  │                                                             │ │
│  │  Solo il proprietario del canale può:                      │ │
│  │  • Ricaricare credito                                      │ │
│  │  • Cambiare piano                                          │ │
│  │  • Modificare impostazioni billing                         │ │
│  │                                                             │ │
│  │  Contatta il proprietario per questa operazione.           │ │
│  │                                                             │ │
│  │  [OK]                                                       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### 7. BLACKLISTED (Manual Admin Block Only)

**When it triggers:**
- Admin manually blocks customer via Admin Panel
- Protection against spam/abuse/problematic customers

**Where it's checked:**
- `apps/backend/src/interfaces/http/controllers/whatsapp-webhook.controller.ts` → early return before processing
- `apps/backend/src/application/chat-engine/chat-engine.service.ts` → guard inside `routeMessage()`

**Code location:**
```typescript
// apps/backend/src/interfaces/http/controllers/whatsapp-webhook.controller.ts
if (customer.isBlacklisted) {
  logger.warn("[WEBHOOK] 🚫 Blocked customer - returning 410", {
    customerId: customer.id,
    workspaceId: customer.workspaceId,
  })
  res.status(410).json({
    status: "blocked",
    message: "Customer is blocked",
  })
  return
}
```

**User experience:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    BLACKLIST BLOCK                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Blocked phone number sends message:                             │
│  ┌────────────────────────────────────┐                             │
│  │ "Ciao?"                        │ → NO RESPONSE               │
│  └────────────────────────────────┘   (Silent block)            │
│                                                                  │
│  Admin Panel - Customer List:                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  🚫 +39 333 1234567                                        │ │
│  │  Status: BLACKLISTED                                       │ │
│  │  Reason: Manually blocked by admin                         │ │
│  │                                                             │ │
│  │  [Unblock Customer]                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Recovery:**
- Admin clicks "Unblock Customer" in Admin Panel
- `isBlacklisted` flag is set to `false`

**Note:** ❌ Automatic blocking after registration attempts has been removed. Users can now send unlimited messages and registration is required only for specific functions (cart, orders, profile).

---

### 8. Function-Level Registration Guard

**Philosophy:**
- ✅ Users can chat **freely without registration**
- ✅ Registration required **only for personalized functions** (cart, orders, profile)
- ❌ No preventive blocking or message limits

**When it triggers:**
- User (non-registered: `customer.isActive=false`) attempts protected function
- Protected functions: cart operations, order management, profile access

**Where it's checked:**
- `FunctionExecutorService.execute()` → before function execution

**Protected Functions (10 total):**

| Category | Functions |
|----------|-----------|
| **Cart Management** | `addToCart`, `viewCart`, `clearCart` |
| **Order Tracking** | `getLinkOrderByCode`, `repeatOrder`, `getOrderDetails`, `confirmOrder`, `showCheckout` |
| **Profile Management** | `handlePushNotifications`, `getProfileLink` |

**Public Functions (always work):**
- `getProductDetails`, `getServiceDetails`, `searchProductForStatistic`, `contactOperator`

**Code location:**
```typescript
// backend/src/services/function-executor.service.ts
const FUNCTIONS_REQUIRING_REGISTRATION = [
  'addToCart', 'viewCart', 'clearCart',
  'getLinkOrderByCode', 'repeatOrder', 'getOrderDetails', 'confirmOrder', 'showCheckout',
  'handlePushNotifications', 'getProfileLink'
]

async execute(context: ExecutionContext): Promise<ExecutionResult> {
  // GUARD: Check registration requirement
  if (FUNCTIONS_REQUIRING_REGISTRATION.includes(context.functionName)) {
    if (!context.customerIsActive) {
      return {
        success: false,
        error: 'REGISTRATION_REQUIRED',
        message: `Per utilizzare "${context.functionName}" devi registrarti: [LINK_REGISTRATION]`
      }
    }
  }

  // Execute function normally
  switch (context.functionName) {
    case 'addToCart': return await this.addToCart(context)
    // ... other cases
  }
}
```

**User experience:**
```
┌─────────────────────────────────────────────────────────────────┐
│            FUNCTION-LEVEL REGISTRATION GUARD                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Non-registered user can ask questions:                          │
│  ┌────────────────────────────────────┐                         │
│  │ "Quanto costa questo prodotto?"   │ → ✅ LLM RESPONSE       │
│  └────────────────────────────────────┘                         │
│                                                                  │
│  Non-registered user tries to order:                             │
│  ┌────────────────────────────────────┐                         │
│  │ "Aggiungi al carrello"            │ → LLM: "Per usare il    │
│  └────────────────────────────────────┘    carrello registrati: │
│                                            https://..."          │
│                                                                  │
│  After registration (isActive=true):                             │
│  ┌────────────────────────────────────┐                         │
│  │ "Aggiungi al carrello"            │ → ✅ CART UPDATED       │
│  └────────────────────────────────────┘                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Token Replacement:**
```typescript
// apps/backend/src/application/services/link-replacement.service.ts
if (message.includes("[LINK_REGISTRATION]")) {
  const tokenService = new TokenService()
  const token = await tokenService.createRegistrationToken(customer.phone, workspaceId)
  const baseUrl = await workspaceService.getWorkspaceURL(workspaceId)
  const registrationLink = await linkGeneratorService.generateRegistrationLink(
    token,
    baseUrl,
    workspaceId
  )
  finalMessage = finalMessage.replace(/\[LINK_REGISTRATION\]/g, registrationLink)
}
```

**Post-Registration Behavior:**
- New customers: `isActive=true`, `isBlacklisted=false`, `activeChatbot=true`
- **Immediate activation** - no admin approval needed
- Can use all protected functions instantly



---

## 🔄 Block Priority Order

When processing a WhatsApp message, blocks are checked in this order:

```
1. BLACKLISTED           → Check first (manual admin block only)
         ↓
2. TRIAL_EXPIRED         → Check trial validity
         ↓
3. INSUFFICIENT_CREDIT   → Check credit balance
         ↓
4. CUSTOMER_LIMIT_REACHED → Check customer count (new users only)
         ↓
5. ✅ Process message
         ↓
6. Function Execution → Check registration guard (if function requires it)
```

**Note:** Registration guard is checked **during function execution**, not at message level. Users can freely chat; registration is required only when calling protected functions.

---

## 📊 Block Statistics (Logging)

All blocks are logged for monitoring:

```typescript
logger.warn(`[BILLING] ⚠️ Credit check failed for ${operation}:`, {
  workspaceId,
  currentBalance: creditCheck.currentBalance,
  required: cost,
  code: "INSUFFICIENT_CREDIT"
})
```

**Log patterns to monitor:**
- `[BILLING] ⚠️ Credit check failed` → Credit issues
- `[BILLING] ⚠️ Trial expired` → Trial conversions needed
- `[BILLING] ⚠️ Plan limit reached` → Upgrade opportunities
- `🚫 User blocked` → Security events

---

## 🛠️ Testing Blocks

### Unit Tests Location
- `backend/__tests__/unit/services/billing.service.spec.ts`
- `backend/__tests__/security/subscription-billing.security.test.ts`

### Test Commands
```bash
# Run all billing tests
cd backend && npm run test:unit -- --grep "billing"

# Run security tests
cd backend && npm run test:security
```

---

## 🔗 Key Files Reference

| Block Type | Primary Check Location |
|------------|----------------------|
| TRIAL_EXPIRED | `billing.middleware.ts:checkTrialValid` |
| INSUFFICIENT_CREDIT | `billing.middleware.ts:checkCredit` |
| CUSTOMER_LIMIT_REACHED | `whatsapp-webhook.controller.ts:395` |
| PLAN_LIMIT_REACHED | `billing.middleware.ts:checkPlanLimits` |
| CHANNEL_LIMIT_EXCEEDED | `workspace.controller.ts:187` |
| OWNER_REQUIRED | `billing.middleware.ts:requireOwnerForBilling` |
| BLACKLISTED | `apps/backend/src/interfaces/http/controllers/whatsapp-webhook.controller.ts` |

---

## 📚 Related Documentation

- [BILLING_FLOW.md](./BILLING_FLOW.md) - Complete billing flow
- [PRICING_CENTRALIZATION_SUMMARY.md](./PRICING_CENTRALIZATION_SUMMARY.md) - Pricing details
- [specs/185-subscription-billing-system/spec.md](../specs/185-subscription-billing-system/spec.md) - Feature spec
