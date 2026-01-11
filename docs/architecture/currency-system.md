# 💱 Currency System - Dynamic Multi-Currency Support

**Version**: 1.0.0  
**Last Updated**: January 9, 2026  
**Feature**: Multi-currency workspace support  

---

## 🌍 Overview

eChatbot supports **multi-currency billing** with dynamic currency selection per workspace:

- **Base Currency**: EUR (€) - default for European workspaces
- **Supported Currencies**: EUR, USD, GBP (easily extensible)
- **Selection**: Per workspace (stored in `workspace.currency` field)
- **Display**: Automatic formatting based on workspace setting

### Current Implementation

```
Workspace "eChatbot HQ" (Italy)
├─ Currency: EUR
├─ Credit: €198.90
├─ Plan: €129/month
└─ Recharges: €12 (this month)
```

---

## 🏗️ Architecture

### Frontend Currency Formatting

#### 1. **Primary Function**: `formatCurrency()` in `subscriptionBillingApi.ts`

```typescript
export const formatCurrency = (
  amount: number,
  currency?: string
): string => {
  if (!currency) {
    // Get workspace currency from localStorage
    const workspace = storage.getWorkspace<{ currency?: string }>()
    currency = workspace?.currency || "EUR"
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}
```

**Used by**:
- BillingSection component (credit balance, plan fees, transactions)
- BillingPage component (invoice totals)
- All billing-related components

#### 2. **Utility Function**: `getCurrencySymbol()` in `utils/format.ts`

```typescript
export const getCurrencySymbol = (currencyCode: string = "USD"): string => {
  // Returns symbol: € for EUR, $ for USD, £ for GBP
}
```

**Used by**:
- ProductsPage (product prices)
- ServicesPage (service pricing)
- Component UI labels

#### 3. **Workspace Selection**: `getWorkspaceCurrency()` in `utils/format.ts`

```typescript
const getWorkspaceCurrency = (): string => {
  const workspace = storage.getWorkspace<{ currency?: string }>()
  return workspace?.currency || 'EUR'
}
```

---

## 🔄 Currency Flow

### 1. Workspace Creation

```
User creates workspace "My Shop"
├─ Country: "Italy"
├─ Currency selected: "EUR"
└─ Stored in: workspace.currency (Prisma schema)
```

### 2. Frontend Rendering

```
Component mounts (e.g., BillingSection)
├─ Calls: getBillingOverview(workspaceId)
├─ API returns: { billing: { creditBalance: 198.90 } }
├─ Component calls: formatCurrency(198.90)
│   └─ Reads: workspace.currency from localStorage ("EUR")
└─ Displays: "€198.90"
```

### 3. API Response (Backend)

```typescript
// Backend returns amount as number (no currency)
{
  creditBalance: 198.90,        // Just the number
  totalRecharges: 12.00,        // Just the number
  monthlyFee: 129.00            // Just the number
}

// Frontend applies currency based on workspace
formatCurrency(198.90)  // Reads workspace.currency → "€198.90"
```

---

## 🔌 Integration Points

### BillingSection Component

```tsx
// File: frontend/src/components/billing/BillingSection.tsx

// Already integrated with dynamic currency:
{formatCurrency(billing.creditBalance)}          // € or $
{formatCurrency(billing.totalRecharges || 0)}    // € or $
{formatCurrency(planConfig.monthlyFee)}          // € or $
```

### LoginPage Home Display

```tsx
// File: frontend/src/pages/LoginPage.tsx

// Gets workspace currency on login:
const formattedCredit = userPlan?.creditBalance != null
  ? (() => {
      const workspace = storage.getWorkspace<{ currency?: string }>()
      const currency = workspace?.currency || "EUR"
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency,
      }).format(userPlan.creditBalance)
    })()
  : "--"
```

### BillingPage Component

```tsx
// File: frontend/src/pages/BillingPage.tsx

const formatCurrency = (amount: number) => {
  const { workspace } = useWorkspace()
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: workspace?.currency || "USD",
  }).format(amount)
}
```

---

## 🛠️ How to Add a New Currency

### Step 1: Add to SUPPORTED_CURRENCIES (utils/format.ts)

```typescript
const SUPPORTED_CURRENCIES = [
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },  // NEW
]
```

### Step 2: Update Backend Workspace Model

```prisma
model Workspace {
  // ...
  currency String @default("EUR")  // Add this if not exists
}
```

### Step 3: Update Admin UI (Backoffice)

When creating/editing workspace, add currency selector:

```tsx
<Select value={currency} onValueChange={setCurrency}>
  <option value="EUR">EUR (€)</option>
  <option value="USD">USD ($)</option>
  <option value="GBP">GBP (£)</option>
  <option value="JPY">JPY (¥)</option>
</Select>
```

### Step 4: Test

```typescript
// Test dynamic currency switching
const workspace1 = { currency: "EUR", creditBalance: 100 }
const workspace2 = { currency: "USD", creditBalance: 100 }

formatCurrency(100, "EUR")  // "€100.00"
formatCurrency(100, "USD")  // "$100.00"
```

---

## ⚠️ Known Limitations

| Issue | Status | Notes |
|-------|--------|-------|
| Backend storage | ✅ Done | Uses Prisma `workspace.currency` |
| Frontend display | ✅ Done | Dynamic formatting in all components |
| Conversion rates | ❌ Not implemented | All amounts stored in workspace's native currency |
| Multi-currency transactions | ❌ Future | Currently each workspace is single-currency |
| PayPal integration | ⚠️ Partial | May need currency conversion for external payments |

---

## 🔐 Security Notes

- **No Rate Conversion**: Amounts are NOT auto-converted (prevent losses)
- **Per-Workspace**: Each workspace has ONE fixed currency
- **User Responsibility**: Users select currency at workspace creation
- **Immutable**: Currency should NOT be changed after creation (prevents data inconsistency)

---

## 📝 Testing Checklist

- [ ] Create workspace with EUR, verify billing shows €
- [ ] Create workspace with USD, verify billing shows $
- [ ] Switch workspaces, verify currency updates
- [ ] Refresh page, verify currency persists
- [ ] Test with different browsers (localStorage isolation)
- [ ] Verify Intl.NumberFormat handles all supported currencies
- [ ] Test edge cases (negative amounts, very large amounts)

---

## 🔗 Related Files

| Component | File | Purpose |
|-----------|------|---------|
| **Format Currency** | `frontend/src/services/subscriptionBillingApi.ts` | Main formatting function |
| **Utility Functions** | `frontend/src/utils/format.ts` | Helper currency functions |
| **BillingSection** | `frontend/src/components/billing/BillingSection.tsx` | Displays credit/fees |
| **BillingPage** | `frontend/src/pages/BillingPage.tsx` | Billing overview page |
| **LoginPage** | `frontend/src/pages/LoginPage.tsx` | Home screen credit display |
| **Backoffice** | `apps/backoffice/src/pages/CollectionsPage.tsx` | Admin billing view |
| **Database Schema** | `packages/database/prisma/schema.prisma` | Workspace currency field |

---

## 📚 References

- [GDPR Privacy Policy](../security/gdpr-compliance.md) - Billing data handling
- [Billing Architecture](./billing.md) - Subscription & credit system
- [Storage System](./storage.md) - localStorage structure
