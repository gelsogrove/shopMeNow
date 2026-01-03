# Registration Flow

**Version**: 2.0.0  
**Last Updated**: January 3, 2026  
**Status**: ACTIVE - Post RegistrationAttempts Removal

---

## Overview

Il sistema eChatbot implementa un flusso di registrazione **permissivo**: gli utenti possono interagire liberamente con il chatbot senza registrarsi. La registrazione è richiesta solo per function specifiche che richiedono personalizzazione (cart, orders, profile).

---

## Architecture Decision

### OLD APPROACH (❌ Rimosso)

- Blocking preventivo dopo 3 tentativi registrazione
- Limite 5 messaggi per utenti non registrati
- Admin approval necessaria post-registrazione
- `isBlacklisted=true`, `activeChatbot=false` dopo registrazione

### NEW APPROACH (✅ Corrente)

- **Nessun blocking preventivo**
- **Messaggi illimitati** per tutti gli utenti
- **Registrazione richiesta solo per function specifiche**
- **Attivazione immediata** post-registrazione
- `isActive=true`, `isBlacklisted=false`, `activeChatbot=true` dopo registrazione

**Rationale**: Gli utenti devono poter esplorare il chatbot liberamente. La registrazione diventa necessaria solo quando vogliono usare funzionalità personalizzate (carrello, ordini, profilo).

---

## Function Protection

### Protected Functions (10)

Richiedono `customer.isActive=true`:

| Category | Functions | Description |
|----------|-----------|-------------|
| **Cart Management** | `addToCart` | Aggiunge prodotto al carrello |
| | `viewCart` | Visualizza contenuto carrello |
| | `clearCart` | Svuota il carrello |
| **Order Tracking** | `getLinkOrderByCode` | Ottiene link ordine via codice |
| | `repeatOrder` | Ripete ordine precedente |
| | `getOrderDetails` | Dettagli ordine specifico |
| | `confirmOrder` | Conferma ordine |
| | `showCheckout` | Mostra pagina checkout |
| **Profile Management** | `handlePushNotifications` | Gestisce push notifications |
| | `getProfileLink` | Link al profilo utente |

### Public Functions (4)

Funzionano sempre (anche per non registrati):

| Category | Functions | Description |
|----------|-----------|-------------|
| **Product Catalog** | `getProductDetails` | Dettagli prodotto specifico |
| | `getServiceDetails` | Dettagli servizio specifico |
| | `searchProductForStatistic` | Ricerca prodotti |
| **Customer Support** | `contactOperator` | Contatta operatore umano |

---

## Implementation Details

### 1. Function Executor Guard

**File**: `apps/backend/src/services/function-executor.service.ts`

```typescript
const FUNCTIONS_REQUIRING_REGISTRATION = [
  // Cart Management
  'addToCart', 
  'viewCart', 
  'clearCart',
  
  // Order Tracking
  'getLinkOrderByCode', 
  'repeatOrder', 
  'getOrderDetails', 
  'confirmOrder', 
  'showCheckout',
  
  // Profile Management
  'handlePushNotifications', 
  'getProfileLink'
]

interface ExecutionContext {
  functionName: string
  parameters: Record<string, any>
  workspaceId: string
  customerId: string
  customerIsActive: boolean  // ← NEW field
  sessionId: string
}

async execute(context: ExecutionContext): Promise<ExecutionResult> {
  // GUARD: Check registration requirement
  if (FUNCTIONS_REQUIRING_REGISTRATION.includes(context.functionName)) {
    if (!context.customerIsActive) {
      return {
        success: false,
        error: 'REGISTRATION_REQUIRED',
        message: `Per utilizzare "${context.functionName}" devi registrarti: [LINK_REGISTRATION_WITH_TOKEN]`
      }
    }
  }

  // Execute function normally
  switch (context.functionName) {
    case 'addToCart': 
      return await this.addToCart(context)
    case 'viewCart': 
      return await this.viewCart(context)
    // ... other cases
    default:
      throw new Error(`Unknown function: ${context.functionName}`)
  }
}
```

### 2. Token Replacement

**File**: `apps/backend/src/services/llm.service.ts`

```typescript
/**
 * Replace all [LINK_*_WITH_TOKEN] placeholders with actual links
 */
private async replaceLinkTokens(
  message: string, 
  customer: Customer, 
  workspace: Workspace
): Promise<string> {
  const tokens = message.match(/\[LINK_[A-Z_]+\]/g) || []
  
  let finalMessage = message
  
  for (const token of tokens) {
    switch (token) {
      case '[LINK_REGISTRATION_WITH_TOKEN]':
        const registrationLink = await this.generateRegistrationLink(
          customer.phone,
          workspace.id
        )
        finalMessage = finalMessage.replace(token, registrationLink)
        logger.info(`Replaced ${token} with registration link`)
        break
        
      case '[LINK_CHECKOUT_WITH_TOKEN]':
        // ... other token replacements
        break
        
      default:
        logger.warn(`Unknown token: ${token}`)
    }
  }
  
  return finalMessage
}

/**
 * Generate registration link with JWT token (24h validity)
 */
private async generateRegistrationLink(
  phone: string, 
  workspaceId: string
): Promise<string> {
  const token = await this.secureTokenService.generateToken({
    type: 'registration',
    phone,
    workspaceId,
    expiresIn: '24h'
  })
  
  const baseUrl = process.env.FRONTEND_URL || 'https://echatbot.ai'
  return `${baseUrl}/register?token=${token}`
}
```

