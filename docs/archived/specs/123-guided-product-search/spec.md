# Feature Specification: Guided Progressive Product Search

**Feature Branch**: `123-guided-product-search`  
**Created**: 2025-01-12  
**Status**: Draft  
**Input**: User wants guided product search with dynamic grouping, progressive filtering, and direct cart integration

---

## 🎯 Design Philosophy: Chatbot as Link Generator

**IMPORTANT ARCHITECTURAL DECISION**: The chatbot's primary role is to **generate secure links** that redirect users to the web interface for complex operations.

**Chatbot Scope** (Direct in chat):

- ✅ Product discovery & search
- ✅ Cart addition (products/services)
- ✅ Order information & tracking
- ✅ Generate cart/order/profile links

**Web Interface Scope** (Via generated links):

- ✅ Cart modifications (quantities, item removal)
- ✅ New order creation & checkout
- ✅ Profile management

**Impact on This Feature**:

- No need for `RemoveProduct` or `UpdateCartItem` Calling Functions
- Customer asks "dammi il carrello" → Bot generates cart link → Customer modifies via web
- Focus: Discovery & addition in chat, modifications & checkout in web

---

## User Scenarios & Testing

### User Story 1 - Generic Search with Dynamic Grouping (Priority: P1)

Customer searches for a broad product category (e.g., "formaggi", "vini", "salumi") and system dynamically groups results by most relevant characteristics to help narrow down choice.

**Why this priority**: Core search experience - most common entry point. Without this, customers can't discover products efficiently.

**Independent Test**: Customer types "formaggi" → System analyzes product catalog → Groups by categories (Freschi, Stagionati, DOP, etc.) → Customer selects group → Receives refined results. Deliverable: Working search with grouping logic.

**Acceptance Scenarios**:

1. **Given** customer in chat, **When** types "cerco formaggio", **Then** system shows grouped categories (Formaggi freschi, Formaggi stagionati, Formaggi a pasta molle, Formaggi DOP) with friendly message "Quale categoria ti interessa?"
2. **Given** customer in chat, **When** types "voglio vino", **Then** system dynamically groups wines (Vini rossi, Vini bianchi, Vini spumanti, Vini biologici) based on available products
3. **Given** customer searches "prodotti bio", **When** system has bio products, **Then** groups by product type (Formaggi bio, Vini bio, Salumi bio)

---

### User Story 2 - Progressive Filtering to Final Selection (Priority: P1)

After initial grouping, customer progressively narrows down choices through multiple filtering steps until reaching a final list of max 3 products to choose from.

**Why this priority**: Completes the search journey started in US1. Without this, customers can't reach actual products.

**Independent Test**: Customer selects "Formaggi stagionati" → System offers sub-filters (DOP, Bio, Integrali) → Customer selects "DOP" → Receives max 3 DOP aged cheeses. Deliverable: Multi-step filtering with max 3 final products.

**Acceptance Scenarios**:

1. **Given** customer selected "Formaggi stagionati", **When** system has multiple sub-categories, **Then** offers secondary filters (DOP, Bio, Artigianali, Integrali)
2. **Given** customer applied 2 filters (stagionati + DOP), **When** results narrow to 3 or fewer products, **Then** displays full product list with names, prices (original + discounted), certifications
3. **Given** customer applied filters resulting in >3 products, **When** viewing results, **Then** system continues offering refinement options OR shows top 3 most relevant products

---

### User Story 3 - Product Detail View & Cart Addition (Priority: P1)

Customer views full details of selected product (description, price, certifications, origin) and can add it directly to cart with optional quantity specification.

**Why this priority**: Conversion step - without this, no purchase possible. Completes the purchase funnel.

**Independent Test**: Customer selects "Parmigiano Reggiano DOP 24 mesi" → Views details (€18.00 → €16.20 with discount, DOP certification, origin Emilia-Romagna) → Says "sì lo voglio" → Product added to cart with qty=1 → Receives cart link. Deliverable: Product details + addToCart integration.

**Acceptance Scenarios**:

