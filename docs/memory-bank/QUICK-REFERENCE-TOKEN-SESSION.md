# 🚀 Quick Reference - Token vs SessionID

**Data**: 12 Ottobre 2025

---

## 🎯 Regola d'Oro

> **Token si usa SOLO per API di token folder (`/api/token/*`)**  
> **SessionID per tutto il resto (backoffice)**

---

## 📋 Frontend: Quale Client Usare?

```typescript
// ✅ Pagine PUBBLICHE (checkout, registrazione, ordini pubblici)
import { tokenApi } from "../services/tokenApi"
await tokenApi.get(`/cart/${token}`)

// ✅ Pagine BACKOFFICE (admin, prodotti, ordini)
import { api } from "../services/api"
await api.get(`/workspaces/${workspaceId}/products`)
```

---

## 🏗️ Backend: Dove Monto le Route?

```typescript
// ✅ Route PUBBLICHE con token
// File: /backend/src/routes/token/index.ts
router.use("/cart", cartRouter) // Diventa /api/token/cart/*

// ✅ Route BACKOFFICE con sessionId
// File: /backend/src/routes/index.ts
router.use("/workspaces", workspaceRouter) // Diventa /api/workspaces/*
```

---

## 🔒 Backend: Devo Escludere da SessionID Check?

```typescript
// File: /backend/src/routes/index.ts
const SESSION_EXEMPT_ROUTES = [
  "/token/", // ⭐ Esclude TUTTO /api/token/*
]
```

---

## ⚠️ Errori Comuni

### ❌ Frontend chiama path sbagliato

```typescript
// ❌ SBAGLIATO
fetch(`/api/cart/${token}`) // Manca /token/ nel path!

// ✅ CORRETTO
tokenApi.get(`/cart/${token}`) // baseURL già include /api/token
```

### ❌ Backend usa router sbagliato

```typescript
// ❌ SBAGLIATO (solo validate, non CRUD)
router.use("/cart", createCartTokenRouter())

// ✅ CORRETTO (ha GET, POST, PUT, DELETE)
router.use("/cart", cartRouter)
```

### ❌ Mixare autenticazioni

```typescript
// ❌ SBAGLIATO
tokenApi con header X-Session-Id  // NO!
api con token in URL              // NO!

// ✅ CORRETTO
tokenApi → solo token in path/query/body
api → solo X-Session-Id header
```

---

## 📊 Tabella Endpoint

| Frontend                              | Backend                            | Auth          |
| ------------------------------------- | ---------------------------------- | ------------- |
| `tokenApi.get('/cart/:token')`        | `GET /api/token/cart/:token`       | Token in path |
| `tokenApi.post('/checkout/submit')`   | `POST /api/token/checkout/submit`  | Token in body |
| `api.get('/workspaces/:id/products')` | `GET /api/workspaces/:id/products` | X-Session-Id  |

---

## 🔍 Debug Checklist

Route token non funziona?

1. [ ] Route montata in `/backend/src/routes/token/index.ts`?
2. [ ] Path include `"/token/"` in SESSION_EXEMPT_ROUTES?
3. [ ] Frontend usa `tokenApi` NON `api`?
4. [ ] Backend log mostra: `✅ Registered /token/cart/* routes`?
5. [ ] Token in URL query, path o body (NON header)?

Route backoffice non funziona?

1. [ ] Frontend usa `api` NON `tokenApi`?
2. [ ] sessionId in localStorage (`"sessionId"`)?
3. [ ] Route applica `authMiddleware` + `workspaceValidationMiddleware`?
4. [ ] Query filtra per `workspaceId`?
5. [ ] Path NON in SESSION_EXEMPT_ROUTES?

---

## 💾 Storage

| Dato           | Dove         | Chiave        |
| -------------- | ------------ | ------------- |
| sessionId      | localStorage | `"sessionId"` |
| JWT admin      | localStorage | `"token"`     |
| Token pubblico | URL          | `?token=xxx`  |

---

**Fine Quick Reference** ⚡

_Per dettagli completi vedi: `TOKEN-VS-SESSIONID-ARCHITECTURE.md`_
