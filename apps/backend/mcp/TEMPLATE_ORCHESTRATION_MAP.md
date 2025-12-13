# Template Orchestration Map - Universal Logic Implementation

## 🎯 Agent Roles & Functions

### ROUTER (01-router.template.md)
**Role**: Pure orchestration - intent classification, delegating to specialist agents
**Available Functions**:
- ✅ productSearchAgent(query)
- ✅ cartManagementAgent(query)
- ✅ orderTrackingAgent(query)
- ✅ customerSupportAgent(query)
- ✅ profileManagementAgent(query)

**Logic to Apply**:
- ✅ FAQ matching (respond directly)
- ✅ Short number interpretation (read chat history to map "5" → category/product)
- ✅ LIST TYPE DETECTION: "(N prodotti)" = categories vs "€" = products
- ✅ Context awareness: previous assistant message determines routing
- ❌ NO grouping (Router just delegates)
- ❌ NO product details (Router just passes queries)

---

### PRODUCT SEARCH (02-product-search.template.md) ✅ DONE
**Role**: Search products/services, return lists with grouping
**Available Functions**:
- ✅ getProductDetails(productName, formato)
- ✅ getServiceDetails(serviceName)
- ✅ searchProductForStatistic(productName) - BACKGROUND only

**Logic Applied**:
- ✅ Multi-lingua mapping (Quesos → FORMAGGI)
- ✅ COUNT rules (0→not found, 1-2→details, 3-5→list, ≥6→GROUP)
- ✅ GROUPING for ≥6 items (min 2 groups, NO certifications, texture/type/use-case/price)
- ✅ CATEGORIES keyword detection
- ✅ Details calling getProductDetails() when user selects

---

### CART MANAGEMENT (03-cart-management OR equivalent)
**Role**: Add/remove items, show cart, manage quantities
**Available Functions**:
- ✅ addToCart(itemCode, quantity)
- ✅ removeFromCart(itemCode)
- ✅ viewCart()
- ✅ clearCart()

**Logic to Apply**:
- ✅ SHORT NUMBER INTERPRETATION: After showing cart items, "1" = remove item #1
- ✅ CONTEXT AWARENESS: Read chat history to understand "add this" (use previous product name)
- ✅ MULTI-LANGUE: Translate item names, quantities, prices per user language
- ✅ NO product search (delegate to Router if customer wants to search)
- ✅ SIMPLE numeric list format (1. Item Name - €XX.XX)
- ❌ NO grouping (cart is linear, not categorical)

---

### ORDER TRACKING (04-order-tracking.template.md)
**Role**: Show orders, track status, repeat orders, checkout
**Available Functions**:
- ✅ getOrderHistory(limit)
- ✅ getOrderDetails(orderCode)
- ✅ repeatOrder(orderCode)
- ✅ showCheckout()
- ✅ confirmOrder()

