# 🔐 SessionID Admin Panel - Sistema di Gestione Sessioni

## 📋 Panoramica

**Requisito Andrea**: Implementare un sistema di **SessionID separato dal JWT** per tracciare le sessioni attive degli utenti admin panel con:

- SessionID generato al login
- Salvato in localStorage (non nella URL)
- Passato in TUTTI gli endpoints (esclusi: login, forgotPassword, health)
- Durata: 1 ora
- Gestione sovrascrittura al nuovo login
- Validazione backend con middleware

**Differenza JWT vs SessionID**:

- **JWT Token**: Autenticazione utente (chi sei), validità 24h, HTTP-only cookie
- **SessionID**: Tracciamento sessione admin (sessione attiva), validità 1h, localStorage + header

---

## 🏗️ Architettura Proposta

### 1. Database Schema

```prisma
model AdminSession {
  id            String    @id @default(cuid())
  sessionId     String    @unique @db.VarChar(64)  // UUID generato al login
  userId        String                              // User che ha fatto login
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspaceId   String?                             // Workspace selezionato (optional)
  workspace     Workspace? @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  // Gestione scadenza e attività
  createdAt     DateTime  @default(now())           // Creazione sessione
  expiresAt     DateTime                            // Scadenza (createdAt + 1h)
  lastActivityAt DateTime @default(now())           // Ultimo accesso API

  // Metadata utili
  ipAddress     String?   @db.VarChar(45)           // IP login
  userAgent     String?   @db.Text                  // Browser/device info
  isActive      Boolean   @default(true)            // Flag attiva/revocata

  @@index([sessionId])
  @@index([userId])
  @@index([expiresAt])
  @@index([isActive])
  @@map("admin_sessions")
}
```

**Relazioni**:

- `User.adminSessions` (one-to-many): Un utente può avere UNA sola sessione attiva alla volta
- `Workspace.adminSessions` (one-to-many): Workspace selezionato nella sessione

**Policy**:

- **UNA sessione attiva per user**: Al nuovo login, la vecchia sessione viene disattivata/eliminata
- **NO storico sessioni**: Solo tracking sessione corrente
- **Auto-cleanup**: Sessioni scadute (expiresAt < now()) vengono eliminate periodicamente

---

### 2. Backend - Generazione SessionID

#### File: `backend/src/application/services/admin-session.service.ts`

```typescript
import { PrismaClient } from "@prisma/client"
import { randomUUID } from "crypto"
import logger from "../../utils/logger"

const prisma = new PrismaClient()

export class AdminSessionService {
  /**
   * Crea una nuova sessione admin al login
   * POLICY: Una sola sessione attiva per user, la vecchia viene revocata
   */
  async createSession(
    userId: string,
    workspaceId: string | null,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    try {
      // 1. Revoca tutte le sessioni esistenti per questo user
      await prisma.adminSession.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      })

      // 2. Genera nuovo sessionId univoco
      const sessionId = randomUUID()

      // 3. Calcola scadenza: +1 ora
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000) // +1h

      // 4. Crea nuova sessione
      await prisma.adminSession.create({
        data: {
          sessionId,
          userId,
          workspaceId,
          expiresAt,
          lastActivityAt: now,
          ipAddress,
          userAgent,
          isActive: true,
        },
      })

      logger.info(
        `🔐 Admin session created for user ${userId}: ${sessionId.substring(
          0,
          8
        )}...`
      )

      return sessionId
    } catch (error) {
      logger.error("❌ Error creating admin session:", error)
      throw new Error("Failed to create session")
    }
  }

  /**
   * Valida una sessione esistente
   * @returns { valid: boolean, session?: AdminSession }
   */
  async validateSession(sessionId: string): Promise<{
    valid: boolean
    session?: any
    error?: string
  }> {
    try {
      const session = await prisma.adminSession.findUnique({
        where: { sessionId },
        include: {
          user: { select: { id: true, email: true, role: true } },
        },
      })

      // 1. Sessione non trovata
      if (!session) {
        return { valid: false, error: "Session not found" }
      }

      // 2. Sessione disattivata
      if (!session.isActive) {
        return { valid: false, error: "Session revoked" }
      }

      // 3. Sessione scaduta (>1h)
      if (session.expiresAt < new Date()) {
        // Auto-revoca sessione scaduta
        await prisma.adminSession.update({
          where: { id: session.id },
          data: { isActive: false },
        })
        return { valid: false, error: "Session expired" }
      }

      // 4. Sessione valida → Aggiorna lastActivityAt
      await prisma.adminSession.update({
        where: { id: session.id },
        data: { lastActivityAt: new Date() },
      })

      return { valid: true, session }
    } catch (error) {
      logger.error("❌ Error validating session:", error)
      return { valid: false, error: "Validation error" }
    }
  }

  /**
   * Revoca una sessione (logout)
   */
  async revokeSession(sessionId: string): Promise<void> {
    await prisma.adminSession.updateMany({
      where: { sessionId },
      data: { isActive: false },
    })
    logger.info(`🔒 Session revoked: ${sessionId.substring(0, 8)}...`)
  }

  /**
   * Cleanup automatico sessioni scadute
   * Chiamato da scheduler (ogni 1h)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await prisma.adminSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } }, // Scadute
          { isActive: false }, // Revocate
        ],
      },
    })

    if (result.count > 0) {
      logger.info(`🧹 Cleaned up ${result.count} expired/revoked sessions`)
    }

    return result.count
  }
}

export const adminSessionService = new AdminSessionService()
```

