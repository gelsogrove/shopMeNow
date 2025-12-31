# 🚀 Heroku Deployment Guide - eChatbot

Guida completa per deployment di eChatbot su Heroku.

**Architettura**: 3 app separate (Backend+Frontend monolith, Backoffice, Scheduler) con database condiviso.

**Build Strategy**: Heroku compila automaticamente tutti i sorgenti durante il deploy (NO file `dist/` committati su Git).

---

## 📋 Prerequisiti

1. **Account Heroku**: https://signup.heroku.com/
2. **Heroku CLI installato**: `brew tap heroku/brew && brew install heroku`
3. **Git repository inizializzato** (già fatto ✅)
4. **Carta di credito collegata** (per Postgres addon, anche con free tier)

---

## 🏗️ Setup Iniziale Heroku

### 1. Login e Creazione delle 3 App

```bash
# Login a Heroku
heroku login

# Crea 3 app separate (scegli nomi unici)
heroku create echatbot-app          # Backend + Frontend (monolith)
heroku create echatbot-backoffice   # Backoffice Admin
heroku create echatbot-scheduler    # Scheduler/Worker

# Verifica remote git (aggiungeremo app specifiche dopo)
git remote -v
```

### 2. Aggiungi Postgres Database (CONDIVISO tra tutte le 3 app)

```bash
# Crea database su app principale (echatbot-app)
heroku addons:create heroku-postgresql:mini --app echatbot-app

# Ottieni DATABASE_URL
DATABASE_URL=$(heroku config:get DATABASE_URL --app echatbot-app)

# Condividi DATABASE_URL con tutte le altre app
heroku config:set DATABASE_URL="$DATABASE_URL" --app echatbot-backoffice
heroku config:set DATABASE_URL="$DATABASE_URL" --app echatbot-scheduler

# Verifica che tutte le app abbiano lo stesso DATABASE_URL
heroku config:get DATABASE_URL --app echatbot-app
heroku config:get DATABASE_URL --app echatbot-backoffice
heroku config:get DATABASE_URL --app echatbot-scheduler
```

**IMPORTANTE**: 
- ✅ **Mini ($5/mese)** include backup automatico + rollback → OBBLIGATORIO per produzione
- ❌ **Essential-0 (free)** NO backup, può perdere dati → solo per test

### 3. Configura Variabili d'Ambiente (tutte le 3 app)

#### **Backend + Frontend (echatbot-app)**

```bash
# Security
heroku config:set NODE_ENV=production --app echatbot-app
heroku config:set JWT_SECRET=$(openssl rand -hex 64) --app echatbot-app

# Frontend URL (per redirect con token - stessa app)
heroku config:set FRONTEND_URL=https://echatbot-app.herokuapp.com --app echatbot-app

# Backend API URL (per chiamate frontend - stessa app)
heroku config:set VITE_API_URL=https://echatbot-app.herokuapp.com --app echatbot-app

# LLM / AI
heroku config:set OPENROUTER_API_KEY=your_key --app echatbot-app

# Email
heroku config:set EMAIL_HOST=smtp.gmail.com --app echatbot-app
heroku config:set EMAIL_PORT=587 --app echatbot-app
heroku config:set EMAIL_USER=your-email@gmail.com --app echatbot-app
heroku config:set EMAIL_PASSWORD="your-app-password" --app echatbot-app

# WhatsApp
heroku config:set WHATSAPP_API_URL=https://api.whatsapp.com --app echatbot-app
heroku config:set WHATSAPP_PHONE_NUMBER_ID=your_id --app echatbot-app
heroku config:set WHATSAPP_ACCESS_TOKEN=your_token --app echatbot-app

# Storage (Cloudinary)
heroku config:set CLOUDINARY_URL='cloudinary://api_key:api_secret@cloud_name' --app echatbot-app
```

#### **Frontend (echatbot-app)**

```bash
# Backend API URL (se usi dominio custom)
heroku config:set VITE_API_URL=https://echatbot.ai/api --app echatbot-app
```

