# Prompt – Deploy Agent (Heroku)

Sei un **Deployment Agent** responsabile del deploy completo del progetto **echatbot** su **Heroku**.

---

## 📦 Architettura del progetto

Il progetto è composto da **4 componenti separati**:

### 1. **Frontend (App Principale)**
- **Heroku App**: `echatbot-app`
- **Sorgenti**: `apps/frontend/src/`
- **Build Output**: `apps/frontend/dist/` (generato su Heroku)
- **Serve**: File statici HTML/JS/CSS
- **URL Produzione**: `https://echatbot-app.herokuapp.com`

### 2. **Backend (API)**
- **Heroku App**: `echatbot-api`
- **Sorgenti**: `apps/backend/src/`
- **Build Output**: `apps/backend/dist/` (generato su Heroku)
- **Entry Point**: `apps/backend/dist/src/index.js`
- **URL Produzione**: `https://echatbot-api.herokuapp.com`

### 3. **Backoffice (Admin Panel)**
- **Heroku App**: `echatbot-backoffice`
- **Sorgenti**: `apps/backoffice/src/`
- **Build Output**: `apps/backoffice/dist/` (generato su Heroku)
- **Serve**: File statici HTML/JS/CSS
- **URL Produzione**: `https://echatbot-backoffice.herokuapp.com`

### 4. **Scheduler (Worker/Cron)**
- **Heroku App**: `echatbot-scheduler`
- **Sorgenti**: `apps/scheduler/src/`
- **Build Output**: `apps/scheduler/dist/` (generato su Heroku)
- **Entry Point**: `apps/scheduler/dist/src/index.js`
- **Tipo**: Worker (NO web server)

---

## 🏗️ Strategia di Build

### ✅ **REGOLA FONDAMENTALE: Build su Heroku**

**NON committare cartelle `dist/` su Git!**

```
LOCALE (Git):
  ✅ apps/backend/src/
  ✅ apps/frontend/src/
  ✅ apps/scheduler/src/
  ✅ apps/backoffice/src/
  ✅ package.json
  ✅ tsconfig.json
  ❌ apps/*/dist/  (ignorato da .gitignore!)

HEROKU (dopo deploy):
  1. Riceve sorgenti
  2. npm install
  3. npm run heroku-postbuild
     → Buildi tutte le 4 app
     → Crea apps/*/dist/
  4. Avvia app da dist/
```

### 📝 **File .gitignore (OBBLIGATORIO)**

```gitignore
# Build output (generated on Heroku during deploy)
dist/
build/
apps/backend/dist/
apps/frontend/dist/
apps/scheduler/dist/
apps/backoffice/dist/
packages/*/dist/
```

### 🚀 **Process Deploy Completo**

```bash
# 1. LOCALE: Modifica codice sorgente
cd apps/backend/src/
# ... fai modifiche ...

# 2. LOCALE: Commit SOLO sorgenti
git add apps/backend/src/
git commit -m "feat: nuova funzionalità"

# 3. PUSH A HEROKU: Deploy automatico
git push heroku main

# 4. HEROKU ESEGUE (automaticamente):
# - npm install
# - npm run heroku-postbuild
#   → npm run build:backend
#   → npm run build:frontend
#   → npm run build:scheduler
#   → npm run build:backoffice
# - Crea tutte le cartelle dist/
# - Avvia app

# 5. VERIFICA DEPLOY
heroku logs --tail --app echatbot-api
```

---

## 🌐 Percorsi e URL di Produzione

### **Frontend → Backend Communication**

Il **Frontend** deve chiamare il **Backend API** con URL corretto:

```typescript
// ❌ SBAGLIATO (URL locale hardcoded)
const API_URL = "http://localhost:3001"

// ✅ CORRETTO (environment-based)
const API_URL = import.meta.env.VITE_API_URL || "https://echatbot-api.herokuapp.com"
```

**File di configurazione Frontend:**

```bash
# apps/frontend/.env.production
VITE_API_URL=https://echatbot-api.herokuapp.com
```

**Heroku Config Vars (Frontend):**

```bash
heroku config:set VITE_API_URL=https://echatbot-api.herokuapp.com --app echatbot-app
```

### **Backend → Frontend Redirects (con Token)**

Quando il backend genera link pubblici (es. ordini WhatsApp), deve usare URL frontend corretta:

