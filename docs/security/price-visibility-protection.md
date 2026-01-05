# Feature 174: Rule #4 - Price Visibility Protection Guide

## 🔒 CRITICAL BUSINESS RULE
**Non-registered users (isActive=false) MUST NEVER see prices**

This document describes the complete data flow and critical points to protect against future regressions.

---

## 📊 Data Flow Chain (DO NOT BREAK!)

```
User Request → ChatEngine → DataLoader → mapProduct() → ResponseBuilder → LLMFormatter → Response
                    ↓            ↓            ↓              ↓                ↓
              Load customer  Pass param   Hide price    Add context      Hide UI elements
              .isActive      customerIs   when false    customerIs       (availability,
                            Active                     Active           cart prompt)
```

---

## 🛡️ Protection Points (ALWAYS VERIFY THESE!)

### 1. **ProductData Type** (`data-loader.service.ts`)
- ✅ `price: number | null` (NOT `number`)
- ✅ `priceWithDiscount?: number | null`
- ❌ **NEVER** make these non-nullable again!

### 2. **DataLoader.loadForIntent()** (`data-loader.service.ts`)
- ✅ Accepts `customerIsActive: boolean = false` parameter
- ✅ Passes it to `loadProductByName()`, `loadProductBySku()`
- ❌ **NEVER** remove this parameter or default to `true`

### 3. **DataLoader.mapProduct()** (`data-loader.service.ts`)
```typescript
// ✅ CORRECT:
const finalPrice = customerIsActive ? p.price : null
const finalDiscountedPrice = customerIsActive ? discount : null

// ❌ WRONG:
const finalPrice = p.price  // Always shows price!
const finalPrice = customerIsActive ? p.price : 0  // Shows €0.00!
```

### 4. **ChatEngine Customer Loading** (`chat-engine.service.ts`)
- ✅ Loads `customer.isActive` from database BEFORE calling DataLoader
- ✅ Passes `customerIsActive` to both:
  - `dataLoader.loadForIntent(..., customerIsActive)`
  - `responseBuilder.build(..., { customerIsActive })`
- ❌ **NEVER** skip customer loading for product details!

**Critical Lines:**
```typescript
// Line ~2137: Numeric selection (user writes "1")
let customerIsActive = false
if (selectIntent.listType === "PRODUCTS") {
  const customer = await this.prisma.customers.findUnique({
    where: { id: input.customerId },
    select: { isActive: true }
  })
  customerIsActive = customer?.isActive ?? false
}

// Line ~4350: Direct SHOW_PRODUCT intent
if (intentResult.intent.type === "SHOW_PRODUCT") {
  const customer = await this.prisma.customers.findUnique({
    where: { id: input.customerId },
    select: { isActive: true }
  })
  customerIsActive = customer?.isActive ?? false
}
```

### 5. **ResponseBuilder Context** (`response-builder.service.ts`)
- ✅ `BuildOptions` includes `customerIsActive?: boolean`
- ✅ `ResponseContext` includes `customerIsActive?: boolean`
- ✅ Context passed to LLMFormatter

### 6. **LLMFormatter Product Detail** (`llm-formatter.service.ts`)
```typescript
// ✅ CORRECT LOGIC:
const isRegisteredUser = response.context.customerIsActive === true

// Hide price when null/undefined
if (displayPrice !== null && displayPrice !== undefined) {
  detailLines.push(`Prezzo: ${formatDisplayPrice(displayPrice)}`)
}

// Conditional UI based on registration
if (isRegisteredUser) {
  // Show: Availability + "Vuoi aggiungerlo al carrello?"
} else {
  // Show: "Per vedere i prezzi e acquistare, registrati..."
}

// ❌ WRONG LOGIC:
const isRegisteredUser = response.context.customerIsActive !== false  // undefined = registered!
detailLines.push(`Prezzo: ${formatDisplayPrice(displayPrice || 0)}`)  // Shows €0.00!
```

---

## 🧪 Manual Test Checklist