#### **Backoffice (echatbot-backoffice)**

```bash
# Backend API URL
heroku config:set VITE_API_URL=https://echatbot.ai/api --app echatbot-backoffice
```

#### **Scheduler (echatbot-scheduler)**

```bash
# Backend API URL (se necessario)
heroku config:set API_URL=https://echatbot-app.herokuapp.com --app echatbot-scheduler
```
```

### 4. Verifica Configurazione

```bash
# Lista tutte le variabili configurate
heroku config

# Controlla specificamente DATABASE_URL
heroku config:get DATABASE_URL
```

---

## 🚀 Deploy Process

### ❗ IMPORTANTE: Build su Heroku

**NON committare cartelle `dist/` su Git!**

Heroku compila automaticamente i sorgenti durante il deploy.

### 1. Build Locale (Test Opzionale)

```bash
# Test build in locale PRIMA di pushare (opzionale)
npm run build

# Verifica output (solo per debug locale)
ls -la apps/backend/dist/
ls -la apps/frontend/dist/
ls -la apps/scheduler/dist/
ls -la apps/backoffice/dist/

# ⚠️ NON committare dist/! Serve solo per test locale
```

### 2. Commit SOLO Sorgenti

```bash
# Commit SOLO file src/, NO dist/
git add apps/backend/src/
git add apps/frontend/src/
git add apps/scheduler/src/
git add apps/backoffice/src/
git add package.json

git commit -m "feat: nuova funzionalità"

# Verifica che dist/ NON sia committato
git status  # Non deve mostrare apps/*/dist/
```

### 3. Deploy su Heroku (3 app)

**Imposta remote Git per ogni app:**

```bash
# Aggiungi remote per ogni app
git remote add heroku-app https://git.heroku.com/echatbot-app.git
git remote add heroku-backoffice https://git.heroku.com/echatbot-backoffice.git
git remote add heroku-scheduler https://git.heroku.com/echatbot-scheduler.git
```

**Deploy su ogni app:**

```bash
# 1. Backend + Frontend (monolith)
git push heroku-app main
# Heroku esegue: npm install → prisma:generate → build:backend → build:frontend → avvia

# 2. Backoffice
git push heroku-backoffice main
# Heroku esegue: npm install → build:backoffice → serve

# 3. Scheduler
git push heroku-scheduler main
# Heroku esegue: npm install → prisma:generate → build:scheduler → worker
```

**Cosa succede su Heroku (automaticamente):**

1. ✅ Heroku riceve sorgenti (NO dist/)
2. ✅ `npm install` (dipendenze)
3. ✅ `npm run heroku-postbuild` (vedi package.json):
   - Backend: `prisma:generate` + `build:backend`
   - Frontend: `build:frontend`
   - Scheduler: `prisma:generate` + `build:scheduler`
   - Backoffice: `build:backoffice`
4. ✅ Crea tutte le cartelle `dist/` su Heroku
5. ✅ Avvia app da `dist/`

### 4. Monitora Deploy

```bash
# Logs Backend+Frontend in tempo reale
heroku logs --tail --app echatbot-app

# Logs Scheduler
heroku logs --tail --app echatbot-scheduler

# Logs Backoffice
heroku logs --tail --app echatbot-backoffice

# Verifica build completato (cerca "Build succeeded")
heroku logs --tail --app echatbot-app | grep "Build succeeded"

# Verifica app running
heroku ps --app echatbot-app
heroku ps --app echatbot-scheduler  # Deve mostrare worker.1
heroku ps --app echatbot-backoffice
```

### 5. Verifica Endpoint

```bash
# Test API Backend
curl https://echatbot-app.herokuapp.com/health
# Output atteso: {"status":"ok","timestamp":"...","version":"1.0.0"}

# Test Frontend (deve caricare pagina HTML)
curl https://echatbot.ai

# Test Backoffice (deve caricare pagina HTML)
curl https://backoffice.echatbot.ai

