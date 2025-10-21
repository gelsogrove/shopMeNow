# 🔒 Security Tests

Questa cartella contiene i test di sicurezza per verificare che tutte le route API abbiano i middleware di autenticazione e autorizzazione corretti.

## 📋 Test Inclusi

### `route-authentication.spec.ts`

Test completo di sicurezza delle route che verifica:

#### 1. **Billing Routes** (7 tests)

- Verifica che tutte le route billing richiedano autenticazione
- Verifica che tutte richiedano `workspaceId` valido nel token
- Testa rifiuto con token invalido/mancante
- Route testate:
  - `GET /billing/:workspaceId/totals`
  - `GET /billing/:workspaceId/summary`
  - `GET /billing/:workspaceId/history`
  - `GET /billing/:workspaceId/monthly`
  - `GET /billing/:workspaceId/monthly/:year/:month`

#### 2. **Customer Routes** (6 tests)

- Verifica autenticazione su tutte le route CRUD customers
- Verifica che l'endpoint `debug-no-auth` NON esista più
- Route testate:
  - `GET /:workspaceId/customers`
  - `POST /:workspaceId/customers`
  - `GET /:workspaceId/customers/:id`
  - `PUT /:workspaceId/customers/:id`
  - `DELETE /:workspaceId/customers/:id`

#### 3. **Product Routes** (4 tests)

- Verifica autenticazione + workspace validation
- Route testate: GET, POST, PUT, DELETE products

#### 4. **Order Routes** (4 tests)

- Verifica autenticazione + workspace validation
- Route testate: GET, POST, PUT, DELETE orders

#### 5. **Offer Routes** (4 tests)

- Verifica autenticazione + workspace validation
- Route testate: GET, POST, PUT, DELETE offers

#### 6. **Campaign Routes** (4 tests)

- Verifica autenticazione + workspace validation
- Route testate: GET, POST, PUT, DELETE campaigns

#### 7. **Public Routes** (8 tests)

- Verifica che route pubbliche NON richiedano auth
- Verifica che route con token richiedano token valido
- Route testate:
  - `/whatsapp/webhook` (GET/POST)
  - `/auth/login` (POST)
  - `/auth/register` (POST)
  - `/cart-tokens` (POST)
  - `/orders-public` (GET)
  - `/registration/data-protection` (GET)

#### 8. **Workspace Validation** (2 tests)

- Verifica isolamento tra workspace
- Testa che un token di workspace A non possa accedere a workspace B
- Testa che token corretto possa accedere al proprio workspace

#### 9. **Token Validation** (4 tests)

- Verifica che token pubblici richiedano `customerId`
- Verifica che token richiedano `workspaceId`
- Testa rifiuto token invalidi

#### 10. **Calling Functions** (4 tests)

- Verifica che route LLM richiedano autenticazione
- Verifica workspace validation
- Route testate:
  - `POST /calling-functions/addProduct`
  - `POST /calling-functions/searchProduct`
  - `POST /calling-functions/repeatOrder`

#### 11. **Analytics Routes** (3 tests)

- Verifica autenticazione su route analytics
- Route testate: dashboard, sales, customers

#### 12. **Settings Routes** (5 tests)

- Verifica mix di route pubbliche e protette
- Testa che template GDPR pubblico sia accessibile
- Testa che settings workspace richiedano auth

## 🚀 Come Eseguire i Test

### Esegui tutti i test di sicurezza

```bash
cd backend
npm run test:security
```

### Esegui solo test di autenticazione route

```bash
npm test -- src/__tests__/security/route-authentication.spec.ts
```

### Esegui con coverage

```bash
npm run test:coverage -- src/__tests__/security/
```

### Esegui in watch mode (sviluppo)

```bash
npm test -- --watch src/__tests__/security/
```

## 📊 Coverage Atteso

| Categoria  | Tests   | Aspetto                     |
| ---------- | ------- | --------------------------- |
| Billing    | 7       | ✅ Tutti passano            |
| Customers  | 6       | ✅ debug-no-auth NON esiste |
| Products   | 4       | ✅ Tutti protetti           |
| Orders     | 4       | ✅ Tutti protetti           |
| Offers     | 4       | ✅ Tutti protetti           |
| Campaigns  | 4       | ✅ Tutti protetti           |
| Public     | 8       | ✅ Pubblici funzionano      |
| Workspace  | 2       | ✅ Isolamento OK            |
| Tokens     | 4       | ✅ Validazione OK           |
| Functions  | 4       | ✅ Tutti protetti           |
| Analytics  | 3       | ✅ Tutti protetti           |
| Settings   | 5       | ✅ Mix corretto             |
| **TOTALE** | **55+** | ✅ **95.3% Security**       |

