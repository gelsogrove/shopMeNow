# 197 - Billing Subscription Separation

## 📋 Overview

Separare il sistema di billing in due componenti indipendenti:
1. **Subscription** (Abbonamento mensile fisso)
2. **Credit Wallet** (Portafoglio crediti per consumo)

## 🎯 Obiettivi

- Chiarezza per l'utente: abbonamento ≠ credito
- Addebito automatico PayPal il 1° del mese
- Possibilità di mettere in pausa il servizio
- Downgrade effettivo dal mese successivo
- Upgrade immediato con pro-rata
- Blocco servizio se credito < -€10 o pagamento fallito
- Fattura visualizzabile in tempo reale (download solo a fine mese)

---

## 🗄️ Database Schema Changes

### Workspace Model - New Fields

```prisma
model Workspace {
  // ... existing fields ...
  
  // Subscription Management
  subscriptionStatus        SubscriptionStatus @default(ACTIVE)
  pausedAt                  DateTime?          // When subscription was paused
  pauseRequestedAt          DateTime?          // When user requested pause (effective next month)
  
  // Plan Change Scheduling (for downgrades)
  pendingPlanType           PlanType?          // Plan to switch to on next billing
  pendingPlanEffectiveDate  DateTime?          // When pending plan becomes active
  
  // Payment
  paypalSubscriptionId      String?            // PayPal subscription ID for auto-charge
  lastPaymentDate           DateTime?          // Last successful payment
  lastPaymentFailedAt       DateTime?          // Last payment failure
  paymentFailureCount       Int                @default(0)
  
  // Credit Wallet (separate from subscription)
  creditBalance             Decimal            @default(19.00) @db.Decimal(10, 2) // Existing
  creditMinThreshold        Decimal            @default(-10.00) @db.Decimal(10, 2) // -€10 limit
}

enum SubscriptionStatus {
  ACTIVE           // Normal operation
  PAUSED           // User paused, no billing, no service
  PAUSE_PENDING    // Pause requested, effective next month
  PAYMENT_FAILED   // Payment failed, service blocked
  CANCELLED        // User cancelled, data retained for X months
}
```

### New Table: MonthlyInvoice

```prisma
model MonthlyInvoice {
  id                String        @id @default(cuid())
  workspaceId       String
  
  // Period
  periodStart       DateTime      // 1st of month
  periodEnd         DateTime      // Last day of month
  
  // Amounts
  subscriptionAmount Decimal      @db.Decimal(10, 2)  // €19/€49/€99
  creditUsage        Decimal      @db.Decimal(10, 2)  // Consumption from wallet
  totalAmount        Decimal      @db.Decimal(10, 2)  // Total to charge
  
  // Status
  status            InvoiceStatus @default(DRAFT)
  paidAt            DateTime?
  paypalTransactionId String?
  
  // Metadata
  planType          PlanType
  itemsBreakdown    Json          // { messages: 150, orders: 10, ... }
  
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  
  workspace         Workspace     @relation(fields: [workspaceId], references: [id])
  
  @@unique([workspaceId, periodStart])
  @@index([workspaceId])
  @@index([status])
  @@map("monthly_invoices")
}

enum InvoiceStatus {
  DRAFT      // Current month, still accumulating
  PENDING    // Month ended, awaiting payment
  PAID       // Successfully charged
  FAILED     // Payment failed
  CANCELLED  // Invoice cancelled (e.g., workspace deleted)
}
```

---

## 🔄 Business Logic

### 1. Subscription Status Flow

```
                    ┌──────────────┐
                    │   ACTIVE     │
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │PAUSE_PENDING │ │PAYMENT_FAILED│ │  CANCELLED   │
   └──────┬───────┘ └──────┬───────┘ └──────────────┘
          │                │
          ▼                │ (payment success)
   ┌──────────────┐        │
   │    PAUSED    │◄───────┘ (no, stays failed until paid)
   └──────┬───────┘
          │ (user resumes)
          ▼
   ┌──────────────┐
   │    ACTIVE    │
   └──────────────┘
```

### 2. Credit Wallet Rules

| Condition | Action |
|-----------|--------|
| `creditBalance >= 0` | Normal operation |
| `-€10 <= creditBalance < 0` | Warning shown, service continues |
| `creditBalance < -€10` | **BLOCK** chatbot responses |

### 3. Monthly Billing (1st of month at 00:05)

