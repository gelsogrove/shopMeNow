# Billing System - Analisi Completa e Piano Operativo

**Data**: 2025-11-17  
**Owner**: Andrea  
**Obiettivo**: Verificare che tutti i costi siano applicati correttamente e creare test di protezione

---

## 📊 STATO ATTUALE - ARCHITETTURA BILLING

### 1. SINGLE SOURCE OF TRUTH - Prezzi Centralizzati ✅

**File**: `backend/prisma/data/pricingConfig.ts`

```typescript
export const pricingConfigData = [
  // USAGE-BASED PRICING
  {
    type: "USAGE",
    key: "MESSAGE",
    value: 0.2,
    description: "Cost per message",
  },
  {
    type: "USAGE",
    key: "NEW_CUSTOMER",
    value: 1.0,
    description: "Cost per new customer",
  },
  {
    type: "USAGE",
    key: "NEW_ORDER",
    value: 1.0,
    description: "Cost per new order",
  },
  {
    type: "USAGE",
    key: "PUSH_CAMPAIGN",
    value: 1.0,
    description: "Cost per push notification",
  },

  // MONTHLY COSTS
  {
    type: "PLAN",
    key: "MONTHLY_CHANNEL_COST",
    value: 59,
    description: "WhatsApp channel monthly",
  },

  // PLANS
  { type: "PLAN", key: "FREE_MONTHLY", value: 0 },
  { type: "PLAN", key: "BASIC_MONTHLY", value: 29 },
  { type: "PLAN", key: "PREMIUM_MONTHLY", value: 59 },
  { type: "PLAN", key: "ENTERPRISE_MONTHLY", value: 149 },
]
```

**✅ CORRETTO**: Un solo posto per modificare i prezzi (Backend + Frontend leggono da qui)

---

### 2. BILLING SERVICE - Metodi Disponibili ✅

**File**: `backend/src/application/services/billing.service.ts`

| Metodo                       | Costo  | Descrizione           | Quando chiamare                      |
| ---------------------------- | ------ | --------------------- | ------------------------------------ |
| `trackMessage()`             | €0.20  | Messaggio AI          | Ogni messaggio WhatsApp processato   |
| `trackNewCustomer()`         | €1.00  | Nuovo cliente         | Registrazione utente completa        |
| `trackNewOrder()`            | €1.00  | Nuovo ordine          | Ordine confermato (status=CONFIRMED) |
| `trackPushCampaign()`        | €1.00  | Push notification     | Invio campaign promozionale          |
| `chargeMonthlyChannelCost()` | €59.00 | Costo canale WhatsApp | Primo giorno del mese (cron job)     |

**Nota**: I prezzi vengono letti dinamicamente da `pricingRepository.getValue(key)` con fallback hardcoded.

---

### 3. PUNTI DI INTEGRAZIONE - Dove vengono chiamati

#### ✅ 3.1 MESSAGE (€0.20/msg)

**File**: `backend/src/repositories/message.repository.ts` (linea ~1074)

```typescript
// ✅ CHIAMATA CORRETTA
await billingService.trackMessage(
  workspaceId,
  customer.id,
  `Message from ${data.phoneNumber}`,
  data.message // User's question
)
```

**Trigger**: Ogni volta che `saveMessage()` processa un messaggio WhatsApp  
**Condizioni**:

- ✅ `debugMode = false` (se `true`, skip billing)
- ✅ Customer NON blacklisted
- ✅ Workspace attivo

**🔴 RISCHIO**: Se qualcuno bypassa `saveMessage()` e scrive direttamente nel database, il billing viene saltato!

---

#### ✅ 3.2 NEW_CUSTOMER (€1.00)

**File**: `backend/src/interfaces/http/controllers/registration.controller.ts` (linea ~479)

```typescript
// ✅ CHIAMATA CORRETTA
await billingService.trackNewCustomer(workspaceId, customerId)
```