### 3. Post-Registration Activation

**File**: `apps/backend/src/interfaces/http/controllers/registration.controller.ts`

```typescript
async register(req: Request, res: Response, next: NextFunction) {
  try {
    const { first_name, last_name, email, phone, company, language, currency, workspace_id } = req.body

    // Validate required fields
    if (!first_name || !last_name || !email || !phone || !workspace_id) {
      return res.status(400).json({ error: "Missing required fields" })
    }

    // Check if customer already exists
    let customer = await prisma.customers.findFirst({
      where: { phone, workspaceId: workspace_id }
    })

    if (!customer) {
      // Create new customer
      customer = await prisma.customers.create({
        data: {
          name: `${first_name} ${last_name}`,
          email,
          phone,
          company,
          workspaceId: workspace_id,
          language: language || "ENG",
          currency: currency || "USD",
          last_privacy_version_accepted: "1.0.0",
          privacy_accepted_at: new Date(),
          
          // ✅ NEW: Immediate activation (no admin approval needed)
          isActive: true,          // Account active immediately
          isBlacklisted: false,    // NOT blocked
          activeChatbot: true,     // Chatbot ENABLED (can receive LLM responses)
        }
      })
    } else {
      // Update existing customer
      customer = await prisma.customers.update({
        where: { id: customer.id },
        data: {
          name: `${first_name} ${last_name}`,
          email,
          company,
          language: language || "ENG",
          currency: currency || "USD",
          last_privacy_version_accepted: "1.0.0",
          privacy_accepted_at: new Date(),
          
          // ✅ NEW: Immediate activation
          isActive: true,
          isBlacklisted: false,
          activeChatbot: true,
        }
      })
    }

    return res.json({ 
      success: true, 
      customer,
      message: "Registration completed successfully"
    })
    
  } catch (error) {
    logger.error("Registration error:", error)
    next(error)
  }
}
```

---

## Flow Diagrams

### Non-Registered User Flow

```
Customer → Send Message "Voglio ordinare"
           ↓
       Chat Engine
           ↓
       LLM Router (Intent: ADD_TO_CART)
           ↓
   Function Executor → addToCart()
           ↓
       GUARD CHECK: customerIsActive?
           ├─ YES → Execute addToCart()
           │         └─ Add product to cart
           │         └─ Return success
           │
           └─ NO  → Return REGISTRATION_REQUIRED
                    ↓
                LLM receives error:
                { 
                  success: false,
                  error: "REGISTRATION_REQUIRED",
                  message: "Per aggiungere al carrello devi registrarti: [LINK_REGISTRATION_WITH_TOKEN]"
                }
                    ↓
                LLM formats natural message:
                "Per usare il carrello devi completare la registrazione: [LINK_REGISTRATION_WITH_TOKEN]"
                    ↓
            LLMService.replaceLinkTokens()
                    ↓
            Token replaced with actual JWT link (24h validity)
                    ↓
         Customer receives message:
         "Per usare il carrello devi completare la registrazione: https://echatbot.ai/register?token=xxx"
```

### Post-Registration Flow

```
Customer → Clicks registration link
           ↓
     Frontend → /register?token=xxx
           ↓
  Registration Controller
           ↓
    Validate token (JWT verify)
           ↓
    Create/Update Customer
    - isActive: true        ← Immediate activation
    - isBlacklisted: false  ← NOT blocked
    - activeChatbot: true   ← Chatbot ENABLED
           ↓
  Customer can now use ALL protected functions:
  ✅ addToCart
  ✅ viewCart
  ✅ confirmOrder
  ✅ getOrderDetails
  ✅ etc.
```

### Public Functions Flow (No Registration Required)

```
Customer (NOT registered) → "Quanto costa il prodotto XYZ?"
           ↓
       Chat Engine
           ↓
       LLM Router (Intent: GET_PRODUCT_DETAILS)
           ↓
   Function Executor → getProductDetails()
           ↓
       GUARD CHECK: Is function protected?
           ├─ NO → Execute directly
           │        └─ Return product details
           │        └─ Customer receives info
           │
           └─ (NOT reached for public functions)
```

---

## Testing

### Unit Tests

**File**: `apps/backend/__tests__/unit/function-executor-registration-guard.spec.ts`