# Test Scheduler (NON espone web server, solo worker)
heroku ps --app echatbot-scheduler  # Verifica worker running
```
# Segui i logs in tempo reale
# Segui i logs in tempo reale
heroku logs --tail

# Controlla solo errori
heroku logs --tail | grep "ERROR"
```

---

## 🗄️ Database Setup Iniziale

### 1. Seed Database (ATTENZIONE!)

⚠️ **IMPORTANTE**: Lo script seed è BLOCCATO in produzione per sicurezza!

Se **devi assolutamente** eseguire seed in produzione (crea dati test):

```bash
# ⚠️ Questo cancellerà tutti i dati e ricreerà da zero!
heroku run "ALLOW_DESTRUCTIVE_OPERATIONS=true npm run prisma:seed"
```

**ALTERNATIVA SICURA** (per produzione vera):

1. Crea il primo admin manualmente tramite Prisma Studio:

```bash
# Apri Prisma Studio connesso al DB Heroku
heroku config:get DATABASE_URL
# Copia l'URL e usalo in locale:
DATABASE_URL="<url-copiato>" npx prisma studio
```

2. Oppure crea uno script custom per inserire solo admin (senza cancellare tutto).

### 2. Verifica Database

```bash
# Connettiti al database Heroku
heroku pg:psql

# Esegui query
SELECT * FROM "User" WHERE role = 'ADMIN';
\q  # Per uscire
```

---

##  Backup Database

### Backup Automatico (incluso con Heroku Postgres Mini)

- ✅ **Backup giornaliero automatico** (ritenzione 4 giorni)
- ✅ **Rollback automatico** disponibile

```bash
# Lista backup disponibili
heroku pg:backups

# Crea backup manuale
heroku pg:backups:capture

# Scarica ultimo backup
heroku pg:backups:download

# Restore da backup (ATTENZIONE: sovrascrive DB!)
heroku pg:backups:restore b001 DATABASE_URL
```

### Backup Manuale (esportazione locale)

```bash
# Esporta database completo
heroku pg:backups:capture
heroku pg:backups:download -o echatbot-backup-$(date +%Y%m%d).dump

# Oppure export diretto via pg_dump
heroku pg:psql --command "\\copy (SELECT * FROM \"User\") TO 'users.csv' CSV HEADER"
```

---

## 🔧 Operazioni Post-Deploy

### 1. Verifica App Funzionanti (tutte e 4)

```bash
# Apri le app nel browser
heroku open --app echatbot-app         # Frontend
heroku open --app echatbot-app         # API (mostra JSON health)
heroku open --app echatbot-backoffice  # Backoffice

# Test endpoint API completo
curl https://echatbot-app.herokuapp.com/health
# Output atteso:
# {"status":"ok","timestamp":"2025-12-30T...","version":"1.0.0","apiVersion":"v1"}

# Verifica Scheduler worker
heroku ps --app echatbot-scheduler
# Output atteso: worker.1: up 2025/12/30 10:00:00 +0000 (~ 1m ago)
```

### 2. Controlla Logs

```bash
# Logs in tempo reale
heroku logs --tail

# Logs solo del web process
heroku logs --tail --ps web

# Filtra per errori
heroku logs --tail | grep "ERROR"
```

### 3. Accedi come Admin

1. Vai su: `https://echatbot-production.herokuapp.com/auth/login`
2. Login con credenziali configurate:
   - Email: valore di `ADMIN_EMAIL`
   - Password: valore di `ADMIN_PASSWORD`

---

## 📈 Scaling & Performance

### Upgrade Dyno (se app lenta)

```bash
# Lista dyno attuali
heroku ps

# Upgrade a Standard 1X ($25/mese - 512MB RAM)
heroku dyno:resize web=standard-1x

# Oppure Standard 2X ($50/mese - 1GB RAM)
heroku dyno:resize web=standard-2x

# Scala orizzontalmente (più istanze)
heroku ps:scale web=2  # 2 istanze in parallelo
```

### Database Performance