1. **Given** customer viewing max 3 products, **When** selects one product, **Then** shows full details: name, description, original price, discounted price, certifications (DOP, Bio, Halal, Integrale), origin, weight
2. **Given** customer viewing product details, **When** says "sì lo voglio" or "aggiungi al carrello", **Then** adds product with quantity=1 to cart and returns cart link
3. **Given** customer viewing product details, **When** says "ne voglio 5", **Then** adds product with quantity=5 to cart
4. **Given** customer says "no grazie", **When** declining product, **Then** system asks if wants to see other products or restart search

---

### User Story 4 - LLM Dynamic Grouping Intelligence (Priority: P2)

System uses LLM reasoning to choose the most sensible grouping strategy based on customer query, available products, and context rather than fixed rules.

**Why this priority**: Enhances UX but not blocking - fixed grouping (category-first) works as fallback.

**Independent Test**: Customer searches "formaggi per pizza" → LLM groups by melting properties (Mozzarella, Scamorza, Fontina) instead of generic categories. Customer searches "regali di natale" → LLM groups by price range and gift-suitability. Deliverable: Smart grouping that adapts to query intent.

**Acceptance Scenarios**:

1. **Given** customer searches with dietary constraint ("prodotti halal"), **When** system analyzes query, **Then** groups primarily by certification (Halal-certified formaggi, Halal-certified salumi) rather than product type
2. **Given** customer searches with price intent ("formaggi economici"), **When** system processes query, **Then** groups by price ranges (€5-€10, €10-€15, €15+)
3. **Given** customer searches with occasion context ("aperitivo"), **When** system understands context, **Then** groups by use-case (Formaggi da tavola, Salumi affettati, Vini spumanti)

---

### User Story 5 - Service Selection & Cart Addition (Priority: P1)

Customer can discover available services (gift wrapping, delivery), view service details, and add services to cart for order completion.

**Why this priority**: Core checkout enhancement - services increase average order value and improve customer satisfaction.

**Independent Test**: Customer asks "che servizi avete?" → System shows numbered list (1. Gift Wrapping - €5.00, 2. Shipping - €8.00) → Customer says "1" → System shows full details (description, price, code, availability) → Customer says "sì" → Service added to cart with quantity=1. Deliverable: Complete service flow with addService integration.

**Acceptance Scenarios**:

1. **Given** customer asks "che servizi avete?", **When** workspace has active services, **Then** shows numbered list with service name and price (e.g., "1. Gift Wrapping - €5.00")
2. **Given** customer sees service list, **When** selects number (e.g., "1"), **Then** shows 5-field detailed view: Nome, Descrizione, Prezzo, Codice, Disponibilità
3. **Given** customer viewing service details, **When** says "sì" or "aggiungi", **Then** immediately adds service to cart with quantity=1 (NO quantity question for services)
4. **Given** service added to cart, **When** operation succeeds, **Then** returns confirmation message with cart link

---

### Edge Cases

