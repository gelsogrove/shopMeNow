# 💰 Widget Billing System - Complete Documentation

**Feature**: Widget message billing at **$0.005 per message** (95% discount vs WhatsApp $0.10)

**Version**: v221  
**Date**: January 26, 2026  
**Status**: ✅ IMPLEMENTED

---

## 📊 Overview

Widget messages are charged at **$0.005 per message** (compared to WhatsApp's $0.10). This lower cost reflects the fact that widget conversations are:
- **Anonymous visitors** (not registered customers)
- **Lead generation** focused (not e-commerce)
- **No order processing** (simplified flow)
- **Browser-based** (no SMS/WhatsApp delivery costs)

### Key Differences: Widget vs WhatsApp

| Feature | WhatsApp Channel | Widget Channel |
|---------|------------------|----------------|
| **Price per message** | $0.10 | $0.005 |
| **Delivery method** | Scheduler queue | Immediate response |
| **Customer type** | Registered (email/phone) | Anonymous visitors |
| **E-commerce** | ✅ Full support | ❌ Disabled |
| **Credit limit** | -$10 overdraft | -$10 overdraft |
| **Billing trigger** | After WhatsApp send | After LLM response |
| **Transaction record** | ✅ Yes | ✅ Yes |
| **Appears in invoice** | ✅ Yes | ✅ Yes |
| **Offline behavior** | Queue holds messages | Widget hidden |
| **Debug mode** | Sends WIP via queue | Shows WIP instantly |

---

## 🔄 Widget Billing Flow

```
┌─────────────────────────────────────────────────────────────┐
│ WIDGET MESSAGE FLOW (with $0.005 billing)                   │
└─────────────────────────────────────────────────────────────┘

1. WIDGET MESSAGE RECEIVED (POST /api/v1/widget/chat/:workspaceId)
   ├─ Validate visitorId (24h expiry)
   ├─ Check workspace exists and active
   └─ Check owner status (ACTIVE required)

2. WORKSPACE STATUS CHECKS
   ├─ enableWidget=false → 403 "Widget disabled"
   ├─ deletedAt != null → 503 "Service unavailable"
   ├─ channelStatus=false → 200 "WIP message"
   ├─ debugMode=true → 200 "WIP message"
   └─ All OK → Continue

3. SECURITY VALIDATION (5 steps)
   ├─ Rate limit check (per visitor)
   ├─ Spam detection
   ├─ Content filter
   ├─ Workspace active
   └─ Visitor valid

4. 💰 CREDIT CHECK (BEFORE LLM)
   ├─ Get owner.creditBalance
   ├─ Check if balance < -$10.00
   │  ├─ YES → 402 "Insufficient credit" (BLOCK)
   │  └─ NO → Continue
   └─ Log warning if balance negative (but >= -$10)

5. FIND OR CREATE CUSTOMER
   ├─ Search by customId (visitorId)
   ├─ Create if not exists:
   │  ├─ name: "Visitor XXXXX"
   │  ├─ email: "visitorId@visitor.local"
   │  ├─ isActive: false (anonymous)
   │  └─ language: from request header
   └─ Update language if changed

6. FIND OR CREATE CHAT SESSION
   ├─ Search active session for customer
   ├─ Create if not exists:
   │  ├─ status: "active"
   │  ├─ isAnonymous: true
   │  ├─ channel: "widget"
   │  └─ expiresAt: visitorId expiry (24h)
   └─ Return sessionId

7. 👋 WELCOME MESSAGE CHECK
   ├─ First message from visitor?
   │  ├─ YES → Send welcome, skip LLM
   │  └─ NO → Continue to LLM
   └─ No billing for welcome (system message)

8. SAVE USER MESSAGE TO HISTORY
   └─ conversationMessage.create()
      ├─ role: "user"
      ├─ content: message
      └─ agentType: ROUTER

9. 🤖 PROCESS WITH LLM (Immediate, no queue)
   └─ llmRouterService.routeMessage()
      ├─ Intent parsing
      ├─ Agent routing
      ├─ Response generation
      └─ Returns: { response, agentUsed, tokensUsed }

10. SAVE ASSISTANT RESPONSE TO HISTORY
    └─ conversationMessage.create()
       ├─ role: "assistant"
       ├─ content: response
       ├─ agentType: from LLM
       └─ tokensUsed: from LLM

11. 💰 BILLING: Deduct $0.005 (AFTER successful response)
    ├─ Check if workspace has owner
    │  ├─ NO → Skip billing (log warning)
    │  └─ YES → Continue
    └─ Call: subscriptionBillingService.deductOwnerWidgetMessageCredit()
       ├─ Get owner billing info
       ├─ Get widget message price ($0.005 from platformConfig)
       ├─ Check sufficient credit (allows -$10 overdraft)
       ├─ 🔒 TRANSACTION:
       │  ├─ Deduct from owner.creditBalance
       │  └─ Create billingTransaction record:
       │     ├─ userId: owner.id
       │     ├─ workspaceId: workspace.id
       │     ├─ type: "MESSAGE"
       │     ├─ amount: -0.005 (negative = deduction)
       │     ├─ balanceAfter: new balance
       │     ├─ description: "Widget message"
       │     ├─ referenceId: messageId
       │     └─ referenceType: "widget_message"
       └─ Log: "💰 Widget message charged: $0.005"

12. RETURN RESPONSE TO USER (200 OK)
    └─ {
         success: true,
         messageId: "widget-{visitorId}-{timestamp}",
         sessionId: chatSession.id,
         response: llmResult.response,
         status: "ready"
       }

📝 NOTE: If billing fails (step 11), user STILL gets response
         → Billing failure doesn't break UX
         → Admin notified via error logs
```

---

## 💳 Credit Limit Management

### Overdraft Policy (-$10 threshold)

Widget uses the **same credit limit as WhatsApp**: **-$10.00 overdraft**

```typescript
const MIN_BALANCE_THRESHOLD = -10.00

// ALLOW message if:
// ✅ balance > -$10.00
// ✅ balance = -$10.00

// BLOCK message if:
// ❌ balance < -$10.00
```

### Examples

| Current Balance | Widget Allowed? | Reason |
|----------------|-----------------|--------|
| $100.00 | ✅ YES | Positive balance |
| $0.50 | ✅ YES | Positive balance |
| $0.00 | ✅ YES | Zero balance OK |
| -$5.00 | ✅ YES | Within -$10 threshold |
| -$9.99 | ✅ YES | Within -$10 threshold |
| -$10.00 | ✅ YES | Exactly at threshold |
| -$10.01 | ❌ NO | Below threshold (blocked) |
| -$15.00 | ❌ NO | Far below threshold |

### Error Response (402 Payment Required)

```json
{
  "error": "INSUFFICIENT_CREDIT",
  "message": "Credit limit reached. Please add credits to continue using the service.",
  "currentBalance": -10.01,
  "minimumRequired": -10.00
}
```

---

## 🚫 Channel Status & Debug Mode

### 1. Widget Disabled (`enableWidget=false`)

**Response**: `403 Forbidden`

```json
{
  "error": "WIDGET_DISABLED",
  "message": "Widget chat is disabled for this workspace"
}
```

**Frontend behavior**: Widget icon disappears from page

---

### 2. Channel Offline (`channelStatus=false`)

**Backend behavior**:
- GET `/api/v1/widget/status/:workspaceId` returns `status: "wip"`
- POST `/api/v1/widget/chat/:workspaceId` returns WIP message

**Frontend behavior**:
- Widget icon shows but disabled
- Clicking shows WIP message
- No billing (LLM not called)

**Response**:
```json
{
  "success": true,
  "status": "wip",
  "response": "Siamo in manutenzione. Riprova più tardi."
}
```

---

### 3. Debug Mode (`debugMode=true`)

**Backend behavior**:
- GET `/api/v1/widget/status/:workspaceId` returns `status: "wip"` + `wipMessage`
- POST `/api/v1/widget/chat/:workspaceId` returns WIP message

**Frontend behavior**:
- Widget icon shows but disabled
- Clicking shows custom WIP message (multilingual)
- No billing (LLM not called)

**Response** (multilingual WIP):
```json
{
  "success": true,
  "status": "wip",
  "response": "Siamo in manutenzione. Per assistenza: admin@echatbot.ai"
}
```

**WIP Message Language Resolution**:
1. Try `wipMessage[requestedLanguage]` (e.g., `wipMessage['it']`)
2. Try `wipMessage['it']` (default Italian)
3. Try `wipMessage['en']` (fallback English)
4. Try `wipMessage` as string (if not object)
5. Fallback: `"Work in progress. Please contact us later."`

---

## 📊 Billing Transactions

### Database Record

Every widget message creates a `BillingTransaction` record:

```sql
INSERT INTO "BillingTransaction" (
  userId,
  workspaceId,
  type,
  amount,
  balanceAfter,
  description,
  referenceId,
  referenceType,
  createdAt
) VALUES (
  'owner-id-uuid',
  'workspace-id-uuid',
  'MESSAGE',
  -0.005,                              -- Negative = deduction
  49.95,                              -- New balance after deduction
  'Widget message',
  'widget-visitor-12345-1737911234',  -- Message ID
  'widget_message',                   -- Reference type
  NOW()
)
```

### Transaction Types

- **WhatsApp messages**: `type: "MESSAGE"`, `referenceType: "message"`
- **Widget messages**: `type: "MESSAGE"`, `referenceType: "widget_message"`
- **Push campaigns**: `type: "PUSH_CAMPAIGN"`
- **Orders**: `type: "ORDER"`

### Querying Widget Billing

```sql
-- Total widget messages cost (last 30 days)
SELECT 
  COUNT(*) as message_count,
  SUM(ABS(amount)) as total_cost
FROM "BillingTransaction"
WHERE 
  referenceType = 'widget_message'
  AND createdAt >= NOW() - INTERVAL '30 days';

-- Widget vs WhatsApp comparison
SELECT 
  referenceType,
  COUNT(*) as count,
  SUM(ABS(amount)) as total_cost,
  AVG(ABS(amount)) as avg_cost_per_message
FROM "BillingTransaction"
WHERE 
  type = 'MESSAGE'
  AND referenceType IN ('message', 'widget_message')
GROUP BY referenceType;
```

---

## 📄 Invoice Integration

Widget charges appear in monthly invoices alongside WhatsApp charges:

### Invoice Line Items

```json
{
  "invoice": {
    "period": "2026-01",
    "lineItems": [
      {
        "description": "WhatsApp Messages (150 msgs @ $0.10)",
        "quantity": 150,
        "unitPrice": 0.10,
        "amount": 15.00
      },
      {
        "description": "Widget Messages (300 msgs @ $0.005)",
        "quantity": 300,
        "unitPrice": 0.005,
        "amount": 15.00
      },
      {
        "description": "Subscription - Premium Plan",
        "quantity": 1,
        "unitPrice": 29.00,
        "amount": 29.00
      }
    ],
    "subtotal": 59.00,
    "tax": 11.81,
    "total": 70.81
  }
}
```

---

## 🔧 Implementation Files

### Backend Files

1. **Widget Controller**  
   File: `apps/backend/src/interfaces/http/controllers/widget-chat.controller.ts`  
   - Handles `/api/v1/widget/chat/:workspaceId` (send message)
   - Handles `/api/v1/widget/status/:workspaceId` (widget status)
   - Credit check BEFORE LLM (line ~390)
   - Billing call AFTER LLM (line ~525)

2. **Subscription Billing Service**  
   File: `apps/backend/src/application/services/subscription-billing.service.ts`  
   - Method: `deductOwnerWidgetMessageCredit(userId, workspaceId, messageId)`
   - Uses `WIDGET_MESSAGE` price key from `platformConfig`
   - Creates transaction with `referenceType: "widget_message"`

3. **Pricing Repository**  
   File: `apps/backend/src/infrastructure/repositories/pricing.repository.ts`  
   - Method: `getValue("WIDGET_MESSAGE")` returns `0.005`

4. **Platform Config (Database)**  
   File: `packages/database/prisma/data/platformConfig.ts`  
   - Key: `WIDGET_MESSAGE`
   - Value: `0.005`
   - Description: "Cost per web widget message (site chat)"

### Frontend Files

1. **Widget JavaScript (Embeddable)**  
   File: `apps/frontend/public/widget.js`  
   - Method: `loadStatus()` checks widget availability
   - Hides widget if `status === "disabled"`
   - Shows WIP message if `status === "wip"`
   - Sends messages to `/api/v1/widget/chat/:workspaceId`

2. **Widget Settings Page**  
   File: `apps/frontend/src/pages/WidgetSettingsPage.tsx`  
   - Toggle: `enableWidget` (enable/disable widget)
   - WIP message configuration (multilingual)

---

## 🧪 Testing

### Manual Testing Checklist

- [ ] Send widget message with positive balance → Charged $0.005
- [ ] Send widget message with balance = $0.00 → Charged $0.005 (balance becomes -$0.005)
- [ ] Send widget message with balance = -$9.99 → Charged $0.005 (balance becomes -$9.995)
- [ ] Send widget message with balance = -$10.00 → Allowed (edge case)
- [ ] Send widget message with balance = -$10.01 → 402 "Insufficient credit"
- [ ] Verify transaction appears in `BillingTransaction` table with `referenceType: "widget_message"`
- [ ] Verify widget cost appears in monthly invoice
- [ ] Set `channelStatus=false` → Widget shows WIP, no billing
- [ ] Set `debugMode=true` → Widget shows WIP, no billing
- [ ] Set `enableWidget=false` → Widget disappears from page

### Unit Tests

File: `apps/backend/__tests__/unit/widget/widget-billing.spec.ts`

**Test Suites**:
1. Widget Message Billing ($0.005)
   - Charge $0.005 (not $0.10)
   - Deduct from owner (not workspace)
   - Continue on billing failure (UX resilience)
   - Skip billing if no owner

2. Credit Limit Enforcement (-$10 threshold)
   - Allow: balance > 0
   - Allow: balance between 0 and -$10
   - Allow: balance exactly -$10
   - Block: balance < -$10

3. Channel Status & Debug Mode
   - WIP message when `debugMode=true`
   - WIP message when `channelStatus=false`
   - Block when `enableWidget=false`

4. Billing Transaction Recording
   - Verify `BillingTransaction` created
   - Verify `referenceType: "widget_message"`

5. Widget Status Endpoint
   - Return "disabled" when offline
   - Return "wip" in debug mode
   - Return "active" when operational

---

## 🔒 Security Considerations

### 1. Credit Validation BEFORE LLM

**CRITICAL**: Check credit **before** calling LLM to prevent abuse

```typescript
// ❌ WRONG: Check after LLM (user gets response for free)
const llmResult = await llmRouter.routeMessage(...)
if (creditBalance < -10) return 402

// ✅ CORRECT: Check before LLM (block early)
if (creditBalance < -10) return 402
const llmResult = await llmRouter.routeMessage(...)
```

### 2. Billing Failure Resilience

**CRITICAL**: Don't fail user request if billing fails

```typescript
try {
  await billingService.deductCredit(...)
} catch (error) {
  logger.error("[BILLING] Failed:", error)
  // ✅ Don't throw - user already got their response
  // ✅ Admin will see error in logs/monitoring
}
```

### 3. Owner-Level Billing (Feature 198)

**CRITICAL**: Credit is deducted from **owner** (User), not workspace

- Multiple workspaces share same owner credit
- Workspace acts as tracking reference only
- `billingTransaction.userId` is REQUIRED (owner ID)
- `billingTransaction.workspaceId` is OPTIONAL (for analytics)

---

## 📈 Monitoring & Alerts

### Key Metrics

1. **Widget usage vs WhatsApp**
   - Total messages per channel
   - Cost comparison
   - Conversion rate (visitor → registered customer)

2. **Credit exhaustion**
   - Track owners reaching -$10 threshold
   - Alert when owner balance < $0
   - Notify before hitting limit

3. **Billing failures**
   - Monitor failed `deductOwnerWidgetMessageCredit` calls
   - Alert on repeated failures (indicates bug)

### Log Patterns

```
[WIDGET-BILLING] 💰 Widget message charged: $0.005 deducted. New balance: $49.995
[WIDGET-BILLING] ⚠️ No owner for workspace {id} - skipping billing
[WIDGET-BILLING] ❌ Failed to deduct widget message credit: {error}
[WIDGET-BILLING] 🚫 Credit limit reached: ${currentBalance} < -$10.00
[WIDGET-BILLING] ⚠️ Negative balance: ${currentBalance} (within -$10 threshold)
```

---

## 🔄 Comparison: Widget vs WhatsApp Billing

| Aspect | WhatsApp | Widget |
|--------|----------|--------|
| **Price** | $0.10/msg | $0.005/msg |
| **Trigger** | After queue delivery | After LLM response |
| **Flow** | Async (queue) | Sync (immediate) |
| **Service** | `BillingService.trackMessage()` | `SubscriptionBillingService.deductOwnerWidgetMessageCredit()` |
| **Config Key** | `MESSAGE` | `WIDGET_MESSAGE` |
| **referenceType** | `"message"` | `"widget_message"` |
| **Credit check** | In queue processor | In controller (before LLM) |
| **Failure handling** | Log + continue queue | Log + still respond |
| **Customer type** | Registered | Anonymous visitor |
| **E-commerce** | ✅ Enabled | ❌ Disabled |

---

## 📚 Related Documentation

- [Billing System](./billing.md) - Complete billing architecture
- [Subscription & Billing](../../features/subscription-billing.md) - Feature 198 overview
- [Playground & Debug Mode](./playground-debugmode.md) - Testing without billing
- [Widget Unification](../../analysis/widget-unification-plan.md) - Original widget architecture

---

## 🎯 Summary

✅ **Widget messages cost $0.005** (95% less than WhatsApp)  
✅ **Same -$10 overdraft limit** as WhatsApp  
✅ **Credit checked BEFORE LLM** (prevents abuse)  
✅ **Billing happens AFTER response** (but always deducted)  
✅ **Transactions recorded** in `BillingTransaction` table  
✅ **Appears in invoices** alongside WhatsApp charges  
✅ **Channel offline** → Widget hidden or WIP message  
✅ **Debug mode** → WIP message, no billing  
✅ **Billing failure** → User still gets response (resilience)  

**Next Steps**:
1. Deploy to production (v221)
2. Monitor billing transactions for widget messages
3. Update customer-facing pricing page with widget cost
4. Add widget usage analytics to dashboard