```typescript
describe('FunctionExecutorService - Registration Guard', () => {
  describe('Protected Functions', () => {
    const protectedFunctions = [
      'addToCart', 'viewCart', 'clearCart',
      'getLinkOrderByCode', 'repeatOrder', 'getOrderDetails', 'confirmOrder', 'showCheckout',
      'handlePushNotifications', 'getProfileLink'
    ]

    protectedFunctions.forEach(functionName => {
      it(`should block "${functionName}" for non-registered customer`, async () => {
        const context = {
          functionName,
          parameters: {},
          workspaceId: 'workspace-123',
          customerId: 'customer-456',
          customerIsActive: false,  // ❌ NOT registered
          sessionId: 'session-789'
        }

        const result = await functionExecutor.execute(context)

        expect(result.success).toBe(false)
        expect(result.error).toBe('REGISTRATION_REQUIRED')
        expect(result.message).toContain('[LINK_REGISTRATION_WITH_TOKEN]')
      })

      it(`should allow "${functionName}" for registered customer`, async () => {
        const context = {
          ...context,
          customerIsActive: true  // ✅ Registered
        }

        const result = await functionExecutor.execute(context)

        expect(result.success).toBe(true)
      })
    })
  })

  describe('Public Functions', () => {
    const publicFunctions = [
      'getProductDetails',
      'getServiceDetails',
      'searchProductForStatistic',
      'contactOperator'
    ]

    publicFunctions.forEach(functionName => {
      it(`should allow "${functionName}" for non-registered customer`, async () => {
        const context = {
          functionName,
          parameters: {},
          customerIsActive: false  // ❌ NOT registered (but should work)
        }

        const result = await functionExecutor.execute(context)

        expect(result.success).toBe(true)
      })
    })
  })
})
```

### Integration Tests

**File**: `apps/backend/__tests__/integration/registration-post-flow.spec.ts`

```typescript
describe('Post-Registration Flow', () => {
  it('should create customer with immediate activation', async () => {
    const response = await request(app)
      .post(`/api/workspaces/${workspaceId}/registration/register`)
      .send({
        first_name: 'Mario',
        last_name: 'Rossi',
        email: 'mario@test.com',
        phone: '+39333',
        workspace_id: workspaceId
      })

    expect(response.status).toBe(200)
    expect(response.body.customer.isActive).toBe(true)
    expect(response.body.customer.isBlacklisted).toBe(false)
    expect(response.body.customer.activeChatbot).toBe(true)
  })

  it('should allow customer to use protected functions immediately', async () => {
    // Register
    await request(app)
      .post(`/api/workspaces/${workspaceId}/registration/register`)
      .send({ ... })

    // Try protected function (should work)
    const customer = await prisma.customers.findFirst({ where: { phone: '+39333' } })
    
    const result = await functionExecutor.execute({
      functionName: 'addToCart',
      customerIsActive: true,
      customerId: customer.id,
      ...
    })

    expect(result.success).toBe(true)
  })
})
```

---

## Migration Notes

### Database Changes

- **Model removed**: `RegistrationAttempts` (table dropped via Prisma migration)
- **Field changes**: None (existing `customer.isActive` field used)

### Service Removal

- **File deleted**: `apps/backend/src/application/services/registration-attempts.service.ts` (231 lines)
- **Imports removed**: 7 files cleaned up

### Webhook Cleanup

- **STEP 1&2 removed**: Registration attempts check (lines 317-377 in `whatsapp-webhook.controller.ts`)
- **Limit removed**: 5-message limit for non-registered users (lines 804-838)

### Behavioral Changes

| Aspect | Before | After |
|--------|--------|-------|
| New user messages | Limited (blocked after 3 attempts) | Unlimited |
| Non-registered messages | Limited (5 in 24h) | Unlimited |
| Registration trigger | Preventive (after few messages) | On-demand (when function needs it) |
| Post-registration | Admin approval needed | Immediate activation |

---

## Future Considerations

### Fraud Prevention

Monitor patterns via analytics (not blocking):
- Suspicious message patterns
- Unusual registration attempts
- Bot-like behavior

**Action**: Manual admin review, not automatic blocking

### Spam Protection

Rate limiting at API gateway level:
- 15 messages/min per customer
- 100 messages/min per workspace

**NOT** at chat level (users can chat freely)

### User Experience

A/B testing opportunities:
- Conversion rates with/without registration prompt
- Optimal timing for registration invitation
- Message copy for registration CTA

---

## Related Documentation

- [blocking.md](./blocking.md) - Sistema blocking completo
- [welcome-message-edge-cases.md](./welcome-message-edge-cases.md) - Edge cases aggiornati
- [Task 01](../epics/tasks/task01-update-documentation.md) - Task epic documentation

---

**Version History**:
- v1.0.0 (2025-12-01): Versione originale con RegistrationAttempts
- v2.0.0 (2026-01-03): Rimozione RegistrationAttempts, function-level guard
