# 🚀 Heroku Deployment Guide - eChatbot

Guida completa per deployment di eChatbot su Heroku (monolith app: Backend + Frontend + Scheduler).

---

## 📋 Prerequisiti

1. **Account Heroku**: https://signup.heroku.com/
2. **Heroku CLI installato**: `brew tap heroku/brew && brew install heroku`
3. **Git repository inizializzato** (già fatto ✅)
4. **Carta di credito collegata** (per Postgres addon, anche con free tier)

---

## 🏗️ Setup Iniziale Heroku

### 1. Login e Creazione App

```bash
# Login a Heroku
heroku login

# Crea nuova app (scegli nome unico)
heroku create echatbot-production

# Oppure se hai già un nome specifico:
# heroku create nome-tua-app

# Verifica remote git
git remote -v
# Dovresti vedere: heroku  https://git.heroku.com/echatbot-production.git
```

### 2. Aggiungi Postgres Database

```bash
# Heroku Postgres Mini ($5/mese - 10GB storage, 20 connections)
# ✅ Include backup automatico giornaliero + rollback 4 giorni
heroku addons:create heroku-postgresql:mini

# Oppure free tier per test (1GB, 20 connections, NO BACKUP!)
# ⚠️ NON USARE IN PRODUZIONE - dati possono essere persi
# heroku addons:create heroku-postgresql:essential-0

# Verifica DATABASE_URL è stata creata automaticamente
heroku config:get DATABASE_URL
```

**IMPORTANTE**: 
- ✅ **Mini ($5/mese)** include backup automatico + rollback → OBBLIGATORIO per produzione
- ❌ **Essential-0 (free)** NO backup, può perdere dati → solo per test

### 3. Configura Variabili d'Ambiente

```bash
# 🔐 SECURITY (OBBLIGATORIO)
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -hex 64)

# 🌐 Frontend URL (cambia con il tuo dominio Heroku)
heroku config:set FRONTEND_URL=https://echatbot-production.herokuapp.com

# 👤 Admin iniziale (cambia password!)
heroku config:set ADMIN_EMAIL=admin@tuodominio.com
heroku config:set ADMIN_PASSWORD="TuaPasswordSicura123!"

# 🤖 LLM / AI (OpenRouter)
heroku config:set OPENROUTER_API_KEY=your_openrouter_key_here

# 📧 Email (Nodemailer - Gmail esempio)
heroku config:set EMAIL_HOST=smtp.gmail.com
heroku config:set EMAIL_PORT=587
heroku config:set EMAIL_USER=tua-email@gmail.com
heroku config:set EMAIL_PASSWORD="tua-app-password"
heroku config:set EMAIL_FROM="eChatbot <noreply@tuodominio.com>"

# 📱 WhatsApp (se attivo)
heroku config:set WHATSAPP_API_URL=https://api.whatsapp.com
heroku config:set WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
heroku config:set WHATSAPP_ACCESS_TOKEN=your_whatsapp_token
heroku config:set WHATSAPP_VERIFY_TOKEN=your_verify_token

# 🗂️ Storage File Statici (Bucketeer - S3 Compatible)

### IMPORTANTE: NON serve AWS S3!
Heroku ha storage **effimero** (si cancella ad ogni deploy).
Usiamo **Bucketeer addon** = storage persistente S3-compatible SENZA account AWS!

```bash
# Aggiungi Bucketeer addon ($5/mese - 1GB storage)
heroku addons:create bucketeer:micro

# Verifica credenziali create automaticamente
heroku config | grep BUCKETEER

# Output:
# BUCKETEER_AWS_ACCESS_KEY_ID=xxx
# BUCKETEER_AWS_REGION=us-east-1
# BUCKETEER_AWS_SECRET_ACCESS_KEY=xxx
# BUCKETEER_BUCKET_NAME=bucketeer-xxx-xxx

