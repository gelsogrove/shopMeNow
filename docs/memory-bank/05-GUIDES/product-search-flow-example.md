# Product Search Flow - Esempio Completo

**Data**: 10 Novembre 2025  
**Feature**: Progressive Discovery + Hierarchical Filtering + Smart Grouping

---

## 🎯 FLUSSO IDEALE - Step by Step

### SCENARIO: Utente cerca formaggi → raffina DOP → seleziona 24 mesi → aggiunge a carrello

---

## 📍 STEP 1: Prima Ricerca - "che formaggi avete?"

### User Input:

```
User: "che formaggi avete?"
```

### Sistema - Router LLM:

```typescript
// llm-router.service.ts
1. Check activeAgent in SearchConversations
   → activeAgent: null (prima query)

2. Router LLM analizza query
   → Delega a: PRODUCT_SEARCH

3. Upsert SearchConversations:
   {
     sessionId: "abc-123",
     activeAgent: "PRODUCT_SEARCH",  // ✅ SET
     state: "ACTIVE",
     expiresAt: now + 10 min
   }
```

### Sistema - ProductSearchAgent:

```typescript
// ProductSearchAgentLLM.ts

1. Load existing conversation
   → filteredProducts: null (prima ricerca)
   → hasFilteredList: false

2. Call QueryAnalyzerAgent
   Input: { query: "che formaggi avete?", hasFilteredList: false }
   Output: {
     categoryIds: ["uuid-formaggi"],
     keywords: ["formaggi"],
     isRefinement: false  // ✅ Nuova ricerca
   }

3. Database Query (NEW SEARCH)
   → ProductRepository.findAll({ categoryIds: ["uuid-formaggi"] })
   → Result: 7 prodotti

4. Analyze Grouping
   → analyzeGrouping(7 products)
   → Strategy: CERTIFICATION (priority 1)
   → Groups found:
      - DOP: 5 products (Taleggio, Pecorino, Mozzarella, Parmigiano, Gorgonzola)
      - Senza certificazione: 2 products (Burrata, Provolone)
   → canGroup: true (>= 2 groups)

5. Save metadata:
   {
     filteredProducts: [7 products],  // ✅ Cache for refinement
     grouping: {
       canGroup: true,
       groupBy: "certification",
       groups: [
         { name: "DOP", count: 5, keywords: ["dop", "DOP"] },
         { name: "Senza certificazione", count: 2, keywords: [] }
       ]
     },
     lastQuery: "che formaggi avete?",
     lastResponse: "Found 7 products grouped by certification"
   }

6. LLM Response (checks canGroup)
   IF grouping.canGroup === true:
     → Show GROUPS, NOT products
   ELSE:
     → Show flat product list
```

### Response to User:

```
🧀 Abbiamo formaggi in queste categorie:

1. 🏆 **DOP** (5 prodotti)
2. 📦 **Senza certificazione** (2 prodotti)

Quale categoria ti interessa?
```

### Database State After Step 1:

```typescript
// searchConversations table
{
  sessionId: "abc-123",
  workspaceId: "workspace-1",
  customerId: "customer-1",
  activeAgent: "PRODUCT_SEARCH",  // ✅
  state: "ACTIVE",
  metadata: {
    filteredProducts: [7 products],  // ✅
    grouping: {
      canGroup: true,
      groupBy: "certification",
      groups: [...]
    }
  },
  expiresAt: "2025-11-10T13:03:11Z"
}
```

---

## 📍 STEP 2: Selezione Gruppo - "1" (DOP)

### User Input:

```
User: "1"  // Seleziona gruppo DOP
```

### Sistema - Router LLM:

```typescript
// llm-router.service.ts

1. Check activeAgent
   → activeAgent: "PRODUCT_SEARCH"  // ✅ Già impostato

2. Check exit keywords
   → "1" NON è exit keyword

3. FORCE delegation to ProductSearch
   → Bypass Router LLM (veloce!)
   → Direct call: ProductSearchAgent.handleQuery("1")
```

### Sistema - ProductSearchAgent:

```typescript
// ProductSearchAgentLLM.ts

1. Load existing conversation
   → filteredProducts: [7 products]  // ✅ From cache
   → grouping.canGroup: true
   → hasFilteredList: true

2. Detect user selected group "1"
   → Extract group keywords: ["dop", "DOP"]

3. Call QueryAnalyzerAgent
   Input: {
     query: "1",
     hasFilteredList: true,  // ✅ Trigger refinement detection
     conversationContext: {
       lastQuery: "che formaggi avete?",
       grouping: { groups: [...] }
     }
   }
   Output: {
     keywords: ["dop"],  // ✅ From selected group
     isRefinement: true  // ✅ Refinement mode
   }

4. Filter in Memory (NO DATABASE)
   → filterProductsInMemory(7 products, { keywords: ["dop"] })
   → Filter logic: name.toLowerCase().includes("dop")
   → Result: 5 products (DOP cheeses)

5. Update metadata:
   {
     filteredProducts: [5 DOP products],  // ✅ Updated cache
     grouping: null,  // ✅ Reset after selection
     lastQuery: "1",
     lastResponse: "Showing 5 DOP products"
   }

6. LLM Response (show products)
   → grouping is null → Show product list
```

