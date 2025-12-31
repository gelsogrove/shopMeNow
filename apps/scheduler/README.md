# eChatbot Scheduler Microservice

Microservizio per job schedulati. Progetto separato dal backend, stesso database PostgreSQL.

## 📋 Cron Jobs

| # | Job | Schedule | Cron | Description |
|---|-----|----------|------|-------------|
| 1 | WhatsApp Channel Queue | Ogni 3 sec | `*/3 * * * * *` | Invia messaggi dalla coda WhatsApp |
| 2 | Short URLs Cleanup | 23:00 daily | `0 23 * * *` | Elimina short URL scaduti |
| 3 | Unused Images Cleanup | 23:05 daily | `5 23 * * *` | Elimina immagini orfane |
| 4 | Messages Archive | 23:10 daily | `10 23 * * *` | Archivia messaggi > 6 mesi |
| 5 | WhatsApp Queue Cleanup | 23:15 daily | `15 23 * * *` | Elimina errori/sent > 7 giorni |
| 6 | Monthly Billing | 1° mese 23:30 | `30 23 1 * *` | Genera billing mensile |

## 🎛️ Enable/Disable Jobs

I job possono essere attivati/disattivati dal **Backoffice**:
- URL: `http://localhost:3002/schedulers`
- Toggle `isActive` per ogni job
- I job disattivati vengono saltati (status: `SKIPPED`)

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
├── src/
│   ├── index.ts            # Entry point + cron schedule
│   ├── config/
│   │   └── database.ts     # Prisma client
│   ├── jobs/
│   │   ├── whatsapp-channel-queue.job.ts
│   │   ├── short-urls-cleanup.job.ts
│   │   ├── unused-images-cleanup.job.ts
│   │   ├── messages-archive.job.ts
│   │   ├── whatsapp-queue-cleanup.job.ts
│   │   └── monthly-billing.job.ts
│   ├── services/
│   │   ├── job-runner.service.ts    # Wrapper con DB logging + isActive check
│   │   └── email-alert.service.ts   # Alert su errore
│   └── utils/
│       └── logger.ts
```

## �� Configurazione

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

Ogni job aggiorna la sua riga nella tabella:

| Campo | Tipo | Descrizione |
|-------|------|-------------|
| jobName | string | Nome univoco del job |
| isActive | boolean | Se false, il job viene saltato |
| lastRunAt | DateTime | Ultima esecuzione |
| lastStatus | string | SUCCESS, FAILED, RUNNING, SKIPPED, NEVER_RUN |
| lastError | string? | Messaggio errore se fallito |
| lastDuration | int? | Durata in ms |

### Backoffice

La pagina `/schedulers` mostra:
- Lista di tutti i job con stato
- Toggle per attivare/disattivare
- Ultima esecuzione e durata
- Eventuali errori

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```