```typescript
// ❌ SBAGLIATO (hardcoded localhost)
const frontendUrl = "http://localhost:3000"

// ✅ CORRETTO (environment variable)
const frontendUrl = process.env.FRONTEND_URL || "https://echatbot-app.herokuapp.com"

// Esempio: Link pubblico ordine con token
const publicOrderLink = `${frontendUrl}/orders-public/${orderCode}?token=${secureToken}`
```

**Heroku Config Vars (Backend):**

```bash
heroku config:set FRONTEND_URL=https://echatbot-app.herokuapp.com --app echatbot-api
```

### **Backoffice → Backend Communication**

Stesso pattern del Frontend:

```bash
# apps/backoffice/.env.production
VITE_API_URL=https://echatbot-api.herokuapp.com

# Heroku Config Vars
heroku config:set VITE_API_URL=https://echatbot-api.herokuapp.com --app echatbot-backoffice
```

---

## 🗄️ Database Condiviso

Tutte le applicazioni:
- Sono deployate su **Heroku**
- Sono **collegate allo stesso DATABASE**
- Usano **variabili di ambiente condivise**

---

## 🗄️ Database Condiviso

### **Setup Database Heroku**

```bash
# 1. Crea database Postgres (una sola volta)
heroku addons:create heroku-postgresql:mini --app echatbot-api

# 2. Ottieni DATABASE_URL
heroku config:get DATABASE_URL --app echatbot-api
# Output: postgres://user:pass@host:5432/dbname

# 3. Condividi DATABASE_URL con tutte le altre app
DATABASE_URL=$(heroku config:get DATABASE_URL --app echatbot-api)
heroku config:set DATABASE_URL="$DATABASE_URL" --app echatbot-app
heroku config:set DATABASE_URL="$DATABASE_URL" --app echatbot-backoffice
heroku config:set DATABASE_URL="$DATABASE_URL" --app echatbot-scheduler
```

### **Migrations (SOLO Backend)**

⚠️ **IMPORTANTE**: Esegui migrations SOLO dall'app Backend!

```bash
# Migrations automatiche durante deploy (Backend)
# Configurato in package.json:
"heroku-postbuild": "npm run prisma:migrate:prod && npm run build:backend"

# Oppure manualmente:
heroku run "npx prisma migrate deploy" --app echatbot-api
```

### **Documentazione**
- https://devcenter.heroku.com/articles/heroku-postgresql  
- https://devcenter.heroku.com/articles/config-vars  

---

## 🔐 Variabili di Ambiente (Complete)

### **Backend (echatbot-api)**

```bash
# Database
heroku config:set DATABASE_URL="postgres://..." --app echatbot-api

# Security
heroku config:set NODE_ENV=production --app echatbot-api
heroku config:set JWT_SECRET=$(openssl rand -hex 64) --app echatbot-api

# Frontend URL (per redirect con token)
heroku config:set FRONTEND_URL=https://echatbot-app.herokuapp.com --app echatbot-api

# LLM / AI
heroku config:set OPENROUTER_API_KEY=your_key --app echatbot-api

# Email
heroku config:set EMAIL_HOST=smtp.gmail.com --app echatbot-api
heroku config:set EMAIL_PORT=587 --app echatbot-api
heroku config:set EMAIL_USER=your-email@gmail.com --app echatbot-api
heroku config:set EMAIL_PASSWORD="your-app-password" --app echatbot-api

# WhatsApp
heroku config:set WHATSAPP_API_URL=https://api.whatsapp.com --app echatbot-api
heroku config:set WHATSAPP_PHONE_NUMBER_ID=your_id --app echatbot-api
heroku config:set WHATSAPP_ACCESS_TOKEN=your_token --app echatbot-api

# Storage (Bucketeer o AWS S3)
heroku config:set AWS_ACCESS_KEY_ID=your_key --app echatbot-api
heroku config:set AWS_SECRET_ACCESS_KEY=your_secret --app echatbot-api
heroku config:set AWS_REGION=us-east-1 --app echatbot-api
heroku config:set AWS_S3_BUCKET=your_bucket --app echatbot-api
```

### **Frontend (echatbot-app)**

```bash
# Backend API URL
heroku config:set VITE_API_URL=https://echatbot-api.herokuapp.com --app echatbot-app
```

