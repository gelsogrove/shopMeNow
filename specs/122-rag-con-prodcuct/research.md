# Research: FR-13 Repeat Order with Confirmation Flow

**Feature**: Repeat Order with User Confirmation  
**Date**: 2025-11-12  
**Researcher**: AI Agent

---

## Research Tasks

### 1. Existing Calling Functions Analysis

**Question**: Can we reuse existing `AddProduct` CF or need new `addProducts` CF?

**Investigation**:

- Examined `/backend/src/domain/calling-functions/AddProduct.ts`
- Interface: `AddProductRequest { products: ProductToAdd[], customerId, workspaceId }`
- ProductToAdd: `{ sku: string, quantity: number, notes?: string }`
- Returns: `{ success, message, totalAdded, skipped, cartUrl, expiresAt }`

**Decision**: ✅ **REUSE existing `AddProduct` CF**

**Rationale**:

- Already supports array of products (NOT single product as name suggests)
- Already generates checkout link with token
- Already workspace-isolated
- Already handles batch additions with detailed reporting

**Alternatives Considered**:

- ❌ Create new `addProducts` CF → Unnecessary duplication
- ❌ Modify `repeatLastOrder` to accept product array → Violates single responsibility

---

### 2. Checkout Step Parameter Implementation

**Question**: How to link directly to Step 2 (address) instead of Step 1 (cart)?

**Investigation**:

- Examined `/frontend/src/pages/CheckoutPage.tsx`
- Current logic: `const [currentStep, setCurrentStep] = useState(1)`
- URL parameter detection: Uses `useSearchParams()` from react-router
- Step navigation: Controlled by `currentStep` state

**Decision**: ✅ **Add `?step=2` URL parameter support**

**Implementation Pattern**:

```typescript
// CheckoutPage.tsx - on mount
useEffect(() => {
  const searchParams = new URLSearchParams(window.location.search)
  const stepParam = searchParams.get("step")
  if (stepParam === "2" && cart.items.length > 0) {
    setCurrentStep(2)
  }
}, [cart])
```

**Rationale**:

- Simple URL-based routing (no complex state management)
- Preserves existing step navigation logic
- Easy to test and maintain

**Alternatives Considered**:

- ❌ Separate route `/checkout/address` → Breaks existing flow, more complex
- ❌ State from localStorage → Race conditions, harder to share links

---

### 3. {{LAST_ORDER}} Variable Format

**Question**: What format should {{LAST_ORDER}} variable use for optimal LLM comprehension?

**Investigation**:

- Examined existing variables: `{{PRODUCTS}}`, `{{CATEGORIES}}`, `{{OFFERS}}`
- Format: Markdown lists with codes, names, prices (Italian)
- Translation: LLM handles dynamic translation to customer language

**Decision**: ✅ **Formatted order summary with product list**

**Format**:

```
Ultimo ordine: ORD-2024-001 del 15/10/2024

Prodotti ordinati:
- A001 Tagliatelle fresche 500g x4 (3.50€ cad.) = 14.00€
- A002 Salame Toscano x12 (2.80€ cad.) = 33.60€
- A003 Parmigiano Reggiano 24 mesi x1 (12.00€ cad.) = 12.00€

Totale ordine: 59.60€
Stato: CONSEGNATO
```

**Rationale**:

- Human-readable for LLM context understanding
- Italian base language (per constitution)
- Includes all necessary details for confirmation dialog
- Product codes enable easy `addProducts` mapping

**Alternatives Considered**:

- ❌ JSON format → LLM prefers natural language
- ❌ Only product names → Loses code for addProducts call
- ❌ English format → Violates constitution (base language: Italian)

---

### 4. Confirmation Flow State Management

**Question**: How to handle LLM confirmation without breaking conversation flow?

**Investigation**:

- Current flow: Router → OrderTrackingAgent → Router → Safety
- LLM conversation history: Last 10 minutes (spec.md line 140)
- No stateful confirmation mechanism (all LLM-driven)

**Decision**: ✅ **LLM-driven confirmation with conversation context**

**Flow**:

1. User: "voglio ripetere ultimo ordine"
2. Agent calls `getLastOrderDetails()` → receives order data
3. Agent shows order summary from {{LAST_ORDER}} + asks "Vuoi confermare?"
4. User: "SI"
5. Agent recognizes confirmation in conversation history
6. Agent calls `addProducts([{sku, quantity}...])` with order items
7. Returns checkout link with `?step=2`

**Rationale**:

- No database state needed (LLM handles context)
- Works with existing conversation history mechanism
- Follows existing confirmation patterns (e.g., `addToCart` requires product ID confirmation)

**Alternatives Considered**:

- ❌ Database state flag `pendingRepeatOrder` → Adds complexity, race conditions
- ❌ Session storage → Doesn't work across WhatsApp message gaps
- ❌ New CF `confirmRepeatOrder()` → Unnecessary, LLM can handle with context

---

### 5. Link Generator Step Parameter

**Question**: How to extend link generation for step parameter?

**Investigation**:

- Examined `/backend/src/services/link-generator.service.ts`
- Current: `generateCheckoutLink(token, workspaceId)` → `https://domain.com/checkout-public?token=xxx`
- Token contains: `{ customerId, workspaceId, type: 'checkout', expiresAt }`

**Decision**: ✅ **Add optional `step` parameter to `generateCheckoutLink`**

**Implementation**:

```typescript
async generateCheckoutLink(
  token: string,
  workspaceId: string,
  step?: number  // NEW - optional step parameter
): Promise<string> {
  const baseUrl = `${process.env.FRONTEND_URL}/checkout-public?token=${token}`
  return step ? `${baseUrl}&step=${step}` : baseUrl
}
```

