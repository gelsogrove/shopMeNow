# 💰 eChatbot Billing Flow - Complete Documentation

**Version**: 1.2.0  
**Last Updated**: January 2, 2026  
**Feature**: 185-subscription-billing-system  

---

## 🔑 CRITICAL: Subscription vs Credit (Two Separate Systems)

### ⚠️ IMPORTANT DISTINCTION

eChatbot uses **TWO INDEPENDENT BILLING SYSTEMS**:

1. **💳 Subscription Fee** (Monthly Payment)
   - **What**: Fixed monthly cost for the plan (€29 Basic, €49 Premium, €129 Enterprise)
   - **How Paid**: External payment (PayPal/Stripe) - charged on 1st of each month
   - **Effect**: Covers platform access, features, and limits
   - **Does NOT touch**: `user.creditBalance` field
   - **Transaction Type**: `MONTHLY_FEE`

2. **💰 Credit Balance** (Pay-as-you-go)
   - **What**: Prepaid credits for WhatsApp operations
   - **Used For**: WhatsApp messages ($0.10), widget messages ($0.05), orders ($1.50), push campaigns ($1.00)
   - **Recharged**: Manually via "Ricarica" button ($10-$1000)
   - **Shared**: Across all owner's workspaces
   - **Field**: `user.creditBalance`
   - **Transaction Types**: `MESSAGE`, `ORDER`, `PUSH_NOTIFICATION`, `RECHARGE`

### 💡 Example Flow

```
User: Andrea (Enterprise Plan)
├─ Monthly Subscription: €129/month → Paid externally (PayPal) on 1st of month
│   └─ Effect: subscriptionStatus = 'ACTIVE', nextBillingDate updated
│       ❌ Credit balance NOT touched
│
└─ Credit Balance: €196.90 → Used ONLY for WhatsApp operations
    ├─ Customer message: -€0.10 → Balance: €196.80
    ├─ Order created: -€1.50 → Balance: €195.30
    ├─ Push campaign: -€1.00 → Balance: €194.30
   └─ Manual recharge: +$100 → Balance: $294.30
```

### 🚨 Common Misconceptions

❌ **WRONG**: "Monthly billing resets credit balance to €0"  
✅ **CORRECT**: "Monthly billing charges subscription fee externally, credit balance stays unchanged"

❌ **WRONG**: "Credit balance includes subscription fee"  
✅ **CORRECT**: "Credit balance is ONLY for WhatsApp messages/operations"

❌ **WRONG**: "Subscription fee is deducted from credit balance"  
✅ **CORRECT**: "Subscription fee is charged externally (PayPal/Stripe), separate from credits"

---

## ⏸️ Pause/Resume Subscription Flow (IMPORTANT)

### Pause Flow - IMMEDIATE EFFECT
```
User clicks "Pause Subscription"
         ↓
API: PUT /api/subscription-billing/owner/pause
         ↓
Database Update:
  • subscriptionStatus = 'PAUSED'
  • pausedAt = NOW
  • pauseRequestedAt = NOW
         ↓
CHATBOT STOPS IMMEDIATELY
  • WorkspaceAccessService.canProcessMessages() returns FALSE
  • BlockReason = 'PAUSED'
  • Customer messages silently ignored
         ↓
Monthly Billing (1st of month):
  • If paused before the month starts → NO subscription fee for that month
  • If paused during the month → subscription fee applies, usage billed only up to pausedAt
  • User keeps current credit balance
```

### Resume Flow - IMMEDIATE EFFECT
```
User clicks "Resume Subscription"
         ↓
API: PUT /api/subscription-billing/owner/resume
         ↓
Database Update:
  • subscriptionStatus = 'ACTIVE'
  • pausedAt = NULL
  • pauseRequestedAt = NULL
         ↓
CHATBOT RESUMES IMMEDIATELY
  • WorkspaceAccessService.canProcessMessages() returns TRUE
  • Customer messages processed normally
         ↓
Next 1st of Month:
  • User charged normally for active months
```

