# Agent Configuration Audit

**Date**: 2025-11-15  
**Source**: `backend/prisma/data/defaultAgents.ts`

---

## 📊 Current Agent Configurations

### 1. Router Agent (Order: 0)

- **Name**: "Router Agent"
- **Type**: ROUTER
- **Model**: openai/gpt-4o-mini
- **Temperature**: 0.3 ✅
- **Max Tokens**: 2048
- **Available Functions**: null
- **Prompt File**: router-agent.md
- **Icon**: GitBranch

**Notes**:

- Has temperature set (0.3)
- No available functions (orchestration only)

---

### 2. Product and Services Agent (Order: 1)

- **Name**: "Product and Services Agent" ⚠️ NEEDS RENAME
- **Type**: PRODUCT_SEARCH
- **Model**: openai/gpt-4o-mini
- **Temperature**: 0.3 ✅ (already set!)
- **Max Tokens**: 2048
- **Available Functions**: null
- **Prompt File**: product-search-agent.md ⚠️ NEEDS RENAME
- **Icon**: Search

**Notes**:

- ✅ Temperature already set to 0.3 (Andrea's requirement already met!)
- ❌ Name needs update: "Product and Services Agent" → "Product & Services Search Agent"
- ❌ Prompt file needs rename: product-search-agent.md → product-services-search-agent.md
- Comment mentions: "Increased from 0.0 to 0.3 for better semantic matching (dolci=desserts)"

---

### 3. Cart Management Agent (Order: 2)

- **Name**: "Cart Management Agent"
- **Type**: CART_MANAGEMENT
- **Model**: openai/gpt-4o-mini
- **Temperature**: 0.3 ✅
- **Max Tokens**: 2048
- **Available Functions**: null
- **Prompt File**: cart-management-agent.md
- **Icon**: ShoppingCart

**Notes**:

- Has temperature set (0.3)

---

### 4. Order Tracking Agent (Order: 3)

- **Name**: "Order Tracking Agent"
- **Type**: ORDER_TRACKING
- **Model**: openai/gpt-4o-mini
- **Temperature**: 0.3 ✅
- **Max Tokens**: 2048
- **Available Functions**: null
- **Prompt File**: order-tracking-agent.md
- **Icon**: Package

**Notes**:

- Has temperature set (0.3)

---

### 5. Customer Support Agent (Order: 4)

- **Name**: "Customer Support Agent"
- **Type**: CUSTOMER_SUPPORT
- **Model**: openai/gpt-4o-mini
- **Temperature**: 0.3 ✅
- **Max Tokens**: 2048
- **Available Functions**: null
- **Prompt File**: customer-support-agent.md
- **Icon**: Headset

**Notes**:

- Has temperature set (0.3)

---

### 6. Safety & Translation Agent (Order: 5)

- **Name**: "Safety & Translation Agent"
- **Type**: SAFETY_TRANSLATION
- **Model**: openai/gpt-4o-mini
- **Temperature**: 0.1 ✅ (lower for consistency)
- **Max Tokens**: 1024 (smaller - translation only)
- **Available Functions**: null
- **Prompt File**: safety-translation-agent.md
- **Icon**: Shield

**Notes**:

- Lower temperature (0.1) for translation consistency
- Smaller max tokens (1024 vs 2048)
- Can use Claude Sonnet if preferred (comment)

---

## 🔍 Key Findings

### Temperature Settings

✅ **ALL agents have temperature set** (no missing temperatures)

| Agent         | Temperature | Rationale                               |
| ------------- | ----------- | --------------------------------------- |
| Router        | 0.3         | Balance orchestration consistency       |
| ProductSearch | 0.3 ✅      | Already set (Andrea's requirement met!) |
| Cart          | 0.3         | Consistent cart operations              |
| OrderTracking | 0.3         | Reliable order data                     |
| Support       | 0.3         | Empathetic but consistent               |
| Safety        | 0.1         | Very low for translation consistency    |

**Andrea's Request**: "nel seed mettiamo temperatura"
**Status**: ✅ ALREADY DONE - ProductSearch has temperature 0.3

---

### Available Functions

❌ **ALL agents have `availableFunctions: null`**

**Current Behavior**:

- No agent-specific function restrictions
- All functions available to all agents (controlled by LLM logic)

**Question**: Should we restrict functions per agent?

- Router: Only delegation functions?
- ProductSearch: Only search functions?
- Cart: Only cart functions?

**Decision**: Keep null for now (LLM routing works, no issues reported)

---

### Trigger Keywords

⚠️ **NOT VISIBLE in defaultAgents.ts** (might be in older version or removed)

**Expected Keywords** (from spec):

- Router: "faq", "orari", "consegne", "pagamenti", etc.
- ProductSearch: "search", "find", "product", "service", "catalog", etc.
- Cart: "cart", "carrello", "add", "aggiungi", etc.

**Current**: No triggerKeywords field in code
**Reason**: Keywords might be removed in favor of pure LLM intent classification

---

## 🚨 Required Changes (Phase 4)

### Task 4.2: Update Agent Name

**Current**:

```typescript
{
  name: "Product and Services Agent",
  type: "PRODUCT_SEARCH" as AgentType,
  // ...
}
```

**Required**:

```typescript
{
  name: "Product & Services Search Agent",
  type: "PRODUCT_SEARCH" as AgentType,
  // ...
}
```

---

### Task 4.1: Update Prompt Filename Mapping

**Current** (AGENT_FILENAME_MAP not visible in excerpt, but inferred):

```typescript
PRODUCT_SEARCH: "product-search-agent.md"
```

**Required**:

```typescript
PRODUCT_SEARCH: "product-services-search-agent.md"
```

---

### Task 4.3: Temperature Setting

**Status**: ✅ ALREADY SET (0.3)
**No changes needed** - Andrea's requirement already met!

---

### Task 4.4: Update Agent Description

**Current**:

```typescript
description: "Specialist in product search, filters, certifications, and catalog navigation"
```

**Required**:

```typescript
description: "Specialist in product & service discovery with intelligent grouping, filters, and catalog navigation"
```

---

## 📊 Summary

| Configuration Item          | Status              | Action Needed         |
| --------------------------- | ------------------- | --------------------- |
| Temperature (ProductSearch) | ✅ Already 0.3      | None - skip Task 4.3! |
| Temperature (Other Agents)  | ✅ All set          | None                  |
| Agent Name                  | ❌ Needs update     | Task 4.2              |
| Prompt Filename             | ❌ Needs update     | Task 4.1              |
| Agent Description           | ⚠️ Needs enrichment | Task 4.4              |
| Available Functions         | ✅ Null (OK)        | None                  |

**Key Insight**: Andrea's temperature requirement is ALREADY implemented! 🎉
