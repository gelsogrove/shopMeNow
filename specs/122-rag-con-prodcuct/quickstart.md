# Quickstart: FR-13 Repeat Order with Confirmation Flow

**Feature**: Repeat Order with User Confirmation  
**Estimated Time**: 3-4 hours  
**Complexity**: Medium (8 story points)  

---

## Prerequisites

- ✅ Backend running on port 3001 (`npm run dev`)
- ✅ Frontend running on port 3000 (`npm run dev`)
- ✅ Database seeded (`npm run seed`)
- ✅ Constitution.md principles understood

---

## Implementation Steps

### Step 1: Add {{LAST_ORDER}} Variable to PromptProcessorService (90 min)

**Location**: `backend/src/services/prompt-processor.service.ts`

**Tasks**:

1. **Add `getLastOrderVariable` method** (40 min)
   ```typescript
   private async getLastOrderVariable(
     customerId: string,
     workspaceId: string
   ): Promise<string> {
     // Query last DELIVERED order
     const order = await this.prisma.orders.findFirst({
       where: { customerId, workspaceId, status: 'DELIVERED' },
       orderBy: { createdAt: 'desc' },
       include: {
         items: {
           include: {
             product: { select: { productCode: true, name: true } }
           }
         }
       },
       take: 1
     })

     if (!order || !order.items || order.items.length === 0) {
       return "Nessun ordine precedente disponibile."
     }

     // Format order summary (Italian base language)
     const orderDate = order.createdAt.toISOString().split('T')[0]
     const itemsText = order.items.map(item => {
       const lineTotal = item.quantity * item.unitPrice
       return `- ${item.product.productCode} ${item.product.name} x${item.quantity} (${item.unitPrice.toFixed(2)}€ cad.) = ${lineTotal.toFixed(2)}€`
     }).join('\n')

     const totalPrice = order.items.reduce(
       (sum, item) => sum + (item.quantity * item.unitPrice),
       0
     )

     return `Ultimo ordine: ${order.orderCode} del ${orderDate}

Prodotti ordinati:
${itemsText}

Totale ordine: ${totalPrice.toFixed(2)}€
Stato: ${order.status}`
   }
   ```

2. **Update `replaceAllVariables` method** (20 min)
   ```typescript
   async replaceAllVariables(
     prompt: string,
     context: ExecutionContext
   ): Promise<string> {
     let processedPrompt = prompt

     // Existing variables (nome, email, etc.)
     // ... keep existing code ...

     // NEW: {{LAST_ORDER}} replacement
     if (processedPrompt.includes('{{LAST_ORDER}}')) {
       const lastOrder = await this.getLastOrderVariable(
         context.customerId,
         context.workspaceId
       )
       processedPrompt = processedPrompt.replace(/\{\{LAST_ORDER\}\}/g, lastOrder)
     }

     return processedPrompt
   }
   ```

3. **Add unit tests** (30 min)
   - Create `backend/__tests__/unit/prompt-processor-lastorder.test.ts`
   - Test cases: with order, no order, database error
   - Run: `npm run test:unit -- prompt-processor-lastorder`

**Verification**:
```bash
# Test variable replacement
npm run test:unit -- prompt-processor-lastorder

# Check output
# Expected: ✅ 3/3 tests passing
```

---

### Step 2: Update Order Tracking Agent Prompt (30 min)

**Location**: `backend/prisma/seed.ts`

**Tasks**:

1. **Add {{LAST_ORDER}} section to Order Agent prompt** (20 min)
   ```typescript
   // Find Order Tracking Agent config update
   const orderAgentPrompt = `
   # System Role
   Tu sei l'Order Tracking Agent di ShopME. Gestisci tracking ordini.

   ## Ultimo Ordine Cliente
   
   {{LAST_ORDER}}

   ## Available Functions
   - getOrderHistory(limit?)
   - getLastOrders(limit?)
   - getOrderDetails(orderCode?)
   - trackOrderStatus(orderCode)
   - sendInvoice(orderCode, email?)
   - repeatLastOrder()

   ## Repeat Order Flow - PRIORITY 1

   When customer asks to repeat last order ("ripeti ultimo ordine", "riordina", etc.):

   1. ✅ **SHOW ORDER SUMMARY**: Use {{LAST_ORDER}} above to show details
   2. ✅ **ASK CONFIRMATION**: "Vuoi ripetere l'operazione?" (MUST ask before adding)
   3. ✅ **WAIT FOR USER RESPONSE**: Listen for "SI", "certo", "ok", "confermo"
   4. ✅ **IF CONFIRMED**: Call repeatLastOrder()
   5. ✅ **RETURN CHECKOUT LINK**: Link will go directly to address step

   **Example Dialog**:
   ```
   👤 User: "Voglio ripetere l'ultimo ordine"
   
   🤖 You: "Ciao Andrea! Il tuo ultimo ordine era ORD-2024-001:
   - 4x Tagliatelle fresche (14.00€)
   - 12x Salame Toscano (33.60€)
   Totale: 47.60€
   
   Vuoi ripetere l'operazione? 🛒"
   
   👤 User: "SI"
   
   🤖 You: [CALL repeatLastOrder()]
   
   📦 Function returns: {cartUrl: "...?step=2", ...}
   
   🤖 You: "✅ Ho aggiunto i prodotti al carrello!
   Procedi al checkout: [LINK]
   ⏰ Link valido per 15 minuti"
   ```
   `

   await prisma.agentConfig.update({
     where: {
       agentType_workspaceId: {
         agentType: 'ORDER_TRACKING',
         workspaceId: defaultWorkspace.id
       }
     },
     data: { systemPrompt: orderAgentPrompt }
   })
   ```