- **Empty Search Results**: Customer searches "caviale" but catalog has none → System responds "Non abbiamo caviale al momento. Posso suggerirti prodotti simili come salmone affumicato?"
- **Single Product Match**: Customer search is so specific ("Parmigiano Reggiano DOP 36 mesi") that only 1 product matches → Skip grouping, show product details directly
- **Ambiguous Quantity Request**: Customer says "ne voglio qualche chilo" → System asks clarification "Quanti chili esattamente?"
- **Out of Stock**: Selected product is out of stock → System shows "Prodotto esaurito. Ti interessa un'alternativa simile?" with similar products
- **Invalid Quantity**: Customer says "ne voglio -5" or "ne voglio mille" → System responds "Quantità non valida. Specifica un numero tra 1 e 100"
- **Search Timeout**: Customer starts search but doesn't respond to grouping → After 10 minutes, conversation expires (standard session timeout)
- **Service Not Available**: Customer selects service but it becomes inactive → System responds "Servizio non disponibile al momento. Posso suggerirti un'alternativa?"
- **Service Already in Cart**: Customer tries to add same service twice → System responds "Servizio già presente nel carrello. Vuoi modificare la quantità?" (Note: services always qty=1, so this is edge case handling)

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST use ProductSearchAgent LLM to process all product search queries with workspace-isolated product catalog
- **FR-002**: System MUST dynamically group products based on query context when more than 3 products match search criteria
- **FR-003**: LLM MUST analyze customer query intent and choose most relevant grouping strategy (category, certification, price, use-case, dietary needs)
- **FR-004**: System MUST limit final product list to maximum 3 products before requiring customer to select one
- **FR-005**: System MUST display product details including: name, description, original price, discounted price, certifications (DOP, Bio, Halal, Integrale), origin, weight
- **FR-006**: System MUST show both original price and customer-specific discounted price for each product (discount from workspace customer profile)
- **FR-007**: System MUST support direct cart addition via "sì lo voglio" or "aggiungi al carrello" commands with quantity=1 default
- **FR-008**: System MUST extract explicit quantity from customer message (e.g., "ne voglio 5") and pass to addToCart function
- **FR-009**: System MUST delegate cart addition to CartManagementAgent via Router using "CONFIRMED: add [PRODUCT-CODE]" message format (no direct addToCart from ProductSearchAgent)
- **FR-010**: System MUST return secure cart link after successful product addition
- **FR-011**: System MUST maintain conversation context across multiple filtering steps (Router maintains history)
- **FR-012**: ProductSearchAgent prompt MUST use {{PRODUCTS}} variable populated with workspace product catalog including certifications
- **FR-013**: System MUST handle empty search results with helpful alternatives suggestion
- **FR-014**: System MUST skip grouping when only 1 product matches search criteria and show details directly
- **FR-015**: System MUST support service discovery via "che servizi avete?" query
- **FR-016**: System MUST display services as numbered list with name and price (format from {{SERVICES}} variable)
- **FR-017**: System MUST show service details including: Nome, Descrizione, Prezzo, Codice, Disponibilità (5-field format)
- **FR-018**: System MUST add services to cart with quantity=1 automatically (NO quantity question for services)
- **FR-019**: System MUST call addService() function immediately after customer confirms service addition

### Non-Functional Requirements

- **NFR-001**: Product search response time MUST be under 3 seconds for initial grouping
- **NFR-002**: LLM grouping logic MUST be consistent for 90%+ of repeated queries with same product set (testable via 10 iteration test)
- **NFR-003**: ProductSearchAgent prompt MUST fit within GPT-4o-mini token limit (128k context, aim for <50k with {{PRODUCTS}})
- **NFR-004**: System MUST log all search queries and grouping decisions for analytics
- **NFR-005**: Cart link generated MUST expire after 15 minutes (standard secure token TTL)
- **NFR-006**: Service list format MUST come from database via {{SERVICES}} variable with structured format: numbered list including name, description, price, code, availability (no hardcoded service display)

## Key Entities

- **Product**: Catalog items with attributes (name, description, price, discount, category, certifications, origin, weight, isActive, stock)
- **ProductCertification**: Flags on product (isDOP, isBio, isHalal, isIntegrale) for filtering and display
- **Service**: Additional services available for orders (gift wrapping, shipping) with attributes (name, description, price, code, isActive)
- **CustomerDiscount**: Workspace-level discount applied to base product price
- **SearchQuery**: Customer input processed by ProductSearchAgent LLM
- **ProductGroup**: Dynamic collection of products grouped by LLM-chosen characteristic
- **CartItem**: Product + quantity added to customer cart via addToCart calling function
- **ServiceItem**: Service added to customer cart via addService calling function (always quantity=1)

---

## Success Criteria

1. **Search Completion Rate**: 80% of product searches result in customer viewing at least one product detail page
2. **Conversion Rate**: 40% of product detail views result in addToCart action
3. **Search Refinement**: Average 2-3 filtering steps before reaching final product selection (not too many, not too few)
4. **Response Time**: 95% of search interactions complete within 5 seconds total (grouping + filtering + details)
5. **User Satisfaction**: Customers report search experience as "helpful" or "very helpful" in 70%+ of cases (measured via post-purchase survey)
6. **Empty Results**: Less than 5% of searches result in "no products found"
7. **Cart Abandonment**: Cart abandonment rate after addToCart is under 30% (indicates search found right product)

