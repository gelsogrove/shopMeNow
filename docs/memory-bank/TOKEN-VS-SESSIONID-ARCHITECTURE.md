# 🔐 Token vs SessionID Architecture - Documentazione Completa

**Data creazione**: 12 Ottobre 2025  
**Autore**: Andrea & AI Assistant

---

## 📋 Indice

1. [Panoramica](#panoramica)
2. [Architettura Backend](#architettura-backend)
3. [Architettura Frontend](#architettura-frontend)
4. [Routing e Middleware](#routing-e-middleware)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 Panoramica

ShopME utilizza **DUE sistemi di autenticazione separati**:

| Sistema | Uso | Storage | Header | Percorso API |
|---------|-----|---------|--------|--------------|
| **SessionID** | Backoffice (Admin) | localStorage | `X-Session-Id` | `/api/*` (escluso `/token/`) |
| **Token** | Pagine pubbliche | URL Query Params | Nessuno | `/api/token/*` |

### Regola Fondamentale

> **"Il token si usa SOLO per API di token folder!"**  
> - Le chiamate sotto `/api/token/*` controllano il **token** (NON sessionId)
> - Tutte le altre chiamate in backoffice usano **sessionId**

---

## 🏗️ Architettura Backend

### 1. Struttura Route Token (`/backend/src/routes/token/`)

```
backend/src/routes/token/
├── index.ts                    # Router principale token
└── [mount routes sotto /api/token/*]
```

**File**: `/backend/src/routes/token/index.ts`

```typescript
import { Router } from "express"
import logger from "../../utils/logger"
import createRegistrationRouter from "../../interfaces/http/routes/registration.routes"
import { checkoutRouter } from "../../interfaces/http/routes/checkout.routes"
import publicOrdersRouter from "../../interfaces/http/routes/public-orders.routes"
import { cartRouter } from "../../interfaces/http/routes/cart.routes"

export function createTokenRouter(): Router {
  const router = Router()

  logger.info("🎫 Setting up token routes...")

  // Registration routes (/api/token/registration/*)
  router.use("/registration", createRegistrationRouter())
  
  // Checkout routes (/api/token/checkout/*)
  router.use("/checkout", checkoutRouter)
  
  // Public orders routes (/api/token/orders-public/*, /api/token/customer-profile/*)
  router.use("/", publicOrdersRouter)
  
  // Cart routes (/api/token/cart/*)
  router.use("/cart", cartRouter)

  logger.info("✅ Token routes setup complete")
  return router
}
```

### 2. Route Registrate sotto `/api/token/*`

| Endpoint | Descrizione | Autenticazione |
|----------|-------------|----------------|
| `/api/token/registration/*` | Registrazione nuovi clienti | Token in URL |
| `/api/token/checkout/*` | Processo checkout | Token in URL |
| `/api/token/checkout/submit` | Submit ordine finale | Token in body |
| `/api/token/orders-public` | Lista ordini cliente | Token in URL |
| `/api/token/orders-public/:code` | Dettaglio ordine | Token in URL |
| `/api/token/customer-profile/*` | Profilo cliente pubblico | Token in URL |
| `/api/token/cart/:token` | GET carrello | Token in path |
| `/api/token/cart/:token/items` | POST aggiungi item | Token in path |
| `/api/token/cart/:token/items/:id` | PUT aggiorna quantità | Token in path |
| `/api/token/cart/:token/items/:id` | DELETE rimuovi item | Token in path |

### 3. Session Exempt Routes

**File**: `/backend/src/routes/index.ts`

```typescript
const SESSION_EXEMPT_ROUTES = [
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/register",
  "/health",
  "/session/validate",
  "/whatsapp/webhook",
  "/chat",
  "/cart-tokens",
  "/token/",  // ⭐ CRITICO: Esclude TUTTO sotto /api/token/*
]
```

**Middleware di validazione**:

```typescript
// Session validation middleware
app.use((req, res, next) => {
  const path = req.path

  // Skip sessionId check for exempt routes
  if (SESSION_EXEMPT_ROUTES.some(route => path.includes(route))) {
    logger.debug(`🔓 SessionID check SKIPPED for exempt route: ${path}`)
    return next()
  }

  // Check X-Session-Id header for all other routes
  const sessionId = req.headers["x-session-id"]
  if (!sessionId) {
    logger.warn(`❌ SessionID required for: ${path}`)
    return res.status(401).json({ error: "SessionID is required" })
  }

  next()
})
```

### 4. Cart Routes (Shopping Cart)

**IMPORTANTE**: Abbiamo usato `cartRouter` (operazioni carrello) NON `createCartTokenRouter()` (cart tokens support).

**File**: `/backend/src/interfaces/http/routes/cart.routes.ts`

Endpoints disponibili:
- `GET /:token` - Ottieni carrello
- `POST /:token/items` - Aggiungi prodotto/servizio
- `DELETE /:token/items/:productId` - Rimuovi item
- `PUT /:token/items/:productId` - Aggiorna quantità

---

## 💻 Architettura Frontend

### 1. Due Client HTTP Separati

#### **tokenApi** - Pagine Pubbliche

**File**: `/frontend/src/services/tokenApi.ts`

```typescript
import axios from "axios"

export const tokenApi = axios.create({
  baseURL: "/api/token",
  withCredentials: false,  // NO cookies
})

// NO sessionId interceptor!
```

**Uso**:
```typescript
// ✅ Corretto
const response = await tokenApi.get(`/cart/${token}`)
const response = await tokenApi.post(`/cart/${token}/items`, { productId, quantity })
const response = await tokenApi.put(`/cart/${token}/items/${itemId}`, { quantity })
const response = await tokenApi.delete(`/cart/${token}/items/${itemId}`)

// ❌ Sbagliato - NON usare fetch() direttamente
fetch(`/api/cart/${token}`) // Manca /token/ nel path!
```

#### **api** - Backoffice Admin

**File**: `/frontend/src/services/api.ts`

```typescript
import axios from "axios"

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
})

// Request interceptor: aggiungi X-Session-Id header
api.interceptors.request.use((config) => {
  const sessionId = localStorage.getItem("sessionId")
  if (sessionId) {
    config.headers["X-Session-Id"] = sessionId
  }
  return config
})
```

**Uso**:
```typescript
// ✅ Corretto per backoffice
const response = await api.get(`/workspaces/${workspaceId}/products`)
const response = await api.post(`/workspaces/${workspaceId}/orders`, orderData)
```

### 2. Pagine Token-Based

| Pagina | File | API Client | Token Source |
|--------|------|-----------|--------------|
| Checkout | `CheckoutPage.tsx` | `tokenApi` | URL query `?token=xxx` |
| Registrazione | `register.tsx` | `tokenApi` | URL query `?token=xxx` |
| Ordini Pubblici | `OrdersPublicPage.tsx` | `tokenApi` | URL query `?token=xxx` |
| Profilo Cliente | `CustomerProfilePublicPage.tsx` | `tokenApi` | URL query `?token=xxx` |

### 3. Hook Validazione Token

**File**: `/frontend/src/hooks/useTokenValidation.ts`

```typescript
export const useCheckoutTokenValidation = () => {
  // ... existing code
  
  const validateToken = async (tokenValue: string) => {
    try {
      const response = await tokenApi.get(`/checkout/token?token=${tokenValue}`)
      // ... handle response
    } catch (error) {
      // ... handle error
    }
  }
  
  return { tokenData, customer, isLoading, error }
}
```

---

## 🔄 Routing e Middleware

### Backend Route Flow

```
Incoming Request
    ↓
Session Validation Middleware
    ↓
    ├─ Path includes "/token/" → SKIP sessionId check ✅
    │   ↓
    │   Token Router (/api/token/*)
    │       ↓
    │       ├─ /registration/*
    │       ├─ /checkout/*
    │       ├─ /orders-public/*
    │       ├─ /customer-profile/*
    │       └─ /cart/*
    │
    └─ Other paths → CHECK X-Session-Id header ⚠️
        ↓
        Backoffice Routes
            ↓
            ├─ /workspaces/:id/*
            ├─ /products/*
            ├─ /orders/*
            └─ etc.
```

### Frontend Route Selection

```typescript
// Public pages (token-based)
if (isPublicPage) {
  import { tokenApi } from "../services/tokenApi"
  
  const token = new URLSearchParams(location.search).get("token")
  const response = await tokenApi.get(`/cart/${token}`)
}

// Backoffice pages (session-based)
if (isBackofficePage) {
  import { api } from "../services/api"
  
  // sessionId automatically added by interceptor
  const response = await api.get(`/workspaces/${workspaceId}/products`)
}
```

---

## ✅ Best Practices

### ✅ DO (Fare)

1. **Usa tokenApi per pagine pubbliche**
   ```typescript
   await tokenApi.get(`/cart/${token}`)
   ```

2. **Usa api per backoffice**
   ```typescript
   await api.get(`/workspaces/${workspaceId}/products`)
   ```

3. **Filtra SEMPRE per workspaceId nel database**
   ```typescript
   const products = await prisma.product.findMany({
     where: { workspaceId, ...otherFilters }
   })
   ```

4. **Monta route token sotto /api/token/***
   ```typescript
   router.use("/cart", cartRouter)  // Diventa /api/token/cart/*
   ```

5. **Aggiungi path a SESSION_EXEMPT_ROUTES se non usa sessionId**
   ```typescript
   const SESSION_EXEMPT_ROUTES = [
     "/token/",  // Esclude tutto /api/token/*
   ]
   ```

### ❌ DON'T (NON fare)

1. **NON usare fetch() diretto su endpoint token**
   ```typescript
   // ❌ Sbagliato
   fetch(`/api/cart/${token}`)  // Manca /token/ nel path!
   
   // ✅ Corretto
   tokenApi.get(`/cart/${token}`)  // baseURL già include /api/token
   ```

2. **NON mixare token e sessionId**
   ```typescript
   // ❌ Sbagliato
   tokenApi con header X-Session-Id
   api con token in URL
   ```

3. **NON hardcodare baseURL completo**
   ```typescript
   // ❌ Sbagliato
   fetch("http://localhost:3001/api/token/checkout/submit")
   
   // ✅ Corretto
   tokenApi.post("/checkout/submit", data)
   ```

4. **NON usare createCartTokenRouter() per cart operations**
   ```typescript
   // ❌ Sbagliato (solo validate token support)
   router.use("/cart", createCartTokenRouter())
   
   // ✅ Corretto (CRUD operations)
   router.use("/cart", cartRouter)
   ```

5. **NON dimenticare di riavviare backend dopo modifiche route**
   - `ts-node-dev` fa hot-reload automatico ✅
   - Verifica log per confermare: `✅ Registered /api/token/* routes`

---

## 🐛 Troubleshooting

### Problema: "SessionID is required"

**Sintomo**: Pagina pubblica richiede sessionId

**Causa**: Path non in SESSION_EXEMPT_ROUTES

**Soluzione**:
```typescript
// backend/src/routes/index.ts
const SESSION_EXEMPT_ROUTES = [
  "/token/",  // Assicurati che questo sia presente!
]
```

### Problema: 404 su endpoint token

**Sintomo**: `GET /api/token/cart/xxx → 404`

**Causa**: Route non montata o router sbagliato

**Soluzione**:
```typescript
// backend/src/routes/token/index.ts
router.use("/cart", cartRouter)  // Usa cartRouter NON createCartTokenRouter()
```

**Verifica log**:
```
✅ Registered /token/cart/* routes (shopping cart)
```

### Problema: Frontend chiama path sbagliato

**Sintomo**: `GET /api/cart/xxx` invece di `/api/token/cart/xxx`

**Causa**: Uso di `fetch()` invece di `tokenApi`

**Soluzione**:
```typescript
// ❌ Prima (sbagliato)
fetch(`/api/cart/${token}`)

// ✅ Dopo (corretto)
tokenApi.get(`/cart/${token}`)  // baseURL = "/api/token"
```

### Problema: Token non validato

**Sintomo**: Backend non riconosce token

**Causa**: Token middleware non applicato

**Soluzione**: Verifica che controller usi `SecureTokenService`:
```typescript
import { SecureTokenService } from "../../../services/secureToken.service"

const tokenService = new SecureTokenService()
const decoded = tokenService.validateToken(token)
```

---

## 📊 Tabella Riepilogativa

### Endpoint Mapping

| Frontend Call | Backend Route | Middleware | Auth Method |
|--------------|---------------|------------|-------------|
| `tokenApi.get('/cart/:token')` | `GET /api/token/cart/:token` | NESSUNO | Token in path |
| `tokenApi.post('/cart/:token/items')` | `POST /api/token/cart/:token/items` | NESSUNO | Token in path |
| `tokenApi.post('/checkout/submit')` | `POST /api/token/checkout/submit` | NESSUNO | Token in body |
| `api.get('/workspaces/:id/products')` | `GET /api/workspaces/:id/products` | sessionValidation | X-Session-Id header |
| `api.post('/workspaces/:id/orders')` | `POST /api/workspaces/:id/orders` | sessionValidation + workspace | X-Session-Id header |

### File Modificati (12 Ottobre 2025)

| File | Modifica | Motivo |
|------|----------|--------|
| `/backend/src/routes/token/index.ts` | Cambiato da `createCartTokenRouter()` a `cartRouter` | Usa cart CRUD operations, non support tokens |
| `/backend/src/routes/index.ts` | Aggiunto `"/token/"` a SESSION_EXEMPT_ROUTES | Esclude validazione sessionId |
| `/frontend/src/services/tokenApi.ts` | Creato nuovo file | Client HTTP per pagine pubbliche |
| `/frontend/src/pages/CheckoutPage.tsx` | Convertito da `fetch()` a `tokenApi` | Usa baseURL corretto `/api/token` |
| `/frontend/src/pages/CheckoutPage.tsx` | Rimossi tutti i `toast` messages | Richiesta Andrea |
| `/frontend/src/hooks/useTokenValidation.ts` | Cambiato da `api` a `tokenApi` | Valida token con endpoint corretto |
| `/backend/src/interfaces/http/routes/public-orders.routes.ts` | Aggiunti route aliases | Supporto `/orders-public` e `/public/orders` |

---

## 🎯 Checklist Sviluppo

Quando aggiungi nuova funzionalità:

### Token-Based (Pubblico)

- [ ] Crea route in `/backend/src/interfaces/http/routes/*.routes.ts`
- [ ] Monta route in `/backend/src/routes/token/index.ts`
- [ ] Verifica path sia sotto `/api/token/*`
- [ ] Usa `SecureTokenService` per validare token
- [ ] Frontend usa `tokenApi` NON `api`
- [ ] NON usa `X-Session-Id` header
- [ ] Testa con URL: `?token=xxx`

### Session-Based (Backoffice)

- [ ] Crea route normale (non sotto /token/)
- [ ] Applica `authMiddleware` + `workspaceValidationMiddleware`
- [ ] Filtra query database per `workspaceId`
- [ ] Frontend usa `api` NON `tokenApi`
- [ ] Usa `X-Session-Id` header (automatico)
- [ ] sessionId in `localStorage`

---

## 📝 Note Finali

### Storage Locations

| Dato | Storage | Chiave |
|------|---------|--------|
| sessionId | localStorage | `"sessionId"` |
| JWT token | localStorage | `"token"` |
| currentWorkspace | localStorage | `"currentWorkspace"` |
| Token pubblico | URL query param | `?token=xxx` |

### Porte e URL

| Servizio | Porta | URL |
|----------|-------|-----|
| Backend | 3001 | `http://localhost:3001` |
| Frontend | 3000 | `http://localhost:3000` |
| PostgreSQL | 5432 | `localhost:5432` |

### Comandi Utili

```bash
# Backend
cd backend && npm run dev           # Avvia backend (port 3001)
cd backend && npm run seed          # Seed database
cd backend && npx prisma migrate dev # Create migration

# Frontend  
cd frontend && npm run dev          # Avvia frontend (port 3000)

# Database
docker-compose up -d                # Avvia PostgreSQL
```

---

**Fine Documentazione** 🎉

*Ultima modifica: 12 Ottobre 2025*  
*Versione: 1.0*