# Alias variabili per il nostro codice (StorageService)
heroku config:set AWS_ACCESS_KEY_ID=$(heroku config:get BUCKETEER_AWS_ACCESS_KEY_ID)
heroku config:set AWS_SECRET_ACCESS_KEY=$(heroku config:get BUCKETEER_AWS_SECRET_ACCESS_KEY)
heroku config:set AWS_REGION=$(heroku config:get BUCKETEER_AWS_REGION)
heroku config:set AWS_S3_BUCKET=$(heroku config:get BUCKETEER_BUCKET_NAME)
```

**Alternative plans:**
- `bucketeer:micro` - $5/mese - 1GB storage + 1GB transfer
- `bucketeer:kilo` - $15/mese - 10GB storage + 10GB transfer
- `bucketeer:mega` - $50/mese - 100GB storage + 100GB transfer

### Come funziona?
- ✅ Bucketeer usa protocollo S3 (compatibile con `@aws-sdk/client-s3`)
- ✅ Il nostro `StorageService` funziona SENZA modifiche
- ✅ Backup automatico incluso
- ✅ NON serve account AWS

---

## 🔄 ALTERNATIVA: Storage Database (se budget zero)

Se vuoi **zero costi storage** (solo per test, NON produzione):
- Salva immagini come BLOB in Postgres
- ⚠️ **SCONSIGLIATO**: rallenta DB, dimensione limitata
- Solo per piccoli loghi/avatar, MAI per catalogo prodotti

```bash
# NO addon necessario, usa solo Postgres
# Modifica codice per salvare in DB come bytea
```

# 🔑 Google OAuth (opzionale)
heroku config:set GOOGLE_CLIENT_ID=your_google_client_id
heroku config:set GOOGLE_CLIENT_SECRET=your_google_client_secret

# ⏱️ Token expiration (default: 1h per link WhatsApp)
heroku config:set TOKEN_EXPIRATION=1h
```

### 4. Verifica Configurazione

```bash
# Lista tutte le variabili configurate
heroku config

# Controlla specificamente DATABASE_URL
heroku config:get DATABASE_URL
```

---

## 🚀 Deploy

### 1. Build Locale (opzionale - test prima di deploy)

```bash
# Test build in locale
npm run build

# Test start in locale (simula produzione)
NODE_ENV=production npm run start:all

# Verifica su http://localhost:3001
```

### 2. Deploy su Heroku

```bash
# Commit eventuali modifiche
git add .
git commit -m "feat: Heroku deployment configuration"

# Push su Heroku (avvia deploy automatico)
git push heroku main

# Oppure se il tuo branch principale è "master":
# git push heroku master:main
```

**Cosa succede durante il deploy:**

1. ✅ Heroku installa dipendenze (`npm install`)
2. ✅ Esegue `heroku-postbuild`: `prisma generate` + `npm run build`
3. ✅ Esegue release command: `npm run prisma:migrate:prod` (migrations)
4. ✅ Avvia app con `web` process dal Procfile: `npm run start:all`

### 3. Monitora Deploy

```bash
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

### 1. Verifica App Funzionante

```bash
# Apri app nel browser
heroku open

# Test endpoint API
curl https://echatbot-production.herokuapp.com/health

# Dovresti vedere:
# {"status":"ok","timestamp":"2025-12-26T...","version":"1.0.0","apiVersion":"v1"}
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
| Bucketeer (storage) | Micro        | $5         | 1GB immagini/file |
| **TOTALE**        |                | **$15**    | ✅ Setup completo + backup |

**Setup Performance (se traffico alto):**

| Risorsa           | Piano          | Costo/mese | Note |
| ----------------- | -------------- | ---------- | ---- |
| Dyno (web)        | Standard 1X    | $25        | 512MB RAM, sempre attivo |
| Postgres          | Standard 0     | $50        | 64GB + backup avanzato |
| Bucketeer         | Kilo           | $15        | 10GB storage + 10GB transfer |
| **TOTALE**        |                | **$90**    | Performance + scalabilità |

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
- [ ] Bucketeer addon aggiunto (`heroku addons:create bucketeer:micro`)
- [ ] Variabili Bucketeer copiate in AWS_* (`heroku config:set AWS_ACCESS_KEY_ID=...`)
- [ ] Tutte le env variables configurate (JWT_SECRET, DATABASE_URL, etc.)
- [ ] Deploy fatto (`git push heroku main`)
- [ ] Migrations eseguite (automatico via `release` command)
- [ ] Database seed/setup iniziale (se necessario)
- [ ] Login admin testato
- [ ] API endpoints testano (`/health`, `/api/...`)
- [ ] Frontend carica correttamente
- [ ] Upload immagini funziona (Bucketeer)
- [ ] Backup database verificato (`heroku pg:backups`)

---

**Pronto per produzione! 🚀**

---

## 📚 Riferimenti Addon

- **Bucketeer**: https://elements.heroku.com/addons/bucketeer
- **Postgres**: https://elements.heroku.com/addons/heroku-postgresql
- **Dashboard Heroku**: https://dashboard.heroku.com/
