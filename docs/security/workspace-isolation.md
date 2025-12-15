# 🔐 CRITICAL SECURITY AUDIT: Workspace/Owner Isolation

**Date**: December 1, 2025  
**Auditor**: AI Security Agent  
**Requested by**: Andrea  

---

## 📋 Executive Summary

This audit analyzed **ALL database queries** in the eChatbot codebase to verify proper workspace/owner isolation. The goal was to ensure that **messages, channels, products, statistics, billing, and invoices NEVER mix between different owners/workspaces**.

### Overall Assessment: ⚠️ MODERATE RISK

**Found Issues**: 12 potential security vulnerabilities  
**Critical**: 4  
**Medium**: 5  
**Low**: 3  

---

## 🚨 CRITICAL ISSUES (Immediate Fix Required)

### 1. **CartRepository - removeItem() missing workspaceId filter**
**File**: `apps/backend/src/repositories/cart.repository.ts:190`
**Risk**: A user could delete cart items from ANY workspace if they know the item ID.

```typescript
// ❌ CURRENT (VULNERABLE)
async removeItem(cartItemId: string) {
  await this.prisma.cartItems.delete({
    where: { id: cartItemId }
  })
}

// ✅ FIX NEEDED
async removeItem(cartItemId: string, workspaceId: string) {
  await this.prisma.cartItems.delete({
    where: { 
      id: cartItemId,
      cart: { workspaceId } // Add workspace validation
    }
  })
}
```

### 2. **CartRepository - updateItemQuantity() missing workspaceId filter**
**File**: `apps/backend/src/repositories/cart.repository.ts:206`
**Risk**: A user could modify cart item quantities in ANY workspace.

```typescript
// ❌ CURRENT (VULNERABLE)
async updateItemQuantity(cartItemId: string, newQuantity: number) {
  await this.prisma.cartItems.update({
    where: { id: cartItemId },
    data: { quantity: newQuantity, updatedAt: new Date() }
  })
}

// ✅ FIX NEEDED
async updateItemQuantity(cartItemId: string, newQuantity: number, workspaceId: string) {
  // First verify cart belongs to workspace
  const item = await this.prisma.cartItems.findFirst({
    where: { id: cartItemId, cart: { workspaceId } }
  })
  if (!item) throw new Error("Cart item not found")
  
  await this.prisma.cartItems.update({
    where: { id: cartItemId },
    data: { quantity: newQuantity, updatedAt: new Date() }
  })
}
```

### 3. **CartRepository - clearCart() missing workspaceId filter**
**File**: `apps/backend/src/repositories/cart.repository.ts:226`
**Risk**: A user could clear cart items from ANY workspace if they know the cart ID.

```typescript
// ❌ CURRENT (VULNERABLE)
async clearCart(cartId: string) {
  await this.prisma.cartItems.deleteMany({
    where: { cartId }
  })
}

// ✅ FIX NEEDED
async clearCart(cartId: string, workspaceId: string) {
  await this.prisma.cartItems.deleteMany({
    where: { 
      cartId,
      cart: { workspaceId } // Add workspace validation
    }
  })
}
```

### 4. **WhatsAppQueueRepository - delete() missing workspaceId filter**
**File**: `apps/backend/src/repositories/whatsapp-queue.repository.ts:160`
**Risk**: A user could delete WhatsApp queue messages from ANY workspace.

```typescript
// ❌ CURRENT (VULNERABLE)
async delete(id: string): Promise<void> {
  await this.prisma.whatsAppQueue.delete({
    where: { id }
  })
}

// ✅ FIX NEEDED
async delete(id: string, workspaceId: string): Promise<void> {
  await this.prisma.whatsAppQueue.delete({
    where: { id, workspaceId }
  })
}
```

---

## ⚠️ MEDIUM ISSUES (Should Fix Soon)

### 5. **OfferRepository - delete() missing workspaceId filter**
**File**: `apps/backend/src/repositories/offer.repository.ts:283`
**Risk**: An offer from another workspace could be deleted if ID is known.

```typescript
// ❌ CURRENT (VULNERABLE)
async delete(id: string): Promise<boolean> {
  await prisma.offers.delete({
    where: { id }
  })
}

// ✅ FIX NEEDED
async delete(id: string, workspaceId: string): Promise<boolean> {
  await prisma.offers.delete({
    where: { id, workspaceId }
  })
}
```

### 6. **CertificationRepository - delete() weak validation**
**File**: `apps/backend/src/repositories/certification.repository.ts:80`
**Risk**: Accepts workspaceId parameter but doesn't use it in the delete query.

```typescript
// ❌ CURRENT (WEAK)
async delete(id: string, workspaceId: string): Promise<void> {
  await this.prisma.certification.delete({
    where: { id } // workspaceId parameter ignored!
  })
}

// ✅ FIX NEEDED
async delete(id: string, workspaceId: string): Promise<void> {
  await this.prisma.certification.delete({
    where: { id, workspaceId } // Use workspaceId
  })
}
```