---

### 3. Backend - Middleware Validazione

#### File: `backend/src/interfaces/http/middlewares/session-validation.middleware.ts`

```typescript
import { NextFunction, Request, Response } from "express"
import { adminSessionService } from "../../../application/services/admin-session.service"
import logger from "../../../utils/logger"

/**
 * Middleware di validazione SessionID
 *
 * POLICY:
 * - Estrae sessionId da header 'X-Session-Id'
 * - Verifica esistenza e validità (non scaduto, isActive)
 * - Aggiorna lastActivityAt automaticamente
 * - Allega session a req.session
 *
 * ECCEZIONI (non applicare middleware):
 * - /api/auth/login
 * - /api/auth/forgot-password
 * - /api/auth/reset-password
 * - /api/health
 * - /api/whatsapp/webhook (pubblico)
 * - /api/internal/* (JWT token-based)
 */
export const sessionValidationMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Estrai sessionId da header
    const sessionId = req.headers["x-session-id"] as string

    if (!sessionId || sessionId.trim() === "") {
      logger.warn(`⚠️ SessionID missing for ${req.method} ${req.url}`)
      res.status(400).json({
        error: "SessionID is required",
        message: "Missing X-Session-Id header",
      })
      return
    }

    // Valida sessione
    const validation = await adminSessionService.validateSession(sessionId)

    if (!validation.valid) {
      logger.warn(`⚠️ Invalid session: ${validation.error}`)
      res.status(401).json({
        error: "Invalid session",
        message: validation.error,
      })
      return
    }

    // Allega session a request
    ;(req as any).session = validation.session
    logger.debug(`✅ Session valid for user ${validation.session.user.email}`)

    next()
  } catch (error) {
    logger.error("❌ Session validation error:", error)
    res.status(500).json({
      error: "Session validation failed",
      message: "Internal server error",
    })
  }
}
```

---

### 4. Backend - Integrazione Login

#### Modifiche: `backend/src/interfaces/http/controllers/auth.controller.ts`

```typescript
import { adminSessionService } from "../../../application/services/admin-session.service"

async login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body

  // 1. Autenticazione utente (esistente)
  const user = await this.userService.authenticate(email, password)
  if (!user) {
    throw new AppError(401, "Invalid credentials")
  }

  // 2. Genera JWT token (esistente)
  const jwtToken = this.generateToken(user)
  this.setTokenCookie(res, jwtToken)

  // 3. 🆕 CREA ADMIN SESSION
  const sessionId = await adminSessionService.createSession(
    user.id,
    null,  // workspaceId: null (sarà settato dopo selezione workspace)
    req.ip,
    req.headers['user-agent']
  )

  // 4. Ritorna sessionId nel body (frontend lo salva in localStorage)
  res.status(200).json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
    sessionId  // 🆕 NUOVO CAMPO
  })
}

async logout(req: Request, res: Response): Promise<void> {
  // 1. Estrai sessionId da header
  const sessionId = req.headers['x-session-id'] as string

  // 2. Revoca sessione
  if (sessionId) {
    await adminSessionService.revokeSession(sessionId)
  }

  // 3. Rimuovi JWT cookie (esistente)
  res.clearCookie("auth_token")

  res.status(200).json({ message: "Logged out successfully" })
}
```

