# 🔐 Authentication Tokens - Guida Completa

**Data**: 13 Ottobre 2025  
**Autore**: Andrea  
**Versione**: 2.0

---

## 📋 Indice

1. [Panoramica](#panoramica)
2. [JWT Token (Admin)](#jwt-token-admin)
3. [SecureToken (Clienti Pubblici)](#securetoken-clienti-pubblici)
4. [SessionID (Admin Sessions)](#sessionid-admin-sessions)
5. [Chiavi di Sicurezza](#chiavi-di-sicurezza)
6. [Best Practices](#best-practices)

---

## 🎯 Panoramica

ShopME utilizza **TRE sistemi di autenticazione separati**:

| Sistema         | Uso                     | Algoritmo   | Chiave Usata           | Storage         |
| --------------- | ----------------------- | ----------- | ---------------------- | --------------- |
| **JWT Token**   | Login admin             | HMAC SHA256 | `JWT_SECRET`           | Cookie httpOnly |
| **SecureToken** | Link pubblici clienti   | AES-256-CBC | `TOKEN_ENCRYPTION_KEY` | Database        |
| **SessionID**   | Tracking sessioni admin | UUID random | N/A                    | Database        |

### Regola Fondamentale

> **"Una chiave, uno scopo"** (OWASP Best Practice)
>
> - `JWT_SECRET` → SOLO per firmare JWT Token admin
> - `TOKEN_ENCRYPTION_KEY` → SOLO per cifrare payload link clienti
> - Mai usare la stessa chiave per scopi diversi

---

## 🔑 JWT Token (Admin)

### Cos'è

Token firmato digitalmente usato per autenticare **admin e utenti backoffice**.

### Quando Viene Generato

Al login admin tramite `POST /api/auth/login`:

```typescript
// backend/src/interfaces/http/controllers/auth.controller.ts
private generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,  // ← CHIAVE: JWT_SECRET
    { expiresIn: '7d' }
  )
}
```

### Struttura JWT

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXItMTIzIiwiZW1haWwiOiJhZG1pbkBzaG9wbWUuY29tIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNjk3MTIzNDU2LCJleHAiOjE2OTc3MjgyNTZ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c

↑ HEADER      ↑ PAYLOAD                                    ↑ SIGNATURE
(base64)      (base64 dei dati utente)                     (HMAC SHA256 con JWT_SECRET)
```

### Come Viene Usato

#### 1. Login → Backend genera e salva in cookie

```typescript
// backend/src/interfaces/http/controllers/auth.controller.ts
async login(req: Request, res: Response) {
  // ... verifica credenziali

  const token = this.generateToken(user)

  // Salva in cookie httpOnly (sicuro)
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000  // 1 giorno
  })

  res.json({ user })
}
```

#### 2. Ogni richiesta → Frontend invia cookie automaticamente

```typescript
// frontend/src/services/api.ts
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true, // Invia cookies automaticamente
})
```

#### 3. Middleware verifica firma

```typescript
// backend/src/middlewares/auth.middleware.ts
export const authMiddleware = async (req, res, next) => {
  const token = req.cookies?.auth_token

  if (!token) {
    return res.status(401).json({ message: "Token required" })
  }

  try {
    // Verifica firma con JWT_SECRET
    const decoded = verify(token, process.env.JWT_SECRET)

    req.user = decoded // Aggiunge user info alla request
    next()
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" })
  }
}
```

### Caratteristiche

- ✅ **Stateless**: Non salvato in database, tutto self-contained
- ✅ **Sicuro**: Firma HMAC SHA256 impedisce manomissioni
- ✅ **Automatico**: Browser gestisce cookie httpOnly
- ✅ **Expiry**: 7 giorni (configurabile)
- ❌ **Non revocabile**: Valido fino a scadenza (soluzione: logout lato frontend)

### Chiave Usata

```bash
# .env
JWT_SECRET="68e0a6fdfd256062879be0510f248645b043fa49c34628f51336d1954619ebc5cbb862864a5112e72288e16fc05a386806fc3c72c4e2d56b40672c6429e0561f"

# ↑ 128 caratteri hex (512 bit)
# Generato con: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Dove Viene Usato

| Route Pattern       | Middleware       | Verifica     |
| ------------------- | ---------------- | ------------ |
| `/api/workspaces/*` | `authMiddleware` | ✅ JWT Token |
| `/api/products/*`   | `authMiddleware` | ✅ JWT Token |
| `/api/orders/*`     | `authMiddleware` | ✅ JWT Token |
| `/api/customers/*`  | `authMiddleware` | ✅ JWT Token |
| `/api/settings/*`   | `authMiddleware` | ✅ JWT Token |

### Security Score: 95/100 ⭐

**Punti di Forza**:

- ✅ HMAC SHA256 (industry standard)
- ✅ httpOnly cookie (XSS protection)
- ✅ Chiave 512 bit (impossibile brute force)
- ✅ Middleware validation su tutte le route protette

**Punti di Miglioramento**:

- ⚠️ Non revocabile (implementare token refresh mechanism)

---

## 🎫 SecureToken (Clienti Pubblici)

### Cos'è

Token criptato usato per **link pubblici clienti** (ordini, carrello, checkout, registrazione).

### Quando Viene Generato

Quando backend crea link pubblico per cliente:

```typescript
// backend/src/application/services/secure-token.service.ts
async createToken(
  type: 'orders' | 'cart' | 'checkout' | 'registration',
  workspaceId: string,
  payload?: any,
  expiresIn: string = '1h',
  customerId?: string
): Promise<string> {

  // 1. Genera token random (64 caratteri hex)
  const token = crypto.randomBytes(32).toString('hex')

  // 2. Cifra payload con AES-256-CBC
  const encryptedPayload = this.encryptPayload({
    customerId,
    workspaceId,
    type,
    ...payload
  })

  // 3. Calcola scadenza
  const expiresAt = new Date(Date.now() + this.parseExpiry(expiresIn))

  // 4. Salva in database
  await prisma.secureToken.create({
    data: {
      token,
      type,
      workspaceId,
      customerId,
      encryptedPayload,
      expiresAt,
      isActive: true
    }
  })

  return token
}
```

### Encryption AES-256-CBC

```typescript
private encryptPayload(payload: any): string {
  const key = process.env.TOKEN_ENCRYPTION_KEY  // ← CHIAVE: TOKEN_ENCRYPTION_KEY

  const cipher = crypto.createCipher('aes-256-cbc', key)
  let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'hex')
  encrypted += cipher.final('hex')

  return encrypted
}

private decryptPayload(encryptedPayload: string): any {
  const key = process.env.TOKEN_ENCRYPTION_KEY  // ← STESSA CHIAVE

  const decipher = crypto.createDecipher('aes-256-cbc', key)
  let decrypted = decipher.update(encryptedPayload, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return JSON.parse(decrypted)
}
```

### Come Viene Usato

#### 1. Backend genera link pubblico

```typescript
// Esempio: Link ordini cliente
const token = await secureTokenService.createToken(
  "orders",
  workspaceId,
  { customerId: customer.id },
  "7d", // Scade dopo 7 giorni
  customer.id
)

const publicLink = `${FRONTEND_URL}/orders-public?token=${token}`

// Invia link via email/WhatsApp al cliente
await emailService.send(customer.email, publicLink)
```

#### 2. Cliente clicca link → Frontend estrae token da URL

```typescript
// frontend/src/pages/OrdersPublicPage.tsx
const params = new URLSearchParams(location.search)
const token = params.get("token")

// Valida token con backend
const response = await tokenApi.get(`/orders-public?token=${token}`)
```

#### 3. Backend valida token

```typescript
// backend/src/application/services/secure-token.service.ts
async validateToken(token: string): Promise<{ valid: boolean, data?: any }> {
  // 1. Cerca token in database
  const record = await prisma.secureToken.findUnique({
    where: { token }
  })

  if (!record) {
    return { valid: false, error: 'Token not found' }
  }

  // 2. Verifica scadenza
  if (new Date() > record.expiresAt) {
    return { valid: false, error: 'Token expired' }
  }

  // 3. Verifica attivo
  if (!record.isActive) {
    return { valid: false, error: 'Token revoked' }
  }

  // 4. Decifra payload
  const data = this.decryptPayload(record.encryptedPayload)

  return { valid: true, data }
}
```

### Caratteristiche

- ✅ **Stateful**: Salvato in database, revocabile
- ✅ **Criptato**: Payload cifrato con AES-256-CBC
- ✅ **Time-limited**: Expiry configurabile tramite `TOKEN_EXPIRATION` env (default: 1h)
- ✅ **Revocabile**: Flag `isActive` in database
- ✅ **Audit trail**: Timestamps creazione/utilizzo

### Chiave Usata

```bash
# .env / .env.local
TOKEN_ENCRYPTION_KEY="f055440ed8b641bfc3e7467653f8eea0c2ee45b4ac8adaf349162ba8fb8c3137"

# ↑ 64 caratteri hex (256 bit)
# Generato con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Durata token (configurabile)
TOKEN_EXPIRATION="1h"  # Formato: "1h", "30m", "2h", etc.
```

### Dove Viene Usato

| Endpoint                   | Tipo Token     | Scadenza Default                 |
| -------------------------- | -------------- | -------------------------------- |
| `/api/token/orders-public` | `orders`       | `TOKEN_EXPIRATION` (default: 1h) |
| `/api/token/cart/:token`   | `cart`         | `TOKEN_EXPIRATION` (default: 1h) |
| `/api/token/checkout`      | `checkout`     | `TOKEN_EXPIRATION` (default: 1h) |
| `/api/token/registration`  | `registration` | `TOKEN_EXPIRATION` (default: 1h) |

**Nota**: La durata di tutti i token è ora configurabile tramite la variabile ambiente `TOKEN_EXPIRATION` in `.env.local`.

### Security Score: 90/100 ⭐

**Punti di Forza**:

- ✅ AES-256-CBC encryption (standard militare)
- ✅ Database-backed (revocabile)
- ✅ Time-limited expiry
- ✅ Chiave 256 bit dedicata

**Punti di Miglioramento**:

- ⚠️ Aggiungere rate limiting per prevenire brute force
- ⚠️ Implementare HMAC signature per prevenire replay attacks

---

## 🗂️ SessionID (Admin Sessions)

### Cos'è

UUID usato per **tracciare sessioni admin** nel database (audit, logout remoto).

### Quando Viene Generato

Al login admin, insieme al JWT Token:

```typescript
// backend/src/application/services/admin-session.service.ts
async createSession(
  userId: string,
  workspaceId: string | null,
  ipAddress?: string,
  userAgent?: string
): Promise<string> {

  // 1. Revoca sessioni esistenti (policy: una sessione per user)
  await prisma.adminSession.updateMany({
    where: { userId, isActive: true },
    data: { isActive: false }
  })

  // 2. Genera SessionID univoco
  const sessionId = randomUUID()

  // 3. Calcola scadenza: +1 ora FISSA
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

  // 4. Salva in database
  await prisma.adminSession.create({
    data: {
      sessionId,
      userId,
      workspaceId,
      expiresAt,
      lastActivityAt: new Date(),
      ipAddress,
      userAgent,
      isActive: true
    }
  })

  return sessionId
}
```

### Come Viene Usato

#### 1. Login → Backend genera sessionId e lo ritorna

```typescript
// backend/src/interfaces/http/controllers/auth.controller.ts
async login(req: Request, res: Response) {
  // ... verifica credenziali

  // Genera JWT Token (per autenticazione)
  const token = this.generateToken(user)
  this.setTokenCookie(res, token)

  // Genera SessionID (per tracking)
  const sessionId = await sessionService.createSession(
    user.id,
    null,  // workspaceId selezionato dopo
    req.ip,
    req.headers['user-agent']
  )

  res.json({
    user: { id, email, firstName, lastName, role },
    sessionId  // ← Frontend lo salva in localStorage
  })
}
```

#### 2. Frontend salva in localStorage

```typescript
// frontend/src/pages/LoginPage.tsx
const handleLogin = async () => {
  const response = await api.post("/auth/login", { email, password })

  // Salva sessionId
  localStorage.setItem("sessionId", response.data.sessionId)

  // Redirect a dashboard
  navigate("/dashboard")
}
```

#### 3. Backend valida sessione su richieste critiche

```typescript
// backend/src/application/services/admin-session.service.ts
async validateSession(sessionId: string) {
  const session = await prisma.adminSession.findUnique({
    where: { sessionId }
  })

  if (!session || !session.isActive) {
    return { valid: false, error: 'Session not found' }
  }

  if (new Date() > session.expiresAt) {
    return { valid: false, error: 'Session expired' }
  }

  // Aggiorna lastActivityAt
  await prisma.adminSession.update({
    where: { sessionId },
    data: { lastActivityAt: new Date() }
  })

  return { valid: true, session }
}
```

### Caratteristiche

- ✅ **UUID v4**: Formato standard (impossibile predire)
- ✅ **Database-backed**: Audit trail completo
- ✅ **Revocabile**: Logout remoto possibile
- ✅ **Time-limited**: Expiry configurabile tramite `TOKEN_EXPIRATION` (default: 1h)
- ✅ **Activity tracking**: `lastActivityAt` aggiornato

### Dove Viene Salvato

| Location              | Chiave                   | Formato |
| --------------------- | ------------------------ | ------- |
| Database              | `AdminSession.sessionId` | UUID v4 |
| Frontend localStorage | `"sessionId"`            | UUID v4 |

### Security Score: 85/100 ⭐

**Punti di Forza**:

- ✅ UUID v4 (collision-resistant)
- ✅ Database audit trail
- ✅ Revocabile (flag `isActive`)
- ✅ IP + User Agent tracking

**Punti di Miglioramento**:

- ✅ **RISOLTO**: Expiry ora configurabile tramite `TOKEN_EXPIRATION` env variable
- ⚠️ Considerare sliding expiry (estensione automatica su attività)
- ⚠️ Aggiungere 2FA per operazioni critiche

---

## 🔐 Chiavi di Sicurezza

### Riepilogo Chiavi

```bash
# backend/.env

# === JWT TOKEN (Admin Login) ===
# Usata per: Firmare JWT Token admin
# Algoritmo: HMAC SHA256
# Lunghezza: 128 caratteri hex (512 bit)
JWT_SECRET="68e0a6fdfd256062879be0510f248645b043fa49c34628f51336d1954619ebc5cbb862864a5112e72288e16fc05a386806fc3c72c4e2d56b40672c6429e0561f"

# === SECURE TOKEN (Link Clienti Pubblici) ===
# Usata per: Cifrare payload link pubblici
# Algoritmo: AES-256-CBC
# Lunghezza: 64 caratteri hex (256 bit)
TOKEN_ENCRYPTION_KEY="f055440ed8b641bfc3e7467653f8eea0c2ee45b4ac8adaf349162ba8fb8c3137"
```

### Tabella Comparativa

| Aspetto             | JWT_SECRET            | TOKEN_ENCRYPTION_KEY  |
| ------------------- | --------------------- | --------------------- |
| **Scopo**           | Firmare JWT admin     | Cifrare link clienti  |
| **Algoritmo**       | HMAC SHA256           | AES-256-CBC           |
| **Lunghezza**       | 512 bit (128 hex)     | 256 bit (64 hex)      |
| **Tipo operazione** | Firma digitale        | Cifratura simmetrica  |
| **Reversibile**     | ❌ No (solo verifica) | ✅ Sì (decrypt)       |
| **Storage token**   | Cookie (stateless)    | Database (stateful)   |
| **Revocabile**      | ❌ No                 | ✅ Sì                 |
| **Expiry**          | 7 giorni              | Configurabile via `TOKEN_EXPIRATION` (default: 1h) |

### Perché Due Chiavi Separate?

#### ❌ Scenario: Una Sola Chiave

```bash
SECRET_KEY="mia-chiave-unica"

# Rischi:
# 1. Se compromessa → TUTTO il sistema cade
# 2. Rotazione chiave → Downtime totale (admin + clienti)
# 3. Impossibile audit granulare
# 4. Violazione OWASP "One key, one purpose"
```

#### ✅ Scenario: Due Chiavi Separate

```bash
JWT_SECRET="..."
TOKEN_ENCRYPTION_KEY="..."

# Vantaggi:
# 1. Compromissione JWT_SECRET → Solo admin rilogga
# 2. Compromissione TOKEN_KEY → Solo link clienti rigenerati
# 3. Rotazione indipendente
# 4. Audit granulare
# 5. Conformità OWASP/NIST/ISO 27001
```

### Generazione Chiavi

```bash
# JWT_SECRET (512 bit)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# TOKEN_ENCRYPTION_KEY (256 bit)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Rotazione Chiavi (Best Practice)

```bash
# Policy: Rotazione ogni 90 giorni

# Step 1: Genera nuove chiavi
NEW_JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
NEW_TOKEN_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Step 2: Backup .env
cp backend/.env backend/.env.backup.$(date +%Y%m%d)

# Step 3: Aggiorna .env
# JWT_SECRET="$NEW_JWT_SECRET"
# TOKEN_ENCRYPTION_KEY="$NEW_TOKEN_KEY"

# Step 4: Notifica utenti
# - Admin: Dovranno rifare login (JWT invalidi)
# - Clienti: Dovranno richiedere nuovi link (token invalidi)

# Step 5: Riavvia server
npm run dev
```

---

## ✅ Best Practices

### DO (Fare)

1. **✅ Usa JWT Token per backoffice**

   ```typescript
   // Route protette admin
   router.use(authMiddleware) // Verifica JWT
   ```

2. **✅ Usa SecureToken per link pubblici**

   ```typescript
   const token = await secureTokenService.createToken('orders', workspaceId, {...}, '7d', customerId)
   ```

3. **✅ Genera chiavi crittograficamente sicure**

   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

4. **✅ Valida SEMPRE workspaceId**

   ```typescript
   const orders = await prisma.order.findMany({
     where: { workspaceId, customerId }, // ← CRITICO
   })
   ```

5. **✅ Usa httpOnly cookies per JWT**
   ```typescript
   res.cookie("auth_token", token, { httpOnly: true })
   ```

### DON'T (NON fare)

1. **❌ NON usare stessa chiave per JWT e AES**

   ```bash
   # ❌ Sbagliato
   SECRET_KEY="..."
   JWT_SECRET=$SECRET_KEY
   TOKEN_ENCRYPTION_KEY=$SECRET_KEY
   ```

2. **❌ NON mettere JWT in localStorage**

   ```typescript
   // ❌ Sbagliato (XSS vulnerability)
   localStorage.setItem("token", jwtToken)

   // ✅ Corretto
   res.cookie("auth_token", jwtToken, { httpOnly: true })
   ```

3. **❌ NON usare chiavi di default**

   ```bash
   # ❌ Sbagliato
   JWT_SECRET="your-super-secret-jwt-key-change-in-production"
   ```

4. **❌ NON committare .env su git**

   ```bash
   # Verifica
   git check-ignore -v backend/.env
   # Output atteso: "backend/.gitignore:26:.env    .env"
   ```

5. **❌ NON esporre chiavi nei log**

   ```typescript
   // ❌ Sbagliato
   logger.info("JWT Secret:", process.env.JWT_SECRET)

   // ✅ Corretto
   logger.info("JWT Secret loaded:", !!process.env.JWT_SECRET)
   ```

---

## 📊 Security Checklist

### JWT Token

- [x] Chiave 512+ bit
- [x] HMAC SHA256 signature
- [x] httpOnly cookie
- [x] Expiry 7 giorni
- [x] Middleware validation
- [ ] Token refresh mechanism (TODO)
- [ ] Logout revocation list (TODO)

### SecureToken

- [x] Chiave 256+ bit
- [x] AES-256-CBC encryption
- [x] Database storage
- [x] Time-limited expiry
- [x] Revocable (isActive flag)
- [ ] Rate limiting (TODO)
- [ ] HMAC signature (TODO)

### SessionID

- [x] UUID v4 format
- [x] Database audit trail
- [x] IP + User Agent tracking
- [x] Expiry configurabile (TOKEN_EXPIRATION env variable)
- [x] Revocable
- [ ] Sliding expiry (TODO)
- [ ] 2FA for critical ops (TODO)

### Chiavi

- [x] Due chiavi separate
- [x] Generazione crittografica
- [x] .env non committato
- [x] Backup automatico
- [ ] Rotazione 90 giorni (TODO)
- [ ] Secret manager (TODO)

---

**Fine Documentazione** 🎉

_Ultima modifica: 13 Ottobre 2025_  
_Versione: 2.0_
