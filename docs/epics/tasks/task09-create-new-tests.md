# Task 08: Creare Nuovi Test

**Epic**: Rimozione RegistrationAttempts & Nuovo Flusso Registrazione  
**Priority**: 🔴 HIGH  
**Estimated**: 2h  
**Status**: 🚧 Todo

---

## 📝 Descrizione

Creare nuovi test per validare il comportamento del registration guard nel `FunctionExecutorService` e il flusso post-registrazione. Questi test garantiscono che:
1. Function protette richiedano customer registrato (`isActive=true`)
2. Function pubbliche funzionino sempre
3. Post-registrazione customer sia immediatamente operativo

---

## 🎯 Obiettivo

Coverage completa delle modifiche:
- ✅ Test guard per 10 function protette
- ✅ Test function pubbliche (no guard)
- ✅ Test error message con token registration
- ✅ Test post-registration flow (immediate activation)

---

## 💻 File da Creare

### 1. Test Function Executor Guard

**Path**: `apps/backend/__tests__/unit/function-executor-registration-guard.spec.ts`

```typescript
import { FunctionExecutorService } from '../../src/services/function-executor.service'
import { PrismaClient } from '@prisma/client'
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended'

describe('FunctionExecutorService - Registration Guard', () => {
  let functionExecutor: FunctionExecutorService
  let prismaMock: DeepMockProxy<PrismaClient>

  beforeEach(() => {
    prismaMock = mockDeep<PrismaClient>()
    functionExecutor = new FunctionExecutorService(prismaMock)
  })

  afterEach(() => {
    mockReset(prismaMock)
  })

  describe('Protected Functions (require isActive=true)', () => {
    const protectedFunctions = [
      'addToCart',
      'viewCart',
      'clearCart',
      'getLinkOrderByCode',
      'repeatOrder',
      'getOrderDetails',
      'confirmOrder',
      'showCheckout',
      'handlePushNotifications',
      'getProfileLink'
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
        expect(result.message).toContain(functionName)
      })

      it(`should allow "${functionName}" for registered customer`, async () => {
        const context = {
          functionName,
          parameters: {},
          workspaceId: 'workspace-123',
          customerId: 'customer-456',
          customerIsActive: true,  // ✅ Registered
          sessionId: 'session-789'
        }

        // Mock function logic (simplified)
        prismaMock.cart.findMany.mockResolvedValue([])

        const result = await functionExecutor.execute(context)

        // ✅ Should execute (no registration error)
        expect(result.success).toBe(true)
        expect(result.error).toBeUndefined()
      })
    })
  })

  describe('Public Functions (no guard)', () => {
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
          parameters: { id: 'product-123' },
          workspaceId: 'workspace-123',
          customerId: 'customer-456',
          customerIsActive: false,  // ❌ NOT registered (but should work)
          sessionId: 'session-789'
        }

        // Mock function logic
        prismaMock.products.findUnique.mockResolvedValue({
          id: 'product-123',
          name: 'Test Product'
        } as any)

        const result = await functionExecutor.execute(context)

        // ✅ Should work for non-registered users
        expect(result.success).toBe(true)
        expect(result.error).toBeUndefined()
      })
    })
  })

  describe('Error Message Format', () => {
    it('should include [LINK_REGISTRATION_WITH_TOKEN] in error message', async () => {
      const context = {
        functionName: 'addToCart',
        parameters: {},
        workspaceId: 'workspace-123',
        customerId: 'customer-456',
        customerIsActive: false,
        sessionId: 'session-789'
      }

      const result = await functionExecutor.execute(context)

      expect(result.message).toMatch(/\[LINK_REGISTRATION_WITH_TOKEN\]/)
    })

    it('should include function name in error message', async () => {
      const context = {
        functionName: 'viewCart',
        parameters: {},
        workspaceId: 'workspace-123',
        customerId: 'customer-456',
        customerIsActive: false,
        sessionId: 'session-789'
      }

      const result = await functionExecutor.execute(context)

      expect(result.message).toContain('viewCart')
    })
  })
})
```

### 2. Test Post-Registration Flow

**Path**: `apps/backend/__tests__/integration/registration-post-flow.spec.ts`