---

### 5. Backend - Registrazione Middleware

#### File: `backend/src/routes/index.ts`

```typescript
import { sessionValidationMiddleware } from "../interfaces/http/middlewares/session-validation.middleware"

// ECCEZIONI: Routes senza sessionId validation
const SESSION_EXEMPT_ROUTES = [
  "/api/auth/login",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/register",
  "/api/health",
  "/api/whatsapp/webhook",
]

// Middleware globale con eccezioni
router.use((req, res, next) => {
  // Skip session validation per route esenti
  if (SESSION_EXEMPT_ROUTES.some((route) => req.path.startsWith(route))) {
    return next()
  }

  // Skip per /api/internal/* (usano JWT token nel query)
  if (req.path.startsWith("/api/internal/")) {
    return next()
  }

  // Applica session validation
  return sessionValidationMiddleware(req, res, next)
})

// ... resto delle routes
```

---

### 6. Frontend - Storage SessionID

#### File: `frontend/src/services/api.ts` (modifiche)

```typescript
import axios from "axios"

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true, // JWT cookie (esistente)
})

// 🆕 Helper per gestire sessionId
const getSessionId = (): string | null => {
  return localStorage.getItem("sessionId")
}

const setSessionId = (sessionId: string): void => {
  localStorage.setItem("sessionId", sessionId)
}

export const clearSessionId = (): void => {
  localStorage.removeItem("sessionId")
}

// 🆕 Request interceptor: aggiunge X-Session-Id header
api.interceptors.request.use(
  (config) => {
    // ECCEZIONI: Non aggiungere sessionId per questi endpoints
    const exemptPaths = [
      "/auth/login",
      "/auth/forgot-password",
      "/auth/reset-password",
      "/auth/register",
      "/health",
    ]

    const isExempt = exemptPaths.some((path) => config.url?.includes(path))

    if (!isExempt) {
      const sessionId = getSessionId()
      if (sessionId) {
        config.headers["X-Session-Id"] = sessionId
        console.log(
          `🔐 Added X-Session-Id header: ${sessionId.substring(0, 8)}...`
        )
      } else {
        console.warn(`⚠️ No sessionId found for ${config.url}`)
      }
    }

    // ... resto del codice (workspace header, etc.)
    return config
  },
  (error) => Promise.reject(error)
)

// 🆕 Response interceptor: gestisce errori sessionId
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const errorMessage = error.response?.data?.error

      // SessionID invalido/scaduto → Redirect a login
      if (
        errorMessage === "Invalid session" ||
        errorMessage === "SessionID is required"
      ) {
        console.error("❌ Session invalid, redirecting to login")
        clearSessionId()
        window.location.href = "/login"
      }
    }

    return Promise.reject(error)
  }
)

// 🆕 Export helpers
export { getSessionId, setSessionId, clearSessionId }
```

---

### 7. Frontend - Login Flow

#### File: `frontend/src/pages/LoginPage.tsx` (o dove si gestisce login)

```typescript
import { setSessionId, clearSessionId } from "@/services/api"

const handleLogin = async (email: string, password: string) => {
  try {
    const response = await api.post("/auth/login", { email, password })

    // 1. Salva user in localStorage (esistente)
    localStorage.setItem("user", JSON.stringify(response.data.user))

    // 2. 🆕 SALVA SESSIONID
    const { sessionId } = response.data
    if (sessionId) {
      setSessionId(sessionId)
      console.log("✅ SessionID saved to localStorage")
    } else {
      console.error("❌ No sessionId in login response!")
    }

    // 3. Redirect a dashboard
    navigate("/dashboard")
  } catch (error) {
    console.error("Login error:", error)
    toast.error("Login failed")
  }
}

const handleLogout = async () => {
  try {
    await api.post("/auth/logout") // Header X-Session-Id aggiunto automaticamente
    clearSessionId()
    localStorage.removeItem("user")
    navigate("/login")
  } catch (error) {
    console.error("Logout error:", error)
  }
}
```

