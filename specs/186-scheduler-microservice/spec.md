# Feature Specification: Scheduler Microservice

**Feature Branch**: `186-scheduler-microservice`  
**Created**: 2025-11-28  
**Status**: Draft

## Overview

Microservizio dedicato per job schedulati. Progetto separato dal backend principale, stesso database PostgreSQL, gestito con PM2 in produzione.

**Monitoring**: 
- Tabella DB `scheduler_job_status` con 1 record per job (ultimo stato)
- Email alert immediata su errore

## Cron Jobs

| # | Job | Schedule | Cron Expression | Description |
|---|-----|----------|-----------------|-------------|
| 1 | **WhatsApp Challenge Queue** | Ogni 3 minuti | `*/3 * * * *` | Invia messaggi dalla coda SE il workspace ha `challenge = true` |
| 2 | **Short URLs Cleanup** | Ogni giorno 23:00 | `0 23 * * *` | Elimina short URLs con `expiresAt < now()` |
| 3 | **Blocked Customers Cleanup** | Ogni 3 giorni 23:01 | `1 23 */3 * *` | Elimina conversazioni di clienti con `isBlocked = true` |
| 4 | **Unused Images Cleanup** | Ogni giorno 23:02 | `2 23 * * *` | Elimina immagini in `uploads/` non referenziate nel DB |
| 5 | **Monthly Billing** | 1° del mese 12:00 | `0 12 1 * *` | Preleva credito mensile dal cliente (subscription billing) |

## Database: Job Status Table

**1 record per job** - aggiornato ad ogni esecuzione (no storico):

```prisma
model SchedulerJobStatus {
  id            String    @id @default(cuid())
  jobName       String    @unique  // "whatsapp-challenge-queue", "short-urls-cleanup", etc.
  lastRunAt     DateTime?          // Last execution timestamp
  lastStatus    String    @default("NEVER_RUN")  // "SUCCESS", "FAILED", "RUNNING", "NEVER_RUN"
  lastError     String?            // Error message if failed
  lastDuration  Int?               // Duration in milliseconds
  nextRunAt     DateTime?          // Calculated next run time
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@map("scheduler_job_status")
}
```

### Esempio dati nella tabella:

| jobName | lastRunAt | lastStatus | lastError | lastDuration |
|---------|-----------|------------|-----------|--------------|
| whatsapp-challenge-queue | 2025-11-28 14:03:00 | SUCCESS | null | 1234 |
| short-urls-cleanup | 2025-11-28 23:00:00 | SUCCESS | null | 89 |
| blocked-customers-cleanup | 2025-11-26 23:01:00 | FAILED | "DB connection error" | 5000 |
| unused-images-cleanup | 2025-11-28 23:02:00 | SUCCESS | null | 3456 |
| monthly-billing | 2025-11-01 12:00:00 | SUCCESS | null | 12000 |

## Project Structure

```
scheduler/
├── package.json
├── tsconfig.json
├── ecosystem.config.js      # PM2 config
├── README.md                 # Documentazione completa
├── .env.example
├── src/
│   ├── index.ts             # Entry point
│   ├── config/
│   │   └── database.ts      # Prisma client
│   ├── jobs/
│   │   ├── index.ts         # Job registry
│   │   ├── whatsapp-challenge-queue.job.ts
│   │   ├── short-urls-cleanup.job.ts
│   │   ├── blocked-customers-cleanup.job.ts
│   │   ├── unused-images-cleanup.job.ts
│   │   └── monthly-billing.job.ts
│   ├── services/
│   │   ├── job-runner.service.ts   # Wrapper: DB update + email alert
│   │   └── email-alert.service.ts  # Invia email su errore
│   └── utils/
│       └── logger.ts
```

## Job Runner Service

Ogni job viene eseguito tramite questo wrapper che:
1. Aggiorna DB con status "RUNNING"
2. Esegue il job
3. Aggiorna DB con "SUCCESS" o "FAILED"
4. Se FAILED → invia email alert

```typescript
// src/services/job-runner.service.ts
import { prisma } from '../config/database'
import { sendJobErrorAlert } from './email-alert.service'
import logger from '../utils/logger'

export async function runJob(jobName: string, fn: () => Promise<void>) {
  const start = Date.now()
  
  // Mark as RUNNING
  await prisma.schedulerJobStatus.upsert({
    where: { jobName },
    create: { jobName, lastStatus: 'RUNNING', lastRunAt: new Date() },
    update: { lastStatus: 'RUNNING', lastRunAt: new Date(), lastError: null }
  })
  
  try {
    logger.info(`⏰ Starting job: ${jobName}`)
    await fn()
    
    // Mark as SUCCESS
    await prisma.schedulerJobStatus.update({
      where: { jobName },
      data: { 
        lastStatus: 'SUCCESS', 
        lastDuration: Date.now() - start,
        lastError: null
      }
    })
    logger.info(`✅ Job completed: ${jobName} (${Date.now() - start}ms)`)
    
  } catch (error) {
    const errorMsg = (error as Error).message
    
    // Mark as FAILED
    await prisma.schedulerJobStatus.update({
      where: { jobName },
      data: { 
        lastStatus: 'FAILED', 
        lastDuration: Date.now() - start,
        lastError: errorMsg
      }
    })
    
    logger.error(`❌ Job FAILED: ${jobName}`, error)
    await sendJobErrorAlert(jobName, error as Error)
  }
}
```

## Email Alert System

Variabili .env (stesse del backend):
```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="gelsogrove@gmail.com"
SMTP_PASS="ecix cwmk oehi qrkl"
SMTP_FROM="noreplay@shopme.com"
ALERT_EMAIL="gelsogrove@gmail.com"
```

## Functional Requirements

- **FR-001**: `npm run dev` → avvia con hot-reload (ts-node-dev)
- **FR-002**: `npm run prod` → avvia con PM2 (auto-restart)
- **FR-003**: Stesso database del backend (shared Prisma schema)
- **FR-004**: Aggiorna tabella `scheduler_job_status` ad ogni esecuzione
- **FR-005**: Email alert immediata su errore job

## Scripts

```json
{
  "scripts": {
    "dev": "dotenv -c .env -- tsnd --respawn src/index.ts",
    "build": "tsc",
    "prod": "npm run build && pm2 start ecosystem.config.js",
    "stop": "pm2 stop shopme-scheduler",
    "logs": "pm2 logs shopme-scheduler",
    "test": "jest"
  }
}
```

## Success Criteria

- [ ] `npm run dev` avvia e logga "Scheduler started"
- [ ] Ogni job esegue al tempo schedulato
- [ ] Tabella `scheduler_job_status` aggiornata correttamente
- [ ] Email alert funziona su errore job
- [ ] PM2 riavvia automaticamente se crasha
- [ ] README.md completo con setup e deployment