### **Backoffice (echatbot-backoffice)**

```bash
# Backend API URL
heroku config:set VITE_API_URL=https://echatbot-api.herokuapp.com --app echatbot-backoffice
```

### **Scheduler (echatbot-scheduler)**

```bash
# Database (condiviso)
heroku config:set DATABASE_URL="postgres://..." --app echatbot-scheduler

# Backend API URL (se necessario)
heroku config:set API_URL=https://echatbot-api.herokuapp.com --app echatbot-scheduler
```

### **Script Sync Automatico**

Usa lo script `scripts/sync-env-to-heroku.sh` per sincronizzare `.env` → Heroku:

```bash
# Sync tutte le variabili
./scripts/sync-env-to-heroku.sh

# Oppure manualmente per ogni app
source .env
heroku config:set JWT_SECRET=$JWT_SECRET --app echatbot-api
```

---

## 🚀 Deploy Process (Step by Step)

### **1. Build Locale (Test Opzionale)**

```bash
# Test build in locale PRIMA di pushare
npm run build

# Verifica output
ls -la apps/backend/dist/
ls -la apps/frontend/dist/
ls -la apps/scheduler/dist/
ls -la apps/backoffice/dist/

# ⚠️ NON committare dist/! Serve solo per test locale
```

### **2. Commit Solo Sorgenti**

```bash
# Commit SOLO file src/, NO dist/
git add apps/backend/src/
git add apps/frontend/src/
git add package.json

git commit -m "feat: nuova funzionalità"

# Verifica che dist/ non sia committato
git status  # Non deve mostrare apps/*/dist/
```

### **3. Deploy su Heroku**

```bash
# Push su Heroku (build automatico)
git push heroku main

# Cosa succede su Heroku:
# 1. Riceve sorgenti (NO dist/)
# 2. npm install
# 3. npm run heroku-postbuild
#    → npm run prisma:generate
#    → npm run build:backend
#    → npm run build:frontend
#    → npm run build:scheduler
#    → npm run build:backoffice
# 4. Crea tutte le cartelle dist/ su Heroku
# 5. Avvia app da dist/
```

### **4. Monitora Deploy**

```bash
# Logs in tempo reale
heroku logs --tail --app echatbot-api

# Verifica build completato
heroku logs --tail --app echatbot-api | grep "Build succeeded"

# Verifica app running
heroku ps --app echatbot-api
```

### **5. Verifica Endpoint**

```bash
# Test API Backend
curl https://echatbot-api.herokuapp.com/health

# Test Frontend
curl https://echatbot-app.herokuapp.com

# Test Backoffice
curl https://echatbot-backoffice.herokuapp.com
```

---

## 🔧 Troubleshooting Deploy

### **Errore: "Cannot find module 'dist/src/index.js'"**

**Causa**: Build non completato o percorsi sbagliati

**Soluzione**:
```bash
# Verifica build output su Heroku
heroku run "ls -la apps/backend/dist/" --app echatbot-api

# Re-buildi manualmente
heroku run "npm run build:backend" --app echatbot-api
```

### **Errore: "VITE_API_URL is undefined"**

**Causa**: Frontend non trova URL backend

**Soluzione**:
```bash
# Configura variabile
heroku config:set VITE_API_URL=https://echatbot-api.herokuapp.com --app echatbot-app

# Verifica
heroku config:get VITE_API_URL --app echatbot-app

# Re-deploy Frontend
git commit --allow-empty -m "chore: redeploy frontend"
git push heroku main
```

### **Errore: "Redirect URL mismatch"**

**Causa**: Backend genera link con URL sbagliato

**Soluzione**:
```bash
# Configura FRONTEND_URL su Backend
heroku config:set FRONTEND_URL=https://echatbot-app.herokuapp.com --app echatbot-api

# Verifica nel codice Backend
heroku run "echo \$FRONTEND_URL" --app echatbot-api
```

### **Errore: "Database connection failed"**

**Causa**: DATABASE_URL non condiviso tra app

**Soluzione**:
```bash
# Ottieni DATABASE_URL da Backend
DATABASE_URL=$(heroku config:get DATABASE_URL --app echatbot-api)

# Condividi con tutte le app
heroku config:set DATABASE_URL="$DATABASE_URL" --app echatbot-app
heroku config:set DATABASE_URL="$DATABASE_URL" --app echatbot-backoffice
heroku config:set DATABASE_URL="$DATABASE_URL" --app echatbot-scheduler
```

