# eChatbot Scheduler Microservice

Microservizio per job schedulati. Progetto separato dal backend, stesso database PostgreSQL.

## 📋 Cron Jobs

| # | Job | Schedule | Cron | Description |
|---|-----|----------|------|-------------|
| 1 | WhatsApp Challenge Queue | Ogni 3 min | `*/3 * * * *` | Invia messaggi dalla coda |
| 2 | Short URLs Cleanup | 23:00 daily | `0 23 * * *` | Elimina link scaduti |
| 3 | Blocked Customers Cleanup | 23:01 ogni 3gg | `1 23 */3 * *` | Elimina conversazioni clienti bloccati |
| 4 | Unused Images Cleanup | 23:02 daily | `2 23 * * *` | Elimina immagini orfane |
| 5 | Monthly Billing | 1° mese 12:00 | `0 12 1 * *` | Addebita fee mensile |

## 🚀 Quick Start

### Development

```bash
# Copia .env dal backend
cp ../backend/.env .env

# Aggiungi ALERT_EMAIL al .env
echo 'ALERT_EMAIL="tua-email@gmail.com"' >> .env

# Installa dipendenze
npm install

# Genera Prisma client
npx prisma generate

# Avvia in development (hot-reload)
npm run dev
```

### Production (PM2)

```bash
# Build e avvia con PM2
npm run prod

# Controlla status
npm run status

# Vedi logs
npm run logs

# Stop
npm run stop
```

## 📁 Struttura

```
scheduler/
├── package.json
├── tsconfig.json
├── ecosystem.config.js     # PM2 config
├── .env                    # Variabili ambiente
├── src/
│   ├── index.ts            # Entry point + cron schedule
│   ├── config/
│   │   └── database.ts     # Prisma client
│   ├── jobs/
│   │   ├── whatsapp-challenge-queue.job.ts
│   │   ├── short-urls-cleanup.job.ts
│   │   ├── blocked-customers-cleanup.job.ts
│   │   ├── unused-images-cleanup.job.ts
│   │   └── monthly-billing.job.ts
│   ├── services/
│   │   ├── job-runner.service.ts    # Wrapper con DB logging
│   │   └── email-alert.service.ts   # Alert su errore
│   └── utils/
│       └── logger.ts
```

## 🔧 Configurazione

### Variabili .env richieste

```env
# Database (stesso del backend)
DATABASE_URL="postgresql://user:pass@host:port/db"

# Email Alert
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="tua-email@gmail.com"
SMTP_PASS="app-password"
SMTP_FROM="noreplay@echatbot.ai"
ALERT_EMAIL="tua-email@gmail.com"
```

## 📊 Monitoring

### Database: `scheduler_job_status`

Ogni job aggiorna la sua riga nella tabella (1 record per job):

| jobName | lastRunAt | lastStatus | lastError | lastDuration |
|---------|-----------|------------|-----------|--------------|
| whatsapp-challenge-queue | 2025-11-28 14:03:00 | SUCCESS | null | 1234 |
| short-urls-cleanup | 2025-11-28 23:00:00 | FAILED | "Connection error" | 89 |

### Stati possibili

- `NEVER_RUN` - Mai eseguito
- `RUNNING` - In esecuzione
- `SUCCESS` - Completato con successo
- `FAILED` - Fallito (+ email alert)

### Email Alert

Se un job fallisce, viene inviata email immediata a `ALERT_EMAIL` con:
- Nome job
- Timestamp
- Messaggio errore
- Stack trace

## 🛠 Comandi utili

```bash
# Logs PM2
pm2 logs echatbot-scheduler

# Monitor real-time
pm2 monit

# Restart
pm2 restart echatbot-scheduler

# Status tutti i processi
pm2 status
```

## ⚠️ Note

- Lo scheduler usa lo **stesso database** del backend
- Esegui `npx prisma generate` dopo ogni modifica allo schema
- PM2 riavvia automaticamente se il processo crasha
- Solo **1 istanza** per evitare job duplicati