---

## 🔄 Flusso Completo

### 1️⃣ Login

```
1. User: POST /api/auth/login { email, password }
2. Backend:
   - Verifica credenziali
   - Genera JWT token → Cookie HTTP-only (24h)
   - 🆕 Genera sessionId → Risposta JSON
   - 🆕 Revoca vecchie sessioni user
   - 🆕 Crea AdminSession (expiresAt: +1h)
3. Frontend:
   - Salva user in localStorage
   - 🆕 Salva sessionId in localStorage
4. Redirect a dashboard
```

### 2️⃣ API Call (es: GET /api/products)

```
1. Frontend interceptor:
   - Legge sessionId da localStorage
   - Aggiunge header: X-Session-Id: {sessionId}
   - Invia richiesta
2. Backend middleware (sessionValidationMiddleware):
   - Estrae X-Session-Id da header
   - Cerca AdminSession in DB
   - Verifica: isActive = true, expiresAt > now()
   - Aggiorna lastActivityAt
   - Allega session a req.session
3. Controller:
   - Processa richiesta normalmente
   - Può accedere a (req as any).session.user
4. Frontend:
   - Riceve risposta JSON
```

### 3️⃣ Sessione Scaduta (>1h)

```
1. Frontend: GET /api/products (con X-Session-Id header)
2. Backend middleware:
   - Trova session, ma expiresAt < now()
   - Revoca sessione (isActive = false)
   - Risponde: 401 Unauthorized { error: "Invalid session", message: "Session expired" }
3. Frontend response interceptor:
   - Rileva 401 + error "Invalid session"
   - Rimuove sessionId da localStorage
   - Redirect a /login
   - Toast: "Sessione scaduta, effettua nuovamente il login"
```

### 4️⃣ Logout

```
1. User: POST /api/auth/logout (con X-Session-Id header)
2. Backend:
   - Revoca sessione (isActive = false)
   - Rimuove JWT cookie
3. Frontend:
   - Rimuove sessionId da localStorage
   - Rimuove user da localStorage
   - Redirect a /login
```

---

## ⚠️ Eccezioni - Routes SENZA SessionID

**Backend (non applicare `sessionValidationMiddleware`)**:

1. `/api/auth/login` - Login iniziale
2. `/api/auth/forgot-password` - Reset password
3. `/api/auth/reset-password` - Conferma reset
4. `/api/auth/register` - Registrazione nuovo user
5. `/api/health` - Health check
6. `/api/whatsapp/webhook` - Webhook esterno
7. `/api/internal/*` - Public access con JWT token nel query

**Frontend (non aggiungere header `X-Session-Id`)**:

- Stesse routes sopra (automatico via interceptor)

---

## 🧪 Test e Debugging

### Test Manuale

```bash
# 1. Login
curl -c cookies.txt -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@shopme.com","password":"venezia44"}'

# Response: { "user": {...}, "sessionId": "abc-123-def-456" }

# 2. API Call con sessionId
curl -b cookies.txt -X GET http://localhost:3001/api/products \
  -H "X-Session-Id: abc-123-def-456"

# 3. Logout
curl -b cookies.txt -X POST http://localhost:3001/api/auth/logout \
  -H "X-Session-Id: abc-123-def-456"
```

### Verifiche Database

```sql
-- Sessioni attive
SELECT
  sessionId,
  user.email,
  workspace.name,
  createdAt,
  expiresAt,
  lastActivityAt,
  isActive
FROM "admin_sessions"
JOIN "User" ON admin_sessions.userId = User.id
LEFT JOIN "Workspace" ON admin_sessions.workspaceId = Workspace.id
WHERE isActive = true
ORDER BY createdAt DESC;

-- Sessioni scadute da pulire
SELECT COUNT(*) FROM "admin_sessions"
WHERE expiresAt < NOW() OR isActive = false;

-- Ultima attività per user
SELECT
  user.email,
  MAX(lastActivityAt) as last_activity
FROM "admin_sessions"
JOIN "User" ON admin_sessions.userId = User.id
WHERE isActive = true
GROUP BY user.email;
```

