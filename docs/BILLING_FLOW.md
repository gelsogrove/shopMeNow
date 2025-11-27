# 💰 ShopME Billing Flow - Complete Documentation

**Version**: 1.0.0  
**Last Updated**: November 27, 2025  
**Feature**: 185-subscription-billing-system  

---

## 📊 Overview

ShopME uses a **prepaid credit system** combined with **subscription plans**. Every operation (message, order, push) deducts from the workspace credit balance in real-time.

### Business Model Summary

| Plan | Monthly Fee | Channels | Products | Customers | Initial Credit |
|------|-------------|----------|----------|-----------|----------------|
| **FREE_TRIAL** | €0 (14 days) | 1 | 50 | 50 | €29.00 |
| **BASIC** | €29/month | 1 | 50 | 50 | - |
| **PREMIUM** | €49/month | 2 | 100 | 100 | - |
| **ENTERPRISE** | Custom | ∞ | ∞ | ∞ | - |

### Operation Costs (from `BillingPrices` enum)

| Operation | Cost | Enum Key |
|-----------|------|----------|
| WhatsApp Message | €0.15 | `MESSAGE` |
| Welcome Message | €1.00 | `WELCOME_MESSAGE` |
| New Order | €1.50 | `NEW_ORDER` |
| New Customer | €1.00 | `NEW_CUSTOMER` |
| Push Campaign | €1.00 | `PUSH_CAMPAIGN` |
| Chatbot Reactivation | €0.20 | `PUSH_CHATBOT_REACTIVATED` |

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
│  │ Cost: €0.15 (MESSAGE)               │                        │
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
│  Message goes to WhatsApp Queue                                  │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ WhatsAppQueueService.processPending │                        │
│  │ Actually SENDS via WhatsApp API     │                        │
│  └───────────────┬─────────────────────┘                        │
│         ↓                                                        │
│  ┌─────────────────────────────────────┐                        │
│  │ 💰 BILLING: deductMessageCredit()   │                        │
│  │ Credit deducted AFTER send success  │                        │
│  │ €0.15 deducted from creditBalance   │                        │
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
│  │    amount: +€50.00                  │                        │
│  └─────────────────────────────────────┘                        │
│         ↓                                                        │
│  ✅ Credit Updated, Service Resumes                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

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

## 🔗 Key Files Reference

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

## 📚 Related Documentation

- [BLOCKING_SYSTEM.md](./BLOCKING_SYSTEM.md) - Complete blocking conditions
- [PRICING_CENTRALIZATION_SUMMARY.md](./PRICING_CENTRALIZATION_SUMMARY.md) - Pricing enum details
- [specs/185-subscription-billing-system/spec.md](../specs/185-subscription-billing-system/spec.md) - Feature spec