```bash
# Statistiche database
heroku pg:info

# Connessioni attive
heroku pg:psql --command "SELECT * FROM pg_stat_activity;"

# Upgrade database (più storage/connessioni)
heroku addons:upgrade heroku-postgresql:standard-0  # $50/mese - 64GB
```

---

## 🚨 Troubleshooting

### App non si avvia

```bash
# Verifica logs
heroku logs --tail

# Controlla build
heroku releases

# Rollback all'ultima versione funzionante
heroku rollback
```

### Errore DATABASE_URL

```bash
# Verifica DATABASE_URL esiste
heroku config:get DATABASE_URL

# Se manca, aggiungi Postgres
heroku addons:create heroku-postgresql:mini
```

### Prisma Migrations Fallite

```bash
# Reset migrations (ATTENZIONE: perde dati!)
heroku run "ALLOW_DESTRUCTIVE_OPERATIONS=true npx prisma migrate reset"

# Oppure applica solo migrations
heroku run "npx prisma migrate deploy"
```

### File Statici Non Caricano

- Verifica che `npm run build` abbia creato `apps/frontend/dist/`
- Controlla logs per path: `[Production] Serving frontend from: ...`
- Se manca, verifica `.slugignore` non escluda `dist/`

---

## 💰 Costi Mensili Stimati

**Setup Minimo Produzione (CONSIGLIATO per partire):**

| Risorsa           | Piano          | Costo/mese | Note |
| ----------------- | -------------- | ---------- | ---- |
| Dyno (web)        | Eco            | $5         | 1000 ore/mese |
| Postgres          | Mini           | $5         | 10GB + backup automatico |
| **TOTALE**        |                | **$10**    | ✅ Setup completo + backup |

**Setup Performance (se traffico alto):**

| Risorsa           | Piano          | Costo/mese | Note |
| ----------------- | -------------- | ---------- | ---- |
| Dyno (web)        | Standard 1X    | $25        | 512MB RAM, sempre attivo |
| Postgres          | Standard 0     | $50        | 64GB + backup avanzato |
| **TOTALE**        |                | **$75**    | Performance + scalabilità |

**Setup Zero-Budget (SOLO TEST - non affidabile):**

| Risorsa           | Piano          | Costo/mese | Limiti |
| ----------------- | -------------- | ---------- | ------ |
| Dyno (web)        | Eco            | $5         | Sleep dopo 30min inattività |
| Postgres          | Essential-0    | $0         | ⚠️ NO BACKUP! Può perdere dati |
| Storage           | Database BLOB  | $0         | ⚠️ Rallenta DB, max 1GB totale |
| **TOTALE**        |                | **$5**     | ⚠️ SOLO per demo/test |

---

## 🔗 Link Utili

- **Heroku Dashboard**: https://dashboard.heroku.com/apps/echatbot-production
- **Postgres Dashboard**: https://data.heroku.com/
- **Logs**: `heroku logs --tail`
- **Metrics**: https://dashboard.heroku.com/apps/echatbot-production/metrics

---

## ✅ Checklist Deploy Completo

- [ ] Heroku CLI installato e login fatto
- [ ] App Heroku creata (`heroku create`)
- [ ] Postgres addon aggiunto (`heroku-postgresql:mini`)
- [ ] Cloudinary configurato (`heroku config:set CLOUDINARY_URL=...`)
- [ ] Tutte le env variables configurate (JWT_SECRET, DATABASE_URL, etc.)
- [ ] Deploy fatto (`git push heroku main`)
- [ ] Migrations eseguite (automatico via `release` command)
- [ ] Database seed/setup iniziale (se necessario)
- [ ] Login admin testato
- [ ] API endpoints testano (`/health`, `/api/...`)
- [ ] Frontend carica correttamente
- [ ] Upload immagini funziona (Cloudinary)
- [ ] Backup database verificato (`heroku pg:backups`)

---

**Pronto per produzione! 🚀**

---

## 📚 Riferimenti Addon

- **Postgres**: https://elements.heroku.com/addons/heroku-postgresql
- **Dashboard Heroku**: https://dashboard.heroku.com/