**Logic to Apply**:
- ✅ SHORT NUMBER INTERPRETATION: After list of orders, "1" = select order #1
- ✅ CONTEXT AWARENESS: "track my order" = show last order, "show history" = getOrderHistory()
- ✅ CHECKOUT FLOW: "checkout" → showCheckout() → "confirm" → confirmOrder()
- ✅ REPEAT LOGIC: User says "repeat", extract orderCode from chat history, call repeatOrder()
- ✅ SIMPLE numeric list (1. Order #ABC123 - €XXX - Status)
- ❌ NO product search (if customer wants product, delegate to Router)
- ❌ NO grouping for ≥6 orders (just paginate or show last N)

---

### CUSTOMER SUPPORT - ECOMMERCE (05-customer-support.template.md)
**Role**: Handle complaints, FAQs, escalation to human
**Available Functions**:
- ✅ contactOperator() - escalate to human
- ✅ NO product/cart functions (not its job)

**Logic to Apply**:
- ✅ FAQ matching FIRST (database search)
- ✅ ESCALATION TRIGGERS: frustration keywords, "operatore", complex issues
- ✅ HUMAN SUPPORT DETECTION: Check if hasHumanSupport = true/false
- ✅ MULTI-LANGUE: Detect language, show support info in customer's language
- ❌ NO product search (delegate to Router)
- ❌ NO cart operations (delegate to Router)
- ❌ NO order tracking (delegate to Router → orderTrackingAgent)

---

### PROFILE MANAGEMENT (06-profile-management.template.md OR similar)
**Role**: Email, preferences, notifications, profile updates
**Available Functions**: (TBD - read the template)

**Logic to Apply**:
- ✅ PROFILE DATA CONTEXT: Show current email, preferences, settings
- ✅ CONFIRMATION FLOW: "Update email to X?" → confirm → save
- ✅ MULTI-LANGUE: Translations for settings labels
- ❌ NO product operations
- ❌ NO order operations

---

### INFORMATIONAL ROUTER (informational/01-router.template.md)
**Role**: FAQ-only info channel, delegate to support/profile agents
**Available Functions**:
- ✅ customerSupportAgent(query)
- ✅ profileManagementAgent(query)
- ❌ NO productSearchAgent (info-only, no sales)

**Logic to Apply**:
- ✅ FAQ matching FIRST
- ✅ DELEGATION RULES: Support questions → customerSupportAgent, Profile → profileManagementAgent
- ✅ NO purchase attempts (politely explain info-only)
- ❌ NO product search (info channel only)

---

### INFORMATIONAL CUSTOMER SUPPORT (informational/04-customer-support.template.md)
**Role**: FAQ, general support (NO escalation to human required in this context, INFO ONLY)
**Available Functions**:
- ✅ contactOperator() - if human support enabled
- ❌ NO product functions

**Logic to Apply**:
- ✅ FAQ search FIRST
- ✅ HUMAN SUPPORT: Only if hasHumanSupport = true
- ✅ MULTI-LANGUE FAQ responses
- ❌ NO sales, NO products

---

## 📋 Universal Logic Checklist

### Multi-Lingua Mapping (applies to ProductSearch, CustomerSupport, Cart, OrderTracking)
```
ECOMMERCE:
- Formaggi, Quesos, Cheeses, Queijos → FORMAGGI
- Bevande, Bebidas, Drinks → BEVANDE
- Salumi, Embutidos, Cured Meats → SALUMI
- etc.

CUSTOMER SUPPORT:
- FAQ results in customer language (LLM translates)

CART/ORDERS:
- Item names, prices, order statuses in customer language
```

### Short Number Interpretation (ProductSearch, Cart, OrderTracking)
**RULE**: When customer says "1", "2", "5":
1. Read LAST assistant message carefully
2. Identify LIST TYPE:
   - "(N prodotti)" / "(N productos)" = CATEGORY LIST (Router knows this)
   - "€" prices = PRODUCT LIST (ProductSearch shows this)
   - Order codes with dates = ORDER LIST (OrderTracking shows this)
3. Find line matching that number
4. Extract EXACT name/code
5. Call appropriate function (getProductDetails, getOrderDetails, etc.)

**EXCEPTION**: CartManagement doesn't show "select from list" - it shows quantity/remove options.

### COUNT Rules (ProductSearch ONLY)
| Count | Response |
|-------|----------|
| 0 | "Not found" + show categories |
| 1-2 | Show details + "Vuoi aggiungerlo al carrello?" |
| 3-5 | Show simple list (1. Name - €Price) |
| ≥6 | **MUST GROUP** (min 2 groups, max 4) |

### Grouping Strategy (ProductSearch ONLY, ≥6 items)
1. Create MINIMUM 2 groups, MAXIMUM 4
2. Each group ≥2 items
3. **NEVER group by certifications** (DOP/IGP - almost all have them)
4. Best strategies: Texture/Type, Use-case, Price, Flavor
5. Format: "1. Group Name (N) - Item1, Item2, ...\n2. Group Name (N) - ..."

### Context Awareness (ALL agents reading chat history)
**ProductSearch**: "5" after categories = select category #5
**Cart**: "add this" + prev message mentions "Mozzarella" = add Mozzarella
**OrderTracking**: "track it" + last order = show that order's details
**CustomerSupport**: Previous frustration + new message = escalate?

---

## 🚀 Implementation Priority

### 🔴 Priority 1 (CRITICAL - core functionality)
1. ✅ ProductSearch (DONE - tested and working)
2. 🔴 Cart Management (numeric interpretation, context)
3. 🔴 Order Tracking (numeric interpretation, checkout flow)

### 🟠 Priority 2 (important - escalation)
4. 🟠 Router (enhance numeric interpretation, FAQ matching)
5. 🟠 Customer Support (FAQ matching, escalation triggers)

### 🟡 Priority 3 (nice to have)
6. 🟡 Profile Management (context awareness)
7. 🟡 Informational Router (delegation rules)
8. 🟡 Informational Support (FAQ matching)

---

## ⚠️ Critical Cross-Agent Rules

### Router MUST NOT:
- ❌ Answer product questions (delegate to productSearchAgent)
- ❌ Add items to cart (delegate to cartManagementAgent)
- ❌ Show order details (delegate to orderTrackingAgent)
- ❌ Escalate support (delegate to customerSupportAgent)

### ProductSearch MUST NOT:
- ❌ Add to cart (delegate to cartManagementAgent)
- ❌ Show orders (delegate to orderTrackingAgent)
- ❌ Handle complaints (delegate to customerSupportAgent)

### Cart MUST NOT:
- ❌ Search products (delegate to Router → productSearchAgent)
- ❌ Checkout (delegate to Router → orderTrackingAgent)

### OrderTracking MUST NOT:
- ❌ Search products (delegate to Router → productSearchAgent)
- ❌ Manage cart (delegate to Router → cartManagementAgent)

### CustomerSupport MUST NOT:
- ❌ Search products (delegate to Router → productSearchAgent)
- ❌ Add to cart (delegate to Router → cartManagementAgent)
- ❌ Track orders (delegate to Router → orderTrackingAgent)
- ❌ Translate (Translation Agent does it AFTER)

---

## 📝 Templates to Update

```
apps/backend/src/templates/
├── ecommerce/
│   ├── 01-router.template.md [ENHANCE]
│   ├── 02-product-search.template.md [✅ DONE]
│   ├── 03-order-tracking.template.md [UPDATE]
│   ├── 04-customer-support.template.md [UPDATE]
│   ├── 05-profile-management.template.md [MAYBE]
│   └── (03-cart-management?) [CREATE OR FIND]
├── informational/
│   ├── 01-router.template.md [UPDATE]
│   ├── 04-customer-support.template.md [UPDATE]
│   └── 05-profile-management.template.md [MAYBE]
└── shared/
    ├── 06-security.template.md [NO CHANGE]
    ├── 07-translation.template.md [NO CHANGE]
    └── 08-summary.template.md [NO CHANGE]
```

---

## ✨ Expected Outcomes

After all updates, the system will:
1. ✅ Understand numeric selections in ANY context
2. ✅ Group products intelligently (≥6 items)
3. ✅ Support multi-language seamlessly
4. ✅ Escalate appropriately to humans
5. ✅ Maintain clear agent boundaries (no bleeding)
6. ✅ Handle checkout flow correctly
7. ✅ Track orders intuitively

**Example Conversation**:
```
Customer (PT): "que categorias voces tem?"
Router: [detects categories question] → productSearchAgent
ProductSearch: Shows 9 categories

Customer: "5"
Router: [reads history, sees category list with "5. Quesos"] → productSearchAgent("User wants to see Quesos category")
ProductSearch: Finds 7 cheeses, GROUPS them (Frescos/Curados)

Customer: "1"
Router: [reads history, sees grouped products] → productSearchAgent("User wants Fresh Cheeses")
ProductSearch: Shows 3 fresh cheeses (Mozzarella, Burrata, Gorgonzola)

Customer: "1"
Router: [reads history, sees product list] → productSearchAgent("User wants details of Mozzarella")
ProductSearch: Shows Mozzarella details + "Vuoi aggiungerlo al carrello?"

Customer: "sim"
Router: [understands YES] → cartManagementAgent("Add Mozzarella")
Cart: Shows cart with Mozzarella

Customer: "checkout"
Router: [detects checkout] → orderTrackingAgent("Proceed to checkout")
OrderTracking: Shows summary, asks "Confirm?"

Customer: "confermo"
OrderTracking: Calls confirmOrder()
```

This is the end-to-end orchestration!