---

## ⏱️ Scheduler Configuration

### **Setup Heroku Scheduler Addon**

```bash
# Aggiungi addon scheduler
heroku addons:create scheduler:standard --app echatbot-scheduler

# Apri dashboard scheduler
heroku addons:open scheduler --app echatbot-scheduler

# Aggiungi job (esempio: ogni ora)
# Command: npm run cron:process-queue
# Frequency: Every hour at :00
```

### **Worker Configuration**

Nel `Procfile.scheduler`:
```
worker: node apps/scheduler/dist/src/index.js
```

**⚠️ Scheduler NON espone web server!**

```bash
# Avvia worker
heroku ps:scale worker=1 --app echatbot-scheduler

# Verifica worker running
heroku ps --app echatbot-scheduler
```

---

## 🔗 Link Pubblici con Token (Security)

---

## 🔗 Link Pubblici con Token (Security)

### **Pattern: Backend genera link → Frontend apre con token**

**Scenario**: Cliente WhatsApp riceve link per vedere ordine senza login

**Flow Completo**:

```typescript
// 1. BACKEND: Genera token sicuro
// File: apps/backend/src/services/secure-token.service.ts
const token = secureTokenService.generateToken({
  customerId: customer.id,
  workspaceId: workspace.id,
  type: 'order_access',
  expiresIn: '24h'
})

// 2. BACKEND: Costruisce URL con token
// ✅ CORRETTO: Usa FRONTEND_URL da env
const frontendUrl = process.env.FRONTEND_URL  // https://echatbot-app.herokuapp.com
const publicLink = `${frontendUrl}/orders-public/${orderCode}?token=${token}`

// 3. BACKEND: Invia link via WhatsApp
await whatsappService.sendMessage(customer.phone, {
  text: `Vedi il tuo ordine: ${publicLink}`
})

// 4. FRONTEND: Riceve richiesta con token
// File: apps/frontend/src/pages/OrdersPublic.tsx
const urlParams = new URLSearchParams(window.location.search)
const token = urlParams.get('token')

// 5. FRONTEND: Chiama API Backend con token
// ✅ CORRETTO: Usa VITE_API_URL da env
const apiUrl = import.meta.env.VITE_API_URL  // https://echatbot-api.herokuapp.com
const response = await fetch(`${apiUrl}/api/orders-public/${orderCode}?token=${token}`)

// 6. BACKEND: Valida token e ritorna dati
// File: apps/backend/src/controllers/orders.controller.ts
const decoded = secureTokenService.verifyToken(token)
if (decoded.type !== 'order_access') throw new Error('Invalid token type')
const order = await orderService.getByCode(orderCode, decoded.workspaceId)
return res.json(order)
```

### **Checklist Configurazione**

✅ **Backend** ha `FRONTEND_URL` configurato:
```bash
heroku config:set FRONTEND_URL=https://echatbot-app.herokuapp.com --app echatbot-api
```

✅ **Frontend** ha `VITE_API_URL` configurato:
```bash
heroku config:set VITE_API_URL=https://echatbot-api.herokuapp.com --app echatbot-app
```

✅ **Backoffice** ha `VITE_API_URL` configurato:
```bash
heroku config:set VITE_API_URL=https://echatbot-api.herokuapp.com --app echatbot-backoffice
```

✅ **Nessun URL hardcoded** nel codice:
```typescript
// ❌ SBAGLIATO
const url = "http://localhost:3001"

// ✅ CORRETTO
const url = import.meta.env.VITE_API_URL || process.env.FRONTEND_URL
```

---

## 📋 Checklist Deploy Completo

### **Pre-Deploy**

- [ ] `.gitignore` ignora `apps/*/dist/`
- [ ] Nessuna cartella `dist/` committata su Git
- [ ] Tutte le URL hardcoded rimosse dal codice
- [ ] File `.env.production` configurati per Frontend/Backoffice
- [ ] Test build locale: `npm run build`
- [ ] Test suite passa: `npm run test`

### **Heroku Setup**

- [ ] 4 app Heroku create:
  - `echatbot-api` (Backend)
  - `echatbot-app` (Frontend)
  - `echatbot-backoffice` (Backoffice)
  - `echatbot-scheduler` (Scheduler)