**Trigger**: Registrazione nuovo utente tramite `/registration/complete`  
**Condizioni**:

- ✅ Registrazione completata con successo
- ✅ Customer creato nel database
- ❌ **PROBLEMA**: Se la call a `trackNewCustomer()` fallisce, registrazione continua (no rollback!)

**🔴 RISCHIO**: Se customer viene creato direttamente via Prisma (es. seed, script), billing non viene tracciato!

---

#### ✅ 3.3 NEW_ORDER (€1.00)

**File 1**: `backend/src/application/services/order.service.ts` (linea ~179)

```typescript
// ✅ CHIAMATA CORRETTA #1 - Order creation as CONFIRMED
if (createdOrder.status === OrderStatus.CONFIRMED) {
  await this.billingService.trackNewOrder(
    createdOrder.workspaceId,
    createdOrder.customerId,
    `Order ${createdOrder.orderCode} confirmed at creation`
  )
}
```

**File 2**: `backend/src/application/services/order.service.ts` (linea ~338)

```typescript
// ✅ CHIAMATA CORRETTA #2 - Status update to CONFIRMED
if (updatedOrder.status === OrderStatus.CONFIRMED) {
  await this.billingService.trackNewOrder(
    updatedOrder.workspaceId,
    updatedOrder.customerId,
    `Order ${updatedOrder.orderCode} confirmed via status update`
  )
}
```

**File 3**: `backend/src/interfaces/http/controllers/checkout.controller.ts` (linea ~479)

```typescript
// ✅ CHIAMATA CORRETTA #3 - Checkout confirmation
await this.billingService.trackNewOrder(
  workspaceId,
  customerId,
  createdOrder.orderCode
)
```

**Trigger**: Ordine passa a status `CONFIRMED`  
**Condizioni**:

- ✅ Order status = `CONFIRMED`
- ✅ 3 entry points coperti (creation, update, checkout)
- ❌ **PROBLEMA**: Se order viene aggiornato direttamente via Prisma, billing non viene tracciato!
- ❌ **PROBLEMA**: Nessun check per evitare doppio addebito (se status cambia CONFIRMED → PENDING → CONFIRMED)

**🔴 RISCHIO DOPPIO ADDEBITO**: Se un ordine viene confermato 2 volte, billing viene applicato 2 volte!

---

#### ❌ 3.4 PUSH_CAMPAIGN (€1.00) - NON IMPLEMENTATO!

**File**: `backend/src/application/services/billing.service.ts` (solo definizione metodo)

```typescript
// ❌ METODO ESISTE MA NON VIENE MAI CHIAMATO!
async trackPushCampaign(workspaceId, customerId, campaignName) { ... }
```

**Status**: ⚠️ **NON INTEGRATO** - Nessuna chiamata nel codebase!  
**Motivo**: Push notification feature non ancora sviluppata (come hai detto)

---

#### ✅ 3.5 MONTHLY_CHANNEL_COST (€59.00) - CRON JOB

**File**: `backend/src/application/services/billing.service.ts` (metodo disponibile)

```typescript
// ✅ METODO ESISTE
async chargeMonthlyChannelCost(workspaceId: string) { ... }
```

**Status**: ⚠️ **METODO PRONTO MA CRON JOB NON VERIFICATO**  
**Trigger atteso**: Primo giorno del mese (automatico via cron)

---

## 🚨 PROBLEMI IDENTIFICATI

### P1 - CRITICAL: Doppio Addebito Ordini

**Scenario**:

1. Order creato con status `CONFIRMED` → billing €1.00 ✅
2. Admin cambia status a `PENDING` (errore shipping)
3. Admin riconferma status a `CONFIRMED` → billing €1.00 ❌ (DOPPIO!)

**Soluzione**: Aggiungere check nel database per ordini già fatturati.

---

### P2 - HIGH: Bypass Billing via Direct Prisma

**Scenario**:

1. Script seed crea 100 customers → 0 billing (bypass `trackNewCustomer`)
2. Script admin crea order manualmente → 0 billing (bypass `trackNewOrder`)

**Soluzione**:

- Database trigger (PostgreSQL) per tracciare automaticamente
- Oppure: SEMPRE usare services, NEVER Prisma diretto

---

### P3 - MEDIUM: Billing Failure Non Blocca Operazioni

**Scenario**:

1. Customer si registra → billing.trackNewCustomer() fallisce (DB error)
2. Registrazione completa comunque (no rollback)
3. Customer creato GRATIS!

**Soluzione**: Transazioni Prisma + rollback se billing fallisce.

---

### P4 - LOW: Push Campaign Non Implementato

**Status**: Feature non sviluppata, billing pronto ma non integrato.

---

## 📋 PIANO OPERATIVO

### FASE 1: PROTEZIONE DOPPIO ADDEBITO (P1)

**Task 1.1**: Aggiungere campo `billedAt` alla tabella `Orders`

```prisma
model Orders {
  id          String   @id @default(cuid())
  orderCode   String
  status      OrderStatus
  billedAt    DateTime?  // ✅ NEW: Timestamp when NEW_ORDER billing was applied
  // ... existing fields
}
```

**Task 1.2**: Modificare `trackNewOrder()` per check duplicati

```typescript
async trackNewOrder(workspaceId: string, customerId: string, orderCode: string) {
  // ✅ CHECK: Order già fatturato?
  const order = await this.prisma.orders.findFirst({
    where: { orderCode, workspaceId }
  })

  if (order?.billedAt) {
    logger.warn(`[BILLING] ⚠️ Order ${orderCode} already billed at ${order.billedAt}`)
    return // Skip duplicate billing
  }

  // ... create billing record

  // ✅ UPDATE: Mark order as billed
  await this.prisma.orders.update({
    where: { id: order.id },
    data: { billedAt: new Date() }
  })
}
```

**Task 1.3**: Migration database

```bash
npx prisma migrate dev --name add_billed_at_to_orders
```

---

### FASE 2: TEST UNITARI DI PROTEZIONE (P2 + P3)

**Task 2.1**: Test `billing.service.spec.ts` - Verificare prezzi corretti

```typescript
describe("BillingService", () => {
  it("should track message with correct price from database", async () => {
    // Mock pricing repository to return €0.20
    // Call trackMessage()
    // Verify billing.create called with amount: 0.20
  })

  it("should track new customer with correct price from database", async () => {
    // Mock pricing repository to return €1.00
    // Call trackNewCustomer()
    // Verify billing.create called with amount: 1.00
  })

  it("should track new order with correct price from database", async () => {
    // Mock pricing repository to return €1.00
    // Call trackNewOrder()
    // Verify billing.create called with amount: 1.00
  })

  it("should NOT double-bill order already marked as billed", async () => {
    // Create order with billedAt set
    // Call trackNewOrder()
    // Verify billing.create NOT called (skip duplicate)
  })
})
```

**Task 2.2**: Test Integration `order.service.spec.ts` - Verificare chiamate billing