### Test Setup:
1. Create test customer with `isActive: false`
2. Use phone number like `34544545454545`

### Test Cases:

#### ✅ **Product List** (Query: "avete la mozzarella?")
- [ ] NO prices shown in list
- [ ] Product names visible
- [ ] Numbers in bold (**1.** **2.**)

#### ✅ **Product Detail** (Query: "1" after list)
**MUST show:**
- [ ] Product name
- [ ] Description
- [ ] Region
- [ ] Format
- [ ] Certifications
- [ ] Transport type
- [ ] Registration message ("Per vedere i prezzi...")

**MUST NOT show:**
- [ ] Price (not even €0.00)
- [ ] Availability (❌/✅ Disponibile)
- [ ] "Vuoi aggiungerlo al carrello?" question

#### ✅ **Registered User** (Set `isActive: true`)
**MUST show:**
- [ ] Price
- [ ] Availability
- [ ] "Vuoi aggiungerlo al carrello?"

---

## 🚨 Common Mistakes to Avoid

### 1. **Type Issues**
```typescript
// ❌ WRONG: Forces type mismatch
interface ProductData {
  price: number  // Can't be null!
}

// ✅ CORRECT:
interface ProductData {
  price: number | null  // Can be hidden
}
```

### 2. **Default Values**
```typescript
// ❌ WRONG: Shows €0.00
price: customerIsActive ? product.price : 0

// ✅ CORRECT: Completely hidden
price: customerIsActive ? product.price : null
```

### 3. **Logic Errors**
```typescript
// ❌ WRONG: undefined treated as registered!
const isRegistered = customerIsActive !== false

// ✅ CORRECT: Only explicit true is registered
const isRegistered = customerIsActive === true
```

### 4. **Missing Null Checks**
```typescript
// ❌ WRONG: Always shows price line (even if null)
detailLines.push(`Prezzo: ${formatDisplayPrice(displayPrice)}`)

// ✅ CORRECT: Only show if price exists
if (displayPrice !== null && displayPrice !== undefined) {
  detailLines.push(`Prezzo: ${formatDisplayPrice(displayPrice)}`)
}
```

### 5. **Missing Customer Load**
```typescript
// ❌ WRONG: No customer loading
const loadedData = await this.dataLoader.loadForIntent(intent, ...)

// ✅ CORRECT: Load customer first
const customer = await this.prisma.customers.findUnique({
  where: { id: customerId },
  select: { isActive: true }
})
const customerIsActive = customer?.isActive ?? false
const loadedData = await this.dataLoader.loadForIntent(intent, ..., customerIsActive)
```

---

## 📝 Code Review Checklist

When reviewing changes that touch price visibility:

- [ ] ProductData type still has `price: number | null`
- [ ] mapProduct() hides prices when `customerIsActive = false`
- [ ] DataLoader functions pass `customerIsActive` parameter
- [ ] ChatEngine loads customer before product details
- [ ] ResponseBuilder includes `customerIsActive` in context
- [ ] LLMFormatter checks `=== true` (not `!== false`)
- [ ] No default values (0, "", etc.) for hidden prices
- [ ] Null checks before showing price in formatter

---

## 🔄 Safe Refactoring Patterns

If you need to refactor this code:

### ✅ SAFE:
- Adding new optional parameters (keep defaults to `false`)
- Adding more places where customer is loaded
- Making checks MORE restrictive (e.g., also check `email` verified)
- Adding debug logging

### ❌ DANGEROUS:
- Removing `customerIsActive` parameter
- Changing defaults from `false` to `true`
- Making `price` non-nullable
- Removing null checks
- Changing `=== true` to `!== false`

---

## 📞 Questions?

If unsure about a change:
1. Check this document first
2. Run manual test with non-registered user
3. Verify ALL 6 protection points above
4. Ask Andrea if still uncertain

**Last Updated**: January 2026 (Feature 174 implementation)
**Maintained by**: Andrea
**Critical Level**: 🔴 MAXIMUM - This is a core business rule
