# 📝 Changelog - 12 Ottobre 2025

## 🔐 Token vs SessionID Architecture - Fix Completo

**Problema iniziale**: Pagine pubbliche (checkout, registrazione, ordini) richiedevano `sessionId` invece di usare solo token dall'URL.

### ✅ Fix Implementati

#### Backend

1. **Creato `/backend/src/routes/token/index.ts`**
   - Router principale per tutte le route token-based
   - Monta sotto `/api/token/*`:
     - `/registration/*` - Registrazione clienti
     - `/checkout/*` - Processo checkout
     - `/orders-public/*` - Ordini pubblici
     - `/customer-profile/*` - Profilo cliente
     - `/cart/*` - Carrello shopping

2. **Aggiunto `/token/` a SESSION_EXEMPT_ROUTES**
   - File: `/backend/src/routes/index.ts`
   - Middleware esclude validazione sessionId per tutte le route sotto `/api/token/*`

3. **Fix Cart Router**
   - **Prima**: Usava `createCartTokenRouter()` (solo validate token support)
   - **Dopo**: Usa `cartRouter` (GET, POST, PUT, DELETE per cart operations)
   - Endpoint funzionanti:
     - `GET /api/token/cart/:token` - Ottieni carrello
     - `POST /api/token/cart/:token/items` - Aggiungi item
     - `PUT /api/token/cart/:token/items/:id` - Aggiorna quantità
     - `DELETE /api/token/cart/:token/items/:id` - Rimuovi item

4. **Aggiunti Route Aliases**
   - File: `/backend/src/interfaces/http/routes/public-orders.routes.ts`
   - Supporto sia `/public/orders` che `/orders-public`
   - Supporto `/orders-public/:orderCode` per dettaglio ordine

#### Frontend

1. **Creato `/frontend/src/services/tokenApi.ts`**
   - Client HTTP dedicato per pagine pubbliche
   - `baseURL: "/api/token"`
   - `withCredentials: false`
   - **NO** sessionId interceptor

2. **Convertito CheckoutPage a tokenApi**
   - File: `/frontend/src/pages/CheckoutPage.tsx`
   - Tutte le chiamate carrello ora usano `tokenApi`:
     - Ottieni carrello: `tokenApi.get('/cart/${token}')`
     - Aggiungi item: `tokenApi.post('/cart/${token}/items')`
     - Aggiorna quantità: `tokenApi.put('/cart/${token}/items/${id}')`
     - Rimuovi item: `tokenApi.delete('/cart/${token}/items/${id}')`
     - Submit ordine: `tokenApi.post('/checkout/submit')`
   - **Rimossi tutti i toast messages** (richiesta Andrea)
   - **Rimosso import** `import { toast } from "sonner"`

3. **Fix useTokenValidation Hook**
   - File: `/frontend/src/hooks/useTokenValidation.ts`
   - Cambiato da `api` a `tokenApi`
   - Validazione token ora va su `/api/token/*` endpoints

4. **Fix WorkspaceSelectionPage**
   - File: `/frontend/src/pages/WorkspaceSelectionPage.tsx`
   - Cambiato da `sessionStorage` a `localStorage` per sessionId

5. **Pagine aggiornate a tokenApi**:
   - ✅ `CheckoutPage.tsx`
   - ✅ `register.tsx`
   - ✅ `OrdersPublicPage.tsx`
   - ✅ `CustomerProfilePublicPage.tsx`
   - ✅ `data-protection.tsx`

### 📚 Documentazione Creata

1. **TOKEN-VS-SESSIONID-ARCHITECTURE.md**
   - Documentazione completa architettura
   - Backend structure e routing
   - Frontend HTTP clients
   - Best practices e troubleshooting
   - Tabelle riepilogative endpoint

2. **QUICK-REFERENCE-TOKEN-SESSION.md**
   - Riferimento rapido per sviluppo
   - Quale client usare (tokenApi vs api)
   - Errori comuni e soluzioni
   - Debug checklist

3. **README.md** (Memory Bank)
   - Indice completo documenti tecnici
   - Guida uso memory bank
   - Link rapidi a documentazione

### 🎯 Risultato Finale

**Prima**:
- ❌ Pagine pubbliche richiedevano sessionId
- ❌ 401 "SessionID is required" su checkout/registrazione
- ❌ Frontend chiamava `/api/cart/*` (404 Not Found)
- ❌ Mix di autenticazioni token/session

**Dopo**:
- ✅ Pagine pubbliche usano SOLO token da URL
- ✅ Nessun errore sessionId su pagine pubbliche
- ✅ Frontend chiama `/api/token/cart/*` (200 OK)
- ✅ Separazione netta: token pubblico / sessionId backoffice
- ✅ Checkout funzionante end-to-end
- ✅ Documentazione completa per team

### 🔄 Migration Path

**Per aggiungere nuove pagine pubbliche**:
1. Backend: Crea route e monta in `/backend/src/routes/token/index.ts`
2. Frontend: Usa `tokenApi` da `/frontend/src/services/tokenApi.ts`
3. Token in URL query params: `?token=xxx`

**Per backoffice admin**:
1. Backend: Route normale con middleware session
2. Frontend: Usa `api` da `/frontend/src/services/api.ts`
3. sessionId automatico da localStorage

---

**Tempo totale**: ~3 ore  
**File modificati**: 12  
**File creati**: 3 (documentazione)  
**Test**: Manuale su checkout completo ✅

---

*Ultima modifica: 12 Ottobre 2025, 12:46*