### Response to User:

```
🧀 Ecco i formaggi DOP:

1. **Gorgonzola Dolce DOP** - €6.50
   📦 Stock: 40 disponibili

2. **Parmigiano Reggiano DOP 24 mesi** - €8.90
   📦 Stock: 60 disponibili

3. **Mozzarella di Bufala Campana DOP** - €7.80
   📦 Stock: 35 disponibili

4. **Pecorino Romano DOP** - €6.20
   📦 Stock: 55 disponibili

5. **Taleggio DOP** - €7.50
   📦 Stock: 30 disponibili

Quale prodotto ti interessa?
```

### Database State After Step 2:

```typescript
{
  activeAgent: "PRODUCT_SEARCH",  // ✅ Still active
  metadata: {
    filteredProducts: [5 DOP products],  // ✅ Refined list
    grouping: null,  // ✅ Cleared
    lastQuery: "1",
    lastResponse: "Showing 5 DOP products"
  }
}
```

---

## 📍 STEP 3: Raffinamento - "24 mesi"

### User Input:

```
User: "24 mesi"
```

### Sistema - Router LLM:

```typescript
1. activeAgent: "PRODUCT_SEARCH"  // ✅
2. "24 mesi" NON è exit keyword
3. FORCE delegation to ProductSearch
```

### Sistema - ProductSearchAgent:

```typescript
1. Load conversation
   → filteredProducts: [5 DOP products]  // ✅
   → hasFilteredList: true

2. Call QueryAnalyzerAgent
   Input: {
     query: "24 mesi",
     hasFilteredList: true  // ✅
   }
   Output: {
     keywords: ["24", "mesi"],
     isRefinement: true  // ✅ Keyword "24 mesi" = refinement
   }

3. Filter in Memory (NO DATABASE)
   → filterProductsInMemory(5 DOP, { keywords: ["24", "mesi"] })
   → Filter: name.includes("24") && name.includes("mesi")
   → Result: 1 product (Parmigiano 24 mesi)

4. Update metadata:
   {
     filteredProducts: [1 product],  // ✅
     selectedProductCode: null,  // Not selected yet
     lastQuery: "24 mesi"
   }
```

### Response to User:

```
🧀 Ecco il Parmigiano Reggiano DOP 24 mesi:

**Parmigiano Reggiano DOP 24 mesi**
💰 Prezzo: ~~€8.90~~ → €8.01 (sconto 10%)
📝 24-month aged Parmigiano Reggiano with crystalline texture and complex nutty flavor
📦 Stock: ✅ 60 disponibili
🏷️ Fornitore: Latticini del Sud
🌍 Regione: Emilia-Romagna
🔖 Certificazioni: DOP

Vuoi aggiungerlo al carrello? 🛒
```

### Database State After Step 3:

```typescript
{
  activeAgent: "PRODUCT_SEARCH",  // ✅
  metadata: {
    filteredProducts: [1 product],  // ✅ Final refinement
    lastQuery: "24 mesi"
  }
}
```

---

## 📍 STEP 4: Conferma Aggiunta Carrello - "sì"

### User Input:

```
User: "sì"
```

### Sistema - ProductSearchAgent:

```typescript
1. Detect confirmation for cart
   → User confirmed after product details shown
   → Extract productCode: "FORMAG-002"

2. Save selected product:
   metadata.selectedProductCode = "FORMAG-002"

3. Respond with DELEGATION pattern:
   "🛒 DELEGATE_TO_CART: add FORMAG-002"
```

### Sistema - Router LLM:

```typescript
// llm-router.service.ts

1. Intercept delegation pattern
   → Detect "🛒 DELEGATE_TO_CART:"
   → Extract: action="add", productCode="FORMAG-002"

2. Context switch (leaving PRODUCT_SEARCH)
   → previousAgent: "PRODUCT_SEARCH"
   → newAgent: "CART_MANAGEMENT"
   → RESET filteredProducts:
      metadata.filteredProducts = null  // ✅ Cleanup

3. Update activeAgent:
   activeAgent: "CART_MANAGEMENT"  // ✅ New context

4. Delegate to CartManagement:
   → CartManagementAgent.handleQuery("add FORMAG-002")
```

### Sistema - CartManagementAgent:

```typescript
1. Parse command: "add FORMAG-002"
2. Add product to cart in database
3. Generate secure cart URL
4. Return success + cartUrl
```

### Response to User:

```
✅ Ho aggiunto 1 x Parmigiano Reggiano DOP 24 mesi al carrello!

🛒 Vedi il tuo carrello: https://shopme.com/s/xyz789

⏰ Link valido per 1 ora
```

### Database State After Step 4:

```typescript
// searchConversations
{
  activeAgent: "CART_MANAGEMENT",  // ✅ Changed
  state: "COMPLETED",  // ✅ Mission accomplished
  metadata: {
    filteredProducts: null,  // ✅ RESET
    selectedProductCode: "FORMAG-002",
    lastQuery: "sì"
  }
}

// carts table
{
  customerId: "customer-1",
  items: [
    {
      productId: "93cbb83f-...",
      productCode: "FORMAG-002",
      quantity: 1,
      price: 8.01
    }
  ]
}
```

---

## 🔄 RESET SCENARIOS

### Scenario A: User cambia topic (exit keywords)

```
User (dopo Step 2): "voglio vedere il carrello"

Router:
1. activeAgent: "PRODUCT_SEARCH"
2. Detect exit keyword: "carrello"
3. Let Router LLM decide
4. Router delegates to: CART_MANAGEMENT
5. RESET: metadata.filteredProducts = null  // ✅
6. activeAgent: "CART_MANAGEMENT"
```

### Scenario B: Nuova ricerca (isRefinement = false)

```
User (dopo Step 2): "avete pasta?"

QueryAnalyzer:
1. hasFilteredList: true (5 DOP products in cache)
2. Detect keyword: "avete" (new search keyword)
3. isRefinement: false  // ✅ New category

ProductSearch:
1. Database query (NEW SEARCH)
2. OVERWRITE filteredProducts with new results
3. filteredProducts: [pasta products]  // ✅ New list
```

### Scenario C: Timeout (10 min TTL)

```
Time: 10 minutes after last activity

Cronjob:
1. Find expired conversations (expiresAt < now)
2. Update state: "EXPIRED"
3. Delete from database (cleanup)
4. filteredProducts lost  // ✅ Automatic cleanup
```

---

## 📊 SUMMARY - Database Queries

### Total Database Queries: **1** ✅

- **Step 1**: 1 query (findAll formaggi) → Returns 7 products
- **Step 2**: 0 queries → Filter in memory (5 DOP)
- **Step 3**: 0 queries → Filter in memory (1 product)
- **Step 4**: 1 query → Add to cart

**Performance**: Excellent! Progressive filtering avoids unnecessary database load.

---

## 🧪 VERIFICATION CHECKLIST

### After Step 1:

- [ ] `activeAgent` = "PRODUCT_SEARCH"
- [ ] `filteredProducts` has 7 products
- [ ] `grouping.canGroup` = true
- [ ] `grouping.groups` has 2 items (DOP, Senza cert)
- [ ] Response shows GROUPS, not products

### After Step 2:

- [ ] `activeAgent` still "PRODUCT_SEARCH"
- [ ] `filteredProducts` updated to 5 DOP products
- [ ] `grouping` = null (cleared)
- [ ] Response shows 5 PRODUCTS
- [ ] NO database query executed

### After Step 3:

- [ ] `activeAgent` still "PRODUCT_SEARCH"
- [ ] `filteredProducts` = 1 product
- [ ] Response shows product details
- [ ] Asks "Vuoi aggiungerlo al carrello?"
- [ ] NO database query executed

### After Step 4:

- [ ] `activeAgent` changed to "CART_MANAGEMENT"
- [ ] `filteredProducts` = null (RESET)
- [ ] Cart has 1 item in database
- [ ] Response includes cartUrl
- [ ] 1 database query (insert cart item)

---

## 🚨 COMMON ISSUES TO AVOID

### ❌ Issue 1: Router doesn't delegate when activeAgent is set

```typescript
// WRONG - Router LLM called for every query
if (message === "sì") {
  routerLLM.decide() // ❌ Slow!
}

// CORRECT - Force delegation
if (activeAgent && !isExitKeyword) {
  return delegateToActiveAgent() // ✅ Fast!
}
```

### ❌ Issue 2: QueryAnalyzer doesn't detect refinement

```typescript
// WRONG - Always new search
analyzeQuery({ query }) // ❌ Missing hasFilteredList

// CORRECT - Pass context
analyzeQuery({
  query,
  hasFilteredList: true, // ✅ Enable refinement detection
})
```

### ❌ Issue 3: filteredProducts not reset on context switch

```typescript
// WRONG - Stale data persists
activeAgent: "CART_MANAGEMENT" // ❌ filteredProducts still cached

// CORRECT - Reset on leaving PRODUCT_SEARCH
if (previousAgent === "PRODUCT_SEARCH" && newAgent !== "PRODUCT_SEARCH") {
  metadata.filteredProducts = null // ✅
}
```

### ❌ Issue 4: LLM ignores grouping.canGroup

```typescript
// WRONG - Shows products even with groups
return formatProducts(products) // ❌ Ignores grouping

// CORRECT - Check canGroup first
if (grouping?.canGroup) {
  return formatGroups(grouping.groups) // ✅
} else {
  return formatProducts(products)
}
```

---

**Fine Esempio Flusso**

Andrea, questo è il flusso completo e corretto. Vuoi che verifichi se il codice attuale implementa esattamente questo flow?