```typescript
import request from 'supertest'
import { app } from '../../src/app'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

describe('Post-Registration Flow', () => {
  let workspaceId: string
  let testPhone: string

  beforeAll(async () => {
    // Setup test workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Test Workspace',
        // ... other fields
      }
    })
    workspaceId = workspace.id
    testPhone = '+39123456789'
  })

  afterAll(async () => {
    // Cleanup
    await prisma.customers.deleteMany({ where: { phone: testPhone } })
    await prisma.workspace.delete({ where: { id: workspaceId } })
    await prisma.$disconnect()
  })

  it('should create customer with isBlacklisted=false and activeChatbot=true', async () => {
    const payload = {
      first_name: 'Mario',
      last_name: 'Rossi',
      email: 'mario.rossi@test.com',
      phone: testPhone,
      language: 'IT',
      currency: 'EUR',
      workspace_id: workspaceId
    }

    const response = await request(app)
      .post(`/api/workspaces/${workspaceId}/registration/register`)
      .send(payload)

    expect(response.status).toBe(200)
    expect(response.body.customer).toBeDefined()
    expect(response.body.customer.isActive).toBe(true)
    expect(response.body.customer.isBlacklisted).toBe(false)      // ✅ NEW
    expect(response.body.customer.activeChatbot).toBe(true)       // ✅ NEW
  })

  it('should allow customer to use chatbot immediately after registration', async () => {
    // 1. Register
    await request(app)
      .post(`/api/workspaces/${workspaceId}/registration/register`)
      .send({
        first_name: 'Luigi',
        last_name: 'Verdi',
        email: 'luigi.verdi@test.com',
        phone: testPhone,
        language: 'IT',
        workspace_id: workspaceId
      })

    // 2. Send WhatsApp message (should work immediately)
    const webhookPayload = {
      from: testPhone,
      message: {
        type: 'text',
        text: { body: 'Ciao, voglio ordinare' }
      }
    }

    const response = await request(app)
      .post('/api/whatsapp/webhook')
      .send(webhookPayload)

    expect(response.status).toBe(200)
    // ✅ Should receive LLM response (not blocked)
  })

  it('should allow customer to use protected functions after registration', async () => {
    // Register
    await request(app)
      .post(`/api/workspaces/${workspaceId}/registration/register`)
      .send({
        first_name: 'Anna',
        last_name: 'Bianchi',
        email: 'anna.bianchi@test.com',
        phone: testPhone,
        language: 'IT',
        workspace_id: workspaceId
      })

    // Try protected function (addToCart)
    const customer = await prisma.customers.findFirst({
      where: { phone: testPhone }
    })

    const functionContext = {
      functionName: 'addToCart',
      parameters: { productId: 'product-123', quantity: 2 },
      workspaceId,
      customerId: customer!.id,
      customerIsActive: true,
      sessionId: 'session-123'
    }

    const functionExecutor = new FunctionExecutorService(prisma)
    const result = await functionExecutor.execute(functionContext)

    // ✅ Should work (no REGISTRATION_REQUIRED error)
    expect(result.success).toBe(true)
    expect(result.error).not.toBe('REGISTRATION_REQUIRED')
  })
})
```

---

## ✅ Acceptance Criteria

### Funzionali
- [ ] Test guard blocca 10 function protette per `customerIsActive=false`
- [ ] Test guard permette 10 function protette per `customerIsActive=true`
- [ ] Test permette 4 function pubbliche per `customerIsActive=false`
- [ ] Test verifica error message contiene `[LINK_REGISTRATION_WITH_TOKEN]`
- [ ] Test post-registration verifica `isBlacklisted=false` e `activeChatbot=true`
- [ ] Test post-registration verifica uso immediato chatbot
- [ ] Test post-registration verifica uso function protette

### Tecnici
- [ ] File `function-executor-registration-guard.spec.ts` creato
- [ ] File `registration-post-flow.spec.ts` creato
- [ ] Tutti i test passano: `npm run test`
- [ ] Coverage >= 80% su `function-executor.service.ts`
- [ ] Coverage >= 80% su `registration.controller.ts`
- [ ] No errori TypeScript: `npm run build`

### Edge Cases
- [ ] Test function name sconosciuta (deve fallire normalmente, non per guard)
- [ ] Test `customerIsActive=null` (deve essere trattato come false)
- [ ] Test `customerIsActive=undefined` (deve essere trattato come false)

---

## 🔗 File Correlati

- `apps/backend/src/services/function-executor.service.ts` - Service da testare
- `apps/backend/src/interfaces/http/controllers/registration.controller.ts` - Controller da testare
- Task 01: Implementazione guard (dependency)
- Task 05: Post-registration behavior (dependency)
- Task 07: Aggiornamento test esistenti (dependency)

---

## 📋 Checklist Implementazione

### Pre-Check
- [ ] Task 01 completato (guard implementato in FunctionExecutorService)
- [ ] Task 05 completato (post-registration defaults aggiornati)
- [ ] Task 07 completato (test esistenti aggiornati)

### 1. Creare Test Function Executor Guard
- [ ] Creare file `apps/backend/__tests__/unit/function-executor-registration-guard.spec.ts`
- [ ] Importare `FunctionExecutorService`, `PrismaClient`, mock utilities
- [ ] Creare suite "Protected Functions" con loop su 10 function
- [ ] Test "should block ... for non-registered customer" (customerIsActive=false)
- [ ] Test "should allow ... for registered customer" (customerIsActive=true)
- [ ] Creare suite "Public Functions" con loop su 4 function
- [ ] Test "should allow ... for non-registered customer"
- [ ] Creare suite "Error Message Format"
- [ ] Test "should include [LINK_REGISTRATION_WITH_TOKEN]"
- [ ] Test "should include function name"
- [ ] Eseguire: `npm run test function-executor-registration-guard.spec.ts`

### 2. Creare Test Post-Registration Flow
- [ ] Creare file `apps/backend/__tests__/integration/registration-post-flow.spec.ts`
- [ ] Setup `beforeAll` (create test workspace)
- [ ] Cleanup `afterAll` (delete test data)
- [ ] Test "should create customer with isBlacklisted=false and activeChatbot=true"
- [ ] Test "should allow customer to use chatbot immediately"
- [ ] Test "should allow customer to use protected functions"
- [ ] Eseguire: `npm run test registration-post-flow.spec.ts`

### 3. Verifica Globale
- [ ] Compilare: `cd apps/backend && npm run build`
- [ ] Test unit: `npm run test:unit` - tutti devono passare
- [ ] Test integration: `npm run test:integration` - tutti devono passare
- [ ] Coverage: `npm run test:coverage` - verificare >= 80%
- [ ] Verificare log output: nessun warning/deprecation

---

**Dependencies**: Task 01 (guard implementation), Task 05 (post-registration), Task 07 (update existing tests)  
**Blocks**: Nessuno (ultimo task testing)  
**Last Updated**: 2026-01-03