```typescript
async function monthlyBillingJob() {
  for (const workspace of activeWorkspaces) {
    // 1. Apply pending plan change (downgrade)
    if (workspace.pendingPlanType && workspace.pendingPlanEffectiveDate <= today) {
      await applyPendingPlan(workspace)
    }
    
    // 2. Handle pause requests
    if (workspace.subscriptionStatus === 'PAUSE_PENDING') {
      await pauseWorkspace(workspace)
      continue // No billing for paused workspaces
    }
    
    // 3. Skip paused workspaces
    if (workspace.subscriptionStatus === 'PAUSED') {
      continue
    }
    
    // 4. Calculate total charge
    const subscriptionFee = getPlanFee(workspace.planType)
    const creditDebt = Math.max(0, -workspace.creditBalance) // If negative
    const totalCharge = subscriptionFee + creditDebt
    
    // 5. Charge PayPal
    const paymentResult = await chargePayPal(workspace, totalCharge)
    
    if (paymentResult.success) {
      // Reset credit to €0 (debt paid)
      await resetCreditBalance(workspace)
      
      // Finalize invoice
      await finalizeInvoice(workspace, totalCharge)
      
      workspace.subscriptionStatus = 'ACTIVE'
      workspace.paymentFailureCount = 0
    } else {
      // Payment failed
      workspace.subscriptionStatus = 'PAYMENT_FAILED'
      workspace.lastPaymentFailedAt = new Date()
      workspace.paymentFailureCount++
      
      // Send notification email
      await sendPaymentFailedEmail(workspace)
    }
  }
}
```

### 4. Upgrade Flow (Immediate)

```typescript
async function upgradeplan(workspaceId: string, newPlan: PlanType) {
  const workspace = await getWorkspace(workspaceId)
  const currentPlan = workspace.planType
  
  // Calculate pro-rata
  const daysRemaining = getDaysRemainingInMonth()
  const totalDays = getDaysInMonth()
  const proRataFactor = daysRemaining / totalDays
  
  const currentFee = getPlanFee(currentPlan)
  const newFee = getPlanFee(newPlan)
  const prorataCharge = (newFee - currentFee) * proRataFactor
  
  // Charge immediately
  await chargePayPal(workspace, prorataCharge)
  
  // Apply plan immediately
  workspace.planType = newPlan
  workspace.pendingPlanType = null // Clear any pending downgrade
}
```

### 5. Downgrade Flow (Scheduled)

```typescript
async function downgradePlan(workspaceId: string, newPlan: PlanType) {
  const workspace = await getWorkspace(workspaceId)
  
  // Validate limits
  const limits = getPlanLimits(newPlan)
  const usage = await getWorkspaceUsage(workspaceId)
  
  if (usage.products > limits.maxProducts || usage.customers > limits.maxCustomers) {
    throw new Error('Reduce products/customers before downgrading')
  }
  
  // Schedule for next month
  workspace.pendingPlanType = newPlan
  workspace.pendingPlanEffectiveDate = getFirstDayOfNextMonth()
  
  // Return info for UI
  return {
    currentPlan: workspace.planType,
    pendingPlan: newPlan,
    effectiveDate: workspace.pendingPlanEffectiveDate
  }
}
```

### 6. Pause Flow

```typescript
async function pauseSubscription(workspaceId: string) {
  const workspace = await getWorkspace(workspaceId)
  
  // If before 15th of month, pause effective next month
  // If after 15th, also next month (no partial refunds)
  workspace.subscriptionStatus = 'PAUSE_PENDING'
  workspace.pauseRequestedAt = new Date()
  
  return {
    message: 'La pausa sarà effettiva dal 1° del prossimo mese. Il chatbot smetterà di rispondere.',
    effectiveDate: getFirstDayOfNextMonth()
  }
}

async function resumeSubscription(workspaceId: string) {
  const workspace = await getWorkspace(workspaceId)
  
  if (workspace.subscriptionStatus !== 'PAUSED') {
    throw new Error('Workspace is not paused')
  }
  
  // Charge immediately for current month (pro-rata)
  const prorataCharge = calculateProrataForResume(workspace)
  await chargePayPal(workspace, prorataCharge)
  
  workspace.subscriptionStatus = 'ACTIVE'
  workspace.pausedAt = null
  workspace.channelStatus = true // Re-enable channel
}
```

---

## 🔌 API Endpoints

### Subscription Management

```yaml
POST /api/workspaces/:workspaceId/subscription/pause
  Request: {}
  Response: { effectiveDate: string, message: string }

POST /api/workspaces/:workspaceId/subscription/resume
  Request: {}
  Response: { prorataCharge: number, message: string }

POST /api/workspaces/:workspaceId/subscription/cancel
  Request: { reason?: string }
  Response: { retentionEndDate: string, message: string }
```