```typescript
describe("OrderService - Billing Integration", () => {
  it("should call trackNewOrder when order created as CONFIRMED", async () => {
    const billingServiceMock = jest.spyOn(billingService, "trackNewOrder")

    await orderService.createOrder({
      status: OrderStatus.CONFIRMED,
      // ... other data
    })

    expect(billingServiceMock).toHaveBeenCalledWith(
      workspaceId,
      customerId,
      expect.stringContaining("Order")
    )
  })

  it("should NOT call trackNewOrder when order created as PENDING", async () => {
    const billingServiceMock = jest.spyOn(billingService, "trackNewOrder")

    await orderService.createOrder({
      status: OrderStatus.PENDING,
      // ... other data
    })

    expect(billingServiceMock).not.toHaveBeenCalled()
  })

  it("should call trackNewOrder when order updated from PENDING to CONFIRMED", async () => {
    const order = await createTestOrder({ status: OrderStatus.PENDING })
    const billingServiceMock = jest.spyOn(billingService, "trackNewOrder")

    await orderService.updateOrderStatus(order.id, OrderStatus.CONFIRMED)

    expect(billingServiceMock).toHaveBeenCalledTimes(1)
  })

  it("should NOT double-bill when order confirmed twice", async () => {
    const order = await createTestOrder({ status: OrderStatus.CONFIRMED })
    const billingServiceMock = jest.spyOn(billingService, "trackNewOrder")

    // First confirmation already happened (billedAt set)
    await orderService.updateOrderStatus(order.id, OrderStatus.PENDING)
    await orderService.updateOrderStatus(order.id, OrderStatus.CONFIRMED)

    expect(billingServiceMock).toHaveBeenCalledTimes(0) // Already billed!
  })
})
```

**Task 2.3**: Test Integration `registration.controller.spec.ts`

```typescript
describe("RegistrationController - Billing Integration", () => {
  it("should call trackNewCustomer when registration completes", async () => {
    const billingServiceMock = jest.spyOn(billingService, "trackNewCustomer")

    await registrationController.completeRegistration(req, res)

    expect(billingServiceMock).toHaveBeenCalledWith(
      workspaceId,
      expect.any(String) // customerId
    )
  })

  it("should rollback registration if billing fails", async () => {
    jest
      .spyOn(billingService, "trackNewCustomer")
      .mockRejectedValue(new Error("DB error"))

    await expect(
      registrationController.completeRegistration(req, res)
    ).rejects.toThrow("Billing failed")

    // Verify customer NOT created
    const customer = await prisma.customers.findUnique({ where: { phone } })
    expect(customer).toBeNull()
  })
})
```

**Task 2.4**: Test Integration `message.repository.spec.ts`

```typescript
describe("MessageRepository - Billing Integration", () => {
  it("should call trackMessage when saveMessage processes WhatsApp message", async () => {
    const billingServiceMock = jest.spyOn(billingService, "trackMessage")

    await messageRepo.saveMessage({
      phoneNumber: "+39333444555",
      message: "Ciao",
      // ... other data
    })

    expect(billingServiceMock).toHaveBeenCalledWith(
      workspaceId,
      customerId,
      expect.stringContaining("Message from"),
      "Ciao"
    )
  })

  it("should NOT call trackMessage when debugMode is true", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { debugMode: true },
    })

    const billingServiceMock = jest.spyOn(billingService, "trackMessage")

    await messageRepo.saveMessage({
      /* ... */
    })

    expect(billingServiceMock).not.toHaveBeenCalled()
  })
})
```

---

### FASE 3: TRANSAZIONI PRISMA PER ROLLBACK (P3)

**Task 3.1**: Wrappare registration in transaction

```typescript
async completeRegistration() {
  await this.prisma.$transaction(async (tx) => {
    // 1. Create customer
    const customer = await tx.customers.create({ /* ... */ })

    // 2. Track billing (if fails, rollback customer creation)
    await billingService.trackNewCustomer(workspaceId, customer.id)

    // 3. Other operations...
  })
}
```

**Task 3.2**: Wrappare order confirmation in transaction

```typescript
async createOrder(data) {
  return await this.prisma.$transaction(async (tx) => {
    // 1. Create order
    const order = await tx.orders.create({ /* ... */ })

    // 2. If CONFIRMED, track billing (if fails, rollback order creation)
    if (order.status === OrderStatus.CONFIRMED) {
      await billingService.trackNewOrder(workspaceId, customerId, order.orderCode)
    }

    return order
  })
}
```

---

### FASE 4: MONITORING E ALERTING (Controllo)

**Task 4.1**: Dashboard Billing Discrepancies

