# Feature 198: Billing Owner Refactor

## 🚨 CRITICAL ARCHITECTURAL FIX

**Problema**: Il billing è attualmente su `Workspace` ma DEVE essere su `User` (Owner).

**Impatto**: Database, Backend, Scheduler, Frontend, Tests - TUTTO deve essere aggiornato.

---

## 📊 Modello Corretto (da implementare)

```
User/Owner Andrea (userId: 123)
├── planType: PREMIUM (€39/mese, max 2 canali)
├── creditBalance: €80 (CONDIVISO tra tutti i workspace)
├── subscriptionStatus: ACTIVE
│
├── Workspace "Shop1" (id: ws-1)
│   └── Usa credit condiviso dell'owner
├── Workspace "Shop2" (id: ws-2)
│   └── Usa credit condiviso dell'owner
│
└── Se PAUSE → TUTTI i workspace di Andrea si fermano
    Se CREDIT < -€10 → TUTTI i workspace di Andrea si fermano
```

---

## 📋 Piano Pricing (dalla UI)

| Piano | Prezzo | Canali (=Workspace) | Prodotti | Clienti |
|-------|--------|---------------------|----------|---------|
| FREE_TRIAL | €0/14gg + €19 credit | 1 | 50 | 50 |
| BASIC | €19/mese | 1 | 50 | 50 |
| PREMIUM | €39/mese | 2 | 100 | 100 |
| ENTERPRISE | €129/mese | Illimitati | Illimitati | Illimitati |

**CONFERMATO**: 
- 1 Channel = 1 Workspace = 1 numero WhatsApp
- Limiti (prodotti, clienti) sono **aggregati PER OWNER** (sommati tra tutti i workspace)
- Credit è **CONDIVISO** tra tutti i workspace dell'owner

---

## 🗄️ Database Changes

### 1. Spostare campi da Workspace a User

**RIMUOVERE da Workspace:**
```prisma
// ❌ DA RIMUOVERE
creditBalance
planType
planStartedAt
trialEndsAt
nextBillingDate
subscriptionStatus
pausedAt
pauseRequestedAt
pendingPlanType
pendingPlanEffectiveDate
lastPaymentFailedAt
paymentFailureCount
```

**AGGIUNGERE a User:**
```prisma
model User {
  // ... existing fields ...
  
  // 💰 BILLING FIELDS (Feature 198)
  creditBalance             Decimal           @default(0) @db.Decimal(10, 2)
  planType                  PlanType          @default(FREE_TRIAL)
  planStartedAt             DateTime          @default(now())
  trialEndsAt               DateTime?
  nextBillingDate           DateTime?
  subscriptionStatus        SubscriptionStatus @default(ACTIVE)
  pausedAt                  DateTime?
  pauseRequestedAt          DateTime?
  pendingPlanType           PlanType?
  pendingPlanEffectiveDate  DateTime?
  lastPaymentFailedAt       DateTime?
  paymentFailureCount       Int               @default(0)
  
  // Billing transactions relation
  billingTransactions       BillingTransaction[]
}
```

### 2. Aggiornare BillingTransaction

```prisma
model BillingTransaction {
  id            String          @id @default(cuid())
  userId        String          // ← CAMBIATO da workspaceId
  user          User            @relation(fields: [userId], references: [id])
  // ... rest unchanged
  
  @@index([userId])  // ← CAMBIATO da workspaceId
}
```

### 3. Aggiornare PlanConfiguration

I limiti sono per OWNER, quindi:
- `maxChannels` = numero max di workspace che l'owner può avere
- `maxProducts` = totale prodotti tra TUTTI i workspace dell'owner
- `maxCustomers` = totale clienti tra TUTTI i workspace dell'owner

---

## 🔌 API Changes

### Endpoints che NON devono avere workspaceId:

```
GET  /api/billing                           → Billing overview per owner (dal token)
GET  /api/billing/balance                   → Credit balance owner
GET  /api/billing/transactions              → Transaction history owner
POST /api/billing/recharge                  → Ricarica credit owner
POST /api/billing/subscription/pause        → Pausa TUTTI i workspace owner
POST /api/billing/subscription/resume       → Riprende TUTTI i workspace owner
POST /api/billing/plan/upgrade              → Upgrade piano owner
POST /api/billing/plan/downgrade            → Downgrade piano owner
GET  /api/billing/subscription/status       → Stato subscription owner
```

### Endpoints che MANTENGONO workspaceId (operazioni specifiche workspace):

```
GET  /api/workspaces/:workspaceId/products
GET  /api/workspaces/:workspaceId/customers
GET  /api/workspaces/:workspaceId/orders
POST /api/workspaces/:workspaceId/chat
... etc (tutte le operazioni workspace-specific)
```

---

## 🔒 Security Model

### Per operazioni Billing (senza workspaceId):
```
1. authMiddleware → Estrae userId dal token
2. Il billing è per userId, non serve workspaceId
3. Pause/Resume → Agisce su TUTTI i workspace dell'owner
```

### Per operazioni Workspace (con workspaceId):
```
1. authMiddleware → Estrae userId dal token
2. validateWorkspaceOperation → Verifica che userId sia owner/member del workspace
3. Prima di processare → Verifica billing status dell'OWNER del workspace
```

---

## 🤖 WhatsApp Webhook Flow (Aggiornato)