### Plan Changes

```yaml
POST /api/workspaces/:workspaceId/plan/upgrade
  Request: { newPlan: PlanType }
  Response: { prorataCharge: number, newPlan: PlanType }

POST /api/workspaces/:workspaceId/plan/downgrade
  Request: { newPlan: PlanType }
  Response: { effectiveDate: string, pendingPlan: PlanType }

DELETE /api/workspaces/:workspaceId/plan/pending
  Response: { message: string } // Cancel pending downgrade
```

### Invoices

```yaml
GET /api/workspaces/:workspaceId/invoices
  Response: MonthlyInvoice[]

GET /api/workspaces/:workspaceId/invoices/current
  Response: MonthlyInvoice (draft, real-time)

GET /api/workspaces/:workspaceId/invoices/:invoiceId/pdf
  Response: PDF file (only for PAID status)
```

### Credit Wallet

```yaml
POST /api/workspaces/:workspaceId/credit/recharge
  Request: { amount: number }
  Response: { newBalance: number, transactionId: string }

GET /api/workspaces/:workspaceId/credit/balance
  Response: { balance: number, minThreshold: number, isBlocked: boolean }
```

---

## 🖥️ Frontend UI Changes

### 1. Billing Section - New Layout

```
┌─────────────────────────────────────────────────────────────┐
│  📦 ABBONAMENTO                                              │
│  ──────────────────────────────────────────────────────────  │
│  Piano: Basic (€19/mese)                   [Cambia Piano ▼] │
│  Stato: ● Attivo                                             │
│  Prossimo rinnovo: 1 Gennaio 2025                           │
│                                                              │
│  [Metti in Pausa]                                            │
├─────────────────────────────────────────────────────────────┤
│  💰 PORTAFOGLIO CREDITI                                      │
│  ──────────────────────────────────────────────────────────  │
│  Saldo: €12.50                              [+ Ricarica]    │
│  Soglia minima: -€10.00                                      │
│  ──────────────────────────────────────────────────────────  │
│  Consumo questo mese:                                        │
│    • 150 messaggi: -€15.00                                   │
│    •  10 ordini:   -€10.00                                   │
│    •   5 push:     -€5.00                                    │
│  ──────────────────────────────────────────────────────────  │
│  Totale consumo: €30.00                                      │
├─────────────────────────────────────────────────────────────┤
│  🧾 FATTURA CORRENTE (Dicembre 2024)        [Visualizza]    │
│  ──────────────────────────────────────────────────────────  │
│  Abbonamento Basic:     €19.00                               │
│  Consumo crediti:       €30.00                               │
│  ──────────────────────────────────────────────────────────  │
│  TOTALE:                €49.00                               │
│  Addebito previsto: 1 Gennaio 2025                          │
└─────────────────────────────────────────────────────────────┘
```

### 2. Pause Confirmation Popup

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️ Conferma Pausa Abbonamento                               │
│  ──────────────────────────────────────────────────────────  │
│                                                              │
│  Mettendo in pausa l'abbonamento:                           │
│                                                              │
│  • Il chatbot NON risponderà più ai clienti                 │
│  • Non ti verrà addebitato nulla dal prossimo mese          │
│  • I tuoi dati (prodotti, clienti, ordini) saranno          │
│    conservati                                                │
│  • Potrai riattivare quando vuoi                            │
│                                                              │
│  La pausa sarà effettiva dal: 1 Gennaio 2025                │
│                                                              │
│  ┌─────────────┐  ┌─────────────────────┐                   │
│  │  Annulla    │  │  ✓ Conferma Pausa   │                   │
│  └─────────────┘  └─────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### 3. Pending Downgrade Banner

```
┌─────────────────────────────────────────────────────────────┐
│  ℹ️ Cambio piano programmato                                 │
│                                                              │
│  Dal 1 Gennaio 2025 passerai al piano Basic (€19/mese)      │
│                                      [Annulla Downgrade]    │
└─────────────────────────────────────────────────────────────┘
```

### 4. Payment Failed State