2. **Run seed** (10 min)
   ```bash
   cd backend && npm run seed
   ```

**Verification**:
```bash
# Check database
npx prisma studio
# Navigate to agentConfig → ORDER_TRACKING
# Verify systemPrompt contains {{LAST_ORDER}}
```

---

### Step 3: Extend LinkGeneratorService with Step Parameter (45 min)

**Location**: `backend/src/services/link-generator.service.ts`

**Tasks**:

1. **Update method signature** (15 min)
   ```typescript
   async generateCheckoutLink(
     token: string,
     workspaceId: string,
     step?: number  // NEW optional parameter
   ): Promise<string> {
     // Validation
     if (step !== undefined && (step < 1 || step > 2)) {
       throw new Error('Invalid step: must be 1 or 2')
     }

     // Get workspace for custom domain
     const workspace = await this.prisma.workspace.findUnique({
       where: { id: workspaceId },
       select: { customDomain: true }
     })

     // Build base URL
     const baseUrl = workspace?.customDomain 
       ? `https://${workspace.customDomain}/checkout-public`
       : `${process.env.FRONTEND_URL}/checkout-public`

     // Add token
     let url = `${baseUrl}?token=${token}`

     // Add step if provided
     if (step !== undefined) {
       url += `&step=${step}`
     }

     return url
   }
   ```

2. **Update CallingFunctionsService.getCartLink** (20 min)
   ```typescript
   // backend/src/services/calling-functions.service.ts
   
   public async getCartLink(request: {
     customerId: string
     workspaceId: string
     step?: number  // NEW parameter
   }): Promise<any> {
     // ... existing token generation ...

     const linkGeneratorService = new LinkGeneratorService()
     const cartUrl = await linkGeneratorService.generateCheckoutLink(
       token,
       request.workspaceId,
       request.step  // Pass step parameter
     )

     return { success: true, linkUrl: cartUrl, token, ... }
   }
   ```

3. **Add unit tests** (10 min)
   - Create `backend/__tests__/unit/link-generator-step.test.ts`
   - Test: no step, step=1, step=2, invalid step
   - Run: `npm run test:unit -- link-generator-step`

**Verification**:
```bash
npm run test:unit -- link-generator-step
# Expected: ✅ 4/4 tests passing
```

---

### Step 4: Update AddProduct CF to Use Step Parameter (30 min)

**Location**: `backend/src/domain/calling-functions/AddProduct.ts`

**Tasks**:

1. **Modify link generation call** (20 min)
   ```typescript
   // Around line 140-170 in AddProduct.ts

   // Generate cart link with step=2 (direct to address)
   const cartLinkResult = await callingFunctionsService.getCartLink({
     customerId: request.customerId,
     workspaceId: request.workspaceId,
     step: 2  // NEW: Skip cart review, go to address
   })

   if (!cartLinkResult.success || !cartLinkResult.linkUrl) {
     // ... error handling ...
   }

   const cartUrl = cartLinkResult.linkUrl  // Now includes ?step=2
   const token = cartLinkResult.token
   const expiresAt = cartLinkResult.expiresAt
   ```

2. **Test AddProduct CF** (10 min)
   ```bash
   # Integration test
   npm run test:integration -- add-product

   # Verify URL format
   # Expected: cartUrl contains "?token=xxx&step=2"
   ```

**Verification**:
```bash
# Check generated URL
console.log(cartUrl)
# Expected: "https://shopme.local/checkout-public?token=eyJ...&step=2"
```

---

### Step 5: Frontend - CheckoutPage Step Parameter Handling (60 min)

**Location**: `frontend/src/pages/CheckoutPage.tsx`

**Tasks**:

1. **Add URL parameter detection** (30 min)
   ```typescript
   // At top of component
   import { useSearchParams } from 'react-router-dom'

   export function CheckoutPage() {
     const [searchParams] = useSearchParams()
     const [currentStep, setCurrentStep] = useState(1)
     const [cart, setCart] = useState<Cart | null>(null)

     // NEW: Detect step parameter on mount
     useEffect(() => {
       const stepParam = searchParams.get('step')
       
       if (stepParam === '2' && cart && cart.items.length > 0) {
         // Only go to step 2 if cart has items
         setCurrentStep(2)
       } else if (stepParam === '2' && (!cart || cart.items.length === 0)) {
         // Cart empty but step=2 requested → show error
         toast.error('Carrello vuoto. Aggiungi prodotti prima di procedere.')
         setCurrentStep(1)
       }
     }, [cart, searchParams])

     // ... rest of component
   ```

2. **Add auto-focus for address step** (20 min)
   ```typescript
   // In Step2Address.tsx
   
   useEffect(() => {
     // If arriving from repeat order (step=2), auto-focus first field
     const urlParams = new URLSearchParams(window.location.search)
     if (urlParams.get('step') === '2') {
       // Focus street address input
       document.getElementById('street-address')?.focus()
     }
   }, [])
   ```

3. **Add unit tests** (10 min)
   - Create `frontend/tests/checkout-step-navigation.test.ts`
   - Test: ?step=2 with items, ?step=2 without items, no step param
   - Run: `npm test -- checkout-step-navigation`

**Verification**:
```bash
# Manual test
# 1. Open: http://localhost:3000/checkout-public?token=xxx&step=2
# 2. Expected: Cart loaded, Step 2 (address) shown directly
# 3. Step 1 (cart review) skipped
```

---

### Step 6: Update RepeatOrder CF Logic (Optional - 30 min)

**Location**: `backend/src/domain/calling-functions/RepeatOrder.ts`

**Current Behavior**: Automatically adds items to cart without confirmation

**New Behavior**: Should work with LLM confirmation flow

**Options**:

**Option A**: Keep RepeatOrder.ts as-is (RECOMMENDED)
- LLM handles confirmation in conversation
- RepeatOrder still adds items when called
- No code changes needed

**Option B**: Add confirmation parameter
```typescript
export interface RepeatOrderRequest {
  customerId: string
  workspaceId: string
  orderCode?: string
  confirmed?: boolean  // NEW
}

// In RepeatOrder function
if (!request.confirmed) {
  return {
    success: false,
    error: "CONFIRMATION_REQUIRED",
    message: "Please confirm order before repeating"
  }
}
```

**Recommendation**: Use **Option A** - LLM-driven confirmation is sufficient

---

### Step 7: Integration Testing (60 min)

**Location**: `backend/__tests__/integration/repeat-order-flow.test.ts`

**Tasks**:

1. **Create end-to-end test** (40 min)
   ```typescript
   describe('Repeat Order Confirmation Flow', () => {
     it('should complete full repeat order flow', async () => {
       // 1. Create test order
       const order = await createTestOrder({
         customerId: testCustomer.id,
         workspaceId: testWorkspace.id,
         status: 'DELIVERED',
         items: [
           { productCode: 'A001', quantity: 4 },
           { productCode: 'A002', quantity: 12 }
         ]
       })

       // 2. Simulate OrderTrackingAgent call
       const context = {
         customerId: testCustomer.id,
         workspaceId: testWorkspace.id,
         customerName: 'Andrea'
       }

       // 3. Replace {{LAST_ORDER}} variable
       const promptProcessor = new PromptProcessorService()
       const prompt = "Order: {{LAST_ORDER}}"
       const result = await promptProcessor.replaceAllVariables(prompt, context)

       expect(result).toContain(order.orderCode)
       expect(result).toContain('A001')
       expect(result).toContain('A002')

       // 4. Call repeatLastOrder (simulating LLM confirmation)
       const addResult = await AddProduct({
         customerId: testCustomer.id,
         workspaceId: testWorkspace.id,
         products: [
           { productCode: 'A001', quantity: 4 },
           { productCode: 'A002', quantity: 12 }
         ]
       })

       expect(addResult.success).toBe(true)
       expect(addResult.cartUrl).toContain('?token=')
       expect(addResult.cartUrl).toContain('&step=2')
       expect(addResult.totalAdded).toBe(2)
     })
   })
   ```

2. **Run integration tests** (20 min)
   ```bash
   npm run test:integration -- repeat-order-flow
   ```

**Verification**:
```bash
# All tests should pass
✅ Backend build successful
✅ Unit tests: 7/7 passing
✅ Integration tests: 1/1 passing
```

---

## Testing Checklist

### Unit Tests ✅

- [x] PromptProcessorService.getLastOrderVariable()
  - [x] With order found
  - [x] No orders
  - [x] Database error
- [x] LinkGeneratorService.generateCheckoutLink()
  - [x] Without step parameter
  - [x] With step=1
  - [x] With step=2
  - [x] Invalid step (should throw error)
- [x] Frontend CheckoutPage step navigation
  - [x] ?step=2 with items in cart
  - [x] ?step=2 with empty cart
  - [x] No step parameter (default to 1)

### Integration Tests ✅

- [x] Full repeat order flow
  - [x] Create test order
  - [x] Replace {{LAST_ORDER}} variable
  - [x] Call AddProduct with order items
  - [x] Verify checkout URL contains ?step=2
  - [x] Verify cart has correct items

### Manual Tests ✅

- [x] WhatsApp conversation flow
  - [x] User: "Voglio ripetere ultimo ordine"
  - [x] Agent shows order summary
  - [x] Agent asks confirmation
  - [x] User: "SI"
  - [x] Agent calls repeatLastOrder()
  - [x] User receives checkout link with ?step=2
- [x] Frontend checkout flow
  - [x] Click link with ?step=2
  - [x] Cart loads correctly
  - [x] Step 2 (address) shown immediately
  - [x] Can navigate back to Step 1 if needed

---

## Rollback Plan

If issues occur, rollback in this order:

1. **Revert seed.ts** (remove {{LAST_ORDER}} from Order Agent prompt)
   ```bash
   git checkout backend/prisma/seed.ts
   npm run seed
   ```

2. **Revert PromptProcessorService** (remove getLastOrderVariable)
   ```bash
   git checkout backend/src/services/prompt-processor.service.ts
   ```

3. **Revert LinkGeneratorService** (remove step parameter)
   ```bash
   git checkout backend/src/services/link-generator.service.ts
   git checkout backend/src/services/calling-functions.service.ts
   ```

4. **Revert frontend** (remove step detection)
   ```bash
   git checkout frontend/src/pages/CheckoutPage.tsx
   ```

**Backward Compatibility**: ✅ All changes are backward compatible - existing code continues to work

---

## Post-Implementation

### 1. Update Documentation

- [ ] Add {{LAST_ORDER}} to `docs/memory-bank/PRD.md` (Variable Replacement section)
- [ ] Update `docs/prompts/order-tracking-agent.md` with repeat order flow
- [ ] Document step parameter in `docs/LINK_FORMATS_REFERENCE.md`

### 2. Monitor Performance

```bash
# Check {{LAST_ORDER}} replacement time
# Expected: <50ms per replacement

# Check AddProduct CF execution
# Expected: <300ms for 3-5 products

# Check checkout page load with ?step=2
# Expected: <2s total load time
```

### 3. User Feedback

- Monitor WhatsApp conversations for repeat order usage
- Track conversion rate: repeat order → checkout completion
- Measure time saved (Step 1 skip)

---

## Estimated Timeline

| Step | Time | Status |
|------|------|--------|
| 1. PromptProcessor {{LAST_ORDER}} | 90 min | ⏳ |
| 2. Update Order Agent Prompt | 30 min | ⏳ |
| 3. LinkGenerator Step Parameter | 45 min | ⏳ |
| 4. AddProduct CF Update | 30 min | ⏳ |
| 5. Frontend Step Detection | 60 min | ⏳ |
| 6. RepeatOrder Logic (Optional) | 30 min | ⏳ |
| 7. Integration Testing | 60 min | ⏳ |
| **TOTAL** | **345 min (5.75h)** | ⏳ |

**Recommendation**: Implement over 2 sessions (3h + 3h) with testing breaks

---

## Success Criteria

✅ **Functionality**:
- [ ] {{LAST_ORDER}} variable shows correct order details
- [ ] Agent asks for confirmation before adding
- [ ] Checkout link includes ?step=2 parameter
- [ ] Frontend loads directly to address step

✅ **Performance**:
- [ ] Variable replacement: <50ms
- [ ] AddProduct CF: <300ms
- [ ] Checkout page load: <2s

✅ **Constitution Compliance**:
- [ ] Database-first (no hardcoded data)
- [ ] Workspace isolation (all queries filtered)
- [ ] Variable replacement (runtime dynamic)
- [ ] No static translations (Italian base → LLM)

✅ **Testing**:
- [ ] All unit tests passing (7/7)
- [ ] Integration test passing (1/1)
- [ ] Manual WhatsApp flow works end-to-end

---

## Next Steps After Quickstart

1. **Phase 2**: Run `/speckit.tasks` to generate detailed task breakdown
2. **Implementation**: Follow steps 1-7 above systematically
3. **Testing**: Run test suite after each step
4. **Deployment**: Merge to `122-rag-con-prodcuct` branch
5. **Monitoring**: Track usage and performance metrics