### Key Points:
- **IMMEDIATE**: Pause/Resume take effect instantly (not end-of-month)
- **NO MONTHLY FEE WHEN FULLY PAUSED**: If the user is paused before a month starts, that month has no subscription fee.
- **PAUSE MONTH**: If pause happens mid-month, the subscription fee applies and usage is billed only until `pausedAt`.
- **ALL WORKSPACES**: Pause affects ALL workspaces owned by the user
- **CREDIT PRESERVED**: Credit balance stays unchanged while paused

---

## 📊 Overview

eChatbot uses a **prepaid credit system** combined with **subscription plans**. Every operation (message, order, push) deducts from the workspace credit balance in real-time.

### Business Model Summary

| Plan | Monthly Fee | Channels | Products | Customers | Initial Credit |
|------|-------------|----------|----------|-----------|----------------|
| **FREE_TRIAL** | €0 (14 days) | 1 | 50 | 50 | €29.00 |
| **BASIC** | €29/month | 1 | 50 | 50 | - |
| **PREMIUM** | €49/month | 2 | 100 | 100 | - |
| **ENTERPRISE** | Custom | ∞ | ∞ | ∞ | - |

**Customers/Leads count**: includes all customers and leads that are **not deleted** (`deletedAt = null`) and **not blacklisted** (`isBlacklisted = false`), regardless of registration status. Playground test customers are excluded.

### Operation Costs (from `BillingPrices` enum)

| Operation | Cost | Enum Key | When Charged |
|-----------|------|----------|--------------|
| WhatsApp Message | $0.10 | `MESSAGE` | After successful WhatsApp delivery |
| Widget Message | $0.05 | `MESSAGE` | After successful widget response |
| Welcome Message | €1.00 | `WELCOME_MESSAGE` | On new customer creation |
| New Order | €1.50 | `NEW_ORDER` | On order creation |
| New Customer | €1.00 | `NEW_CUSTOMER` | On registration |
| Push Campaign | €1.00 | `PUSH_CAMPAIGN` | On push send |
| Chatbot Reactivation | €0.20 | `PUSH_CHATBOT_REACTIVATED` | On reactivation push |

> **⚠️ IMPORTANT**: WhatsApp messages are charged **ONLY** when successfully delivered.
> If `debugMode=true` or WhatsApp send fails, **NO billing occurs**.

---

## 🔄 Complete Billing Flow

