# 💰 Pricing Management Guide

**Last Updated**: 23 October 2025  
**Author**: Andrea (via AI Copilot)  
**Status**: PRODUCTION READY ✅

---

## 🎯 Overview

Il sistema di pricing di ShopME è completamente **centralizzato nel database**. Esiste UN SOLO posto dove modificare i prezzi, e le modifiche si propagano automaticamente sia al backend che al frontend.

### ✅ Garanzie del Sistema

- **Single Source of Truth**: `backend/prisma/data/pricingConfig.ts` → Database
- **No Hardcoded Prices**: Tutti i prezzi vengono dal database via `PricingRepository`
- **Historical Preservation**: I billing records mantengono il prezzo al momento della transazione
- **Automatic Updates**: Backend e Frontend si aggiornano automaticamente
- **Type Safety**: TypeScript garantisce coerenza tra tutti i layer

---

## 📦 Struttura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                   DATABASE (PostgreSQL)                      │
│                   PricingConfig Table                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ id | type     | key          | value | description  │  │
│  ├────┼──────────┼──────────────┼───────┼──────────────┤  │
│  │ 1  | PLAN     | BASIC_MONTHLY| 29    | Basic plan   │  │
│  │ 2  | USAGE    | NEW_CUSTOMER | 1.0   | New customer │  │
│  │ 3  | USAGE    | MESSAGE      | 0.15  | Per message  │  │
│  │ 4  | THRESHOLD| FREE_MESSAGES| 200   | Free tier    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
┌───────▼────────┐                    ┌───────▼────────┐
│   BACKEND      │                    │   FRONTEND     │
│                │                    │                │
│ PricingRepo    │                    │ usePricing()   │
│ ├─ getAll()    │                    │ hook           │
│ ├─ getValue()  │                    │                │
│ └─ update()    │                    │ - Global cache │
│                │   /api/pricing     │ - Auto-fetch   │
│ BillingService │◄───────────────────┤ - Loading      │
│ ├─ trackMsg()  │                    │                │
│ ├─ trackCustom │                    │ Components:    │
│ └─ trackOrder  │                    │ - PricingPlans │
│                │                    │ - Simulator    │
└────────────────┘                    └────────────────┘
```

---

## 🔧 Come Modificare i Prezzi

### Metodo 1: Script di Update (CONSIGLIATO ✅)

**Quando usarlo**: Per modifiche rapide di pochi prezzi

1. **Apri il file di configurazione**:

   ```bash
   code backend/scripts/update-pricing.ts
   ```

2. **Modifica i valori in `PRICING_UPDATES`**:

   ```typescript
   const PRICING_UPDATES = {
     // Decommenta solo i prezzi che vuoi cambiare
     NEW_CUSTOMER: 1.0, // Da €1.50 a €1.00
     MESSAGE: 0.12, // Da €0.15 a €0.12
   }
   ```

3. **Esegui lo script**:

   ```bash
   cd backend
   npm run update-pricing
   ```

4. **Output atteso**:

   ```
   ✅ NEW_CUSTOMER:
      Old: €1.5
      New: €1
      Change: €-0.50

   ✅ Pricing update completed!
   📊 Summary: Updated 2 pricing configurations
   ```

5. **Verifica le modifiche**:
   ```bash
   npm run view-pricing
   ```

### Metodo 2: Modifica del Seed (per setup iniziale)

**Quando usarlo**: Per configurazione iniziale o reset completo

1. **Apri il file sorgente**:

   ```bash
   code backend/prisma/data/pricingConfig.ts
   ```

2. **Modifica i valori**:

   ```typescript
   export const pricingConfigData = [
     {
       type: "USAGE" as const,
       key: "NEW_CUSTOMER",
       value: 1.0, // ⬅️ MODIFICA QUI
       description: "Cost per new customer registration",
       isActive: true,
     },
     // ... altri prezzi
   ]
   ```

3. **Re-seed del database**:

   ```bash
   cd backend
   npm run seed
   ```

   **⚠️ ATTENZIONE**: Questo **resetta TUTTI i dati** nel database!

---

## 📊 Tipi di Pricing

### 1. **PLAN** (Piani Mensili)

Costi fissi per i piani di abbonamento:

| Key                    | Default | Descrizione                |
| ---------------------- | ------- | -------------------------- |
| `FREE_MONTHLY`         | €0      | Piano gratuito (14 giorni) |
| `BASIC_MONTHLY`        | €29     | Piano base                 |
| `PREMIUM_MONTHLY`      | €59     | Piano premium              |
| `ENTERPRISE_MONTHLY`   | €199    | Piano enterprise           |
| `MONTHLY_CHANNEL_COST` | €59     | Costo canale WhatsApp      |

### 2. **USAGE** (Costi a Consumo)

Costi per operazioni specifiche:

| Key             | Default | Descrizione                        |
| --------------- | ------- | ---------------------------------- |
| `MESSAGE`       | €0.15   | Per ogni messaggio AI              |
| `NEW_CUSTOMER`  | €1.00   | Per ogni nuovo cliente (era €1.50) |
| `NEW_ORDER`     | €1.50   | Per ogni nuovo ordine              |
| `PUSH_CAMPAIGN` | €1.00   | Per ogni notifica push             |

### 3. **THRESHOLD** (Soglie Gratuite)

Limiti per i piani gratuiti:

| Key                   | Default | Descrizione                |
| --------------------- | ------- | -------------------------- |
| `FREE_MESSAGES`       | 200     | Messaggi gratis nel trial  |
| `FREE_PRODUCTS`       | 50      | Prodotti max piano Free    |
| `FREE_CLIENTS`        | 50      | Clienti max piano Free     |
| `BASIC_PRODUCTS`      | 50      | Prodotti max piano Basic   |
| `BASIC_CLIENTS`       | 50      | Clienti max piano Basic    |
| `PREMIUM_PRODUCTS`    | 100     | Prodotti max piano Premium |
| `PREMIUM_CLIENTS`     | 100     | Clienti max piano Premium  |
| `ENTERPRISE_PRODUCTS` | 999999  | Prodotti illimitati        |
| `ENTERPRISE_CLIENTS`  | 999999  | Clienti illimitati         |

---

## 🧪 Testing

### Unit Tests (Calcolo Puro)

```bash
cd backend
npm run test:unit -- billing-calculation.spec.ts
```

**Test coperti**:

- ✅ Calcolo costi singoli (MESSAGE, NEW_CUSTOMER, NEW_ORDER)
- ✅ Accumulazione: `previousTotal + currentCharge = newTotal`
- ✅ Edge cases (zero, numeri grandi, precisione)
- ✅ Scenari reali (customer journey, workspace mensile)
- ✅ Verifica prezzo €1.00 per NEW_CUSTOMER (non più €1.50)

### Integration Tests (Database Reale)

```bash
cd backend
npm run test:integration -- billing-service.spec.ts
```

**Test coperti**:

- ✅ BillingService.trackMessage() con prezzo da DB
- ✅ BillingService.trackNewCustomer() con prezzo da DB
- ✅ BillingService.trackNewOrder() con prezzo da DB
- ✅ Coerenza con PricingRepository
- ✅ Preservazione prezzi storici nei billing records

### Test Manuale API

```bash
# 1. Backend deve essere in esecuzione
cd backend && npm run dev

