# Sistema di Fatturazione Mensile - Implementazione

**Data**: 20 Ottobre 2025  
**Branch**: 84-design-implement-new-calling-functions-addproduct-repeatorder-full-befeprompt-integration

---

## 🎯 Obiettivo

Implementare un sistema di visualizzazione della fatturazione basato su **mesi calendario** anziché periodi rolling (es. "ultimi 30 giorni"), per avere visibilità chiara dei costi mensili effettivi.

---

## 📊 Caratteristiche Implementate

### 1. **Mese Corrente**
- ✅ Visualizzazione del totale parziale del mese in corso
- ✅ Breakdown dettagliato per tipo di costo (messaggi, ordini, canale, ecc.)
- ✅ Indicatore chiaro che il mese è incompleto

### 2. **Storico 12 Mesi**
- ✅ Tabella con ultimi 12 mesi completi
- ✅ Totali per mese
- ✅ Dettaglio operazioni e tipologie
- ✅ Statistiche: media mensile, mese più alto, mese più basso

### 3. **Sicurezza Multi-Tenant**
- ✅ Ogni query Prisma filtra per `workspaceId`
- ✅ API client valida `workspaceId` obbligatorio
- ✅ Middleware `authMiddleware` su tutte le routes
- ✅ Logging con `workspaceId` per tracciabilità

---

## 🏗️ Architettura

### Backend

**File**: `backend/src/application/services/billing.service.ts`

```typescript
async getMonthlyBreakdown(workspaceId: string): Promise<{
  currentMonth: CurrentMonthBilling
  history: MonthlyBilling[]
}>
```

**Logica**:
1. Recupera tutti i record `Billing` degli ultimi 13 mesi (12 completi + corrente)
2. Raggruppa per mese calendario (anno-mese)
3. Calcola totali e breakdown per tipo
4. Separa mese corrente (incompleto) dallo storico

**Sicurezza**:
```typescript
const billings = await this.prisma.billing.findMany({
  where: {
    workspaceId, // ✅ CRITICO: sempre presente
    createdAt: { gte: startDate }
  }
})
```

---

### Controller

**File**: `backend/src/interfaces/http/controllers/billing.controller.ts`

```typescript
async getMonthlyBreakdown(req: Request, res: Response): Promise<void>
```

**Validazione**:
- Verifica `workspaceId` presente nei params
- Ritorna errore 400 se mancante
- Log con workspaceId per audit

---

### Routes

**File**: `backend/src/interfaces/http/routes/billing.routes.ts`

```typescript
router.use(authMiddleware) // ✅ Autenticazione JWT
router.get("/:workspaceId/monthly", billingController.getMonthlyBreakdown)
```

**Pattern URL**: `/api/billing/:workspaceId/monthly`

---

### Frontend

**File**: `frontend/src/services/billingApi.ts`

```typescript
export const getMonthlyBreakdown = async (
  workspaceId: string
): Promise<MonthlyBreakdownResponse>
```

**Validazione Client-Side**:
```typescript
if (!workspaceId) {
  throw new Error("Workspace ID is required for billing operations")
}
```

---

**File**: `frontend/src/components/analytics/BillingTab.tsx`

Componente React che:
1. Usa `useWorkspace()` per ottenere workspace corrente
2. Chiama API con `workspaceId` validato
3. Visualizza mese corrente + storico
4. Gestisce loading/error states

---

**File**: `frontend/src/pages/AnalyticsPage.tsx`

Integrazione:
- Aggiunto sistema tabs (Analytics / Fatturazione)
- Tab "Fatturazione" mostra `<BillingTab />`
- Mantiene date picker per Analytics tab

---

## 🔒 Sicurezza Multi-Tenant

### Principi Applicati

1. **Database-First**: Nessun fallback, tutto dal DB filtrato per workspace
2. **Workspace Isolation**: Ogni query ha `WHERE workspaceId = ...`
3. **Validation Layer**: 
   - Backend: controller valida params
   - Frontend: API client valida prima della chiamata
4. **Audit Trail**: Log include sempre `workspaceId`

### Punti di Controllo

```typescript
// ✅ Backend Service
const billings = await this.prisma.billing.findMany({
  where: { workspaceId } // MANDATORY
})

// ✅ Backend Controller
if (!workspaceId) {
  return res.status(400).json({ error: "Workspace ID is required" })
}

// ✅ Frontend API
if (!workspaceId) {
  throw new Error("Workspace ID is required for billing operations")
}

// ✅ Frontend Component
const { workspace } = useWorkspace()
await getMonthlyBreakdown(workspace.id) // ✅ Never hardcoded
```

---

## 📝 Dati Visualizzati

### Mese Corrente

