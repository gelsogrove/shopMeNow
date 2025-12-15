# Feature Specification: Order Details Query

**Feature Branch**: `192-order-details-query`  
**Created**: 2024-12-02  
**Status**: Draft  
**Input**: User description: "Lista ordini con totale, selezione per numero, query dettagli ordine da DB, opzioni download documenti (fattura/DDT/nota credito)"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - View Order List with Totals (Priority: P1)

As a customer, I want to see my recent orders with the order total (not product count) so I can quickly identify which order I want to inspect.

**Why this priority**: This is the entry point for the entire feature. Without the order list, users cannot access order details.

**Independent Test**: Can be fully tested by asking the chatbot "quali sono i miei ordini?" and verifying the response shows order codes, dates, status, and totals (€).

**Acceptance Scenarios**:

1. **Given** a customer with past orders, **When** they ask "quali sono i miei ordini?", **Then** the system displays a numbered list with order code, status, date, and total amount (€)
2. **Given** a customer with past orders, **When** they view the order list, **Then** each order shows `📦 ORD-XXX-YYYY-N - ✅ Status (DD/MM/YYYY) - €XX.XX` format
3. **Given** a customer with no orders, **When** they ask for orders, **Then** they receive a friendly message saying no orders found
4. **Given** a customer asks "mostrami gli ordini", **When** the request is processed, **Then** the system responds with the same order list format

**Output Format**:
```
Ciao! Ecco i tuoi ordini recenti:

1. 📦 ORD-048-2025-9 - ✅ Consegnato (29/09/2025) - €125.50
2. 📦 ORD-044-2025-9 - ✅ Consegnato (14/09/2025) - €89.00
3. 📦 ORD-040-2025-8 - ✅ Consegnato (28/08/2025) - €45.30
4. 📦 ORD-036-2025-8 - 🚚 In spedizione (14/08/2025) - €210.75
5. 📦 ORD-032-2025-7 - ⏳ In lavorazione (26/07/2025) - €33.20

A quale sei interessato? (scrivi il numero)
```

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: N/A (WhatsApp chatbot response)
- [ ] Backend API: Order Tracking Agent processes request
- [ ] Service Layer: `getCustomerOrders()` returns orders with totals
- [ ] Repository: Query orders by customerId with total calculation
- [ ] Database: Orders table already exists
- [ ] Security: Workspace isolation in queries
- [ ] Testing: Unit tests for order list formatting
- [ ] Documentation: Update order-tracking-agent.md prompt
- [ ] Concurrency: N/A for read operation
- [ ] Prompt Variables: N/A
- [ ] Code Cleanliness: No duplication with existing order functions

---

### User Story 2 - Select Order by Number (Priority: P1)

As a customer, I want to select an order by typing its number (1, 2, 3...) so I can view the full details of that specific order.

**Why this priority**: Critical for the user flow - links order list selection to order details retrieval.

**Independent Test**: After seeing order list, customer types "1" and receives full order details.

**Acceptance Scenarios**:

1. **Given** a customer has seen the order list, **When** they type "1", **Then** the system calls `getOrderDetails(orderCode)` for the first order
2. **Given** a customer has seen the order list, **When** they type "3", **Then** the system retrieves details for the third order in the list
3. **Given** a customer types a number outside the list range, **When** processed, **Then** the system responds with "Numero non valido, scegli tra 1 e N"
4. **Given** a customer directly asks "dammi ordine ORD-048-2025-9", **When** processed, **Then** the system calls `getOrderDetails(ORD-048-2025-9)` directly

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: N/A
- [ ] Backend API: Router Agent routes to Order Tracking Agent with order selection
- [ ] Service Layer: Parse number from conversation history, extract orderCode
- [ ] Repository: N/A (uses calling function)
- [ ] Database: N/A
- [ ] Security: Verify order belongs to customer
- [ ] Testing: Unit tests for number selection parsing
- [ ] Documentation: Update router-agent.md with order selection example
- [ ] Concurrency: N/A
- [ ] Prompt Variables: N/A
- [ ] Code Cleanliness: Follow REGOLA VII for short reply context interpretation

---

### User Story 3 - View Full Order Details (Priority: P1)

As a customer, I want to see all details of my selected order including products, prices, shipping info, and address so I have complete visibility.