### 7. **TransportTypeRepository - delete() weak validation**
**File**: `apps/backend/src/repositories/transport-type.repository.ts:80`
**Risk**: Accepts workspaceId parameter but doesn't use it in the delete query.

```typescript
// ❌ CURRENT (WEAK)
async delete(id: string, workspaceId: string): Promise<void> {
  await this.prisma.transportType.delete({
    where: { id } // workspaceId parameter ignored!
  })
}

// ✅ FIX NEEDED
async delete(id: string, workspaceId: string): Promise<void> {
  await this.prisma.transportType.delete({
    where: { id, workspaceId } // Use workspaceId
  })
}
```

### 8. **CartRepository - getItemById() missing workspaceId filter**
**File**: `apps/backend/src/repositories/cart.repository.ts:244`
**Risk**: Could leak cart item information from other workspaces.

```typescript
// ❌ CURRENT (VULNERABLE)
async getItemById(cartItemId: string) {
  return await this.prisma.cartItems.findUnique({
    where: { id: cartItemId },
    include: { product: true, service: true }
  })
}

// ✅ FIX NEEDED
async getItemById(cartItemId: string, workspaceId: string) {
  return await this.prisma.cartItems.findFirst({
    where: { 
      id: cartItemId,
      cart: { workspaceId }
    },
    include: { product: true, service: true }
  })
}
```

### 9. **UserRepository - findAll() no workspace filter**
**File**: `apps/backend/src/repositories/user.repository.ts:74`
**Risk**: Returns ALL users in the system without workspace filtering.
**Note**: This may be intentional for platform admin functionality, but should be documented.

```typescript
// ⚠️ CURRENT (CHECK IF INTENTIONAL)
async findAll(): Promise<User[]> {
  const users = await this.prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
  })
  return users.map(user => this.mapToDomain(user))
}
```

---

## 📋 LOW ISSUES (Review & Document)

### 10. **CartRepository - getOrCreateCart() weak workspaceId enforcement**
**File**: `apps/backend/src/repositories/cart.repository.ts:56`
**Risk**: When finding existing cart, it only uses `customerId` without workspace validation.

```typescript
// ⚠️ CURRENT (WEAK)
let cart = await this.prisma.carts.findUnique({
  where: { customerId }  // No workspaceId check!
})
```
**Note**: Since `customerId` is unique per workspace (enforced by DB schema), this may be safe, but explicit workspaceId check is better.

### 11. **MessageRepository - findCustomerByPhone() optional workspaceId**
**File**: `apps/backend/src/repositories/message.repository.ts:409`
**Risk**: workspaceId is optional, which could return customers from wrong workspace.

```typescript
// ⚠️ CURRENT (RISKY)
async findCustomerByPhone(phoneNumber: string, workspaceId?: string) {
  const where: Prisma.CustomersWhereInput = { phone: phoneNumber }
  if (workspaceId) {
    where.workspaceId = workspaceId // Optional!
  }
  return customer
}
```
**Recommendation**: Make workspaceId mandatory.

### 12. **WhatsAppQueueRepository - checkDuplicate() missing workspaceId**
**File**: `apps/backend/src/repositories/whatsapp-queue.repository.ts:178`
**Risk**: Duplicate check looks across all workspaces, not just current workspace.

```typescript
// ⚠️ CURRENT (WEAK)
async checkDuplicate(customerId: string, content: string, withinMinutes: number = 1) {
  const existing = await this.prisma.whatsAppQueue.findFirst({
    where: {
      customerId,
      messageContent: content,
      createdAt: { gte: timeThreshold }
    }
  })
  // No workspaceId filter!
}
```

---

## ✅ PROPERLY ISOLATED (Good Examples)

The following repositories have **correct workspace isolation**:

| Repository | Status | Notes |
|------------|--------|-------|
| `ProductRepository` | ✅ SECURE | All queries filter by workspaceId |
| `OrderRepository` | ✅ SECURE | All queries filter by workspaceId |
| `CustomerRepository` | ✅ SECURE | All queries filter by workspaceId |
| `CategoryRepository` | ✅ SECURE | All queries filter by workspaceId |
| `ServiceRepository` | ✅ SECURE | All queries filter by workspaceId |
| `FAQRepository` | ✅ SECURE | All queries filter by workspaceId |
| `AgentConfigRepository` | ✅ SECURE | All queries filter by workspaceId |
| `SalesRepository` | ✅ SECURE | All queries filter by workspaceId |
| `GdprRepository` | ✅ SECURE | All queries filter by workspaceId |
| `SettingsRepository` | ✅ SECURE | All queries filter by workspaceId |
| `SupplierRepository` | ✅ SECURE | All queries filter by workspaceId |
| `ConversationMessageRepository` | ✅ SECURE | All queries filter by workspaceId |
| `AgentConversationLogRepository` | ✅ SECURE | All queries filter by workspaceId |
| `SearchConversationRepository` | ✅ SECURE | All queries filter by workspaceId |

---

## 💰 BILLING/SUBSCRIPTION ISOLATION ANALYSIS

### SubscriptionBillingRepository