```
1. Messaggio arriva per Workspace ws-1
2. Trova owner di ws-1 → userId: 123
3. WorkspaceAccessService.canProcessMessages(userId: 123)
   └── Controlla: subscriptionStatus, creditBalance su USER
4. Se bloccato → Silent block (nessun messaggio salvato)
5. Se OK → Processa con LLM
6. Deduce credit da USER.creditBalance
```

---

## 📅 Scheduler Monthly Billing (Aggiornato)

```typescript
// PRIMA: Loop su Workspace
// DOPO: Loop su User (Owner)

async function monthlyBillingJob() {
  // Get all users with paid plans
  const users = await prisma.user.findMany({
    where: {
      planType: { not: 'FREE_TRIAL' },
      deletedAt: null,
    },
    include: {
      ownedWorkspaces: true, // Per disabilitare se payment fails
    }
  })

  for (const user of users) {
    // 1. Apply pending plan changes
    // 2. Handle PAUSE_PENDING → PAUSED
    // 3. Calculate charge: subscription + credit debt
    // 4. Process payment
    // 5. On failure: set PAYMENT_FAILED, disable ALL user's workspaces
  }
}
```

---

## 🖥️ Frontend Changes

### BillingSection.tsx
- NON passare workspaceId
- Usare endpoint `/api/billing` (senza workspace)
- Mostrare credit/plan aggregato per owner

### SubscriptionStatusCard.tsx
- NON passare workspaceId
- Pause/Resume agisce su TUTTO l'account

### Workspace Selection Page
- Mostrare billing status dell'owner (non per workspace)
- Se owner è PAUSED → tutti i workspace mostrano "Paused"

---

## 📝 Migration Steps

### Step 1: Database Migration
```sql
-- 1. Add billing fields to User
ALTER TABLE "User" ADD COLUMN "creditBalance" DECIMAL(10,2) DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "planType" TEXT DEFAULT 'FREE_TRIAL';
-- ... altri campi

-- 2. Migrate data: Per ogni owner, somma credit dei suoi workspace
UPDATE "User" u SET 
  "creditBalance" = (
    SELECT COALESCE(SUM(w."creditBalance"), 0) 
    FROM "Workspace" w 
    WHERE w."ownerId" = u.id
  ),
  "planType" = (
    SELECT w."planType" 
    FROM "Workspace" w 
    WHERE w."ownerId" = u.id 
    ORDER BY w."createdAt" ASC 
    LIMIT 1
  )
WHERE EXISTS (
  SELECT 1 FROM "Workspace" w WHERE w."ownerId" = u.id
);

-- 3. Update BillingTransaction to use userId
ALTER TABLE "BillingTransaction" ADD COLUMN "userId" TEXT;
UPDATE "BillingTransaction" bt SET "userId" = (
  SELECT w."ownerId" FROM "Workspace" w WHERE w.id = bt."workspaceId"
);
ALTER TABLE "BillingTransaction" ALTER COLUMN "userId" SET NOT NULL;

-- 4. Remove billing fields from Workspace (DOPO che tutto funziona)
-- ALTER TABLE "Workspace" DROP COLUMN "creditBalance";
-- ... etc
```

### Step 2: Backend Services
1. `SubscriptionBillingService` → Query su User invece di Workspace
2. `WorkspaceAccessService` → Check billing status dell'owner
3. Routes → Nuovi endpoint senza workspaceId

### Step 3: Scheduler
1. `monthly-billing.job.ts` → Loop su User
2. Disable TUTTI i workspace dell'owner se payment fails

### Step 4: Frontend
1. Rimuovere workspaceId dalle chiamate billing
2. Aggiornare API service
3. Aggiornare componenti UI

### Step 5: Tests
1. Aggiornare tutti i test billing
2. Aggiungere test per billing condiviso

---

## ⚠️ Breaking Changes

1. **API**: Endpoint billing cambiano (rimuovono workspaceId)
2. **Database**: Campi billing si spostano
3. **Logica**: Credit è condiviso, non per workspace

---

## 🎯 Acceptance Criteria

- [ ] Credit balance è su User, condiviso tra tutti i workspace
- [ ] Pause ferma TUTTI i workspace dell'owner
- [ ] Resume riattiva TUTTI i workspace dell'owner
- [ ] Payment failure blocca TUTTI i workspace dell'owner
- [ ] Limiti (products, customers) sono aggregati per owner
- [ ] Monthly billing processa per User, non per Workspace
- [ ] API billing NON richiedono workspaceId
- [ ] Frontend billing NON passa workspaceId
- [ ] WhatsApp webhook verifica billing dell'OWNER
- [ ] Tests aggiornati al 100%

---

## 📊 Effort Estimate

| Area | Effort | Risk |
|------|--------|------|
| Database Migration | 2h | HIGH (data migration) |
| Backend Services | 4h | MEDIUM |
| Backend Routes | 2h | LOW |
| Scheduler | 1h | LOW |
| Frontend | 3h | LOW |
| Tests | 3h | MEDIUM |
| **TOTALE** | **15h** | **MEDIUM-HIGH** |

---

## 🚀 Execution Plan

1. **Branch**: `198-billing-owner-refactor`
2. **Database first**: Migration con rollback plan
3. **Backend**: Services → Routes → Controllers
4. **Scheduler**: Monthly billing job
5. **Frontend**: API service → Components
6. **Tests**: Unit → Integration
7. **QA**: Manual testing billing flows