# 2. In un altro terminale
curl http://localhost:3001/api/pricing/config | jq
```

**Output atteso**:

```json
{
  "plans": {
    "BASIC_MONTHLY": 29,
    "PREMIUM_MONTHLY": 59,
    "ENTERPRISE_MONTHLY": 199,
    "MONTHLY_CHANNEL_COST": 59,
    "FREE_MONTHLY": 0
  },
  "usage": {
    "MESSAGE": 0.15,
    "NEW_CUSTOMER": 1,        // ⬅️ €1.00 (cambiato da €1.50)
    "NEW_ORDER": 1.5,
    "PUSH_CAMPAIGN": 1
  },
  "thresholds": {
    "FREE_MESSAGES": 200,
    "FREE_PRODUCTS": 50,
    ...
  }
}
```

---

## 🔍 Verifica che tutto funzioni

### Checklist Completa

1. **Database aggiornato?**

   ```bash
   cd backend && npm run view-pricing
   ```

   Controlla che i valori siano corretti.

2. **Backend usa i prezzi dal database?**

   - Cerca in `billing.service.ts`: `await this.pricingRepository.getValue(...)`
   - ✅ Nessun hardcoded price, solo fallback per sicurezza
   - ✅ Fallback allineato con valore attuale nel database

3. **Frontend riceve i prezzi dall'API?**

   - Hook `usePricing()` chiama `/api/pricing/config`
   - Componenti usano: `usage.NEW_CUSTOMER ?? 1.0` (fallback aggiornato)
   - Test: DevTools → Network → verifica chiamata API

4. **Test passano?**

   ```bash
   npm run test:unit -- billing-calculation.spec.ts
   # Tutti i 15 test devono passare ✅
   ```

5. **Storico preservato?**
   - Query vecchi billing: `SELECT * FROM Billing ORDER BY createdAt DESC LIMIT 10`
   - Verifica che `amount` contenga il prezzo al momento della transazione
   - Nuovi billing devono usare nuovi prezzi

---

## 🚨 Troubleshooting

### Frontend mostra prezzi vecchi

**Causa**: Browser cache

**Soluzione**:

```javascript
// Browser DevTools Console
localStorage.clear()
location.reload()
```

Oppure:

```bash
# Hard refresh
Cmd + Shift + R (Mac)
Ctrl + Shift + R (Windows/Linux)
```

### API restituisce "Unauthorized"

**Causa**: Endpoint `/pricing` non in `SESSION_EXEMPT_ROUTES`

**Soluzione**: Verifica `backend/src/routes/index.ts`:

```typescript
const SESSION_EXEMPT_ROUTES = [
  "/auth/login",
  "/pricing", // ⬅️ Deve essere presente!
  // ...
]
```

### Prezzi non si aggiornano dopo modifica

**Causa**: Server non riavviato o cache frontend

**Soluzione**:

1. **Backend**: Hot-reload automatico (ts-node-dev)
2. **Frontend**: Refresh browser (F5)
3. **Database**: Verifica con `npm run view-pricing`

### Test falliscono con prezzo sbagliato

**Causa**: Test non aggiornati con nuovo prezzo

**Soluzione**: Controlla i fallback nei test:

```typescript
// ❌ VECCHIO
NEW_CUSTOMER: usage.NEW_CUSTOMER ?? 1.5