### 1. New User Registration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEW USER REGISTRATION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User registers on website                                    │
│         ↓                                                        │
│  2. System creates:                                              │
│     • User account                                               │
│     • First Workspace with:                                      │
│       - plan = FREE_TRIAL                                        │
│       - creditBalance = €29.00                                   │
│       - trialEndsAt = now + 14 days                             │
│       - nextBillingDate = 1st of next month                     │
│         ↓                                                        │
│  3. User can now:                                                │
│     • Add products (max 50)                                      │
│     • Receive customers (max 50)                                 │
│     • Use 1 WhatsApp channel                                     │
│     • Credit deducted per operation                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. WhatsApp Message Processing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              WHATSAPP MESSAGE PROCESSING                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Customer sends WhatsApp message                                 │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ GATE 1: Is Trial Valid?             │                        │
│  │ billingService.isTrialValid()       │                        │
│  └───────────────┬─────────────────────┘                        │
│         ↓ YES              ↓ NO                                  │
│         │           ┌──────────────────┐                        │
│         │           │ BLOCK: TRIAL_    │                        │
│         │           │ EXPIRED          │                        │
│         │           │ HTTP 402         │                        │
│         │           │ Silent (no msg)  │                        │
│         │           └──────────────────┘                        │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ GATE 2: Has Sufficient Credit?      │                        │
│  │ billingService.checkCredit()        │                        │
│  │ Cost: $0.10 (MESSAGE)               │                        │
│  └───────────────┬─────────────────────┘                        │
│         ↓ YES              ↓ NO                                  │
│         │           ┌──────────────────┐                        │
│         │           │ BLOCK:           │                        │
│         │           │ INSUFFICIENT_    │                        │
│         │           │ CREDIT           │                        │
│         │           │ HTTP 402         │                        │
│         │           │ Silent (no msg)  │                        │
│         │           └──────────────────┘                        │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ GATE 3: Customer Limit OK?          │                        │
│  │ billingService.checkPlanLimits()    │                        │
│  │ (only for NEW customers)            │                        │
│  └───────────────┬─────────────────────┘                        │
│         ↓ YES              ↓ NO                                  │
│         │           ┌──────────────────┐                        │
│         │           │ BLOCK: CUSTOMER_ │                        │
│         │           │ LIMIT_REACHED    │                        │
│         │           │ HTTP 403         │                        │
│         │           │ Silent (no msg)  │                        │
│         │           └──────────────────┘                        │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ ✅ All gates passed!                 │                        │
│  │ Process with LLM Router             │                        │
│  └───────────────┬─────────────────────┘                        │
│         ↓                                                        │
│  Message saved to DB (NO billing here)                           │
│         ↓                                                        │
│  Message goes to WhatsApp Queue (status: "pending")              │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ WhatsAppQueueService.processPending │                        │
│  └───────────────┬─────────────────────┘                        │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ Check: debugMode enabled?           │                        │
│  └───────────────┬─────────────────────┘                        │
│         ↓ NO               ↓ YES                                 │
│         │           ┌──────────────────┐                        │
│         │           │ SKIP: Message    │                        │
│         │           │ stays "pending"  │                        │
│         │           │ ❌ NO BILLING    │                        │
│         │           └──────────────────┘                        │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ Send via WhatsApp API               │                        │
│  └───────────────┬─────────────────────┘                        │
│         ↓ SUCCESS          ↓ FAIL                                │
│         │           ┌──────────────────┐                        │
│         │           │ status: "error"  │                        │
│         │           │ ❌ NO BILLING    │                        │
│         │           └──────────────────┘                        │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ status: "sent"                      │                        │
│  │ 💰 BILLING: deductMessageCredit()   │                        │
│  │ Credit deducted AFTER send success  │                        │
│  │ €0.10 deducted from creditBalance   │                        │
│  └─────────────────────────────────────┘                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3. New Customer (Welcome Message) Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              NEW CUSTOMER WELCOME FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  New phone number contacts WhatsApp                              │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ Check: Is user blocked?             │                        │
│  │ (too many registration attempts)    │                        │
│  └───────────────┬─────────────────────┘                        │
│         ↓ NO               ↓ YES                                 │
│         │           ┌──────────────────┐                        │
│         │           │ BLOCK: BLACKLIST │                        │
│         │           │ No response      │                        │
│         │           └──────────────────┘                        │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ GATE 1: Is Trial Valid?             │                        │
│  └───────────────┬─────────────────────┘                        │
│         ↓ YES              ↓ NO → TRIAL_EXPIRED (HTTP 402)      │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ GATE 2: Has Credit for Welcome?     │                        │
│  │ Cost: €1.00 (WELCOME_MESSAGE)       │                        │
│  └───────────────┬─────────────────────┘                        │
│         ↓ YES              ↓ NO → INSUFFICIENT_CREDIT (HTTP 402)│
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ GATE 3: Customer Limit OK?          │                        │
│  │ Current: X/50 (or X/100 Premium)    │                        │
│  └───────────────┬─────────────────────┘                        │
│         ↓ YES              ↓ NO → CUSTOMER_LIMIT_REACHED (403)  │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ ✅ Create Customer record           │                        │
│  │ ✅ Generate Registration Link       │                        │
│  │ ✅ Send Welcome Message             │                        │
│  │ 💰 Track: €1.00 (WELCOME_MESSAGE)   │                        │
│  └─────────────────────────────────────┘                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Product/Customer Creation Flow (Admin Panel)