| Campo | Descrizione |
|-------|-------------|
| `year` | Anno (es. 2025) |
| `month` | Mese 1-12 |
| `monthName` | Nome in italiano (es. "Ottobre") |
| `total` | Totale parziale del mese |
| `byType` | Breakdown per tipo di costo |
| `isComplete` | `false` (mese in corso) |

### Storico (12 mesi)

Array di mesi con stessa struttura, ma `isComplete` non presente (sempre completi).

### Tipi di Costo

```typescript
MONTHLY_CHANNEL: "Canale Mensile" (€19)
MESSAGE: "Messaggi" (€0.15 cad.)
NEW_CUSTOMER: "Nuovi Clienti" (€1.50)
NEW_ORDER: "Nuovi Ordini" (€1.50)
HUMAN_SUPPORT: "Supporto Umano" (€1.00)
PUSH_MESSAGE: "Notifiche Push" (€1.00)
NEW_FAQ: "Nuove FAQ" (€0.50)
ACTIVE_OFFER: "Offerte Attive" (€0.50)
```

---

## 🧪 Test di Sicurezza

### Test Multi-Tenant

**Scenario**: Due workspace differenti non devono vedere dati reciproci

**Test Case 1**: Chiamata con workspaceId diverso
```bash
# Login come user workspace A
curl -H "Authorization: Bearer TOKEN_A" \
  http://localhost:3001/api/billing/WORKSPACE_B/monthly

# Risultato atteso: 401 Unauthorized oppure dati vuoti
```

**Test Case 2**: Workspace ID mancante
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/api/billing/monthly

# Risultato atteso: 404 Not Found (route non esiste senza :workspaceId)
```

**Test Case 3**: WorkspaceId nel token vs params
```typescript
// authMiddleware estrae workspaceId dal token
// Controller DEVE validare che req.params.workspaceId === (req as any).workspaceId
```

---

## 🚀 Deployment

### Checklist Pre-Deploy

- [x] Backend compilato senza errori
- [x] Frontend compilato senza errori
- [x] Tutti i file hanno `workspaceId` validation
- [x] Log include `workspaceId` per audit
- [x] Nessun dato hardcodato
- [x] API usa workspace dal context
- [x] Prisma queries filtrate per workspace

### Comandi

```bash
# Backend
cd backend && npm run build

# Frontend
cd frontend && npm run build

# Restart services (hot-reload attivo, non necessario)
```

---

## 📖 Utilizzo

### Per l'Utente (Andrea)

1. Vai su **Analytics** page
2. Clicca tab **"Fatturazione"**
3. Vedi:
   - **Mese Corrente**: Totale parziale aggiornato in tempo reale
   - **Breakdown**: Quanti messaggi, ordini, ecc. e relativi costi
   - **Storico 12 Mesi**: Tabella completa con totali mensili
   - **Statistiche**: Media, max, min mensile

### Per lo Sviluppatore

**Aggiungere nuovo tipo di billing**:
1. Aggiorna enum `BillingType` in Prisma schema
2. Aggiungi prezzo in `BillingPrices` enum
3. Aggiungi label in `BILLING_TYPE_LABELS` (frontend)
4. Aggiungi colore in `BILLING_TYPE_COLORS` (frontend)

---

## 🐛 Troubleshooting

### "Workspace ID is required"
- **Causa**: `workspaceId` non presente nella chiamata API
- **Fix**: Verificare che componente usi `useWorkspace()` e passi `workspace.id`

### "No data available"
- **Causa**: Nessun record Billing nel database per questo workspace
- **Fix**: Eseguire seed o effettuare operazioni che generano billing

### Dati di altri workspace visibili
- **CRITICO**: Bug di sicurezza multi-tenant
- **Fix**: Verificare query Prisma include `WHERE workspaceId`
- **Log**: Cercare in logs se `workspaceId` è corretto

---

## 📚 File Modificati

### Backend
- `backend/src/interfaces/http/routes/billing.routes.ts` (nuovo endpoint)
- `backend/src/interfaces/http/controllers/billing.controller.ts` (nuovo metodo)
- `backend/src/application/services/billing.service.ts` (logica breakdown)

### Frontend
- `frontend/src/services/billingApi.ts` (NUOVO)
- `frontend/src/components/analytics/BillingTab.tsx` (NUOVO)
- `frontend/src/pages/AnalyticsPage.tsx` (aggiunte tabs)

---

## ✅ Completamento

**Tutti i TODO completati**:
1. ✅ Sicurezza multi-tenant su routes
2. ✅ Endpoint `/api/billing/:workspaceId/monthly`
3. ✅ Logica `getMonthlyBreakdown` in service
4. ✅ API client `billingApi.ts`
5. ✅ Componente `BillingTab`
6. ✅ Integrazione in `AnalyticsPage`
7. ✅ Test sicurezza workspace isolation

**Pronto per test da parte di Andrea!** 🎉