### Log Backend

```bash
# Cerca log sessioni
grep "🔐\|🔒" backend/logs/*.log

# Esempi:
# 🔐 Admin session created for user abc123: de4f9876...
# ✅ Session valid for user admin@shopme.com
# ⚠️ SessionID missing for GET /api/products
# ⚠️ Invalid session: Session expired
# 🔒 Session revoked: de4f9876...
# 🧹 Cleaned up 5 expired/revoked sessions
```

---

## 🔧 Troubleshooting

### ❌ "SessionID is required" su ogni chiamata

**Causa**: Frontend non sta inviando header `X-Session-Id`

**Soluzioni**:

1. Verifica sessionId in localStorage: `localStorage.getItem("sessionId")`
2. Verifica interceptor axios in `frontend/src/services/api.ts`
3. Controlla console browser per log interceptor
4. Verifica che non sia route esente (login, health, etc.)

### ❌ "Session expired" dopo pochi minuti

**Causa**: expiresAt troppo corto o no aggiornamento lastActivityAt

**Soluzioni**:

1. Verifica durata in `adminSessionService.createSession()`: `+ 60 * 60 * 1000` (1h)
2. Verifica che middleware aggiorni `lastActivityAt` ad ogni chiamata
3. Query DB per vedere scadenze: `SELECT expiresAt, lastActivityAt FROM admin_sessions WHERE isActive = true`

### ❌ Sessione non viene revocata al nuovo login

**Causa**: Policy "una sessione per user" non applicata

**Soluzioni**:

1. Verifica `adminSessionService.createSession()` chiami `updateMany({ userId }, { isActive: false })`
2. Query DB: `SELECT COUNT(*) FROM admin_sessions WHERE userId = 'xxx' AND isActive = true` (deve essere 1)

### ❌ Frontend non fa redirect a /login quando sessione scade

**Causa**: Response interceptor non configurato

**Soluzioni**:

1. Verifica interceptor in `api.ts` gestisca `401` + `error: "Invalid session"`
2. Verifica `clearSessionId()` e `window.location.href = "/login"`
3. Testa manualmente con sessionId finto: `localStorage.setItem("sessionId", "invalid")`

---

## 📊 Vantaggi vs Svantaggi

### ✅ Vantaggi

1. **Tracking preciso sessioni attive**: Sai esattamente chi è loggato e quando
2. **Controllo scadenza granulare**: 1h indipendente da JWT (24h)
3. **Revoca immediata**: Logout invalida sessionId senza aspettare JWT expiry
4. **Audit trail**: IP, userAgent, lastActivityAt per sicurezza
5. **NO token nella URL**: SessionId in localStorage + header (sicuro)

### ❌ Svantaggi

1. **Doppia validazione**: JWT cookie + SessionID header (overhead)
2. **DB query extra**: Ad ogni API call per validare sessionId
3. **Complessità**: Gestione duplicata (JWT + Session)
4. **Race conditions**: Possibile conflitto cleanup vs validazione

---

## 🚀 Roadmap Opzionale

- [ ] **Estensione automatica**: Aggiornare expiresAt ad ogni attività (sliding window)
- [ ] **Multi-device**: Permettere più sessioni attive per user (desktop + mobile)
- [ ] **Dashboard sessioni**: Frontend per vedere/revocare sessioni attive
- [ ] **Notifiche scadenza**: Avviso "5 minuti rimasti" prima expiry
- [ ] **Session storage sicuro**: Encrypted localStorage (vs plain sessionId)

---

## 📚 File da Creare/Modificare

### Backend

1. **NUOVO**: `backend/src/application/services/admin-session.service.ts` (250 righe)
2. **NUOVO**: `backend/src/interfaces/http/middlewares/session-validation.middleware.ts` (80 righe)
3. **MODIFICA**: `backend/src/interfaces/http/controllers/auth.controller.ts` (aggiungere createSession in login/logout)
4. **MODIFICA**: `backend/src/routes/index.ts` (registrare middleware con eccezioni)
5. **NUOVO**: `backend/prisma/schema.prisma` (model AdminSession)
6. **NUOVO**: Migration Prisma per AdminSession