**Why this priority**: Core value proposition - customers need full order transparency.

**Independent Test**: After selecting order #1, system displays complete order details from database query.

**Acceptance Scenarios**:

1. **Given** customer selects an order, **When** `getOrderDetails(orderCode)` is called, **Then** system queries database and returns all order fields
2. **Given** order details are retrieved, **When** displayed to customer, **Then** format includes: order code, date, status, product list with quantities and prices, subtotal, shipping cost, total, and delivery address
3. **Given** an order has multiple products, **When** details are shown, **Then** each product shows name, code, quantity, and line total
4. **Given** an order has a discount applied, **When** details are shown, **Then** the discount is visible in the breakdown

**Output Format**:
```
📦 Ordine ORD-048-2025-9

📅 Data: 29/09/2025
📍 Stato: ✅ Consegnato

📦 Prodotti:
• (PARM-001) Parmigiano Reggiano DOP 1kg x2 - €37.00
• (OLIO-003) Olio EVO Toscano 750ml x1 - €18.50
• (MOZZ-002) Mozzarella di Bufala DOP x3 - €23.40

💰 Subtotale: €78.90
🎁 Sconto: -€7.89 (10%)
🚚 Spedizione: €5.00
💵 Totale: €76.01

📍 Indirizzo di consegna:
Via Roma 123, 20100 Milano (MI)

Vuoi:
📄 Scaricare la fattura
🚚 Documento di trasporto
💳 Nota di credito (se disponibile)

Scrivi cosa ti serve!
```

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: N/A
- [ ] Backend API: New calling function `getOrderDetails`
- [ ] Service Layer: `OrderService.getOrderDetails(orderCode, customerId)`
- [ ] Repository: Query order with items, calculate totals
- [ ] Database: Orders + OrderItems tables
- [ ] Security: Verify order belongs to requesting customer
- [ ] Testing: Unit tests for order details formatting
- [ ] Documentation: Add `getOrderDetails` to agent-functions.config.ts
- [ ] Concurrency: N/A for read operation
- [ ] Prompt Variables: N/A
- [ ] Code Cleanliness: Reuse existing order query logic where possible

---

### User Story 4 - Download Order Documents (Priority: P2)

As a customer, I want to download invoice, transport document (DDT), or credit note for my order so I have the official documentation.

**Why this priority**: Important for business customers and compliance, but not blocking core order viewing.

**Independent Test**: After viewing order details, customer can request "fattura" and receives a download link.

**Acceptance Scenarios**:

1. **Given** customer is viewing order details, **When** they type "fattura", **Then** system provides a tokenized link to download the invoice PDF
2. **Given** customer is viewing order details, **When** they type "documento di trasporto" or "DDT", **Then** system provides a tokenized link to the DDT PDF
3. **Given** customer is viewing order details for an order WITH credit note, **When** they type "nota di credito", **Then** system provides a tokenized link to the credit note PDF
4. **Given** customer requests a credit note but none exists, **When** processed, **Then** system responds "Non è presente una nota di credito per questo ordine"
5. **Given** document links are provided, **When** customer clicks link, **Then** PDF downloads securely via tokenized URL

**Output Format** (document link response):
```
📄 Ecco la tua fattura per l'ordine ORD-048-2025-9:

[LINK_ORDER_WITH_TOKEN]

Il link è valido per 24 ore. Dalla pagina ordine potrai scaricare la fattura.
```

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: N/A (links open in browser)
- [ ] Backend API: Document download endpoint with token validation
- [ ] Service Layer: Generate secure download token, validate access
- [ ] Repository: Query document URLs from order
- [ ] Database: Order model already has invoiceUrl, ddt fields (verify creditNoteUrl exists)
- [ ] Security: Token-based access, expiry validation
- [ ] Testing: Unit tests for document link generation
- [ ] Documentation: Add document download link tokens to documentation
- [ ] Concurrency: N/A
- [ ] Prompt Variables: N/A
- [ ] Code Cleanliness: Reuse SecureTokenService pattern

---

### Edge Cases