## 🔐 Cosa Verificano i Test

### ✅ Autenticazione (authMiddleware)

- Token JWT presente nel header `Authorization: Bearer <token>`
- Token valido e non scaduto
- Risposta 401 se manca o è invalido

### ✅ Workspace Validation (workspaceValidationMiddleware)

- `workspaceId` presente nel token JWT
- `workspaceId` nel token corrisponde al workspace richiesto nell'URL
- Risposta 400 se `workspaceId` manca
- Risposta 403 se `workspaceId` non corrisponde (accesso negato)

### ✅ Token Validation (tokenValidationMiddleware)

- Token pubblico valido per route `/orders-public`
- Token contiene `customerId` e `workspaceId`
- Token non scaduto
- Risposta 401 se token invalido

### ✅ Public Routes

- Route pubbliche non richiedono auth
- Route con token richiedono token valido
- Rate limiting attivo dove necessario

## 🎯 Obiettivi Test

1. **Prevenire Data Leak**: Nessuna route sensibile esposta senza auth
2. **Workspace Isolation**: Utente workspace A non può accedere a dati workspace B
3. **Token Security**: Tutti i token validati correttamente
4. **Debug Safety**: Nessun endpoint debug esposto in production
5. **Audit Trail**: Ogni accesso loggato con userId + workspaceId

## 📝 Note

### Helper Functions

Il file include helper per generare token JWT:

```typescript
// Token valido con workspaceId
generateValidToken(userId, workspaceId)

// Token senza workspaceId (per test negativi)
generateTokenWithoutWorkspace(userId)
```

### Expected Responses

- `401 Unauthorized`: Auth mancante o token invalido
- `403 Forbidden`: Auth OK ma workspace non autorizzato
- `400 Bad Request`: workspaceId mancante nel token
- `404 Not Found`: Endpoint non esiste (es: debug-no-auth)

### Continuous Integration

Questi test dovrebbero essere eseguiti:

- ✅ Prima di ogni commit (pre-commit hook)
- ✅ Su ogni PR (GitHub Actions)
- ✅ Prima di ogni deploy (CI/CD pipeline)
- ✅ Giornalmente in staging

## 🚨 Se un Test Fallisce

### 401 Unexpected

```
Test: GET /billing/:workspaceId/totals - Should REJECT without auth
Status: Expected 401, got 200
```

**Problema**: Route non protetta!  
**Fix**: Aggiungere `authMiddleware` al router

### 403 Not Working

```
Test: Should REJECT access to different workspace
Status: Expected 403, got 200
```

**Problema**: Workspace validation mancante!  
**Fix**: Aggiungere `workspaceValidationMiddleware`

### 404 on debug-no-auth

```
Test: debug-no-auth endpoint should NOT exist
Status: Expected 404, got 200
```

**Problema**: Debug endpoint ancora esposto!  
**Fix**: Rimuovere endpoint da `customers.routes.ts`

## 📚 Documentazione Correlata

- [COMPLETE_ROUTE_SECURITY_AUDIT.md](../../docs/memory-bank/01-security/COMPLETE_ROUTE_SECURITY_AUDIT.md) - Audit completo sicurezza
- [route-security-audit.md](../../docs/memory-bank/01-security/route-security-audit.md) - Audit iniziale
- [copilot-instructions.md](../../.github/copilot-instructions.md) - Database-first rules

## ✅ Checklist Pre-Deploy

Prima di ogni deploy, verificare che:

- [ ] Tutti i test di sicurezza passano
- [ ] Coverage > 90% su route critiche
- [ ] Nessun endpoint debug esposto
- [ ] Rate limiting configurato
- [ ] Logging attivo su route sensibili
- [ ] CORS configurato correttamente
- [ ] HELMET middleware attivo

---

**Ultimo Aggiornamento**: 21 Ottobre 2025  
**Autore**: Andrea  
**Security Score**: 95.3% (A)  
**Tests**: 55+