### Frontend

1. **MODIFICA**: `frontend/src/services/api.ts` (interceptors sessionId)
2. **MODIFICA**: `frontend/src/pages/LoginPage.tsx` (salvare sessionId)
3. **MODIFICA**: Tutti i logout handlers (clearSessionId)

### Documentazione

1. **NUOVO**: `docs/memory-bank/sessionid-admin-panel.md` (questo file)
2. **AGGIORNA**: `docs/memory-bank/endpoints.md` (header X-Session-Id required)

---

## 🎯 Requisiti Confermati (Andrea)

1. **Estensione automatica**: ❌ NO - Sempre **1h fissa dalla creazione** (no sliding window)
2. **Multi-device**: ❌ NO - **UNA sola sessione** per user alla volta
3. **Dashboard admin**: ❌ NO - Non necessaria
4. **Notifiche scadenza**: ❌ NO - Non richieste
5. **Storage**: ✅ `localStorage` (non sessionStorage)

---

## 🛡️ Protected Routes Pattern (Frontend)

**Requisito Andrea**: Ogni pagina deve verificare sessionId all'ingresso:

- ✅ SessionID presente + valido → Accesso pagina
- ❌ SessionID assente/invalido → Redirect a `/auth/login`

**Eccezione Login Page**:

- ✅ SessionID valido → Redirect automatico a `/workspace-selection`
- ❌ SessionID assente → Mostra form login

### Implementazione: Route Guard

#### File: `frontend/src/components/ProtectedRoute.tsx`

```typescript
import { useEffect, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { api, getSessionId, clearSessionId } from "@/services/api"

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * Protected Route Component
 *
 * POLICY:
 * - Verifica sessionId presente in localStorage
 * - Valida sessionId con backend (GET /api/session/validate)
 * - Se valido → Renderizza children
 * - Se invalido → Redirect a /auth/login
 */
export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const [isValidating, setIsValidating] = useState(true)
  const [isValid, setIsValid] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const validateSession = async () => {
      const sessionId = getSessionId()

      // No sessionId → redirect login
      if (!sessionId) {
        console.warn("⚠️ No sessionId found, redirecting to login")
        setIsValidating(false)
        setIsValid(false)
        return
      }

      try {
        // Valida sessionId con backend
        const response = await api.get("/session/validate")

        if (response.data.valid) {
          console.log("✅ Session valid")
          setIsValid(true)
        } else {
          console.warn("⚠️ Session invalid:", response.data.error)
          clearSessionId()
          setIsValid(false)
        }
      } catch (error) {
        console.error("❌ Session validation error:", error)
        clearSessionId()
        setIsValid(false)
      } finally {
        setIsValidating(false)
      }
    }

    validateSession()
  }, [location.pathname])

  // Loading state
  if (isValidating) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    )
  }

  // Invalid session → redirect login
  if (!isValid) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  // Valid session → render protected content
  return <>{children}</>
}
```

### Uso in App.tsx

#### File: `frontend/src/App.tsx`

```typescript
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { LoginPage } from "@/pages/LoginPage"
import { WorkspaceSelectionPage } from "@/pages/WorkspaceSelectionPage"
import { DashboardPage } from "@/pages/DashboardPage"
// ... altri imports

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/auth/login" element={<LoginPageWithRedirect />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

        {/* Protected Routes */}
        <Route
          path="/workspace-selection"
          element={
            <ProtectedRoute>
              <WorkspaceSelectionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <ProductsPage />
            </ProtectedRoute>
          }
        />
        {/* ... tutte le altre pagine admin avvolte in ProtectedRoute */}
      </Routes>
    </BrowserRouter>
  )
}
```

### Login Page con Auto-Redirect

#### File: `frontend/src/pages/LoginPage.tsx`