```
┌─────────────────────────────────────────────────────────────────┐
│              PRODUCT CREATION (Admin Panel)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Admin clicks "Add Product"                                      │
│         ↓                                                        │
│  API: POST /workspaces/:id/products                              │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ MIDDLEWARE: checkPlanLimits         │                        │
│  │ billingService.checkPlanLimits(     │                        │
│  │   workspaceId, "products"           │                        │
│  │ )                                   │                        │
│  └───────────────┬─────────────────────┘                        │
│         ↓ Within Limits    ↓ Exceeded                            │
│         │           ┌──────────────────┐                        │
│         │           │ BLOCK: PLAN_     │                        │
│         │           │ LIMIT_REACHED    │                        │
│         │           │ HTTP 403         │                        │
│         │           │ "Limite raggiunto│                        │
│         │           │  50/50 prodotti" │                        │
│         │           └──────────────────┘                        │
│         ↓                                                        │
│  ✅ Product Created Successfully                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏦 Credit Management

### Credit Deduction Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              CREDIT DEDUCTION (SHARED ACROSS WORKSPACES)         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Operation completes successfully                                │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ 1. Get workspace owner              │                        │
│  │    ownerId = workspace.ownerId      │                        │
│  └───────────────┬─────────────────────┘                        │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ 2. Update ALL owner's workspaces    │                        │
│  │    prisma.workspace.updateMany({    │                        │
│  │      where: { ownerId, isActive },  │                        │
│  │      data: {                        │                        │
│  │        creditBalance: { decrement } │                        │
│  │      }                              │                        │
│  │    })                               │                        │
│  └───────────────┬─────────────────────┘                        │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ 3. Create BillingTransaction record │                        │
│  │    type: MESSAGE/ORDER/etc          │                        │
│  │    amount: -€0.15                   │                        │
│  │    balanceAfter: new balance        │                        │
│  └─────────────────────────────────────┘                        │
│                                                                  │
│  📝 NOTE: Credit is SHARED across all workspaces of same owner  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Credit Recharge Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              CREDIT RECHARGE                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Owner clicks "Ricarica" button                                  │
│         ↓                                                        │
│  API: POST /workspaces/:id/billing/recharge                      │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ MIDDLEWARE: requireOwnerForBilling  │                        │
│  │ Only SUPER_ADMIN can recharge       │                        │
│  └───────────────┬─────────────────────┘                        │
│         ↓ Is Owner         ↓ Not Owner                           │
│         │           ┌──────────────────┐                        │
│         │           │ BLOCK: OWNER_    │                        │
│         │           │ REQUIRED         │                        │
│         │           │ HTTP 403         │                        │
│         │           └──────────────────┘                        │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ 1. Process payment (simulated)      │                        │
│  │ 2. Increment creditBalance          │                        │
│  │ 3. Create BillingTransaction        │                        │
│  │    type: RECHARGE                   │                        │
│  │    amount: +$50.00                  │                        │
│  └─────────────────────────────────────┘                        │
│         ↓                                                        │
│  ✅ Credit Updated, Service Resumes                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Payment Failure Tracking (Future Payment Flow)

- `user.paymentFailureCount` increments on each failed payment attempt.
- `user.lastPaymentFailedAt` stores the last failure timestamp.
- Service blocking occurs only when `paymentFailureCount >= 3`.
- On successful payment, reset `paymentFailureCount` to 0 and set `subscriptionStatus = ACTIVE`.

---

## 📅 Billing Cycle

### Monthly Billing Date Rule

```
┌─────────────────────────────────────────────────────────────────┐
│              BILLING DATE: 1st OF NEXT MONTH                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Today: November 15, 2025                                        │
│         ↓                                                        │
│  User upgrades from BASIC → PREMIUM                              │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ IMMEDIATE EFFECTS:                  │                        │
│  │ ✅ Plan = PREMIUM (immediate)        │                        │
│  │ ✅ Limits = 2 channels, 100 products │                        │
│  │ ✅ Features = Brand customization    │                        │
│  └───────────────┬─────────────────────┘                        │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ BILLING EFFECTS:                    │                        │
│  │ nextBillingDate = December 1, 2025  │                        │
│  │ (always 1st of next month)          │                        │
│  │                                     │                        │
│  │ On Dec 1: €49.00 charged for        │                        │
│  │ December subscription               │                        │
│  └─────────────────────────────────────┘                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## � Recharge Credit - Preset Amounts

### Available Tiers (Updated January 2026)

When users click "Recharge Credit" button, they can choose from:

| Amount | Currency | Use Case |
|--------|----------|----------|
| **$10** | USD | Budget-friendly quick recharge |
| **$30** | USD | Standard recharge |
| **$50** | USD | Good value option |
| **$100** | USD | Large recharge for heavy users |

### Implementation Details

- **File**: `frontend/src/components/billing/BillingSection.tsx`
- **Constant**: `RECHARGE_OPTIONS` (lines 106-110)
- **UI**: 4-column button grid in modal dialog
- **Min amount**: $10 (enforced on backend)
- **Max amount**: $1000 (enforced on backend)
- **Currency**: USD (billing and recharges)