**Rationale**:

- Minimal change (backward compatible)
- Optional parameter (existing code unaffected)
- Standard URL query parameter approach

**Alternatives Considered**:

- ❌ Separate method `generateCheckoutLinkWithStep()` → Code duplication
- ❌ Encode step in token → Token becomes stateful, harder to manage

---

### 6. Order Tracking Agent Prompt Update

**Question**: Where to add {{LAST_ORDER}} and how to update prompt?

**Investigation**:

- Prompts stored in `agentConfig` table (database-first principle)
- Current update mechanism: `npm run update-prompt` (from `docs/prompt_agent.md`)
- Script: `/backend/scripts/update-agent-prompt.ts`

**Decision**: ✅ **Add {{LAST_ORDER}} to Order Tracking Agent system prompt via database seed**

**Update Points**:

1. Add variable to `/backend/src/services/prompt-processor.service.ts` replacement logic
2. Update `/backend/prisma/seed.ts` Order Tracking Agent prompt
3. Add {{LAST_ORDER}} section to prompt: "Ultimo ordine cliente: {{LAST_ORDER}}"
4. Run `npm run seed` to update database

**Rationale**:

- Follows existing prompt update workflow
- Database-first (constitution principle I)
- Easily versioned and rolled back

**Alternatives Considered**:

- ❌ Hardcode in OrderTrackingAgentLLM.ts → Violates database-first
- ❌ Dynamic injection at runtime without prompt → LLM won't know variable exists

---

## Consolidated Findings

### Key Decisions Summary

1. **Reuse AddProduct CF** - No new CF needed, existing supports arrays
2. **URL parameter ?step=2** - Simple, testable, maintainable
3. **Formatted order summary** - Italian base, Markdown format, includes codes
4. **LLM-driven confirmation** - No database state, uses conversation history
5. **Extend link generator** - Optional step parameter, backward compatible
6. **Database seed update** - Add {{LAST_ORDER}} to Order Agent via seed.ts

### Technology Choices

| Component        | Technology                | Rationale                       |
| ---------------- | ------------------------- | ------------------------------- |
| CF Reuse         | AddProduct.ts             | Already supports product arrays |
| URL Routing      | React Router searchParams | Standard, no extra deps         |
| Variable Format  | Markdown Italian          | Consistent with existing vars   |
| State Management | LLM conversation history  | No DB state needed              |
| Link Generation  | Query parameter           | RESTful, cacheable              |
| Prompt Update    | Database seed             | Constitution compliant          |

### Best Practices Applied

- ✅ **Database-First**: {{LAST_ORDER}} from agentConfig table
- ✅ **Workspace Isolation**: All queries filtered by workspaceId
- ✅ **Variable Replacement**: Runtime replacement in PromptProcessorService
- ✅ **No Static Translations**: Italian base → LLM translates
- ✅ **Reuse Over Reinvent**: Use AddProduct CF instead of new CF
- ✅ **Backward Compatibility**: Optional step parameter doesn't break existing

### Integration Patterns

**Calling Function Flow**:

```
User: "ripeti ultimo ordine"
  ↓
Router LLM → OrderTrackingAgent
  ↓
OrderTrackingAgent calls getLastOrderDetails()
  ↓
{{LAST_ORDER}} replaced with formatted summary
  ↓
Agent shows order + asks confirmation
  ↓
User: "SI"
  ↓
Agent recognizes confirmation
  ↓
Agent calls addProducts([{sku, quantity}...])
  ↓
AddProduct CF adds all items to cart
  ↓
Returns checkout link with ?step=2
  ↓
User clicks → CheckoutPage loads at Step 2 (address)
```

**Variable Replacement Flow**:

```
1. Order query: orders.findFirst(customerId, workspaceId, status: DELIVERED)
2. Format order:
   - orderCode, date
   - items.map(item => `${product.sku} ${product.name} x${qty} (${price}€)`)
   - totalPrice
3. Replace in prompt: prompt.replace('{{LAST_ORDER}}', formattedOrder)
4. LLM receives context with last order details
5. LLM generates response in customer language
```

---

## Risks & Mitigations

### Risk 1: LLM Hallucination on Confirmation

**Risk**: LLM might call `addProducts` without user confirmation

**Mitigation**:

- Add explicit prompt instruction: "MUST ask confirmation before calling addProducts"
- Test with negative cases: user says "no", "aspetta", "dopo"
- Add validation: Check last user message contains confirmation keywords

### Risk 2: Checkout Step 2 without Cart Items

**Risk**: User accesses `?step=2` with empty cart

**Mitigation**:

- Frontend validation: `if (cart.items.length === 0 && step === 2) setCurrentStep(1)`
- Show error message: "Carrello vuoto, aggiungi prodotti prima di procedere"

### Risk 3: Order Item Unavailability

**Risk**: Product from last order no longer available

**Mitigation**:

- AddProduct CF already handles: Returns `skipped` count + details
- Agent should communicate: "Ho aggiunto 3 su 4 prodotti. Salame Toscano non più disponibile"

---

## Next Steps (Phase 1)

1. Generate `data-model.md` with order summary format specification
2. Generate API contracts for updated link generation
3. Create `quickstart.md` with step-by-step implementation guide
4. Update agent context with new dependencies (none needed)

**Estimated Effort**: 8 story points (3-4 days)

- Backend changes: 3 SP (PromptProcessor, LinkGenerator, Seed)
- Frontend changes: 2 SP (CheckoutPage step parameter)
- Testing: 3 SP (Unit + Integration tests)