```typescript
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api, getSessionId, setSessionId, clearSessionId } from "@/services/api"

/**
 * Login Page con Auto-Redirect
 *
 * POLICY:
 * - Se sessionId valido presente → Redirect automatico a /workspace-selection
 * - Se sessionId assente/invalido → Mostra form login
 */
export const LoginPageWithRedirect = () => {
  const [isChecking, setIsChecking] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const checkExistingSession = async () => {
      const sessionId = getSessionId()

      if (!sessionId) {
        console.log("No sessionId, showing login form")
        setIsChecking(false)
        return
      }

      try {
        // Verifica se sessionId ancora valido
        const response = await api.get("/session/validate")

        if (response.data.valid) {
          console.log(
            "✅ Valid session found, redirecting to workspace-selection"
          )
          navigate("/workspace-selection", { replace: true })
        } else {
          console.log("Session invalid, showing login form")
          clearSessionId()
          setIsChecking(false)
        }
      } catch (error) {
        console.error("Session check error:", error)
        clearSessionId()
        setIsChecking(false)
      }
    }

    checkExistingSession()
  }, [navigate])

  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await api.post("/auth/login", { email, password })

      // Salva sessionId
      const { sessionId, user } = response.data
      setSessionId(sessionId)
      localStorage.setItem("user", JSON.stringify(user))

      console.log("✅ Login successful, redirecting to workspace-selection")
      navigate("/workspace-selection")
    } catch (error) {
      console.error("Login error:", error)
      // ... gestione errore
    }
  }

  // Loading state durante check sessione
  if (isChecking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    )
  }

  // Mostra form login
  return (
    <div className="login-container">
      {/* ... UI form login esistente */}
      <button onClick={() => handleLogin(email, password)}>Login</button>
    </div>
  )
}
```

---

## 🔄 Flusso Protected Routes

### Caso 1: User con Sessione Valida

```
1. User naviga a http://localhost:3000/products
2. ProtectedRoute:
   - Legge sessionId da localStorage
   - GET /api/session/validate (con X-Session-Id header)
3. Backend:
   - Trova session attiva
   - expiresAt > now() → Valid
   - Aggiorna lastActivityAt
   - Risponde: { valid: true }
4. ProtectedRoute:
   - Renderizza <ProductsPage />
```

### Caso 2: User con Sessione Scaduta

```
1. User naviga a http://localhost:3000/dashboard
2. ProtectedRoute:
   - Legge sessionId da localStorage
   - GET /api/session/validate
3. Backend:
   - Trova session, ma expiresAt < now()
   - Revoca session (isActive = false)
   - Risponde: { valid: false, error: "Session expired" }
4. ProtectedRoute:
   - clearSessionId()
   - <Navigate to="/auth/login" />
```

### Caso 3: User Senza Sessione

```
1. User naviga a http://localhost:3000/orders
2. ProtectedRoute:
   - getSessionId() → null
   - Skip validazione backend
   - <Navigate to="/auth/login" />
```

### Caso 4: User su Login Page con Sessione Valida

```
1. User naviga a http://localhost:3000/auth/login
2. LoginPageWithRedirect:
   - useEffect: checkExistingSession()
   - GET /api/session/validate
3. Backend:
   - Session valida → { valid: true }
4. LoginPageWithRedirect:
   - navigate("/workspace-selection") automatico
   - User NON vede form login
```

### Caso 5: User su Login Page Senza Sessione

```
1. User naviga a http://localhost:3000/auth/login
2. LoginPageWithRedirect:
   - useEffect: checkExistingSession()
   - getSessionId() → null
   - setIsChecking(false)
3. Mostra form login normalmente
```

---

## 🔐 Backend - Endpoint Validazione Sessione

**NUOVO Endpoint Richiesto**: `GET /api/session/validate`

#### File: `backend/src/interfaces/http/controllers/session.controller.ts`

```typescript
import { Request, Response } from "express"
import { adminSessionService } from "../../../application/services/admin-session.service"
import logger from "../../../utils/logger"

export class SessionController {
  /**
   * Valida sessionId corrente
   * GET /api/session/validate
   *
   * Headers:
   * - X-Session-Id: {sessionId}
   *
   * Response:
   * - 200: { valid: true, session: {...} }
   * - 401: { valid: false, error: "Session expired" }
   */
  async validate(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.headers["x-session-id"] as string

      if (!sessionId) {
        res.status(401).json({
          valid: false,
          error: "SessionID missing",
        })
        return
      }

      const validation = await adminSessionService.validateSession(sessionId)

      if (!validation.valid) {
        res.status(401).json({
          valid: false,
          error: validation.error,
        })
        return
      }

      res.status(200).json({
        valid: true,
        session: {
          userId: validation.session.userId,
          email: validation.session.user.email,
          expiresAt: validation.session.expiresAt,
          lastActivityAt: validation.session.lastActivityAt,
        },
      })
    } catch (error) {
      logger.error("❌ Session validation endpoint error:", error)
      res.status(500).json({
        valid: false,
        error: "Validation failed",
      })
    }
  }
}

export const sessionController = new SessionController()
```