### How to Modify Amounts

To change recharge amounts globally:

1. Edit `frontend/src/components/billing/BillingSection.tsx`:
   ```typescript
   const RECHARGE_OPTIONS: RechargeAmountOption[] = [
     { value: 10, label: "$10" },
     // ... modify values here
   ]
   ```

2. Update tests in `frontend/__tests__/components/BillingSection.spec.tsx`

3. Verify frontend hot-reload applies changes

### Backend Validation

Backend enforces:
- **Minimum**: $10 (prevent abuse)
- **Maximum**: $1000 (prevent data errors)
- **Only owners** can recharge (role check)
- **Sufficient balance** before deduction

---

## �🔗 Key Files Reference

| Component | File Path |
|-----------|-----------|
| **Billing Service** | `backend/src/application/services/subscription-billing.service.ts` |
| **Billing Middleware** | `backend/src/interfaces/http/middlewares/billing.middleware.ts` |
| **Billing Prices Enum** | `backend/src/domain/enums/billing-prices.enum.ts` |
| **Billing Repository** | `backend/src/repositories/subscription-billing.repository.ts` |
| **Billing Controller** | `backend/src/interfaces/http/controllers/subscription-billing.controller.ts` |
| **WhatsApp Queue Service** | `backend/src/services/whatsapp-queue.service.ts` |
| **Message Repository** | `backend/src/repositories/message.repository.ts` |

---

## 🧾 Admin Workflow – Manual Disable & Collections Flow

1. **Manual Disable Only** – The only way to stop a customer is via the **Enabled** toggle on the Clients page (`PUT /api/users/admin/:userId/status`). Toggling to `DISABLED` cascades to all workspaces (sets `isActive=false`, `channelStatus=false`), so chatbots stop responding and logins are blocked. Re‑enabling restores all workspaces. `PAYMENT_FAILED` never triggers a block by itself.
2. **Collections Tabs**
   - **Current Month**: tracking only (no payments, no credit notes, no downloads). Use it to monitor the live totals for the current month.
   - **Previous Month**: this is the month to charge on the 1st. It stays in the list until a payment succeeds. If payment fails, it remains here.
   - **History**: paid invoices only. Credit notes live **only here**, and each credit note has its own document.
3. **Process Payment** – The Collections page calls `/api/users/admin/invoices/:invoiceId/paypal/mock-payment`. The button is disabled once the invoice status becomes `PAID`, so we never run the same payment twice. A success updates `paidAt` and moves the invoice into **History**.
4. **Adjustments vs Credit Notes**
   - **Adjustments**: only before payment (Previous Month), used to correct totals prior to charging.
   - **Credit Notes**: only after payment (History), used for post‑charge corrections and refunds.
5. **Notes** – Admin notes are stored on the invoice and follow it across tabs. Notes are tied to the invoice ID.

### Invoice Numbering (Global Sequence)
- **Format**: `YYYYMMDD-0001` (example: `20251201-0001`)
- **When assigned**: at payment time (`paidAt`) so the number reflects the **economic transaction date**.
- **Uniqueness**: global sequence shared across all owners (not per customer).
- **PDF naming**:
  - Invoice: `YYYYMMDD-0001.pdf`
  - Credit note: `CN-YYYYMMDD-0001.pdf`

### Invoice Totals (formula)
`total = subscription + usage + credit debt + adjustments + recharges + tax`

> Credit notes are **never** part of the billed total. They are issued as separate documents in **History** only.
> Recharges are included in the billed total; if this changes, update the formula and UI labels accordingly.

### Rounding (shared)
All billing totals (subtotals, taxes, totals) are rounded to the nearest **$0.10** for consistency across backoffice, app, and PDFs.

---

## 📚 Related Documentation

- [BLOCKING_SYSTEM.md](./BLOCKING_SYSTEM.md) - Complete blocking conditions
- [PRICING_CENTRALIZATION_SUMMARY.md](./PRICING_CENTRALIZATION_SUMMARY.md) - Pricing enum details
- [specs/185-subscription-billing-system/spec.md](../specs/185-subscription-billing-system/spec.md) - Feature spec