---

## Assumptions

1. **Existing Infrastructure**: ProductSearchAgent already exists in codebase with basic product listing capability (to be enhanced with grouping logic)
2. **Product Catalog Quality**: Workspace has sufficient product data (descriptions, certifications, categories) for meaningful grouping (seed database will be enhanced)
3. **LLM Capability**: GPT-4o-mini has sufficient reasoning for dynamic grouping (may upgrade to GPT-4o if needed, but testing with mini first)
4. **Router Context**: Router Agent maintains full conversation history and can recognize "sì lo voglio" as cart addition intent after product details shown
5. **CartManagementAgent Integration**: CartManagementAgent's addToCart calling function accepts `productId` and optional `quantity` parameters
6. **Token Variable**: {{PRODUCTS}} variable replacement already implemented in PromptProcessorService (just needs certification fields added)
7. **No Flow Changes**: Router → ProductSearchAgent → Router → CartManagementAgent flow remains unchanged (only prompt + CF modifications)

---

## Dependencies

- **ProductSearchAgent Prompt**: Existing prompt needs complete rewrite for progressive grouping logic
- **Database Seed**: Need to add certification flags (isDOP, isBio, isHalal, isIntegrale) to test products
- **PromptProcessorService**: Must include certification fields in {{PRODUCTS}} variable output
- **addToCart CF**: Must accept quantity parameter (verify current implementation)
- **Router Agent Prompt**: Must recognize "sì lo voglio" after product details as cart addition intent

---

## Out of Scope

- **Product Recommendations**: "Prodotti simili" or "I clienti hanno comprato anche" features (future enhancement)
- **Product Comparison**: Side-by-side comparison of 2-3 products (future enhancement)
- **Filters UI**: This is chat-only - no visual filter checkboxes/dropdowns (web UI filters separate feature)
- **Search History**: "Ripeti ultima ricerca" or "Vedi ricerche precedenti" (future enhancement)
- **Product Ratings**: Display of customer reviews/ratings (not in current database schema)
- **Stock Quantity Display**: Showing "Solo 3 rimasti!" or exact stock numbers (privacy/competitive concern)
- **Multi-Product Addition**: Adding multiple different products in one message (one product at a time for now)

---

## Risks & Mitigations

### Risk 1: Token Limit Exceeded with Large Product Catalogs

**Impact**: HIGH - Workspaces with 1000+ products may cause {{PRODUCTS}} to exceed token limit

**Mitigation**:

- Use product count threshold: If >500 products, use category-based pre-filtering before sending to LLM
- Alternative: Implement RAG-based product search (future enhancement) where only relevant products sent to LLM
- Short-term: Warn workspaces with >500 products that search performance may degrade

### Risk 2: LLM Grouping Quality Varies

**Impact**: MEDIUM - Dynamic grouping may produce inconsistent or unhelpful groups

**Mitigation**:

- Include explicit grouping examples in ProductSearchAgent prompt (few-shot learning)
- Add fallback: If LLM grouping unclear, default to category-based grouping
- Log all grouping decisions for quality analysis and prompt refinement

### Risk 3: Quantity Extraction Ambiguity

**Impact**: LOW - Customer says "ne voglio alcuni" or "ne voglio tipo 3-4"

**Mitigation**:

- LLM extracts clear number or asks clarification: "Quanti esattamente? Specifica un numero"
- Default to qty=1 if extraction fails with warning logged

---

## Notes

- This feature focuses on **chat-based search experience** - complementary to existing catalog browsing in web UI
- Key innovation: **Progressive disclosure** reduces cognitive load vs showing all products at once
- **LLM dynamic grouping** (FR-003) is differentiator vs. fixed category trees
- Success depends on **prompt quality** more than code changes (90% prompt, 10% code)
- Consider A/B testing: Dynamic grouping vs fixed category grouping to measure effectiveness

---