#### File: `backend/src/interfaces/http/routes/session.routes.ts`

```typescript
import { Router } from "express"
import { sessionController } from "../controllers/session.controller"

const router = Router()

/**
 * Session Routes
 * Gestione validazione sessioni admin
 */

// Valida sessione corrente (usato da ProtectedRoute frontend)
// Questo endpoint NON usa sessionValidationMiddleware (loop infinito)
router.get("/validate", sessionController.validate.bind(sessionController))

export { router as sessionRoutes }
```

#### Registrazione in `backend/src/routes/index.ts`

```typescript
import { sessionRoutes } from "../interfaces/http/routes/session.routes"

// IMPORTANTE: /api/session/validate deve essere ESENTE da sessionValidationMiddleware
// Altrimenti loop infinito (validate richiede sessionId valido per validare sessionId)

// Eccezioni middleware
const SESSION_EXEMPT_ROUTES = [
  "/api/auth/login",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/health",
  "/api/session/validate", // 🆕 AGGIUNTO
  "/api/whatsapp/webhook",
]

// Routes
router.use("/session", sessionRoutes) // 🆕 REGISTRA /api/session/*
```

---

## 📊 Sicurezza - Motivazioni

### Perché SessionID + Protected Routes?

1. **Doppia barriera difensiva**:

   - JWT cookie: Autenticazione (chi sei)
   - SessionID: Autorizzazione sessione attiva (sei ancora loggato?)

2. **Controllo scadenza preciso**:

   - JWT: 24h (long-lived token)
   - SessionID: 1h fissa (short-lived session)
   - Anche con JWT valido, session può essere scaduta/revocata

3. **Revoca immediata**:

   - Logout → Revoca session backend (isActive = false)
   - JWT rimane valido, ma sessionId invalido = no accesso

4. **Frontend protected**:

   - Ogni route verifica sessionId PRIMA di renderizzare
   - User non può bypassare controllando solo JWT
   - Anche URL diretti controllati (es: /dashboard)

5. **Login auto-redirect**:
   - User con session valida non deve ri-loggarsi
   - UX migliore: redirect automatico a workspace-selection

---

## 🆕 File da Creare/Modificare (Aggiornato)

### Backend

1. **NUOVO**: `backend/src/application/services/admin-session.service.ts`
2. **NUOVO**: `backend/src/interfaces/http/middlewares/session-validation.middleware.ts`
3. **NUOVO**: `backend/src/interfaces/http/controllers/session.controller.ts` (🆕)
4. **NUOVO**: `backend/src/interfaces/http/routes/session.routes.ts` (🆕)
5. **MODIFICA**: `backend/src/interfaces/http/controllers/auth.controller.ts`
6. **MODIFICA**: `backend/src/routes/index.ts` (middleware + session routes)
7. **NUOVO**: `backend/prisma/schema.prisma` (model AdminSession)
8. **NUOVO**: Migration Prisma

### Frontend

1. **MODIFICA**: `frontend/src/services/api.ts` (interceptors)
2. **NUOVO**: `frontend/src/components/ProtectedRoute.tsx` (🆕)
3. **MODIFICA**: `frontend/src/pages/LoginPage.tsx` (auto-redirect)
4. **MODIFICA**: `frontend/src/App.tsx` (wrap routes con ProtectedRoute)
5. **MODIFICA**: Tutti i logout handlers (clearSessionId)

---

**Ultimo aggiornamento**: 11 Ottobre 2025  
**Stato**: 📋 Design Completo + Protected Routes - Pronto per Implementazione  
**Tempo stimato implementazione**: 6-8 ore (backend + frontend + protected routes + test)