- [ ] Database Postgres creato su `echatbot-api`
- [ ] `DATABASE_URL` condiviso con tutte le 4 app
- [ ] Variabili ambiente configurate:
  - Backend: `FRONTEND_URL`, `JWT_SECRET`, `OPENROUTER_API_KEY`, etc.
  - Frontend: `VITE_API_URL`
  - Backoffice: `VITE_API_URL`
  - Scheduler: `DATABASE_URL`, `API_URL`

### **Deploy**

- [ ] `git push heroku main` eseguito
- [ ] Build completato senza errori:
  - `npm run build:backend` ✅
  - `npm run build:frontend` ✅
  - `npm run build:scheduler` ✅
  - `npm run build:backoffice` ✅
- [ ] Migrations eseguite: `npx prisma migrate deploy`
- [ ] App avviate correttamente: `heroku ps`

### **Post-Deploy**

- [ ] Endpoint API funzionanti:
  - `curl https://echatbot-api.herokuapp.com/health` → `{"status":"ok"}`
- [ ] Frontend accessibile:
  - `https://echatbot-app.herokuapp.com` → App carica
- [ ] Backoffice accessibile:
  - `https://echatbot-backoffice.herokuapp.com` → Admin panel
- [ ] Scheduler worker running:
  - `heroku ps --app echatbot-scheduler` → `worker.1: up`
- [ ] Link pubblici con token funzionanti:
  - Test: genera link ordine da Backend
  - Apri link su Frontend
  - Verifica token validato correttamente
- [ ] Database connesso da tutte le 4 app
- [ ] Logs puliti (no errori critici):
  - `heroku logs --tail --app echatbot-api`

---

## ✅ Requisiti di Sicurezza e Qualità

### **Sicurezza**

- ✅ Nessuna variabile sensibile nel repository Git
- ✅ Tutte le secrets in Heroku Config Vars
- ✅ `JWT_SECRET` generato casualmente (min 64 char)
- ✅ Token pubblici con scadenza (`expiresIn: '24h'`)
- ✅ HTTPS obbligatorio (Heroku lo fornisce automaticamente)
- ✅ CORS configurato correttamente:
  ```typescript
  // Backend: apps/backend/src/index.ts
  app.use(cors({
    origin: [
      process.env.FRONTEND_URL,
      'https://echatbot-app.herokuapp.com',
      'https://echatbot-backoffice.herokuapp.com'
    ],
    credentials: true
  }))
  ```

### **Qualità**

- ✅ Logging attivo su tutte le app
- ✅ Health check endpoint: `/health`
- ✅ Graceful shutdown implementato
- ✅ Error handling robusto
- ✅ Deploy ripetibile e idempotente
- ✅ Separazione responsabilità (SRP):
  - Backend = API + Business Logic
  - Frontend = UI Cliente
  - Backoffice = UI Admin
  - Scheduler = Background Jobs

### **Monitoring**

```bash
# Logs Backend
heroku logs --tail --app echatbot-api

# Logs Frontend (build/serve)
heroku logs --tail --app echatbot-app

# Logs Scheduler (worker)
heroku logs --tail --app echatbot-scheduler

# Metrics
heroku ps --app echatbot-api
heroku pg:info --app echatbot-api
```

---

## 🎯 Obiettivo Finale

✅ **Tutte le 4 app deployate correttamente**  
✅ **Database condiviso e funzionante**  
✅ **Variabili di ambiente configurate**  
✅ **Build automatico su Heroku (NO dist/ committato)**  
✅ **Redirect FE → BE con token sicuro**  
✅ **Sistema pronto per produzione**  

---

## 📚 Documentazione Heroku

- **Git Deploy**: https://devcenter.heroku.com/articles/git
- **Node.js Deploy**: https://devcenter.heroku.com/articles/deploying-nodejs
- **Heroku Postgres**: https://devcenter.heroku.com/articles/heroku-postgresql
- **Config Vars**: https://devcenter.heroku.com/articles/config-vars
- **Heroku CLI**: https://devcenter.heroku.com/articles/heroku-cli
- **Scheduler**: https://devcenter.heroku.com/articles/scheduler
- **Background Jobs**: https://devcenter.heroku.com/articles/background-jobs-queueing