- What happens when customer asks for order details without first viewing the list? → System should handle direct order code requests (e.g., "dammi ordine ORD-048-2025-9")
- What happens when order code doesn't exist? → Return friendly error "Ordine non trovato"
- What happens when order belongs to different customer? → Return "Ordine non trovato" (don't reveal existence)
- What happens when document URL is null/empty in database? → Return "Documento non ancora disponibile"
- What happens when customer has 0 orders? → Return friendly message suggesting to make first purchase

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST display customer orders with total amount (€), not product count
- **FR-002**: System MUST allow order selection by number (1-9) after showing list
- **FR-003**: System MUST allow direct order lookup by order code (e.g., "dammi ordine ORD-XXX")
- **FR-004**: System MUST query full order details from database when `getOrderDetails(orderCode)` is called
- **FR-005**: Order details MUST include: order code, date, status, products (name, code, qty, price), subtotal, discount, shipping, total, delivery address
- **FR-006**: System MUST offer document download options (invoice, DDT, credit note) after showing order details
- **FR-007**: Credit note option MUST only appear if order has a credit note available
- **FR-008**: Document download links MUST be tokenized and expire after 24 hours
- **FR-009**: System MUST verify order belongs to requesting customer before showing details
- **FR-010**: System MUST NOT use `LINK_ORDERS_WITH_TOKEN` (deprecated) - show details inline instead

### Calling Function Definition

**New Function**: `getOrderDetails`

```typescript
{
  name: "getOrderDetails",
  description: "Get full details of a specific order including products, prices, totals, and available documents",
  agentType: "ORDER_TRACKING",
  parameters: {
    type: "object",
    properties: {
      orderCode: {
        type: "string",
        description: "The order code (e.g., ORD-048-2025-9)"
      }
    },
    required: ["orderCode"]
  },
  returns: {
    type: "object",
    description: "Complete order details with products, totals, address, and document availability"
  }
}
```

### Key Entities

- **Order**: Existing entity - orderCode, status, date, total, customerId, workspaceId, invoiceUrl, ddtUrl, creditNoteUrl
- **OrderItem**: Existing entity - sku, productName, quantity, unitPrice, lineTotal
- **Customer**: Existing entity - used for ownership verification

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Customers can view their order list within 2 seconds of asking
- **SC-002**: Order list displays total amount (€) instead of product count
- **SC-003**: Customers can select an order by typing a single number (1-9)
- **SC-004**: Full order details are retrieved and displayed within 3 seconds
- **SC-005**: Document download links work correctly and expire after 24 hours
- **SC-006**: 100% of order detail requests return accurate data from database (no hardcoded/fake data)
- **SC-007**: Direct order code queries (e.g., "dammi ordine ORD-XXX") work correctly
- **SC-008**: `getOrderDetails` calling function appears in Agent Configuration UI

## Implementation Plan

### Files to Create/Modify

| Step | Action | File |
|------|--------|------|
| 1 | Add `getOrderDetails` function definition | `apps/backend/src/config/agent-functions.config.ts` |
| 2 | Implement `getOrderDetails` handler | `apps/backend/src/services/calling-functions.service.ts` |
| 3 | Add `getOrderDetailsByCode` method | `apps/backend/src/application/services/order.service.ts` |
| 4 | Update Order Tracking Agent prompt | `docs/prompts/order-tracking-agent.md` |
| 5 | Update Router Agent prompt (order selection example) | `docs/prompts/router-agent.md` |
| 6 | Add document download link tokens | `apps/backend/src/services/link-replacement.service.ts` |
| 7 | Update database seed to add `getOrderDetails` to ORDER_TRACKING agent | `apps/backend/prisma/seed.ts` |

### Architecture Notes

- Follows **REGOLA I**: Function defined in single source `agent-functions.config.ts`
- Follows **REGOLA V**: Function automatically visible in Agent Configuration UI
- Follows **REGOLA VII**: Router handles short replies (number selection) with context
- Follows **REGOLA X**: Uses valid link tokens only (no deprecated tokens)
- `LINK_ORDERS_WITH_TOKEN` already removed from documentation ✅

## Assumptions

- Order table already has `invoiceUrl`, `ddtUrl` fields
- `creditNoteUrl` field exists or will be added if missing
- Document URLs point to externally hosted PDFs (not generated by system)
- Token expiration for document links follows existing `SecureTokenService` pattern (24h default)
- Order status translations handled by Safety & Translation Agent