```
┌─────────────────────────────────────────────────────────────┐
│  🚨 PAGAMENTO FALLITO                                        │
│  ──────────────────────────────────────────────────────────  │
│                                                              │
│  Il pagamento del 1 Dicembre 2024 non è andato a buon fine. │
│  Il chatbot non risponde ai clienti.                        │
│                                                              │
│  Importo dovuto: €49.00                                      │
│                                                              │
│  ┌─────────────────────────────────────┐                    │
│  │  💳 Paga Ora                         │                    │
│  └─────────────────────────────────────┘                    │
│                                                              │
│  Aggiorna metodo di pagamento su PayPal                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 Test Coverage

### Unit Tests (Backend)

```typescript
describe('BillingService', () => {
  describe('pauseSubscription', () => {
    it('should set status to PAUSE_PENDING')
    it('should set pauseRequestedAt to now')
    it('should return effective date as first of next month')
    it('should reject if already paused')
  })
  
  describe('resumeSubscription', () => {
    it('should calculate pro-rata for remaining days')
    it('should charge PayPal for pro-rata amount')
    it('should set status to ACTIVE')
    it('should enable channelStatus')
    it('should reject if not paused')
  })
  
  describe('upgradePlan', () => {
    it('should calculate correct pro-rata')
    it('should charge PayPal immediately')
    it('should update planType immediately')
    it('should clear any pending downgrade')
  })
  
  describe('downgradePlan', () => {
    it('should validate limits before scheduling')
    it('should reject if products exceed new plan limit')
    it('should set pendingPlanType and effectiveDate')
    it('should not change current planType')
  })
  
  describe('creditDeduction', () => {
    it('should deduct credit for messages')
    it('should allow balance to go negative up to -€10')
    it('should block messages when balance < -€10')
    it('should return isBlocked=true when threshold exceeded')
  })
})
```

### Scheduler Tests

```typescript
describe('monthlyBillingJob', () => {
  describe('plan changes', () => {
    it('should apply pending downgrade on first of month')
    it('should clear pendingPlanType after applying')
    it('should not apply if effectiveDate is future')
  })
  
  describe('pause handling', () => {
    it('should convert PAUSE_PENDING to PAUSED')
    it('should skip billing for PAUSED workspaces')
    it('should set pausedAt when pausing')
  })
  
  describe('payment processing', () => {
    it('should charge subscription + credit debt')
    it('should reset creditBalance to 0 on success')
    it('should set PAYMENT_FAILED on charge failure')
    it('should increment paymentFailureCount on failure')
    it('should send email on payment failure')
  })
  
  describe('invoice generation', () => {
    it('should create PENDING invoice at month end')
    it('should update to PAID on successful charge')
    it('should include breakdown of consumption')
  })
})
```

### Integration Tests

```typescript
describe('Billing Flow E2E', () => {
  it('complete pause/resume cycle')
  it('upgrade with pro-rata charge')
  it('downgrade scheduled for next month')
  it('monthly billing with credit debt')
  it('payment failure and recovery')
  it('credit depletion and blocking')
})
```

---

## 📅 Implementation Order

1. **Phase 1: Database** (Day 1)
   - Add new fields to Workspace
   - Create MonthlyInvoice table
   - Add SubscriptionStatus and InvoiceStatus enums
   - Migration + seed update

2. **Phase 2: Backend Services** (Day 2-3)
   - SubscriptionService (pause/resume/cancel)
   - PlanChangeService (upgrade/downgrade)
   - InvoiceService (create/finalize/get)
   - Update BillingService for credit threshold

3. **Phase 3: Scheduler** (Day 3-4)
   - Update monthlyBillingJob
   - Add PayPal integration (mock for now)
   - Invoice finalization job

4. **Phase 4: API Endpoints** (Day 4)
   - Subscription endpoints
   - Plan change endpoints
   - Invoice endpoints

5. **Phase 5: Frontend** (Day 5-6)
   - New BillingSection layout
   - Pause confirmation popup
   - Pending downgrade banner
   - Real-time invoice view

6. **Phase 6: Tests** (Throughout)
   - Unit tests for each service
   - Scheduler tests
   - Integration tests

---

## ⚠️ Edge Cases to Handle

1. **Workspace created mid-month**: Pro-rata first month billing
2. **Pause requested same day as billing**: Process pause first
3. **Resume after multiple months paused**: Only charge current month pro-rata
4. **Downgrade cancelled day before effective**: Allow cancel until 23:59 day before
5. **PayPal subscription expired**: Prompt to re-setup payment method
6. **Credit goes negative during month**: Allow until -€10, then block
7. **Multiple failed payments**: Retry schedule (Day 1, 3, 7, then suspend)

---

## 🔗 Dependencies

- PayPal Subscriptions API (or Stripe Billing)
- Email service for notifications
- PDF generation for invoices
- Existing BillingTransaction table (keep for audit trail)