// ✅ NUOVO
NEW_CUSTOMER: usage.NEW_CUSTOMER ?? 1.0
```

---

## 📝 Best Practices

### ✅ DO

- **Usa sempre lo script `update-pricing.ts`** per modifiche rapide
- **Documenta ogni modifica** con commento nel codice
- **Testa dopo ogni modifica** (`npm run test:unit`)
- **Verifica API response** (`curl /api/pricing/config`)
- **Aggiorna fallback** nel frontend se cambi prezzi base

### ❌ DON'T

- **NON hardcodare mai prezzi** nel codice business logic
- **NON modificare direttamente il database** (usa script)
- **NON dimenticare di fare seed** dopo modifica `pricingConfig.ts`
- **NON rimuovere fallback** (servono per sicurezza se DB fallisce)
- **NON toccare billing records storici** (preservazione obbligatoria)

---

## 🔗 File Correlati

### Backend

- **Dati**: `backend/prisma/data/pricingConfig.ts` (SINGLE SOURCE OF TRUTH)
- **Schema**: `backend/prisma/schema.prisma` (model PricingConfig)
- **Repository**: `backend/src/repositories/pricing.repository.ts`
- **Controller**: `backend/src/interfaces/http/controllers/pricing.controller.ts`
- **Routes**: `backend/src/interfaces/http/routes/pricing.routes.ts`
- **Service**: `backend/src/application/services/billing.service.ts`
- **Scripts**:
  - `backend/scripts/update-pricing.ts` (modifica prezzi)
  - `backend/scripts/view-pricing.ts` (visualizza prezzi)

### Frontend

- **Hook**: `frontend/src/hooks/usePricing.ts` (global cache)
- **Components**:
  - `frontend/src/components/landing/PricingPlans.tsx`
  - `frontend/src/pages/PricingSimulator.tsx`
  - `frontend/src/components/pricing/PricingSimulatorModal.tsx`

### Tests

- **Unit**: `backend/src/__tests__/unit/billing-calculation.spec.ts`
- **Integration**: `backend/src/__tests__/integration/billing-service.spec.ts`

### Documentation

- **PRD**: `docs/memory-bank/prd.md` (architettura completa)
- **This Guide**: `docs/memory-bank/05-guides/pricing-management.md`

---

## 📊 Esempio: Cambiare NEW_CUSTOMER da €1.50 a €1.00

### Situazione Iniziale

```typescript
// pricingConfig.ts
{
  key: "NEW_CUSTOMER",
  value: 1.5,  // €1.50
}
```

### Step-by-Step

1. **Modifica lo script**:

   ```typescript
   // backend/scripts/update-pricing.ts
   const PRICING_UPDATES = {
     NEW_CUSTOMER: 1.0, // Da €1.50 a €1.00
   }
   ```

2. **Esegui update**:

   ```bash
   npm run update-pricing
   ```

   Output: `✅ NEW_CUSTOMER: Old €1.5 → New €1 (Change: €-0.50)`

3. **Verifica database**:

   ```bash
   npm run view-pricing
   ```

   Output: `✅ NEW_CUSTOMER €1 Cost per new customer registration`

4. **Aggiorna sorgente** (per future seed):

   ```typescript
   // backend/prisma/data/pricingConfig.ts
   {
     key: "NEW_CUSTOMER",
     value: 1.0,  // ⬅️ Aggiornato
   }
   ```

5. **Aggiorna fallback frontend**:

   ```typescript
   // PricingPlans.tsx, PricingSimulator.tsx, PricingSimulatorModal.tsx
   NEW_CUSTOMER: usage.NEW_CUSTOMER ?? 1.0 // Da 1.5 a 1.0
   ```

6. **Aggiorna commenti**:

   ```typescript
   // billing.service.ts
   const newCustomerCost =
     (await this.pricingRepository.getValue("NEW_CUSTOMER")) ?? 1.0

   // registration.controller.ts
   // 💰 BILLING: Track NEW_CUSTOMER when user registers (€1.00)
   logger.info(`[BILLING] 💰 New customer registered: €1.00 charged...`)
   ```

7. **Riesegui test**:

   ```bash
   npm run test:unit -- billing-calculation.spec.ts
   ```

   Output: `✅ Tests: 15 passed, 15 total`

8. **Test manuale API**:

   ```bash
   curl http://localhost:3001/api/pricing/config | jq '.usage.NEW_CUSTOMER'
   ```

   Output: `1`

9. **Refresh frontend** e verifica che mostri €1.00

### Risultato Finale

- ✅ Database: €1.00
- ✅ Backend: legge €1.00 dal database
- ✅ Frontend: mostra €1.00 (da API)
- ✅ Test: tutti passano con €1.00
- ✅ Storico: vecchi billing mantengono €1.50
- ✅ Nuovi billing: useranno €1.00

---

## 🎓 Conclusione

Il sistema di pricing centralizzato garantisce:

1. **Coerenza**: Un solo punto di modifica (database)
2. **Tracciabilità**: Prezzi storici preservati nei billing
3. **Automazione**: Backend e Frontend si aggiornano automaticamente
4. **Sicurezza**: Fallback values per resilienza
5. **Testing**: Coverage completo (unit + integration)
6. **Facilità**: Script user-friendly per modifiche rapide

**Domande?** Contatta Andrea o consulta la [PRD completa](../prd.md).

---

**Last Review**: 23 October 2025  
**Next Review**: Quando si aggiungono nuovi tipi di pricing o piani
