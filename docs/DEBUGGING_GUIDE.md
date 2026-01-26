# 🔍 Guida Debugging ECONNREFUSED

## Il Vero Problema (Non è Docker!)

**ECONNREFUSED significa**: La connessione al database è stata rifiutata/chiusa a livello TCP, non che il database sia down.

### Cause Reali:

1. **Pool adapter è "stale"** (connessioni TCP morte in cache)
   - Succede quando: Prisma riusa connessioni da un pool che è stato interrotto
   - Sintomo: ECONNREFUSED di tanto in tanto, non sempre
   - Soluzione: Ricreare pool o usare connessioni fresche

2. **Timeout di inattività del pool** 
   - idleTimeoutMillis: 30000 (30s) → pool chiude connessioni inattive
   - Se query arriva dopo 30s di inattività → porta morta
   - Soluzione: Aumentare timeout o aggiungere health check

3. **Max connections raggiunto**
   - Pool max: 20 connessioni
   - Se scheduler + backend + frontend esauriscono il pool → timeout
   - Soluzione: Aumentare max pool o chiudere connessioni non usate

4. **Race condition tra servizi**
   - Backend e scheduler competono per pool stesso
   - Scheduler rimane attivo 24/7 while backend si riavvia con hot-reload
   - Soluzione: Isolamento pool o queue di riconnessione

---

## 🔧 Procedura Debugging ECONNREFUSED

### Step 1: Verificare Connettività Base
```bash
# Verifica che DB sia online
docker ps | grep shop_db
# Expected: "Up" status

# Verifica porta è aperta
nc -zv localhost 5434
# Expected: "succeeded"

# Verifica credenziali
psql -h localhost -p 5434 -U echatbotfy -d echatbotfy -c "SELECT 1"
# Expected: (1 row) without error
```

### Step 2: Verificare Quale Servizio Fallisce
```bash
# Identifica il servizio con errore
grep -r "ECONNREFUSED\|workspace.findMany" logs/ 2>/dev/null | head -5

# Estrai il file source
# Backend: /apps/backend/src/...
# Scheduler: /apps/scheduler/src/jobs/...
```

### Step 3: Analizzare Pattern
```bash
# Conta errori per minuto (se ripetuti = problema pool)
grep ECONNREFUSED logs/error.log | wc -l

# Se > 10 errori al minuto → pool è esaurito/stale
# Se < 2 errori = timeout casuale
```

### Step 4: Verificare Pool Status
```bash
# Nel database package:
# ❌ Connector stale: se pool rimane attivo 1+ ore senza reset
# ✅ Soluzione: Implementare health check o connection refresh

# Current config (packages/database/src/index.ts):
# max: 20              ← aumentare a 30-50 se scheduler è lento
# idleTimeoutMillis: 30000  ← aumentare a 60000 se job ≥ 30s
# connectionTimeoutMillis: 10000  ← aumentare a 15000 se intermittente
```

### Step 5: Verificare Hot-Reload Timing
```bash
# Se backend riavvia con hot-reload mentre scheduler usa pool:
# ❌ Backend.ts modifica → pool viene ricreato
# ❌ Scheduler ancora usa vecchia pool reference
# → ECONNREFUSED

# Soluzione: Attendere che auto-reload finisca prima di testare scheduler
```

---

## 🚀 Fix Immediati (Priority Order)

### Fix #1: Aumentare Pool Config (30 secondi)
```typescript
// packages/database/src/index.ts
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 50,                        // ← aumenta da 20
  idleTimeoutMillis: 60000,       // ← aumenta da 30000
  connectionTimeoutMillis: 15000, // ← aumenta da 10000
})

pool.on('error', (err) => {
  console.error('⚠️ Pool error:', err.message)
  // Log ma non termina processo
})

pool.on('connect', () => {
  console.log('✅ Pool connection established')
})
```

**Rebuild dopo:**
```bash
cd packages/database && npm run build
# Pool config ora ha buffer maggiore
```

---

### Fix #2: Implementare Connection Health Check (2 minuti)
```typescript
// packages/database/src/index.ts - aggiungere

// Health check ogni 5 minuti
setInterval(async () => {
  try {
    await pool.query('SELECT 1')
    console.log('✅ Pool health check passed')
  } catch (err) {
    console.warn('⚠️ Pool health check failed:', err.message)
    // Pool auto-ricrea connessione al prossimo query
  }
}, 5 * 60 * 1000) // ogni 5 minuti
```

---

### Fix #3: Isolamento Pool per Scheduler (5 minuti)
```typescript
// apps/scheduler/src/config/database.ts
// Se scheduler causa problemi a backend: usa pool dedicato

import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const schedulerPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,  // Pool più piccolo per scheduler
  idleTimeoutMillis: 60000,
})

const adapter = new PrismaPg(schedulerPool)
export const prisma = new PrismaClient({ adapter })
```

---

## 📊 Quando Verificare Pool

**SEMPRE verificare dopo:**
- ✅ Modifica a schema.prisma
- ✅ Cambio numero pool connections
- ✅ Cambio idleTimeoutMillis
- ✅ Deployment a produzione
- ✅ Aggiornamento Prisma

**Test:**
```bash
cd apps/scheduler && npm run dev
# Aspetta 2 minuti, verifica:
# [2026-01-24 ...] INFO: [WhatsApp Queue] 📬 Processing workspace...
# Se vedi questo SENZA ECONNREFUSED → ✅ OK
```

---

## 🚨 Scenario: ECONNREFUSED Ricorrente

Se persiste anche con fix sopra:

1. **Isolare il servizio** che genera errore
   ```bash
   # Chiudi backend
   pkill -f "tsx.*backend"
   
   # Lancia solo scheduler
   cd apps/scheduler && npm run dev
   
   # Se scheduler funziona → problema è nel backend/pool sharing
   ```

2. **Verificare log Prisma**
   ```bash
   # Abilita log verbose
   export DEBUG="prisma:*"
   npm run dev
   ```

3. **Verificare pg pool direttamente**
   ```bash
   # Script test (node script.js)
   const { Pool } = require('pg')
   const pool = new Pool({
     connectionString: 'postgresql://echatbotfy:pass@localhost:5434/echatbotfy',
     max: 50,
     idleTimeoutMillis: 60000,
   })
   
   // Prova 100 queries veloci
   for(let i=0; i<100; i++) {
     pool.query('SELECT 1').catch(e => console.log('FAILED', i, e.message))
   }
   
   setTimeout(() => pool.end(), 10000)
   ```

---

## ✅ Prevenzione Futura

**Checklist prima di push:**
- [ ] Pool config appropriato per carico
- [ ] Health check abilitato
- [ ] Log ECONNREFUSED monitorati
- [ ] Scheduler isolato se necessario
- [ ] Test 10+ minuti con `npm run dev:all`