- Query database per trovare:
  - Orders con status=CONFIRMED ma `billedAt = null` (missing billing)
  - Customers senza billing record di tipo NEW_CUSTOMER
  - Messages senza billing record corrispondente

**Task 4.2**: Cron Job Mensile - Reconciliation

```typescript
// Script: backend/scripts/billing-reconciliation.ts
async function reconcileBilling() {
  // 1. Find all CONFIRMED orders without billedAt
  const unbilledOrders = await prisma.orders.findMany({
    where: { status: "CONFIRMED", billedAt: null },
  })

  // 2. Alert admin
  logger.warn(`Found ${unbilledOrders.length} orders missing billing!`)

  // 3. Optionally: Auto-bill them (with admin approval)
}
```

**Task 4.3**: Unit Test per Cron Job

```typescript
describe("Billing Reconciliation Cron", () => {
  it("should detect orders confirmed but not billed", async () => {
    // Create order with status=CONFIRMED, billedAt=null
    const order = await createTestOrder({ status: "CONFIRMED", billedAt: null })

    const result = await reconcileBilling()

    expect(result.missingBillings).toContain(order.id)
  })
})
```

---

## 📊 CHECKLIST FINALE

### Operativo (Implementazione)

- [ ] **P1.1**: Migration - Add `billedAt` field to Orders table
- [ ] **P1.2**: Update `trackNewOrder()` - Check duplicates before billing
- [ ] **P3.1**: Wrap registration in Prisma transaction (rollback on billing fail)
- [ ] **P3.2**: Wrap order confirmation in Prisma transaction (rollback on billing fail)

### Controllo (Testing)

- [ ] **P2.1**: Unit tests `billing.service.spec.ts` (4 tests)
- [ ] **P2.2**: Integration tests `order.service.spec.ts` (4 tests)
- [ ] **P2.3**: Integration tests `registration.controller.spec.ts` (2 tests)
- [ ] **P2.4**: Integration tests `message.repository.spec.ts` (2 tests)
- [ ] **P4.1**: Dashboard query per billing discrepancies
- [ ] **P4.2**: Cron job mensile riconciliazione
- [ ] **P4.3**: Unit test per cron job riconciliazione

### Documentazione

- [ ] Update README con billing flow
- [ ] API docs (Swagger) per billing endpoints
- [ ] Runbook per admin: come gestire billing discrepancies

---

## 🎯 PRIORITÀ ESECUZIONE

### SPRINT 1 (Alta Priorità - 3 giorni)

1. **P1**: Protezione doppio addebito ordini

   - Migration `billedAt`
   - Update `trackNewOrder()` logic
   - Test integration order service

2. **P2**: Test unitari billing service
   - 4 test fondamentali per prezzi corretti

### SPRINT 2 (Media Priorità - 2 giorni)

3. **P3**: Transazioni Prisma
   - Registration controller transaction
   - Order service transaction
   - Test rollback scenarios

### SPRINT 3 (Monitoring - 1 giorno)

4. **P4**: Controlli e monitoring
   - Dashboard discrepancies
   - Cron job riconciliazione
   - Alert system

---

## 💡 RACCOMANDAZIONI FINALI

1. **✅ ARCHITETTURA OK**: Single source of truth per prezzi funziona bene
2. **⚠️ DOPPIO ADDEBITO**: Rischio reale, fixare ASAP con `billedAt` field
3. **⚠️ TRANSAZIONI**: Usare Prisma transactions per atomicità billing
4. **✅ TEST OBBLIGATORI**: Proteggere con unit tests che falliscono se billing call rimossa
5. **📊 MONITORING**: Dashboard mensile per verificare consistency

**Push Notifications**: Come hai detto, lasciamo per dopo - il metodo `trackPushCampaign()` è pronto quando serve!

---

**Autore**: GitHub Copilot Agent  
**Reviewers**: Andrea  
**Status**: Draft per approvazione