| Method | Status | Notes |
|--------|--------|-------|
| `getWorkspaceBilling()` | ✅ | Filters by workspaceId |
| `getCreditBalance()` | ✅ | Filters by workspaceId |
| `deductCredit()` | ✅ | Uses transaction with workspaceId |
| `addCredit()` | ✅ | Uses transaction with workspaceId |
| `getTransactionHistory()` | ✅ | Correctly aggregates by ownerId across owner's workspaces |
| `getWorkspaceUsage()` | ✅ | Correctly aggregates by ownerId |

### BillingService

| Method | Status | Notes |
|--------|--------|-------|
| `trackMessage()` | ⚠️ REVIEW | Updates ALL owner's workspaces with shared credit - **intentional behavior** |
| `getBillingSummary()` | ✅ | Filters by workspaceId |
| `getCurrentTotal()` | ✅ | Filters by workspaceId |
| `getMonthlyBreakdown()` | ✅ | Filters by workspaceId |

### Credit Note Service

| Method | Status | Notes |
|--------|--------|-------|
| `createCreditNote()` | ✅ | Validates order.workspaceId |
| `getCreditNotesByOrderId()` | ✅ | Validates order.workspaceId |
| `getCreditNoteById()` | ✅ | Joins with order.workspaceId |
| `getAllCreditNotes()` | ✅ | Filters by order.workspaceId |
| `deleteCreditNote()` | ✅ | Validates order.workspaceId before delete |

---

## 📊 ANALYTICS & STATISTICS

### AnalyticsService

| Method | Status | Notes |
|--------|--------|-------|
| `getDashboardAnalytics()` | ✅ | All queries use workspaceId |
| `generateOrderTrends()` | ✅ | Raw query includes workspaceId |
| `generateRevenueTrends()` | ✅ | Raw query includes workspaceId |
| `generateCustomerTrends()` | ✅ | Raw query includes workspaceId |
| `generateMessageTrends()` | ✅ | Joins chat_sessions by workspaceId |
| `generateUsageCostTrends()` | ✅ | Billing table filtered by workspaceId |
| `generateCategoryTrends()` | ✅ | Raw query includes workspaceId |
| `getTopProducts()` | ✅ | Filters products by workspaceId |
| `getTopCustomers()` | ✅ | Filters by workspaceId |
| `getTopSellers()` | ✅ | Filters by workspaceId |
| `getSystemLogs()` | ✅ | Billing filtered by workspaceId |

---

## 🎯 VARIABLE REPLACEMENT (Prompt Processing)

Based on review, the prompt processing service correctly:
- ✅ Gets products/offers/services filtered by workspaceId
- ✅ Gets agent configs filtered by workspaceId
- ✅ Replaces customer variables for workspace's customers only

---

## 🛠️ RECOMMENDED ACTIONS

### Priority 1 - CRITICAL (Fix This Week)
1. Fix `CartRepository.removeItem()` - Add workspaceId validation
2. Fix `CartRepository.updateItemQuantity()` - Add workspaceId validation
3. Fix `CartRepository.clearCart()` - Add workspaceId validation
4. Fix `WhatsAppQueueRepository.delete()` - Add workspaceId filter

### Priority 2 - MEDIUM (Fix This Sprint)
5. Fix `OfferRepository.delete()` - Add workspaceId parameter and filter
6. Fix `CertificationRepository.delete()` - Use workspaceId parameter
7. Fix `TransportTypeRepository.delete()` - Use workspaceId parameter
8. Fix `CartRepository.getItemById()` - Add workspaceId filter
9. Review `UserRepository.findAll()` - Document if intentional

### Priority 3 - LOW (Next Sprint)
10. Fix `CartRepository.getOrCreateCart()` - Add explicit workspaceId check
11. Make `MessageRepository.findCustomerByPhone()` workspaceId mandatory
12. Add workspaceId to `WhatsAppQueueRepository.checkDuplicate()`

---

## 📝 TESTING RECOMMENDATIONS

After fixes, add these security tests:

```typescript
describe('Workspace Isolation Security Tests', () => {
  it('should NOT allow deleting cart items from other workspaces', async () => {
    // Create cart in workspace A
    // Try to delete from workspace B context
    // Should fail with "Not found" error
  })

  it('should NOT allow viewing cart items from other workspaces', async () => {
    // Create cart in workspace A
    // Try to get item from workspace B context
    // Should return null
  })

  it('should NOT mix billing between owners', async () => {
    // Create transactions for owner A
    // Get transaction history for owner B
    // Should only see owner B's transactions
  })
})
```

---

## 📌 CONCLUSION

The eChatbot codebase has **generally good workspace isolation**, with the majority of repositories properly filtering by `workspaceId`. However, there are **12 specific issues** that need attention, with **4 being critical** security vulnerabilities in the Cart and WhatsApp Queue repositories.

The billing system correctly implements **shared credit balance across owner's workspaces** (channels), which is the intended design for multi-channel owners.

**Recommendation**: Address the 4 critical issues immediately, then work through the medium and low priority items in subsequent sprints.

---

*Report generated by AI Security Audit Agent*
