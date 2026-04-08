# 📅 Feature: Calendar & Appointment Booking System with Google Calendar Integration

## 🎯 Obiettivo

Introdurre un sistema completo di **Calendario Appuntamenti** integrato con **Google Calendar** come unica fonte di verità. Il workspace owner (es. dentista, commerciale, installatore) collega il proprio account Google Calendar, configura i tipi di servizio prenotabili, e i clienti possono prenotare appuntamenti direttamente dalla chat. Gli eventi vengono salvati direttamente in Google Calendar, con **Reminder Automatici** via WhatsApp/Widget nella lingua del cliente.

---

## 🔑 Decisione Architetturale Critica: Google Calendar come Single Source of Truth

**APPROCCIO SCELTO**: Google Calendar è l'**unica fonte di verità** per gli appuntamenti. 

**Cosa significa**:
- ❌ **NO tabella `Appointment` nel DB** - gli eventi vivono SOLO in Google Calendar
- ✅ **OAuth 2.0** - workspace owner collega il suo account Google
- ✅ **Google Calendar API** - tutte le operazioni (create, read, update, delete) chiamano l'API
- ✅ **Bi-directional sync** - modifiche in Google Calendar riflettono nel sistema (e viceversa)
- ✅ **Admin usa Google Calendar UI** - per gestire il calendario (nessuna UI duplicata nel nostro sistema)

**Vantaggi**:
- ✅ Workspace owner usa strumento familiare (Google Calendar)
- ✅ Può modificare/spostare appuntamenti da mobile Google Calendar app
- ✅ Sincronizzazione automatica con altri servizi (Zoom, Meet, etc.)
- ✅ Backup automatico (Google infra)

**Trade-offs**:
- ⚠️ Dipendenza da Google Calendar API (se Google down → booking temporaneamente non disponibile)
- ⚠️ Rate limit 180 req/min per account (sufficiente per uso tipico)
- ⚠️ +3 giorni implementazione (OAuth + error handling)

---

## 🎯 RIEPILOGO DECISIONI DI ANDREA

Dopo discussione con Andrea su 4 punti critici:

| # | Decisione | Implementazione |
|---|-----------|---|
| **1️⃣** | **Chiedi conferma** | Flusso a 2 step: prima LLM propone, poi cliente conferma "sì"/"no" |
| **2️⃣** | **Testo + link** | Response contiene sia testo formattato che link Google Calendar diretto |
| **3️⃣** | **Google offline fallback** | Messaggio: "⚠️ Prenotazione in sospeso, ti faremo sapere!" (salva in PendingAppointment) |
| **4️⃣** | **Admin sincro manuale** | NO auto-sync da Google Calendar. Admin deve clickare "Sync Now" nel dashboard |

---

## 🔑 Decisione Architetturale Critica: Google Calendar come Single Source of Truth

**APPROCCIO SCELTO**: Google Calendar è l'**unica fonte di verità** per gli appuntamenti.

---

## 📐 Architettura Concettuale

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKSPACE SETTINGS                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Calendar: [ON/OFF]                                       │   │
│  │  ──────────────────────────────────────────────────────  │   │
│  │  Google Calendar: [Connect Account] 🔗                   │   │
│  │    Status: ✅ Connected (email@gmail.com)                 │   │
│  │  ──────────────────────────────────────────────────────  │   │
│  │  Se ON → mostra tabella "Appointment Types"              │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │ Service Type │ Duration │ Buffer │ Reminder │ Active │  │   │
│  │  │──────────────│──────────│────────│──────────│────────│  │   │
│  │  │ Pulizia denti│ 30 min   │ 15min  │ 24h      │ ✅     │  │   │
│  │  │ TAC          │ 45 min   │ 30min  │ 48h      │ ✅     │  │   │
│  │  │ Estrazione   │ 60 min   │ 30min  │ 24h      │ ❌     │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                                                            │   │
│  │  Business Hours: Mon-Fri 09:00-18:00 (customizable)      │   │
│  │  Blackout Periods: [Add Holiday/Vacation]                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GOOGLE OAUTH FLOW (One-Time Setup)            │
│                                                                   │
│  Admin clicks "Connect Google Calendar"                          │
│      ↓                                                            │
│  1. Redirect to Google OAuth consent screen                      │
│  2. Admin grants calendar.events + calendar.readonly permissions │
│  3. Google returns access_token + refresh_token                  │
│  4. Backend saves tokens in GoogleCalendarConnection table       │
│  5. Status: ✅ Connected                                          │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│        🔥 FLUSSO CHAT (WhatsApp/Widget) - CON CONFERMA           │
│                                                                   │
│  Cliente: "Vorrei prenotare una pulizia denti martedì alle 10"   │
│      ↓                                                            │
│  Router LLM → intent = BOOKING_REQUEST → bookingAgent           │
│      ↓                                                            │
│  BOOKING_AGENT LLM: riconosce TYPE + DATE + TIME                │
│      ↓                                                            │
│  [PASSO 1] getAvailableSlots() → verifica slot libero          │
│      ↓                                                            │
│  [PASSO 2] Bot propone: "Confermi prenotazione martedì 15 Aprile│
│            ore 10:00?"                                           │
│      ↓                                                            │
│  [PASSO 3] Cliente risponde "sì" o "no"                         │
│      ↓                                                            │
│  SE "sì":                                                         │
│    - bookAppointment() → crea event Google Calendar              │
│    - Bot: "✅ Confermato! + link Google Calendar"                │
│  SE "no":                                                         │
│    - Bot: "Nessun problema. Vuoi scegliere un altro orario?"     │
│    - getAvailableSlots() → suggerisce alternative               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         🔥 RESPONSE MESSAGGIO (Testo + Link Google Calendar)     │
│                                                                   │
│  ✅ Prenotazione confermata!                                     │
│  📅 Pulizia denti                                                │
│  📆 Martedì 15 Aprile 2026 ore 10:00 (CET)                     │
│  ⏱️ Durata: 30 minuti + 15 min buffer                            │
│  📩 Riceverai un reminder 24h prima!                             │
│  🔗 Apri in Google Calendar: https://calendar.google.com/event..│
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GOOGLE CALENDAR (Source of Truth)             │
│                                                                   │
│  Event creato con:                                               │
│    • summary: "Pulizia denti - Mario Rossi"                      │
│    • start: 2026-04-15T10:00:00+02:00 (timezone-aware)          │
│    • end: 2026-04-15T10:45:00+02:00 (duration+buffer)           │
│    • extendedProperties.private:                                 │
│        - workspaceId: "wks_123"                                  │
│        - customerId: "cust_456"                                  │
│        - appointmentTypeId: "clx123"                             │
│        - shopMeSource: "true"  ← flag per filtering              │
│        - reminderSent: "false"                                   │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│     🔥 GOOGLE CALENDAR OFFLINE - FALLBACK GRACEFUL               │
│                                                                   │
│  Se Google Calendar API unavailable:                             │
│    ↓                                                              │
│  Bot risponde: "⚠️ Prenotazione in sospeso, ti faremo sapere!"   │
│    ↓                                                              │
│  Backend SALVA in "PendingAppointment" table                     │
│    ↓                                                              │
│  Admin vede dashboard con "Pending Google Calendar Sync"         │
│    ↓                                                              │
│  Admin deve MANUALMENTE fare una di:                             │
│    • Ricaricare pagina (che trigga sync manuale)                 │
│    • Clickare bottone "Sync Now" nel dashboard                   │
│    • Attendere che Google Calendar torni online                  │
│                                                                   │
│  NO AUTO-SYNC: deciso da Andrea che l'admin controlla il rischio│
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SCHEDULER (Cron Job)                          │
│                                                                   │
│  appointment-reminder.job.ts                                     │
│  Schedule: ogni 30 minuti                                        │
│                                                                   │
│  1. Per ogni workspace con Google Calendar connected:           │
│     a. Chiama Google Calendar API listEvents()                  │
│     b. Filtra: events con shopMeSource=true + reminderSent=false│
│     c. Filtra: scheduledAt tra NOW e NOW+48h                    │
│     d. Per ogni event:                                           │
│        - Calcola reminderTime = scheduledAt - reminderHours     │
│        - Se NOW >= reminderTime:                                │
│          • ATOMIC LOCK: Update event.reminderSent = "sending"   │
│          • Replace variables in reminderMessage                 │
│          • Translate to customer.language (timezone-aware)      │
│          • Route by channel (WhatsApp €0.50 / Email free)       │
│          • Update event.reminderSent = "true"                   │
│          • Billing: deduct €0.50 if WhatsApp                    │
│  2. Log: { sent(whatsapp: N, email: M), skipped, failed }       │
│                                                                   │
│  ⚠️ SE ADMIN CANCELLA EVENTO DA GOOGLE CALENDAR:                 │
│     → Faremo noi MANUALMENTE tramite webhook monitoring         │
│     → NO auto-delete dal nostro sistema                          │
│     → Admin vede il cambio al prossimo sync di cache             │
└─────────────────────────────────────────────────────────────────┘
```

---

## � ARCHITETTURE DECISIONALI CRITICHE

### Decisione A: Slot Availability Check (Race Condition Prevention)

**Problema**: Quando cliente A e B prenotano lo stesso slot contemporaneamente, come preveniamo double-booking?

**Soluzioni testate**:
1. ❌ Leggi SEMPRE da Google Calendar in real-time → slow (~2-3 sec), rate limit
2. ❌ Cache locale puro → fast ma stale, rischio double-booking
3. ✅ **IBRIDA: Cache + Double-Check realtime**

**Implementazione scelta**:

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                   │
│  [Sync Job] Ogni 10 minuti:                                      │
│    • Per ogni workspace: leggi Google Calendar                   │
│    • Cache locale aggiornata (Redis o in-memory con TTL 10min)   │
│                                                                   │
│  [Booking Flow]:                                                 │
│    1. getAvailableSlots(date) → leggi CACHE (instant, <10ms)     │
│    2. Cliente sceglie slot e chiede conferma                     │
│    3. [Durante conferma] check realtime Google Calendar          │
│       - timeout = 2-3 secondi                                    │
│       - "double-check" che slot sia ancora libero                │
│       - Se timeout → usa Cache + crea comunque (fallback safe)   │
│    4. bookAppointment() → crea event in Google Calendar          │
│       - Se fallisce (offline, quota) → salva in PendingAppointment
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Vantaggi**:
- ✅ Fast slot listing (cache < 10ms)
- ✅ Double-booking prevention (realtime check before confirm)
- ✅ Graceful degradation (fallback se Google offline)
- ✅ Respects rate limit (1 workspace = 1 req per 10 min = 6 req/hr, scalable 1000x)

**Trade-offs**:
- ⚠️ Slot gap di max 10 minuti (acceptable, sync job runs frequently)
- ⚠️ Se timeout Google, crea event ugualmente (rischio minimum: recuperabile manualmente via PendingAppointment)

---

### Decisione B: Google Calendar API Rate Limit (Scaling 1000+ Workspace)

**Problema**: 
- Google Calendar: 180 req/min per account
- 1000 workspace × 30 prenotazioni/giorno = 30.000 eventi/giorno
- Se check realtime OGNI booking = 30.000 API req/giorno = BLOW UP

**Soluzione**: **Sync Cache + Weighted Real-time Check**

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                   │
│  [1] Cache Sync (Efficient):                                     │
│      • Background job ogni 10 minuti                             │
│      • Per ogni workspace: 1 API call listEvents(timeMin, timeMax)
│      • 1000 workspace × 1 call = 1000 calls                      │
│      • Spread over 10 min = 100 calls/min ✓ (well under 180)     │
│      • Cache updated with TTL = 10 minutes                       │
│                                                                   │
│  [2] Real-time Check (Selective):                                │
│      • ONLY quando customer CONFIRM booking                      │
│      • Queue di rate-limiting: max 10 realtime checks/sec        │
│      • Per 30 booking/giorno per workspace = ~5 checks/sec max   │
│      • ✓ Still well under 180 req/min limit                      │
│                                                                   │
│  [3] Rate Limit Queue:                                           │
│      • Bullmq/Redis queue con concurrency=10                     │
│      • Se queue piena: client gets "system busy" error           │
│      • Fallback: usa cache + create pending                      │
│                                                                   │
│  [4] Monitoring:                                                 │
│      • Track API usage per workspace                             │
│      • Alert if exceeds 120 req/min (70% of 180 limit)           │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

EXPECTED TRAFFIC (1000 workspace scenario):
─────────────────────────────────────────────
• Cache sync:       1000 req / 10 min   = 100 req/min   ✓ Safe
• Real-time check:  ~500 checks / min   = 500 req/min   ✗ OVER LIMIT

SOLUTION: Weighted priority queue
• Prefer: immediate bookings > late cancellations > admin queries
• If queue backlog > 50 items: reject new checks (show "system busy")
• Retry failed checks on next sync cycle (10 min)
```

**Implementation** (pseudocode):

```typescript
// Sync job: runs every 10 minutes
const syncCacheJob = async () => {
  for (const workspace of workspaces) {
    const events = await googleCalendar.listEvents(workspace.id);
    await redis.set(`cache:slots:${workspace.id}`, events, { EX: 600 }); // TTL 10 min
  }
};

// During booking: use rate-limited queue
const bookAppointmentWithRateLimit = async (params) => {
  // 1. Get available slots from CACHE (instant)
  const slots = await getCachedSlots(params.workspaceId, params.date);
  if (!slots.includes(params.time)) {
    return "Slot not available";
  }

  // 2. ADD TO RATE-LIMIT QUEUE for real-time check
  const jobId = await realtimeCheckQueue.add(
    { workspaceId, date, time },
    { priority: 'high', timeout: 3000 }
  );

  // 3. WAIT UP TO 3 SECONDS for result
  const result = await Promise.race([
    realtimeCheckQueue.waitUntilFinished(jobId),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('timeout')), 3000)
    )
  ]).catch(err => {
    // Timeout: fallback to cache
    console.log('[Fallback] Real-time check timed out, using cache');
    return { success: true, source: 'cache' };
  });

  // 4. CREATE EVENT in Google Calendar
  if (result.success) {
    return await googleCalendar.createEvent(params);
  }
};
```

---

## �🗄️ Database Schema Changes

### 🔴 CRITICAL: NO `Appointment` Table

**A differenza di un sistema standalone, NON esiste una tabella `Appointment` nel nostro database.**  
Gli appuntamenti vivono **SOLO in Google Calendar**. Il nostro DB contiene:
- ✅ Configurazione tipi appuntamento (`AppointmentType`)
- ✅ OAuth tokens per Google Calendar (`GoogleCalendarConnection`)
- ✅ Business hours e blackout periods (`WorkspaceBusinessHours`, `BlackoutPeriod`)
- ❌ **NO eventi** - questi sono in Google Calendar

---

### 1. Workspace Model - Nuovi Flag

```prisma
model Workspace {
  // ... existing fields ...
  
  // CALENDAR/APPOINTMENT FEATURE
  calendarEnabled    Boolean    @default(false)   // Toggle ON/OFF nel settings
  timezone           String     @default("Europe/Rome")  // ← FIX CRITICO: timezone awareness
  maxActiveAppointments Int     @default(3)       // ← FIX: limite per cliente
  
  // RELATIONS
  googleCalendarConnection GoogleCalendarConnection?
  googleCalendarWebhook    GoogleCalendarWebhook?
  appointmentTypes         AppointmentType[]
  pendingAppointments      PendingAppointment[]
  reminderLocks            ReminderLock[]
  lateCancellationAttempts LateCancellationAttempt[]
  businessHours            WorkspaceBusinessHours[]
  blackoutPeriods          BlackoutPeriod[]
}
```

**NOTE CRITICHE**:
- `timezone`: **OBBLIGATORIO** per fix bug reminder/slot calculation (all'ora giusta nel fuso del workspace)
- `maxActiveAppointments`: **ANTI-SPAM** - limite prenotazioni attive per cliente (default 3)

---

### 2. Nuovo Model: `AppointmentType`

Tabella configurabile dal workspace owner. Ogni riga è un tipo di appuntamento prenotabile.
Il campo `serviceType` è una **stringa libera** inserita manualmente dall'admin - NON è legata alla tabella Services.
Questo permette massima flessibilità: l'admin può creare tipi come "Pulizia denti", "Demo gratuita", "Meeting commerciale", "Installazione" senza vincoli.

```prisma
model AppointmentType {
  id              String    @id @default(cuid())
  workspaceId     String
  serviceType     String    // Stringa libera: "Pulizia denti", "Demo", "Meeting", "TAC", etc.
                             // NON è FK a Services - inserita manualmente dall'admin
  description     String?   // Descrizione opzionale per il cliente
  duration        Int       @default(60)    // Durata in minuti (default 60)
  bufferMinutes   Int       @default(15)    // ← FIX CRITICO: tempo buffer DOPO l'appuntamento
                                             // Previene prenotazioni consecutive senza pausa (default 15 min)
  reminderMessage String    @db.Text        // Testo template del reminder
                                             // Es: "Ciao {{customerName}}, domani hai {{serviceType}} alle {{time}}. Ci sarai?"
  reminderHours   Int       @default(24)    // Quante ore prima inviare il reminder (default: 24h = giorno prima)
  isActive        Boolean   @default(true)  // Attivo/disattivo
  color           String?   @default("#3B82F6") // Colore nel calendario (opzionale)
  sortOrder       Int       @default(0)     // Ordine di visualizzazione
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime? // Soft delete
  
  // RELATIONS
  workspace           Workspace            @relation(fields: [workspaceId], references: [id])
  pendingAppointments PendingAppointment[]
  // ❌ NO appointments relation - eventi vivono in Google Calendar
  
  @@index([workspaceId])
  @@index([workspaceId, isActive])
  @@index([workspaceId, deletedAt])
}
```

### 3. Nuovo Model: `GoogleCalendarConnection`

Storaggio OAuth tokens per Google Calendar (uno per workspace).

```prisma
model GoogleCalendarConnection {
  id             String    @id @default(cuid())
  workspaceId    String    @unique  // One calendar per workspace
  
  // GOOGLE OAUTH TOKENS (stored in clear text - acceptable for appointment data)
  googleEmail    String              // Email account connesso (es: "dentista@clinica.it")
  accessToken    String    @db.Text  // Google OAuth access_token
  refreshToken   String    @db.Text  // Google OAuth refresh_token
  tokenExpiresAt DateTime            // Scadenza access_token
  scopes         String[]            // ["https://www.googleapis.com/auth/calendar.events"]
  
  // METADATA
  connectedAt    DateTime  @default(now())
  lastSyncAt     DateTime?           // Ultimo sync/refresh riuscito
  isActive       Boolean   @default(true)
  
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  
  // RELATIONS
  workspace      Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  
  @@index([workspaceId])
  @@index([tokenExpiresAt]) // Per refresh automatico
}
```

### 4. Nuovo Model: `WorkspaceBusinessHours`

Orari di apertura configurabili per ogni workspace (es: Lun-Ven 09:00-18:00, pausa pranzo 13:00-14:00).

```prisma
model WorkspaceBusinessHours {
  id          String    @id @default(cuid())
  workspaceId String
  
  // BUSINESS HOURS (one row per day)
  dayOfWeek   Int                 // 0=Sunday, 1=Monday, ..., 6=Saturday
  isOpen      Boolean   @default(true)
  openTime    String?             // "09:00" (HH:mm format)
  closeTime   String?             // "18:00"
  breakStart  String?             // "13:00" (opzionale - pausa pranzo)
  breakEnd    String?             // "14:00"
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  // RELATIONS
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  
  @@unique([workspaceId, dayOfWeek])
  @@index([workspaceId])
}
```

**Default Business Hours** (se non configurato):
- Lun-Ven: 09:00-18:00 (no break)
- Sab-Dom: closed

### 5. Nuovo Model: `BlackoutPeriod`

Periodi di chiusura (vacanze, festività, formazione) configurabili dal workspace owner.

```prisma
model BlackoutPeriod {
  id          String    @id @default(cuid())
  workspaceId String
  
  // BLACKOUT DATES
  startDate   DateTime            // Inizio periodo (timezone-aware)
  endDate     DateTime            // Fine periodo
  reason      String?             // "Vacanze estive", "Formazione", "Festività"
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime?           // Soft delete
  
  // RELATIONS
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  
  @@index([workspaceId])
  @@index([workspaceId, startDate, endDate])
}
```

### 6. Update Customers Model - Relazione

> **NOTA**: La tabella `Services` NON viene modificata. `AppointmentType` è completamente indipendente dal catalogo servizi.

```prisma
model Customers {
  // ... existing fields ...
  
  // ❌ NO appointments relation - eventi vivono in Google Calendar
  // Tracking via extendedProperties.private.customerId nel Google Calendar event
}
```

### 7. Update PlanConfiguration - Reminder Billing ✅

```prisma
model PlanConfiguration {
  // ... existing fields ...
  
  // CALENDAR/REMINDER BILLING — €0.50 per reminder WhatsApp
  reminderCost     Float   @default(0.50)  // €0.50 per reminder WhatsApp (email = free)
}
```

### 8. Nuovo Model: `ReminderLock` (FIX: Atomic Lock Vero)

🔥 **CRITICAL FIX**: Google Calendar API NON garantisce atomicità come Prisma transaction.
Usa DB come lock layer per prevenire reminder duplicati.

```prisma
model ReminderLock {
  id           String    @id @default(cuid())
  eventId      String    @unique  // Google Calendar event ID
  workspaceId  String
  lockedAt     DateTime  @default(now())
  processedAt  DateTime?
  status       String    @default("LOCKED")  // LOCKED, SENT, FAILED
  
  @@index([eventId])
  @@index([workspaceId])
  @@index([lockedAt])  // Per cleanup vecchi lock
}
```

**Usage nel reminder job**:
```typescript
// Atomic lock acquisition
const locked = await prisma.reminderLock.create({
  data: { eventId: event.id, workspaceId }
}).catch(() => null);  // Unique constraint violation = già in elaborazione

if (!locked) {
  skipped++;
  continue;  // Altro job instance ha acquisito il lock
}
```

### 9. Nuovo Model: `PendingAppointment` (FIX: Fallback Google API Down)

🔥 **CRITICAL FIX**: Quando Google Calendar API down, salva appuntamenti in DB locale.
Background job tenta sync ogni 5 min.

```prisma
model PendingAppointment {
  id                String    @id @default(cuid())
  workspaceId       String
  customerId        String
  appointmentTypeId String
  
  // SCHEDULING
  scheduledAt       DateTime
  duration          Int
  bufferMinutes     Int
  notes             String?
  
  // SYNC STATUS
  syncStatus        String    @default("PENDING")  // PENDING, SYNCED, FAILED
  googleEventId     String?   // Populated after successful sync
  lastSyncAttempt   DateTime?
  syncError         String?
  retryCount        Int       @default(0)
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  // RELATIONS
  workspace         Workspace @relation(fields: [workspaceId], references: [id])
  customer          Customers @relation(fields: [customerId], references: [id])
  appointmentType   AppointmentType @relation(fields: [appointmentTypeId], references: [id])
  
  @@index([workspaceId])
  @@index([syncStatus])
  @@index([lastSyncAttempt])
}
```

### 10. Nuovo Model: `GoogleCalendarWebhook` (FIX: Scalability - Push invece di Poll)

🔥 **CRITICAL FIX**: Invece di polling ogni 30 min (non scala con 1000+ workspace),
usa Google Calendar Push Notifications (Webhooks).

```prisma
model GoogleCalendarWebhook {
  id              String    @id @default(cuid())
  workspaceId     String    @unique
  channelId       String    @unique  // Google Calendar webhook channel ID
  resourceId      String              // Google Calendar resource ID
  expiration      DateTime            // Webhook expiration (max 7 days)
  
  isActive        Boolean   @default(true)
  lastNotification DateTime?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // RELATIONS
  workspace       Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  
  @@index([workspaceId])
  @@index([expiration])  // Per renewal automatico
}
```

**Setup Webhook**:
```typescript
// Dopo OAuth success, subscribe to calendar changes
const channel = await calendar.events.watch({
  calendarId: 'primary',
  requestBody: {
    id: generateUUID(),  // channelId
    type: 'web_hook',
    address: 'https://yourdomain.com/api/v1/google-calendar/webhook',
    expiration: Date.now() + (7 * 24 * 60 * 60 * 1000)  // 7 days max
  }
});

await prisma.googleCalendarWebhook.create({
  data: {
    workspaceId,
    channelId: channel.id,
    resourceId: channel.resourceId,
    expiration: new Date(channel.expiration)
  }
});
```

### 11. Nuovo Model: `LateCancellationAttempt` (Analytics: cancellazioni <2h)

```prisma
model LateCancellationAttempt {
  id                String    @id @default(cuid())
  workspaceId       String
  customerId        String
  eventId           String    // Google Calendar event ID
  minutesBeforeEvent Int      // Quanti minuti prima dell'evento
  
  createdAt         DateTime  @default(now())
  
  // RELATIONS
  workspace         Workspace @relation(fields: [workspaceId], references: [id])
  customer          Customers @relation(fields: [customerId], references: [id])
  
  @@index([workspaceId])
  @@index([customerId])
}
```

### 12. Nuovo Model: `GdprLog` (Audit trail cancellazione dati)

```prisma
model GdprLog {
  id           String    @id @default(cuid())
  workspaceId  String
  customerId   String
  action       String    // 'DELETE_CALENDAR_DATA', etc.
  eventCount   Int       @default(0)
  completedAt  DateTime
  
  createdAt    DateTime  @default(now())
  
  @@index([workspaceId])
  @@index([customerId])
}
```

### 13. Workspace Model - Campo `hasWebhookPendingEvents`

```prisma
model Workspace {
  // ... existing fields from section 1 above ...
  hasWebhookPendingEvents Boolean @default(false) // Flag set by webhook callback, cleared by scheduler
}
```

### 14. Customers Model - Relazione LateCancellationAttempt

```prisma
model Customers {
  // ... existing fields ...
  lateCancellationAttempts LateCancellationAttempt[]
}
```

---

## � Google OAuth 2.0 Setup

### Google Cloud Console Configuration

1. **Create Project** su [Google Cloud Console](https://console.cloud.google.com/)
2. **Enable Google Calendar API**:
   - APIs & Services → Library
   - Cerca "Google Calendar API"
   - Click "Enable"
3. **Create OAuth 2.0 Credentials**:
   - APIs & Services → Credentials
   - Create Credentials → OAuth client ID
   - Application type: **Web application**
   - Authorized redirect URIs:
     - Production: `https://yourdomain.com/api/v1/google-oauth/callback`
     - Development: `http://localhost:3001/api/v1/google-oauth/callback`
4. **Download JSON** con `client_id` e `client_secret`
5. **Add to .env**:
   ```bash
   GOOGLE_OAUTH_CLIENT_ID=your_client_id
   GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
   GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3001/api/v1/google-oauth/callback
   ```

### OAuth Scopes Required

```typescript
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',    // Create/update/delete events
  'https://www.googleapis.com/auth/calendar.readonly'   // Read events
];
```

### OAuth Flow Diagram

```
Admin (Workspace Owner)
  ↓
[1] Click "Connect Google Calendar" button nel settings
  ↓
[2] Frontend redirect to:
    https://accounts.google.com/o/oauth2/v2/auth?
      client_id=XXX
      &redirect_uri=http://localhost:3001/api/v1/google-oauth/callback
      &response_type=code
      &scope=calendar.events+calendar.readonly
      &access_type=offline         ← CRITICAL for refresh_token
      &prompt=consent              ← Force to get refresh_token
      &state=workspaceId:wks_123   ← CSRF protection + workspace tracking
  ↓
[3] Admin grants permissions
  ↓
[4] Google redirects to:
    http://localhost:3001/api/v1/google-oauth/callback?code=AUTH_CODE&state=workspaceId:wks_123
  ↓
[5] Backend exchanges code for tokens:
    POST https://oauth2.googleapis.com/token
    body: {
      code: AUTH_CODE,
      client_id, client_secret,
      redirect_uri, grant_type: 'authorization_code'
    }
  ↓
[6] Google returns:
    {
      access_token: "ya29.xxx",
      refresh_token: "1//xxx",  ← Stored for long-term access
      expires_in: 3600,
      scope: "...",
      token_type: "Bearer"
    }
  ↓
[7] Backend saves to GoogleCalendarConnection table:
    {
      workspaceId,
      googleEmail: (from tokeninfo API),
      accessToken, refreshToken,
      tokenExpiresAt: now() + expires_in,
      scopes, isActive: true
    }
  ↓
[8] Frontend shows: ✅ Connected (email@gmail.com)
```

### Token Refresh Logic

```typescript
// services/google-calendar.service.ts

async refreshAccessToken(connection: GoogleCalendarConnection) {
  const response = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    refresh_token: connection.refreshToken,
    grant_type: 'refresh_token'
  });

  // Update DB
  await prisma.googleCalendarConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: response.data.access_token,
      tokenExpiresAt: new Date(Date.now() + response.data.expires_in * 1000),
      lastSyncAt: new Date()
    }
  });

  return response.data.access_token;
}
```

---

## 🔧 Backend Implementation

### Layer Architecture (Clean Architecture/DDD)

```
apps/backend/src/
├── repositories/
│   ├── appointment-type.repository.ts          // CRUD AppointmentType (DB)
│   ├── google-calendar-connection.repository.ts // CRUD GoogleCalendarConnection
│   ├── business-hours.repository.ts            // CRUD WorkspaceBusinessHours
│   └── blackout-period.repository.ts           // CRUD BlackoutPeriod
├── services/
│   ├── google-calendar.service.ts              // 🔥 NUOVO: Google Calendar API wrapper
│   ├── google-oauth.service.ts                 // 🔥 NUOVO: OAuth flow handler
│   └── slot-calculator.service.ts              // 🔥 NUOVO: Slot availability calculation
├── application/services/
│   ├── appointment-type.service.ts             // Business logic tipi appuntamento
│   └── appointment.service.ts                  // Business logic (orchestrates Google Calendar calls)
├── interfaces/http/
│   ├── controllers/
│   │   ├── appointment-type.controller.ts
│   │   ├── appointment.controller.ts
│   │   ├── google-oauth.controller.ts          // 🔥 NUOVO: OAuth endpoints
│   │   ├── business-hours.controller.ts        // 🔥 NUOVO: Business hours CRUD
│   │   └── blackout-period.controller.ts       // 🔥 NUOVO: Blackout CRUD
│   └── routes/
│       ├── appointment-type.routes.ts
│       ├── appointment.routes.ts
│       ├── google-oauth.routes.ts              // 🔥 NUOVO
│       ├── business-hours.routes.ts            // 🔥 NUOVO
│       └── blackout-period.routes.ts           // 🔥 NUOVO
├── domain/calling-functions/
│   ├── bookAppointment.ts                      // 🔥 REWRITTEN: Google Calendar API
│   ├── cancelAppointment.ts                    // 🔥 REWRITTEN: Google Calendar API
│   ├── getAppointments.ts                      // 🔥 REWRITTEN: Google Calendar API
│   ├── getAvailableSlots.ts                    // 🔥 REWRITTEN: Google Calendar API
│   ├── rescheduleAppointment.ts                // 🔥 NUOVO
│   └── confirmReminderResponse.ts              // 🔥 NUOVO: Handle "SI/NO" to reminders
└── jobs/
    └── appointment-reminder.job.ts             // 🔥 REWRITTEN: Read from Google Calendar API
```

### GoogleCalendarService Wrapper (NUOVO)

```typescript
// services/google-calendar.service.ts

import { google } from 'googleapis';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import { addMinutes } from 'date-fns';

export class GoogleCalendarService {
  constructor(
    private prisma: PrismaClient,
    private logger: Logger
  ) {}

  /**
   * Get Calendar API client for workspace (handles token refresh automatically)
   */
  async getCalendarClient(workspaceId: string) {
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { workspaceId },
      include: { workspace: true }
    });

    if (!connection || !connection.isActive) {
      throw new Error('Google Calendar not connected');
    }

    // Check if token expired
    if (new Date() >= connection.tokenExpiresAt) {
      await this.refreshAccessToken(connection);
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: connection.accessToken,
      refresh_token: connection.refreshToken
    });

    return google.calendar({ version: 'v3', auth: oauth2Client });
  }

  /**
   * 🔥 CREATE EVENT (bookAppointment calling function)
   */
  async createEvent({
    workspaceId,
    customerId,
    appointmentTypeId,
    scheduledAt,  // Date object (already timezone-aware)
    duration,     // minutes
    bufferMinutes,
    notes
  }: CreateEventParams) {
    const calendar = await this.getCalendarClient(workspaceId);
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    const customer = await this.prisma.customers.findUnique({ where: { id: customerId } });
    const appointmentType = await this.prisma.appointmentType.findUnique({ where: { id: appointmentTypeId } });

    // Timezone-aware calculation
    const startDateTime = zonedTimeToUtc(scheduledAt, workspace.timezone);
    const endDateTime = addMinutes(startDateTime, duration + bufferMinutes);

    const event = {
      summary: `${appointmentType.serviceType} - ${customer.name || customer.phone}`,
      description: notes || '',
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: workspace.timezone  // ← CRITICAL: timezone awareness
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: workspace.timezone
      },
      extendedProperties: {
        private: {
          workspaceId,
          customerId,
          appointmentTypeId,
          shopMeSource: 'true',           // ← FILTER FLAG for our events
          reminderSent: 'false',
          bookedVia: 'chat'
        }
      },
      reminders: {
        useDefault: false,
        overrides: [] // We handle reminders ourselves
      }
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event
    });

    this.logger.info(`[GoogleCalendar] Event created: ${response.data.id} for workspace ${workspaceId}`);
    return response.data;
  }

  /**
   * 🔥 LIST EVENTS (getAppointments, scheduler)
   */
  async listEvents({
    workspaceId,
    customerId,
    timeMin,     // ISO string or Date
    timeMax,     // ISO string or Date
    maxResults = 50
  }: ListEventsParams) {
    const calendar = await this.getCalendarClient(workspaceId);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: typeof timeMin === 'string' ? timeMin : timeMin.toISOString(),
      timeMax: typeof timeMax === 'string' ? timeMax : timeMax.toISOString(),
      maxResults,
      singleEvents: true,  // Expand recurring events
      orderBy: 'startTime',
      privateExtendedProperty: [
        `workspaceId=${workspaceId}`,
        `shopMeSource=true`,  // ← ONLY our events
        ...(customerId ? [`customerId=${customerId}`] : [])
      ]
    });

    return response.data.items || [];
  }

  /**
   * 🔥 GET SINGLE EVENT (used by cancelAppointment, confirmReminderResponse, rescheduleAppointment)
   */
  async getEvent(workspaceId: string, eventId: string): Promise<calendar_v3.Schema$Event> {
    const calendar = await this.getCalendarClient(workspaceId);

    const response = await calendar.events.get({
      calendarId: 'primary',
      eventId
    });

    return response.data;
  }

  /**
   * 🔥 DELETE EVENT (cancelAppointment)
   */
  async deleteEvent(workspaceId: string, eventId: string) {
    const calendar = await this.getCalendarClient(workspaceId);

    await calendar.events.delete({
      calendarId: 'primary',
      eventId
    });

    this.logger.info(`[GoogleCalendar] Event deleted: ${eventId}`);
  }

  /**
   * 🔥 UPDATE EVENT (rescheduleAppointment, update reminderSent flag)
   */
  async updateEvent(workspaceId: string, eventId: string, updates: Partial<calendar_v3.Schema$Event>) {
    const calendar = await this.getCalendarClient(workspaceId);

    const response = await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: updates
    });

    return response.data;
  }

  /**
   * 🔥 GET AVAILABLE SLOTS (getAvailableSlots calling function)
   * 
   * Legge DIRETTAMENTE da Google Calendar (NO DB) per evitare inconsistenza
   */
  async getAvailableSlots({
    workspaceId,
    appointmentTypeId,
    date  // "2026-04-15"
  }: GetAvailableSlotsParams): Promise<string[]> {
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    const appointmentType = await this.prisma.appointmentType.findUnique({ where: { id: appointmentTypeId } });
    const businessHours = await this.prisma.workspaceBusinessHours.findMany({
      where: { workspaceId }
    });
    const blackoutPeriods = await this.prisma.blackoutPeriod.findMany({
      where: {
        workspaceId,
        startDate: { lte: new Date(`${date}T23:59:59`) },
        endDate: { gte: new Date(`${date}T00:00:00`) },
        deletedAt: null
      }
    });

    // Check if date is in blackout period
    if (blackoutPeriods.length > 0) {
      return [];  // No slots available
    }

    // Get business hours for this day
    const dayOfWeek = new Date(date).getDay();
    const hours = businessHours.find(h => h.dayOfWeek === dayOfWeek);

    if (!hours || !hours.isOpen) {
      return [];  // Closed
    }

    // 🔥 Read existing events from Google Calendar (NOT DB)
    const timeMin = new Date(`${date}T00:00:00`);
    const timeMax = new Date(`${date}T23:59:59`);
    const existingEvents = await this.listEvents({
      workspaceId,
      timeMin,
      timeMax
    });

    // Generate slots with buffer
    const slots: string[] = [];
    let currentTime = zonedTimeToUtc(
      new Date(`${date}T${hours.openTime}:00`),
      workspace.timezone
    );
    const closeTime = zonedTimeToUtc(
      new Date(`${date}T${hours.closeTime}:00`),
      workspace.timezone
    );

    while (currentTime < closeTime) {
      const slotEnd = addMinutes(currentTime, appointmentType.duration + appointmentType.bufferMinutes);

      // Check if slot overlaps with existing events
      const hasConflict = existingEvents.some(event => {
        const eventStart = new Date(event.start.dateTime || event.start.date);
        const eventEnd = new Date(event.end.dateTime || event.end.date);

        return (
          (currentTime >= eventStart && currentTime < eventEnd) ||
          (slotEnd > eventStart && slotEnd <= eventEnd) ||
          (currentTime <= eventStart && slotEnd >= eventEnd)
        );
      });

      // Check if slot is in break time
      const isBreak = hours.breakStart && hours.breakEnd &&
        currentTime >= zonedTimeToUtc(new Date(`${date}T${hours.breakStart}:00`), workspace.timezone) &&
        currentTime < zonedTimeToUtc(new Date(`${date}T${hours.breakEnd}:00`), workspace.timezone);

      if (!hasConflict && !isBreak && slotEnd <= closeTime) {
        // Convert back to workspace timezone for display
        const slotTimeZoned = utcToZonedTime(currentTime, workspace.timezone);
        slots.push(format(slotTimeZoned, 'HH:mm'));
      }

      // 🔥 FIX: Incrementa di TUTTA la durata + buffer, NON solo 15 min
      // Altrimenti slot si sovrappongono (es: 10:00-10:45, poi 10:15 sarebbe overlap)
      currentTime = addMinutes(currentTime, appointmentType.duration + appointmentType.bufferMinutes);
    }

    return slots;
  }

  /**
   * 🔥 NUOVO: Revoke token detection + auto-disable
   */
  async handleTokenRevoked(workspaceId: string, error: any) {
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      logger.warn(`[GoogleCalendar] Token revoked for workspace ${workspaceId}`);

      // Disable connection
      await this.prisma.googleCalendarConnection.update({
        where: { workspaceId },
        data: {
          isActive: false,
          lastSyncAt: new Date()
        }
      });

      // Notify admin
      await this.notificationService.send({
        workspaceId,
        type: 'CALENDAR_DISCONNECTED',
        message: '⚠️ Google Calendar disconnected. Please reconnect in Settings.',
        priority: 'high'
      });

      throw new Error('Google Calendar disconnected. Please reconnect.');
    }

    throw error;  // Re-throw other errors
  }

  /**
   * 🔥 NUOVO: GDPR - Delete customer data from Google Calendar
   */
  async deleteCustomerData(workspaceId: string, customerId: string) {
    logger.info(`[GoogleCalendar] Deleting customer data: ${customerId}`);

    // Get all events for this customer
    const events = await this.listEvents({
      workspaceId,
      customerId,
      timeMin: subMonths(new Date(), 12),  // Last 12 months
      timeMax: addMonths(new Date(), 12),  // Next 12 months
      maxResults: 500
    });

    // Delete all events
    for (const event of events) {
      try {
        await this.deleteEvent(workspaceId, event.id);
        logger.info(`[GoogleCalendar] Deleted event ${event.id} for customer ${customerId}`);
      } catch (error) {
        logger.error(`[GoogleCalendar] Failed to delete event ${event.id}:`, error);
      }
    }

    // Audit log
    await this.prisma.gdprLog.create({
      data: {
        workspaceId,
        customerId,
        action: 'DELETE_CALENDAR_DATA',
        eventCount: events.length,
        completedAt: new Date()
      }
    });

    logger.info(`[GoogleCalendar] Deleted ${events.length} events for customer ${customerId}`);
  }
}
```

---

### API Endpoints

#### AppointmentType (Admin CRUD)

```
GET    /api/workspaces/:workspaceId/appointment-types          → Lista tipi (con filtro isActive)
POST   /api/workspaces/:workspaceId/appointment-types          → Crea tipo
PUT    /api/workspaces/:workspaceId/appointment-types/:id      → Modifica tipo
DELETE /api/workspaces/:workspaceId/appointment-types/:id      → Soft delete tipo
PATCH  /api/workspaces/:workspaceId/appointment-types/:id/toggle → Toggle isActive
```

#### Google OAuth (NUOVO)

```
GET    /api/v1/google-oauth/connect/:workspaceId               → Redirect to Google OAuth consent screen
GET    /api/v1/google-oauth/callback                           → OAuth callback (exchange code for tokens)
DELETE /api/v1/google-oauth/disconnect/:workspaceId            → Disconnect Google Calendar
GET    /api/v1/google-oauth/status/:workspaceId                → Check connection status
```

#### Business Hours (NUOVO)

```
GET    /api/workspaces/:workspaceId/business-hours             → Lista orari per tutti i giorni
POST   /api/workspaces/:workspaceId/business-hours             → Crea/update orario per giorno
PUT    /api/workspaces/:workspaceId/business-hours/:dayOfWeek  → Aggiorna orario specifico
```

#### Blackout Periods (NUOVO)

```
GET    /api/workspaces/:workspaceId/blackout-periods           → Lista periodi chiusura
POST   /api/workspaces/:workspaceId/blackout-periods           → Aggiungi periodo
DELETE /api/workspaces/:workspaceId/blackout-periods/:id       → Rimuovi periodo
```

#### Appointments (Admin + Chat)

```
GET    /api/workspaces/:workspaceId/appointments               → Lista appuntamenti (legge da Google Calendar)
GET    /api/workspaces/:workspaceId/appointments/:eventId      → Dettaglio appuntamento
POST   /api/workspaces/:workspaceId/appointments               → Crea appuntamento (manuale da admin)
DELETE /api/workspaces/:workspaceId/appointments/:eventId      → Cancella appuntamento
PATCH  /api/workspaces/:workspaceId/appointments/:eventId      → Reschedule appuntamento
GET    /api/workspaces/:workspaceId/appointments/available-slots → Slot disponibili (legge da Google Calendar)
```

### Calling Functions (Riscritte per Google Calendar API)

#### 1. `bookAppointment`

```typescript
// domain/calling-functions/bookAppointment.ts

interface BookAppointmentParams {
  workspaceId: string;
  customerId: string;
  appointmentTypeId: string;     // 🔥 FIX: Use ID instead of fuzzy match on serviceType
  date: string;                  // ISO format: "2026-04-15"
  time: string;                  // "10:00"
  notes?: string;
  chatSessionId?: string;
  confirmed?: boolean;           // 🔥 NUOVO: explicit confirmation flag
}

// 🔥 FLUSSO CON CONFERMA (Andrea's decision #1):
//
// [STEP 1] LLM riconosce TYPE + DATE + TIME
//   → bookAppointment(params, confirmed=false)
//   ↓
// [STEP 2] Bot risponde: "Confermi prenotazione martedì 15 Aprile ore 10:00?"
//   → salva conversationState.pendingBooking = params
//   ↓
// [STEP 3] Cliente risponde "sì" o "no"
//   ↓
// SE "sì":
//   → bookAppointment(params, confirmed=true)
//   → crea event in Google Calendar
//   → risponde: "✅ Confermato! + link Google Calendar" (TESTO E LINK - Andrea's #2)
// SE "no":
//   → cancella pendingBooking
//   → suggerisce alternative
//

export async function bookAppointment(params: BookAppointmentParams): Promise<string> {
  const { workspaceId, customerId, appointmentTypeId, date, time, notes, confirmed } = params;

  // 1. Get models
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  const appointmentType = await prisma.appointmentType.findUnique({
    where: { id: appointmentTypeId, workspaceId, isActive: true, deletedAt: null }
  });
  const customer = await prisma.customers.findUnique({ where: { id: customerId } });

  if (!appointmentType) {
    return "❌ Tipo di appuntamento non disponibile.";
  }

  // 2. Check Google Calendar connected
  const connection = await prisma.googleCalendarConnection.findUnique({
    where: { workspaceId }
  });

  if (!connection || !connection.isActive) {
    return "❌ Servizio calendario temporaneamente non disponibile. Contatta l'operatore.";
  }

  // 3. 🔥 Timezone-aware datetime parsing
  const scheduledAt = zonedTimeToUtc(
    `${date}T${time}:00`,
    workspace.timezone
  );

  // Check if date is in the past
  if (scheduledAt < new Date()) {
    return "❌ Non puoi prenotare appuntamenti nel passato.";
  }

  // 4. 🔥 IF NOT CONFIRMED → ask for confirmation
  if (!confirmed) {
    // Verify slot is available (cache check)
    const cachedSlots = await getCachedSlots(workspaceId, date);
    const requestedSlot = format(utcToZonedTime(scheduledAt, workspace.timezone), 'HH:mm');

    if (!cachedSlots?.includes(requestedSlot)) {
      // Slot not in cache, suggest alternatives
      const alternatives = cachedSlots?.slice(0, 3).join(", ") || "Nessuno";
      return `❌ Slot ${time} potrebbe non essere disponibile.\n\n` +
             `📅 Alternative disponibili: ${alternatives}\n\n` +
             `⚠️ Vuoi prenotare uno di questi?`;
    }

    // STEP 2: Ask for confirmation (Decision #1 from Andrea)
    const scheduledInTz = utcToZonedTime(scheduledAt, workspace.timezone);
    const formattedDate = format(scheduledInTz, "EEEE d MMMM yyyy", { locale: itLocale });
    const formattedTime = format(scheduledInTz, "HH:mm");

    // Store in conversation state for next message
    conversationState.pendingBooking = {
      workspaceId, customerId, appointmentTypeId, date, time, confirmed: true
    };

    return `📅 Confermi questa prenotazione:\n\n` +
           `${appointmentType.serviceType}\n` +
           `${formattedDate} ore ${formattedTime}\n` +
           `Durata: ${appointmentType.duration} minuti\n\n` +
           `Rispondi "sì" per confermare o "no" per annullare.`;
  }

  // 5. 🔥 CONFIRMED → Create appointment in Google Calendar

  // Double-check availability with real-time check (with timeout)
  try {
    const availableSlots = await googleCalendarService.getAvailableSlots({
      workspaceId,
      appointmentTypeId,
      date
    }, { timeout: 3000 });  // 3 second timeout

    const requestedSlot = format(utcToZonedTime(scheduledAt, workspace.timezone), 'HH:mm');

    if (!availableSlots.includes(requestedSlot)) {
      // Race condition: slot was just booked
      const alternatives = availableSlots.slice(0, 3).join(", ");
      return `❌ Lo slot ${time} non è più disponibile (prenotato nel frattempo).\n\n` +
             `📅 Slot alternativi disponibili: ${alternatives || "Nessuno"}\n\n` +
             `⚠️ Vuoi prenotare uno di questi?`;
    }
  } catch (error) {
    // Timeout: use cache + proceed (graceful fallback)
    logger.warn('[bookAppointment] Real-time check timeout, proceeding with cache:', error);
  }

  // 6. Check maxActiveAppointments (anti-spam)
  const futureEvents = await googleCalendarService.listEvents({
    workspaceId,
    customerId,
    timeMin: new Date(),
    timeMax: addMonths(new Date(), 6)
  });

  if (futureEvents.length >= workspace.maxActiveAppointments) {
    return `❌ Hai già ${workspace.maxActiveAppointments} prenotazioni attive. ` +
           `Cancella una prenotazione esistente prima di prenotarne una nuova.`;
  }

  // 7. 🔥 Create event in Google Calendar
  try {
    const event = await googleCalendarService.createEvent({
      workspaceId,
      customerId,
      appointmentTypeId,
      scheduledAt,
      duration: appointmentType.duration,
      bufferMinutes: appointmentType.bufferMinutes,
      notes
    });

    // 8. 🔥 RESPONSE: Testo + Link (Decision #2 from Andrea)
    const scheduledInTz = utcToZonedTime(scheduledAt, workspace.timezone);
    const formattedDate = format(scheduledInTz, "EEEE d MMMM yyyy", { locale: itLocale });
    const formattedTime = format(scheduledInTz, "HH:mm");
    const calendarLink = `https://calendar.google.com/calendar/event?eid=${event.id}`;

    return `✅ Prenotazione confermata!\n\n` +
           `📅 ${appointmentType.serviceType}\n` +
           `📆 ${formattedDate} ore ${formattedTime} (${workspace.timezone})\n` +
           `⏱️ Durata: ${appointmentType.duration} minuti + ${appointmentType.bufferMinutes} min buffer\n` +
           `📩 Riceverai un reminder ${appointmentType.reminderHours}h prima!\n` +
           `🔗 Apri in Google Calendar: ${calendarLink}`;

  } catch (error) {
    logger.error('[bookAppointment] Failed to create event:', error);

    // 🔥 GOOGLE CALENDAR OFFLINE FALLBACK (Decision #3 from Andrea: "Prenotazione in sospeso")
    if (error.code === 503 || error.message?.includes('unavailable')) {
      // Save to PendingAppointment table
      await prisma.pendingAppointment.create({
        data: {
          workspaceId,
          customerId,
          appointmentTypeId,
          scheduledAt,
          duration: appointmentType.duration,
          bufferMinutes: appointmentType.bufferMinutes,
          notes,
          syncStatus: 'PENDING'
        }
      });

      return `⚠️ Prenotazione in sospeso, ti faremo sapere!\n\n` +
             `Google Calendar è momentaneamente offline. ` +
             `L'operatore farà la sincronizzazione manualmente ` +
             `(Decision #4 from Andrea).`;
    }

    // Generic error
    return "❌ Errore durante la prenotazione. Riprova tra qualche minuto o contatta l'operatore.";
  }
}
```

#### 2. `cancelAppointment`

```typescript
// domain/calling-functions/cancelAppointment.ts

interface CancelAppointmentParams {
  workspaceId: string;
  customerId: string;
  eventId?: string;              // Google Calendar event ID (se specificato)
}

// FLOW:
// 1. Se eventId → cancella direttamente
// 2. Se NO eventId → lista appuntamenti futuri del cliente
//    - GoogleCalendarService.listEvents(customerId, timeMin=NOW)
//    - Genera lista JSON con options mapping
//    - Cliente sceglie numero
// 3. 🔥 Check if appointment < 2h away → require confirmation
//    - "CONFERMA CANCELLAZIONE" to prevent accidental cancellations
// 4. GoogleCalendarService.deleteEvent(eventId)
// 5. Return confirmation message

export async function cancelAppointment(params: CancelAppointmentParams): Promise<string> {
  const { workspaceId, customerId, eventId } = params;

  // If no eventId, list appointments for customer to choose
  if (!eventId) {
    const futureEvents = await googleCalendarService.listEvents({
      workspaceId,
      customerId,
      timeMin: new Date(),
      timeMax: addMonths(new Date(), 3)
    });

    if (futureEvents.length === 0) {
      return "🗓️ Non hai prenotazioni attive.";
    }

    // Generate numbered list
    const listText = futureEvents.map((event, index) => {
      const startTime = utcToZonedTime(
        new Date(event.start.dateTime),
        workspace.timezone
      );
      return `${index + 1}. ${event.summary} - ${format(startTime, "d MMM HH:mm")}`;
    }).join("\n");

    // Store mapping in conversation state
    conversationState.optionsMapping = futureEvents.map(e => ({ eventId: e.id }));

    return `🗓️ Prenotazioni attive:\n\n${listText}\n\nQuale vuoi cancellare? (rispondi con il numero)`;
  }

  // Get event details
  const event = await googleCalendarService.getEvent(workspaceId, eventId);

  if (!event) {
    return "❌ Prenotazione non trovata.";
  }

  // 🔥 Check if appointment is < 2h away
  const eventStart = new Date(event.start.dateTime);
  const hoursUntil = (eventStart.getTime() - Date.now()) / (1000 * 60 * 60);

  if (hoursUntil < 2 && hoursUntil > 0) {
    // Require explicit confirmation for late cancellations
    conversationState.pendingCancellation = eventId;

    return `⚠️ L'appuntamento è tra ${Math.round(hoursUntil * 60)} minuti!\n\n` +
           `Sei sicuro di volerlo cancellare? Rispondi "CONFERMA CANCELLAZIONE"`;
  }

  // 🔥 Log late cancellation if < 2h (ANY cancellation path - reminder, chat, admin) - DECISION B
  const minutesUntil = (eventStart.getTime() - Date.now()) / (1000 * 60);
  if (minutesUntil < 120 && minutesUntil > 0) {
    await prisma.lateCancellationAttempt.create({
      data: {
        workspaceId,
        customerId,
        eventId,
        minutesBeforeEvent: Math.round(minutesUntil),
        timestamp: new Date()
      }
    });
    logger.info(`[LateCancellation] Customer ${customerId} cancelled ${Math.round(minutesUntil)}min before event`);
  }

  // Delete event from Google Calendar
  try {
    await googleCalendarService.deleteEvent(workspaceId, eventId);

    return `✅ Prenotazione cancellata con successo!\n\n` +
           `Se cambi idea puoi prenotare nuovamente quando vuoi.`;

  } catch (error) {
    logger.error('[cancelAppointment] Failed to delete event:', error);
    return "❌ Errore durante la cancellazione. Contatta l'operatore.";
  }
}
```

#### 3. `getAppointments`

```typescript
// domain/calling-functions/getAppointments.ts

interface GetAppointmentsParams {
  workspaceId: string;
  customerId: string;
  filter?: "upcoming" | "past" | "all";  // Default: "upcoming"
}

// FLOW:
// 1. 🔥 GoogleCalendarService.listEvents() with timeMin/timeMax filters
// 2. Format list with date, time, serviceType
// 3. Return human-friendly list

export async function getAppointments(params: GetAppointmentsParams): Promise<string> {
  const { workspaceId, customerId, filter = "upcoming" } = params;
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });

  let timeMin: Date;
  let timeMax: Date;

  if (filter === "upcoming") {
    timeMin = new Date();
    timeMax = addMonths(new Date(), 6);
  } else if (filter === "past") {
    timeMin = subMonths(new Date(), 6);
    timeMax = new Date();
  } else {
    timeMin = subMonths(new Date(), 6);
    timeMax = addMonths(new Date(), 6);
  }

  // 🔥 Read from Google Calendar
  const events = await googleCalendarService.listEvents({
    workspaceId,
    customerId,
    timeMin,
    timeMax
  });

  if (events.length === 0) {
    return filter === "upcoming"
      ? "🗓️ Non hai prenotazioni future. Vuoi prenotare un appuntamento?"
      : "🗓️ Nessun appuntamento trovato.";
  }

  // Format list
  const listText = events.map((event) => {
    const startTime = utcToZonedTime(
      new Date(event.start.dateTime),
      workspace.timezone
    );
    const formattedDate = format(startTime, "EEEE d MMMM yyyy HH:mm", { locale: itLocale });

    return `• ${event.summary} - ${formattedDate}`;
  }).join("\n");

  return `🗓️ Le tue prenotazioni:\n\n${listText}\n\nVuoi cancellare o modificare qualcosa?`;
}
```

#### 4. `getAvailableSlots`

```typescript
// domain/calling-functions/getAvailableSlots.ts

interface GetAvailableSlotsParams {
  workspaceId: string;
  appointmentTypeId: string;     // 🔥 FIX: Use ID instead of serviceType
  date: string;                  // "2026-04-15"
}

// FLOW:
// 1. 🔥 GoogleCalendarService.getAvailableSlots() → legge da Google Calendar (NO DB)
// 2. Return list of available slots with timezone

export async function getAvailableSlots(params: GetAvailableSlotsParams): Promise<string> {
  const { workspaceId, appointmentTypeId, date } = params;

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  const appointmentType = await prisma.appointmentType.findUnique({ where: { id: appointmentTypeId } });

  if (!appointmentType || !appointmentType.isActive) {
    return "❌ Tipo di appuntamento non disponibile.";
  }

  // 🔥 Read from Google Calendar API (not DB)
  const slots = await googleCalendarService.getAvailableSlots({
    workspaceId,
    appointmentTypeId,
    date
  });

  if (slots.length === 0) {
    return `❌ Nessuno slot disponibile per ${format(new Date(date), "d MMMM yyyy", { locale: itLocale })}.\n\nProva un altro giorno.`;
  }

  // Group slots by morning/afternoon
  const morning = slots.filter(s => parseInt(s.split(":")[0]) < 13);
  const afternoon = slots.filter(s => parseInt(s.split(":")[0]) >= 13);

  let response = `📅 Slot disponibili per ${appointmentType.serviceType} il ${format(new Date(date), "d MMMM yyyy", { locale: itLocale })}:\n\n`;

  if (morning.length > 0) {
    response += `🌅 Mattina: ${morning.join(", ")}\n`;
  }
  if (afternoon.length > 0) {
    response += `🌆 Pomeriggio: ${afternoon.join(", ")}\n`;
  }

  response += `\n⚠️ Durata: ${appointmentType.duration} min + ${appointmentType.bufferMinutes} min buffer\n\nQuale orario preferisci?`;

  return response;
}
```

#### 5. `rescheduleAppointment` (NUOVO)

```typescript
// domain/calling-functions/rescheduleAppointment.ts

interface RescheduleAppointmentParams {
  workspaceId: string;
  customerId: string;
  eventId: string;               // Google Calendar event ID
  newDate: string;               // "2026-04-20"
  newTime: string;               // "14:00"
}

// FLOW:
// 1. Get existing event from Google Calendar
// 2. Check new slot availability
// 3. GoogleCalendarService.updateEvent() with new start/end
// 4. Return confirmation

export async function rescheduleAppointment(params: RescheduleAppointmentParams): Promise<string> {
  const { workspaceId, customerId, eventId, newDate, newTime } = params;

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });

  // Get existing event
  const event = await googleCalendarService.getEvent(workspaceId, eventId);

  if (!event) {
    return "❌ Prenotazione non trovata.";
  }

  const appointmentTypeId = event.extendedProperties?.private?.appointmentTypeId;
  const appointmentType = await prisma.appointmentType.findUnique({ where: { id: appointmentTypeId } });

  // Check new slot availability
  const availableSlots = await googleCalendarService.getAvailableSlots({
    workspaceId,
    appointmentTypeId,
    date: newDate
  });

  if (!availableSlots.includes(newTime)) {
    return `❌ Lo slot ${newTime} non è disponibile.\n\nSlot disponibili: ${availableSlots.slice(0, 5).join(", ")}`;
  }

  // Update event
  const newScheduledAt = zonedTimeToUtc(
    new Date(`${newDate}T${newTime}:00`),
    workspace.timezone
  );
  const newEndAt = addMinutes(newScheduledAt, appointmentType.duration + appointmentType.bufferMinutes);

  try {
    await googleCalendarService.updateEvent(workspaceId, eventId, {
      start: {
        dateTime: newScheduledAt.toISOString(),
        timeZone: workspace.timezone
      },
      end: {
        dateTime: newEndAt.toISOString(),
        timeZone: workspace.timezone
      },
      extendedProperties: {
        private: {
          ...event.extendedProperties?.private,
          reminderSent: 'false'  // Reset reminder flag
        }
      }
    });

    return `✅ Appuntamento spostato con successo!\n\n` +
           `📆 Nuova data: ${format(utcToZonedTime(newScheduledAt, workspace.timezone), "d MMMM yyyy HH:mm", { locale: itLocale })}`;

  } catch (error) {
    logger.error('[rescheduleAppointment] Failed:', error);
    return "❌ Errore durante lo spostamento. Riprova.";
  }
}
```

#### 6. `confirmReminderResponse` (NUOVO)

```typescript
#### 6. `confirmReminderResponse` (NUOVO - FIX: max 2 attempts poi escalation)

```typescript
// domain/calling-functions/confirmReminderResponse.ts

interface ConfirmReminderResponseParams {
  workspaceId: string;
  customerId: string;
  eventId: string;               // Event ID from reminder context
  response: "yes" | "no" | "unclear";
  attemptNumber?: number;         // 🔥 Track clarification attempts
}

// 🔥 FLOW:
// 1. Parse response ("SI", "CONFERMO", "NO", "ANNULLA", etc.)
// 2. If YES → update event.extendedProperties.confirmed = "true"
// 3. If NO → call cancelAppointment() + log LateCancellationAttempt if <2h away
// 4. If UNCLEAR → ask for clarification MAX 2 times
//    - If 3rd unclear attempt → escalate to operator

export async function confirmReminderResponse(params: ConfirmReminderResponseParams): Promise<string> {
  const { workspaceId, customerId, eventId, response, attemptNumber = 1 } = params;

  if (response === "yes") {
    // Update event (mark as confirmed)
    await googleCalendarService.updateEvent(workspaceId, eventId, {
      extendedProperties: {
        private: {
          confirmed: 'true'
        }
      }
    });

    return "✅ Perfetto! Ti aspettiamo all'appuntamento. A presto!";

  } else if (response === "no") {
    // Get event details
    const event = await googleCalendarService.getEvent(workspaceId, eventId);
    const eventTime = new Date(event.start.dateTime);
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    const timeDiff = (eventTime.getTime() - new Date().getTime()) / (1000 * 60); // minutes

    // 🔥 Log late cancellation if <2h away
    if (timeDiff < 120) {
      await prisma.lateCancellationAttempt.create({
        data: {
          workspaceId,
          customerId,
          eventId,
          minutesBeforeEvent: Math.round(timeDiff),
          timestamp: new Date()
        }
      });

      logger.info(`[LateCancellation] Customer ${customerId} cancelled ${Math.round(timeDiff)}min before event`);
    }

    // Cancel appointment
    return await cancelAppointment({ workspaceId, customerId, eventId });

  } else {
    // Unclear response → ask for clarification MAX 2 times
    if (attemptNumber >= 2) {
      // 3rd unclear → log + notify operator (NO DB table)
      logger.warn(`[ReminderAmbiguity] Customer ${customerId} failed 2 clarification attempts for event ${eventId}`);
      
      await notificationService.send({
        workspaceId,
        type: 'APPOINTMENT_REMINDER_ESCALATION',
        message: `Customer ${customerId} ambiguous response to reminder for event ${eventId}. Last response: "${response}"`,
        priority: 'normal'
      });

      return `Mi dispiace, non ho capito la tua risposta. Un operatore ti contatterà presto per confermare.`;
    }

    // Ask again
    return `🤔 Non ho capito bene. Vuoi CONFERMARE o CANCELLARE l'appuntamento? Rispondi **SI** o **NO**. (tentativo ${attemptNumber} di 2)`;
  }
}
```

#### 7. Internal: Reminder Ambiguity Escalation (Logging Only)

```typescript
// When after 2 clarification attempts customer response is still unclear:
// - Log event: logger.warn('[ReminderAmbiguity]', ...)
// - Notify operator: notificationService.send(type: 'APPOINTMENT_REMINDER_ESCALATION')
// - NO database table (A: Log + Notification only)
// - Operator sees notification in admin dashboard or receives WhatsApp/email
// - Operator contacts customer manually if needed

// NO contactOperator() function
// NO SupportTicket or AppointmentEscalation table
// Pure logging + notification pattern
```
}
```
```

### Scheduler Job: `appointment-reminder.job.ts` (🔥 REWRITTEN with DB LOCK + Webhooks)

🔥 **CRITICAL FIX**: Atomic lock via DB (NOT Google API), webhooks for scalability, token revocation handling.

**Modes:**
1. **WEBHOOK MODE** (scalable for 100+ workspaces) - Google pushes changes
2. **POLLING MODE** (fallback) - Poll every 30 min for workspaces without webhook
3. **PENDING SYNC** (retry) - Retry failed Google API calls every 5 min

```typescript
// apps/scheduler/src/jobs/appointment-reminder.job.ts

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { subHours, addDays, addMinutes } from 'date-fns';
import { GoogleCalendarService } from '../services/google-calendar.service';
import logger from '../utils/logger';

const prisma = new PrismaClient();
const googleService = new GoogleCalendarService(prisma);

// 🔥 WEBHOOK MODE: Process pending events from webhook notifications (every 5 min)
cron.schedule('*/5 * * * *', async () => {
  await processWebhookQueue();
});

// 🔥 POLLING MODE: Poll workspaces without webhook (every 30 min, fallback)
cron.schedule('*/30 * * * *', async () => {
  await pollWorkspacesWithoutWebhook();
});

// 🔥 WEBHOOK RENEWAL: Renew expiring webhooks (every 6 days, max 7 days expiry)
cron.schedule('0 0 */6 * *', async () => {
  await renewExpiringWebhooks();
});

// 🔥 PENDING SYNC: Retry failed Google API calls (every 5 min)
cron.schedule('*/5 * * * *', async () => {
  await syncPendingAppointments();
});

/**
 * 🔥 WEBHOOK MODE: Process events marked by webhook callback
 */
async function processWebhookQueue() {
  const workspaces = await prisma.workspace.findMany({
    where: {
      hasWebhookPendingEvents: true,  // Flag set by webhook callback
      deletedAt: null
    },
    include: {
      googleCalendarConnection: true
    }
  });

  for (const workspace of workspaces) {
    try {
      await processWorkspaceReminders(workspace, 'WEBHOOK');
      
      // Clear flag
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { hasWebhookPendingEvents: false }
      });
    } catch (error) {
      logger.error(`[REMINDER] Webhook processing failed for ${workspace.id}:`, error);
      
      // 🔥 Token revocation check
      if (error.code === 401) {
        await googleService.handleTokenRevoked(workspace.id, error);
      }
    }
  }
}

/**
 * 🔥 POLLING MODE: Poll only workspaces WITHOUT webhook (fallback)
 */
async function pollWorkspacesWithoutWebhook() {
  const workspaces = await prisma.workspace.findMany({
    where: {
      deletedAt: null,
      googleCalendarConnection: { isActive: true },
      googleCalendarWebhook: { is: null }  // No webhook = fallback to polling
    },
    take: 180  // Max 180 req/min rate limit
  });

  for (const workspace of workspaces) {
    try {
      await processWorkspaceReminders(workspace, 'POLLING');
      
      // Rate limit: 3 req/sec max
      await new Promise(resolve => setTimeout(resolve, 333));
    } catch (error) {
      logger.error(`[REMINDER] Polling failed for ${workspace.id}:`, error);
      
      // 🔥 Token revocation check
      if (error.code === 401) {
        await googleService.handleTokenRevoked(workspace.id, error);
      }
    }
  }
}

/**
 * Process reminders for single workspace
 */
async function processWorkspaceReminders(workspace: any, mode: 'WEBHOOK' | 'POLLING') {
  // 1. Get upcoming events (24h window)
  const events = await googleService.listEvents({
    workspaceId: workspace.id,
    timeMin: new Date(),
    timeMax: addDays(new Date(), 1),
    maxResults: 100
  });

  for (const event of events) {
    // 2. Check if reminder is due
    const reminderTime = subHours(new Date(event.start.dateTime), 24);
    if (new Date() < reminderTime) continue;  // Too early

    // 3. 🔥 ATOMIC LOCK via DB (NOT Google API)
    const locked = await prisma.reminderLock.create({
      data: {
        eventId: event.id,
        workspaceId: workspace.id,
        status: 'LOCKED'
      }
    }).catch((error) => {
      // Unique constraint violation = another job instance has lock
      if (error.code === 'P2002') return null;
      throw error;
    });

    if (!locked) {
      logger.debug(`[REMINDER] Event ${event.id} already locked`);
      continue;
    }

    try {
      // 4. Send reminder
      await sendReminderMessage(workspace, event);

      // 5. Mark as sent
      await prisma.reminderLock.update({
        where: { id: locked.id },
        data: {
          status: 'SENT',
          processedAt: new Date()
        }
      });

      logger.info(`[REMINDER] Sent for event ${event.id}`);
    } catch (error) {
      // Mark as failed
      await prisma.reminderLock.update({
        where: { id: locked.id },
        data: {
          status: 'FAILED',
          processedAt: new Date()
        }
      });

      logger.error(`[REMINDER] Failed for event ${event.id}:`, error);
    }
  }
}

/**
 * 🔥 WEBHOOK RENEWAL: Renew expiring webhooks (DECISION A)
 * - Proactive renewal every 6 days (Google expiry: 7 days)
 * - If renewal fails: retry N times with exponential backoff
 * - If all retries fail: silent fallback to polling mode
 * - No admin notification (automatic)
 */
async function renewExpiringWebhooks() {
  const expiring = await prisma.googleCalendarWebhook.findMany({
    where: {
      expiration: { lt: addDays(new Date(), 1) },  // Expiring in <24h
      isActive: true
    },
    include: {
      workspace: {
        include: { googleCalendarConnection: true }
      }
    }
  });

  for (const webhook of expiring) {
    let retryCount = 0;
    const MAX_RETRIES = 3;
    let renewed = false;

    while (retryCount < MAX_RETRIES && !renewed) {
      try {
        // Stop old channel
        await googleService.stopWebhook(webhook.channelId, webhook.resourceId);

        // Create new webhook
        const newChannel = await googleService.createWebhook(
          webhook.workspace.id,
          webhook.workspace.googleCalendarConnection.accessToken
        );

        // Update DB
        await prisma.googleCalendarWebhook.update({
          where: { id: webhook.id },
          data: {
            channelId: newChannel.id,
            resourceId: newChannel.resourceId,
            expiration: new Date(newChannel.expiration)
          }
        });

        logger.info(`[REMINDER] Renewed webhook for ${webhook.workspaceId}`);
        renewed = true;
      } catch (error) {
        retryCount++;
        
        if (retryCount < MAX_RETRIES) {
          // Exponential backoff: 2s, 4s, 8s
          const delayMs = Math.pow(2, retryCount) * 1000;
          logger.warn(`[REMINDER] Webhook renewal retry ${retryCount} for ${webhook.id}, backing off ${delayMs}ms`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          // All retries exhausted: silent fallback to polling
          logger.error(`[REMINDER] Webhook renewal failed after ${MAX_RETRIES} retries for ${webhook.id}. Falling back to polling.`);
          
          await prisma.googleCalendarWebhook.update({
            where: { id: webhook.id },
            data: { isActive: false }  // Disable webhook, polling will take over
          });
        }
      }
    }
  }
}

/**
 * 🔥 PENDING SYNC: Retry failed Google API calls
 */
async function syncPendingAppointments() {
  const pending = await prisma.pendingAppointment.findMany({
    where: {
      syncStatus: 'PENDING',
      retryCount: { lt: 5 }  // Max 5 retry attempts
    },
    include: {
      workspace: { include: { googleCalendarConnection: true } },
      customer: true,
      appointmentType: true
    },
    take: 50
  });

  for (const appt of pending) {
    try {
      // Create event in Google Calendar
      const event = await googleService.createEvent(
        appt.workspaceId,
        {
          summary: `${appt.appointmentType.serviceType} - ${appt.customer.name}`,
          description: appt.notes || '',
          start: {
            dateTime: appt.scheduledAt.toISOString(),
            timeZone: appt.workspace.timezone
          },
          end: {
            dateTime: addMinutes(appt.scheduledAt, appt.duration).toISOString(),
            timeZone: appt.workspace.timezone
          },
          extendedProperties: {
            private: {
              customerId: appt.customerId,
              appointmentTypeId: appt.appointmentTypeId
            }
          }
        }
      );

      // Mark as synced
      await prisma.pendingAppointment.update({
        where: { id: appt.id },
        data: {
          syncStatus: 'SYNCED',
          googleEventId: event.id,
          lastSyncAttempt: new Date()
        }
      });

      logger.info(`[REMINDER] Synced pending appointment ${appt.id}`);
    } catch (error) {
      // DECISION A: Silent fail + log only (no admin notification)
      // Increment retry count
      await prisma.pendingAppointment.update({
        where: { id: appt.id },
        data: {
          retryCount: { increment: 1 },
          lastSyncAttempt: new Date(),
          syncError: error.message,
          syncStatus: appt.retryCount >= 4 ? 'FAILED' : 'PENDING'  // Mark FAILED after 5 attempts
        }
      });

      if (appt.retryCount >= 4) {
        // Max retries reached: silent fail, log only (no notification)
        logger.error(`[REMINDER] Pending appointment ${appt.id} failed after 5 retries. Marking FAILED. Error:`, error);
      } else {
        logger.warn(`[REMINDER] Failed to sync ${appt.id} (attempt ${appt.retryCount + 1}/5):`, error);
      }
    }
  }
}
```

### Variable Replacement nel Reminder

```typescript
// Variabili disponibili nel reminderMessage:
const templateVariables = {
  "{{customerName}}": customer.name,
  "{{serviceType}}": appointmentType.serviceType,
  "{{date}}": formatDate(appointment.scheduledAt, customer.language),
  "{{time}}": formatTime(appointment.scheduledAt),
  "{{duration}}": `${appointment.duration}`,
  "{{workspaceName}}": workspace.name,
  "{{appointmentId}}": appointment.id
};

// Esempio template:
// "Ciao {{customerName}}, ti ricordiamo che domani alle {{time}} hai un appuntamento per {{serviceType}} (durata: {{duration}} minuti). Ci sarai?"

// Dopo sostituzione:
// "Ciao Mario, ti ricordiamo che domani alle 10:00 hai un appuntamento per Pulizia denti (durata: 30 minuti). Ci sarai?"

// Dopo traduzione LLM (se cliente parla spagnolo):
// "Hola Mario, te recordamos que mañana a las 10:00 tienes una cita para Limpieza dental (duración: 30 minutos). ¿Estarás ahí?"
```

---

## 🎨 Frontend Implementation

### 1. Workspace Settings - Sezione Calendar

**Posizione:** Nella pagina Settings, nuova sezione "Calendar & Appointments"

```
Settings Page
├── Business Config
├── AI Personality  
├── WhatsApp Channel
├── Website Widget
├── Human Support
├── 📅 Calendar & Appointments    ← NUOVA SEZIONE
│   ├── Toggle: Enable Calendar [ON/OFF]
│   └── (se ON) → Appointment Types Table
│       ├── + Add Type (button)
│       ├── Table: Name | Service | Duration | Reminder | Active | Actions
│       └── Edit (Sheet panel da destra)
├── Security
└── Custom Tools
```

**Toggle Calendar:**
- Switch ON/OFF → PATCH `/api/workspaces/:workspaceId/settings` → `{ calendarEnabled: true/false }`
- Quando OFF: nasconde tutto il resto della sezione
- Quando ON: mostra tabella Appointment Types

**Appointment Types Table:**

| Column | Type | Description |
|--------|------|-------------|
| Service Type | Text input | Stringa libera (es: "Pulizia denti", "Demo", "Meeting") |
| Duration | Number input | Minuti (es: 30, 45, 60) |
| Reminder Message | Textarea | Template del reminder con variabili |
| Reminder Hours | Number | Ore prima dell'invio (default: 24) |
| Active | Toggle switch | isActive |
| Actions | Edit / Delete | Sheet panel per edit, soft delete |

**Form di creazione/modifica (Sheet panel):**

```
┌─────────────────────────────────────────────┐
│  📅 Add Appointment Type                     │
│                                              │
│  Service Type *                              │
│  [________________________]                  │
│  (es: "Pulizia denti", "Demo", "Meeting")    │
│                                              │
│  Description (optional)                      │
│  [________________________]                  │
│                                              │
│  Duration (minutes) *                        │
│  [60                      ]                  │
│                                              │
│  Reminder Message *                          │
│  [Ciao {{customerName}}, ti ricordiamo      │
│   che domani alle {{time}} hai...           ]│
│                                              │
│  Available variables:                        │
│  {{customerName}} {{serviceType}} {{date}}   │
│  {{time}} {{duration}} {{workspaceName}}     │
│                                              │
│  Send Reminder (hours before) *              │
│  [24                      ]                  │
│                                              │
│  Color                                       │
│  [🔵 Blue ▼]                                 │
│                                              │
│  Active  [✅]                                 │
│                                              │
│  [Cancel]              [Save]                │
└─────────────────────────────────────────────┘
```

### 2. Sidebar - Voce Calendario

```
📋 Chat History
👥 Clients
❓ FAQ
🛒 E-commerce (se sellsProductsAndServices)
  ├─ 📦 Products
  ├─ 🔧 Services
  ├─ 🏷️ Offers
  ├─ 👤 Sales
  └─ 🛍️ Orders
📅 Calendar              ← NUOVA VOCE (visibile solo se calendarEnabled=true)
📢 Campaigns
```

### 3. Pagina Calendario (`/calendar`)

**Vista principale:** Calendario mensile/settimanale/giornaliero

```
┌─────────────────────────────────────────────────────────────────┐
│  📅 Appointments Calendar                                        │
│                                                                   │
│  [< Prev]  April 2026  [Next >]   [Day] [Week] [Month]          │
│                                                                   │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐                    │
│  │ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │ Sun │                    │
│  │     │     │     │     │     │     │     │                    │
│  │     │     │  1  │  2  │  3  │  4  │  5  │                    │
│  │     │     │     │     │     │     │     │                    │
│  │  6  │  7  │  8  │  9  │ 10  │ 11  │ 12  │                    │
│  │     │ 🔵  │     │     │ 🔵  │     │     │                    │
│  │     │10:00│     │     │14:00│     │     │                    │
│  │     │Pulizia    │     │TAC  │     │     │                    │
│  │     │Mario R.   │     │Anna │     │     │                    │
│  │ 13  │ 14  │ 15  │ 16  │ 17  │ 18  │ 19  │                    │
│  │     │     │ 🟢  │     │     │     │     │                    │
│  │     │     │09:00│     │     │     │     │                    │
│  │     │     │Call │     │     │     │     │                    │
│  │     │     │Luca │     │     │     │     │                    │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┘                    │
│                                                                   │
│  [+ New Appointment]                                              │
│                                                                   │
│  ┌─ Upcoming Appointments ──────────────────────────────────┐    │
│  │  🔵 07 Apr 10:00 - Pulizia denti - Mario Rossi (Conf.)  │    │
│  │  🔵 10 Apr 14:00 - TAC - Anna Bianchi (Confirmed)       │    │
│  │  🟢 15 Apr 09:00 - Call commerciale - Luca Verdi (Conf.)│    │
│  │  🔴 18 Apr 11:00 - Estrazione - Paolo Neri (Cancelled)  │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

**Funzionalità pagina calendario:**
- Vista Mese / Settimana / Giorno
- Click su appuntamento → Sheet panel con dettagli
- "New Appointment" → Form manuale (seleziona cliente, tipo, data/ora)
- Filtri per: tipo, status, periodo
- Colori per tipo di appuntamento
- Badge con conteggio appuntamenti per giorno

**Sheet Panel Dettaglio Appuntamento:**

```
┌─────────────────────────────────────────────┐
│  📅 Appointment Details                      │
│                                              │
│  Status: ✅ Confirmed                        │
│                                              │
│  Type: Pulizia denti                         │
│  Customer: Mario Rossi (+39 333 1234567)     │
│  Date: 07 April 2026                         │
│  Time: 10:00 - 10:30 (30 min)               │
│  Booked via: WhatsApp Chat                   │
│  Notes: Prima visita                         │
│                                              │
│  Reminder: 🟡 Pending (will send 06 Apr 10:00│
│                                              │
│  [Cancel Appointment]  [Mark Complete]        │
│  [Reschedule]          [Mark No-Show]         │
└─────────────────────────────────────────────┘
```

### 4. Widget & WhatsApp - Flusso Chat Gestito da LLM

Il booking avviene tramite la chat (WhatsApp o Widget). L'LLM gestisce TUTTO il flusso conversazionale grazie a 3 ingredienti:

1. **System Prompt** (dal database AgentConfig) → istruzioni su COME comportarsi
2. **Variabile `{{appointmentTypes}}`** → lista dei tipi prenotabili (dal database)
3. **Calling Functions** → azioni che l'LLM può invocare per consultare slot e creare prenotazioni

---

## 🤖 LLM Agent Integration - Come l'LLM Sa Cosa Fare

### 1. System Prompt dell'Agent (database-driven)

Il BOOKING_AGENT riceve questo system prompt (salvato in `AgentConfig` table, MAI hardcoded):

```markdown
## Ruolo
Sei l'assistente per prenotazioni di {{workspaceName}}. Aiuti i clienti a prenotare appuntamenti.

## Tipi di appuntamento disponibili
{{appointmentTypes}}

## Appuntamenti del cliente
{{customerAppointments}}

## Regole di comportamento

### 🔥 FLUSSO PRENOTAZIONE (step OBBLIGATORI con LISTA NUMERATA):

**STEP 1 - Mostra tipi disponibili (OBBLIGATORIO):**
Quando il cliente vuole prenotare, mostra SEMPRE la lista NUMERATA dei tipi disponibili.
NON ACCETTARE mai frasi come "pulizia denti" senza prima mostrare la lista.

Esempio:
"Che tipo di appuntamento ti interessa?
1. Pulizia denti (30 min)
2. TAC dentale (45 min)
3. Visita di controllo (20 min)

Rispondi col numero."

🚫 **CRITICAL**: NON fare fuzzy match su "pulizia" → appointmentTypeId.
✅ **CORRETTO**: Mostra lista numerata, aspetta numero, poi usa appointmentTypeId.

**STEP 2 - Cliente risponde col NUMERO:**
Wait for numeric selection: "1", "2", "3", etc.
Solo DOPO il numero, mappa a appointmentTypeId e procedi.

**STEP 3 - Chiedi la data preferita:**
Dopo che il cliente sceglie il NUMERO, chiedi "Per quando vorresti prenotare?"
Il cliente può dire: "martedì", "domani", "la prossima settimana", "15 aprile".

**STEP 4 - Mostra slot disponibili (LISTA NUMERATA):**
Chiama la funzione `getAvailableSlots` con il tipo scelto e la data.
Mostra gli slot come opzioni NUMERATE.

Esempio:
"Per martedì 8 aprile ho i seguenti slot liberi:
1. 09:00
2. 10:30
3. 14:00
4. 15:30

Quale preferisci?"

**STEP 5 - Cliente risponde col NUMERO:**
Wait for numeric selection: "1", "2", "3", "4", etc.
Solo DOPO il numero, chiama `bookAppointment`.

**STEP 6 - Conferma prenotazione:**
Chiama `bookAppointment` con tipo, data e ora scelti.
Mostra il riepilogo con ✅ e informa del reminder.

### 🔥 REMINDER - Gestione Risposte (FIX: max 2 tentativi, poi escalation)

Quando invii reminder, il cliente può rispondere:
- "Sì" / "OK" / "Confermo" → Registra conferma
- "No" / "Non vengo" → Chiedi se vuole cancellare
- Risposta AMBIGUA (es: "forse", "non so", "ti faccio sapere") → Chiedi conferma MAX 2 volte

🚫 **CRITICAL**: Se dopo 2 tentativi la risposta è ancora ambigua, escalation INTERNA (log + notification):
"Un operatore ti contatterà presto per confermare."

✅ **v1 DECISION A**: No DB table, only logging + notification. Operator sees notification and contacts customer manually if needed.

### REGOLE IMPORTANTI:
- NON inventare mai slot disponibili. Usa SEMPRE `getAvailableSlots`.
- Se non ci sono slot liberi per quel giorno, proponi il giorno successivo.
- Se il cliente vuole cancellare, chiama `cancelAppointment`.
- Se il cliente chiede i suoi appuntamenti, chiama `getAppointments`.
- Rispondi SEMPRE nella lingua del cliente.
- SEMPRE usa liste numerate per scelte (tipi, slot).
- NEVER skip lista numerata - NO fuzzy match su nomi servizi.

## Funzioni disponibili (5 Calling Functions)
- `getAvailableSlots(appointmentTypeId, date)` → Ritorna slot liberi (appointmentTypeId da lista numerata)
- `bookAppointment(appointmentTypeId, date, time)` → Prenota e conferma
- `cancelAppointment(eventId?)` → Cancella un appuntamento
- `getAppointments(filter)` → Lista appuntamenti del cliente
- `rescheduleAppointment(eventId, newDate, newTime)` → Sposta appuntamento a nuova data/ora

**NOTA INTERNA**: `confirmReminderResponse()` NON è una calling function. È gestita internamente dal reminder scheduler:
- Reminder enviato via chat → cliente risponde "SI/NO"
- Sistema riconosce la risposta via intent parsing
- Se SI → log conferma
- Se NO → chiama cancelAppointment()
- Se AMBIGUA x2 → escalation log + notification all'operatore
```

### 2. Variabile `{{appointmentTypes}}` - Cosa Riceve l'LLM

Quando il prompt viene processato, `{{appointmentTypes}}` viene sostituita con i dati reali dal database:

```typescript
// PromptVariableBuilder genera questo testo:
// Costruito da: SELECT * FROM AppointmentType WHERE workspaceId = X AND isActive = true

"Tipi di appuntamento disponibili:
1. Pulizia denti - Pulizia dentale professionale (30 minuti)
2. TAC dentale - Tomografia computerizzata (45 minuti)
3. Visita di controllo - Visita ordinaria (20 minuti)
4. Demo gratuita - Dimostrazione prodotto/servizio (30 minuti)
5. Meeting commerciale - Incontro con il team (45 minuti)"
```

### 3. Variabile `{{customerAppointments}}` - Appuntamenti Esistenti

```typescript
// Se il cliente ha già appuntamenti futuri:
"I tuoi prossimi appuntamenti:
📅 8 Apr 2026 ore 10:00 - Pulizia denti (confermato)
📅 15 Apr 2026 ore 14:00 - TAC dentale (confermato)"

// Se il cliente non ha appuntamenti:
"Non hai appuntamenti prenotati al momento."
```

### 4. Calling Functions - Cosa Ritornano al LLM

#### `getAvailableSlots` → L'LLM riceve gli slot e li mostra

```typescript
// 🔥 FIX: appointmentTypeId DOPO selezione numerata (NO fuzzy match su "pulizia")
// LLM chiama: getAvailableSlots({ appointmentTypeId: "clx123...", date: "2026-04-08" })
// 
// La funzione fa:
// 1. Prende AppointmentType by ID → duration = 30 min
// 2. Prende tutti gli Appointment CONFIRMED del 8 aprile
// 3. Calcola gli slot liberi (09:00-18:00, intervalli di 30 min, escludendo occupati)
// 4. Ritorna al LLM:

{
  "success": true,
  "appointmentType": "Pulizia denti",
  "date": "2026-04-08",
  "duration": 30,
  "availableSlots": [
    { "time": "09:00", "display": "Martedì 8 Aprile ore 09:00" },
    { "time": "10:30", "display": "Martedì 8 Aprile ore 10:30" },
    { "time": "14:00", "display": "Martedì 8 Aprile ore 14:00" },
    { "time": "15:30", "display": "Martedì 8 Aprile ore 15:30" }
  ],
  "message": "Slot disponibili per Pulizia denti il 8 Aprile 2026"
}

// L'LLM riceve questo JSON e risponde al cliente:
// "Per martedì 8 aprile ho i seguenti orari disponibili:
//  1. 09:00
//  2. 10:30
//  3. 14:00
//  4. 15:30
//  Quale preferisci?"
```

#### `bookAppointment` → Conferma prenotazione

```typescript
// 🔥 FIX: appointmentTypeId dopo selezione numerata
// LLM chiama: bookAppointment({ appointmentTypeId: "clx123...", date: "2026-04-08", time: "10:30" })
//
// La funzione fa:
// 1. Verifica slot ancora libero (double-booking check)
// 2. Crea Appointment con status CONFIRMED
// 3. Calcola endAt (10:30 + 30min = 11:00)
// 4. Ritorna al LLM:

{
  "success": true,
  "appointment": {
    "id": "clx123...",
    "appointmentType": "Pulizia denti",
    "date": "2026-04-08",
    "time": "10:30",
    "endTime": "11:00",
    "duration": 30,
    "status": "CONFIRMED",
    "reminderAt": "2026-04-07T10:30:00Z"
  },
  "message": "Appuntamento confermato: Pulizia denti il 8 Aprile 2026 alle 10:30"
}

// L'LLM riceve e risponde:
// "✅ Prenotazione confermata!
//  📅 Pulizia denti
//  📆 Martedì 8 Aprile 2026 ore 10:30
//  ⏱️ Durata: 30 minuti
//  📩 Riceverai un reminder il giorno prima!"
```

---

## 💬 Flussi Conversazionali Completi (Behind the Scenes)

### Scenario 1: Prenotazione Completa (Happy Path)

```
STEP 1 - Cliente chiede appuntamento
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cliente: "Vorrei prenotare un appuntamento"

  [BEHIND THE SCENES]
  → Router Agent: intent = BOOKING_REQUEST
  → BOOKING_AGENT riceve il messaggio
  → L'LLM ha nel prompt {{appointmentTypes}} con i 5 tipi attivi
  → L'LLM sa che deve mostrare la lista (STEP 1 del suo prompt)

Bot: "Certo! Che tipo di appuntamento ti interessa?
      1. Pulizia denti (30 min)
      2. TAC dentale (45 min)
      3. Visita di controllo (20 min)
      4. Demo gratuita (30 min)
      5. Meeting commerciale (45 min)"

STEP 2 - Cliente sceglie il tipo
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cliente: "1"

  [BEHIND THE SCENES]
  → L'LLM sa che "1" = Pulizia denti (dal contesto della conversazione)
  → L'LLM sa che deve chiedere la data (STEP 2 del suo prompt)

Bot: "Per quando vorresti prenotare la pulizia denti?"

STEP 3 - Cliente indica la data
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cliente: "Martedì prossimo"

  [BEHIND THE SCENES]
  → L'LLM interpreta "martedì prossimo" = 2026-04-08
  → L'LLM chiama: getAvailableSlots({ appointmentTypeId: "clx123", date: "2026-04-08" })
  → La funzione torna con 4 slot liberi
  → L'LLM mostra gli slot numerati (STEP 3 del suo prompt)

Bot: "Per martedì 8 aprile ho i seguenti orari disponibili:
      1. 09:00
      2. 10:30
      3. 14:00
      4. 15:30
      Quale preferisci?"

STEP 4 - Cliente sceglie l'orario
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Cliente: "2"

  [BEHIND THE SCENES]
  → L'LLM sa che "2" = 10:30
  → L'LLM chiama: bookAppointment({ serviceType: "Pulizia denti", date: "2026-04-08", time: "10:30" })
  → La funzione: verifica disponibilità → crea Appointment → ritorna conferma
  → L'LLM mostra il riepilogo (STEP 4 del suo prompt)

Bot: "✅ Prenotazione confermata!
      📅 Pulizia denti
      📆 Martedì 8 Aprile 2026 ore 10:30
      ⏱️ Durata: 30 minuti
      📩 Riceverai un reminder il giorno prima!"
```

### Scenario 2: Nessuno Slot Disponibile

```
Cliente: "Vorrei prenotare una TAC per lunedì"

  [BEHIND THE SCENES]
  → L'LLM chiama: getAvailableSlots({ appointmentTypeId: "clx456", date: "2026-04-07" })
  → La funzione ritorna: { availableSlots: [], message: "Nessuno slot disponibile" }
  → L'LLM propone alternative

Bot: "Mi dispiace, per lunedì 7 aprile non ci sono slot disponibili per la TAC dentale.
      Vuoi che controlli la disponibilità per:
      1. Martedì 8 aprile
      2. Mercoledì 9 aprile
      3. Un'altra data?"

Cliente: "1"

  [BEHIND THE SCENES]
  → L'LLM chiama: getAvailableSlots({ appointmentTypeId: "clx456", date: "2026-04-08" })
  → Ritorna 3 slot disponibili

Bot: "Per martedì 8 aprile ho:
      1. 09:00
      2. 11:00
      3. 16:00
      Quale preferisci?"
```

### Scenario 3: Cancellazione Appuntamento

```
Cliente: "Voglio cancellare il mio appuntamento"

  [BEHIND THE SCENES]
  → Router Agent: intent = BOOKING_CANCEL
  → L'LLM ha nel prompt {{customerAppointments}} con gli appuntamenti futuri
  → L'LLM chiama: getAppointments({ filter: "upcoming" })
  → Ritorna lista appuntamenti

Bot: "Hai questi appuntamenti prenotati:
      1. 📅 8 Apr ore 10:30 - Pulizia denti
      2. 📅 15 Apr ore 14:00 - TAC dentale
      Quale vuoi cancellare?"

Cliente: "1"

  [BEHIND THE SCENES]
  → L'LLM chiama: cancelAppointment({ eventId: "clx123..." })
  → La funzione: status → CANCELLED, reminderStatus → SKIPPED

Bot: "❌ Appuntamento cancellato.
      Pulizia denti del 8 Aprile 2026 ore 10:30 è stato annullato.
      Vuoi prenotare un'altra data?"
```

### Scenario 4: Cliente Chiede i Suoi Appuntamenti

```
Cliente: "Che appuntamenti ho?"

  [BEHIND THE SCENES]
  → L'LLM chiama: getAppointments({ filter: "upcoming" })

Bot: "Ecco i tuoi prossimi appuntamenti:
      📅 8 Apr 2026 ore 10:30 - Pulizia denti (confermato)
      📅 15 Apr 2026 ore 14:00 - TAC dentale (confermato)
      
      Vuoi modificare o cancellare un appuntamento?"
```

### Scenario 5: Slot Occupato (Race Condition)

```
  [BEHIND THE SCENES]
  → L'LLM chiama: bookAppointment({ serviceType: "Pulizia denti", date: "2026-04-08", time: "10:30" })
  → Nel frattempo un altro cliente ha prenotato quello slot!
  → La funzione ritorna: { success: false, error: "SLOT_TAKEN", message: "Lo slot non è più disponibile" }
  → L'LLM chiama automaticamente: getAvailableSlots() per mostrare alternative

Bot: "Mi dispiace, lo slot delle 10:30 è appena stato prenotato da un altro cliente.
      Ecco gli orari ancora disponibili per martedì 8 aprile:
      1. 09:00
      2. 14:00
      3. 15:30
      Quale preferisci?"
```

### Scenario 6: Cliente Parla in Spagnolo

```
Cliente: "Quiero reservar una cita"

  [BEHIND THE SCENES]
  → customer.language = "es"
  → L'LLM riceve sempre le istruzioni uguali + {{appointmentTypes}} (in italiano dal DB)
  → Translation Agent traduce la risposta in spagnolo

Bot: "¡Claro! ¿Qué tipo de cita te interesa?
      1. Limpieza dental (30 min)
      2. TAC dental (45 min)
      3. Revisión de control (20 min)
      4. Demo gratuita (30 min)
      5. Reunión comercial (45 min)"

Cliente: "1"

Bot: "¿Para cuándo quieres reservar la limpieza dental?"

Cliente: "El martes"

  [BEHIND THE SCENES]
  → getAvailableSlots({ serviceType: "Pulizia denti", date: "2026-04-08" })

Bot: "Para el martes 8 de abril tengo disponibles:
      1. 09:00
      2. 10:30
      3. 14:00
      Cuál prefieres?"

Cliente: "2"

  [BEHIND THE SCENES]
  → bookAppointment(...)

Bot: "✅ ¡Reserva confirmada!
      📅 Limpieza dental
      📆 Martes 8 de Abril 2026 a las 10:30
      ⏱️ Duración: 30 minutos
      📩 ¡Recibirás un recordatorio el día anterior!"
```

---

## 🔑 Riassunto: Come l'LLM Sa Cosa Fare

```
┌──────────────────────────────────────────────────────────────┐
│                    COSA RICEVE L'LLM                          │
│                                                                │
│  1. SYSTEM PROMPT (da AgentConfig table)                      │
│     → "Sei l'assistente per prenotazioni..."                  │
│     → Regole del flusso a 4 step                              │
│     → Cosa fare se no slot, se cancella, etc.                 │
│                                                                │
│  2. {{appointmentTypes}} (costruita dal DB a runtime)         │
│     → "1. Pulizia denti (30min)\n2. TAC (45min)\n..."        │
│     → L'LLM SA quali tipi esistono per quel workspace        │
│                                                                │
│  3. {{customerAppointments}} (costruita dal DB a runtime)     │
│     → "📅 8 Apr 10:30 - Pulizia denti"                       │
│     → L'LLM SA se il cliente ha già appuntamenti             │
│                                                                │
│  4. CALLING FUNCTIONS (registrate come tools dell'LLM)        │
│     → getAvailableSlots(serviceType, date)                    │
│     → bookAppointment(serviceType, date, time)                │
│     → cancelAppointment(appointmentId)                        │
│     → getAppointments(filter)                                 │
│     → L'LLM PUÒ invocarle quando serve                      │
│                                                                │
│  5. CONVERSATION HISTORY (contesto chat attuale)              │
│     → L'LLM ricorda cosa ha detto prima                      │
│     → Sa che "1" si riferisce alla lista appena mostrata      │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│                    FLUSSO DECISIONALE LLM                      │
│                                                                │
│  Cliente dice qualcosa                                        │
│       │                                                        │
│       ├─ "voglio prenotare" → Mostra {{appointmentTypes}}     │
│       ├─ "1" (scelta tipo) → Chiedi data                      │
│       ├─ "martedì" → Chiama getAvailableSlots() → Mostra slot│
│       ├─ "2" (scelta slot) → Chiama bookAppointment() → ✅   │
│       ├─ "cancella" → Chiama getAppointments() → lista       │
│       ├─ "i miei appuntamenti" → Chiama getAppointments()    │
│       └─ altro → Gestisce normalmente (saluto, info, etc.)   │
└──────────────────────────────────────────────────────────────┘
```

### Nuovo Agent: BOOKING_AGENT

```
Agent: BOOKING_AGENT
Order: 3 (dopo PRODUCT_SEARCH)
Functions: bookAppointment, cancelAppointment, getAppointments, getAvailableSlots
Prompt: Database-driven (AgentConfig table) - vedi system prompt sopra
Condizione: SOLO se workspace.calendarEnabled === true
```

### Prompt Variables Nuove

```
{{appointmentTypes}}     → Lista tipi attivi: "1. Pulizia denti (30min)\n2. TAC (45min)\n..."
{{customerAppointments}} → Appuntamenti futuri del cliente: "📅 8 Apr 10:00 - Pulizia denti\n..."
```

### Condizione di Attivazione

Le calling functions di booking sono disponibili **SOLO** se `workspace.calendarEnabled === true`.

Se `calendarEnabled === false`:
- Il LLM NON riceve le funzioni di booking
- Il LLM NON riceve `{{appointmentTypes}}` nel prompt
- La sidebar NON mostra "Calendar"
- Il BOOKING_AGENT NON viene caricato nella pipeline

---

## 🔒 Security & Multi-Tenant

### Workspace Isolation

**OGNI** query relativa ad appuntamenti DEVE filtrare per `workspaceId` (NO queries without workspaceId filter):

```typescript
// ✅ CORRETTO
const types = await prisma.appointmentType.findMany({
  where: { workspaceId, isActive: true, deletedAt: null }
});

// ❌ MAI FARE
const types = await prisma.appointmentType.findMany({
  where: { isActive: true } // MANCA workspaceId!
});
```

### Double-Booking Prevention (via Google Calendar API)

```typescript
// 🔥 CRITICAL: Verificare availability DIRETTAMENTE via Google Calendar API
// (NO query local DB - Google è source of truth)

async function bookAppointment(params: BookAppointmentParams) {
  // ... validation ...
  
  // 1. Get available slots from Google Calendar
  const slots = await googleCalendarService.getAvailableSlots({
    workspaceId,
    appointmentTypeId,
    date
  });
  
  if (!slots.includes(time)) {
    return "❌ Slot non disponibile (prenotato da altro cliente)";
  }
  
  // 2. Create event atomically
  // Google Calendar API handles concurrency via its own mechanisms
  // If 2 clients try same slot: first wins, second gets error
  
  try {
    const event = await googleCalendarService.createEvent({...});
    return "✅ Prenotazione confermata";
  } catch (error) {
    // Slot was taken between check and create
    return "❌ Slot appena prenotato da altro cliente. Prova un altro orario.";
  }
}
```

**Nota**: NON usiamo `prisma.$transaction` o lock DB perché Google Calendar è source of truth.
Google Calendar rate limit (180 req/min) è sufficiente per uso tipico.

      ]
    }
  });
  
  return !conflicting; // true se disponibile
}
```

### Middleware Stack per Endpoints

```typescript
// TUTTI gli endpoint di appointment usano il 3-layer stack:
router.get(
  '/workspaces/:workspaceId/appointments',
  authMiddleware,
  sessionValidationMiddleware,
  validateWorkspaceOperation,
  appointmentController.getAppointments.bind(appointmentController)
);
```

---

## 💰 Billing Impact

### Costo per Reminder — €0.50 (Premium)

✅ **DECISIONE**: Reminder costano **€0.50** per WhatsApp (premium separato da messaggi normali):
- **Costo per reminder WhatsApp**: €0.50 (distinto da €0.10 per messaggio normale)
- **Reminder via email**: GRATUITO (widget-only customers)
- **TransactionType**: `APPOINTMENT_REMINDER` (nuovo, separato da `MESSAGE`)
- **Fatturazione**: Visibile nello storico transazioni come voce separata (non mescolato ai messaggi €0.10)
- **MonthlyInvoice**: Incluso nella fattura mensile, itemizzato come "Appointment Reminders"
- **PlanConfiguration.reminderCost**: €0.50 (configurabile per workspace)

### Schema — Modifiche Necessarie

#### 1. Nuovo valore nel TransactionType enum (`schema.prisma`)
```prisma
enum TransactionType {
  MESSAGE              // -€0.10 per WhatsApp message
  NEW_ORDER            // -€1.00 per order created
  PUSH_NOTIFICATION    // -€1.00 per push notification
  APPOINTMENT_REMINDER // -€0.50 per reminder (WhatsApp only) ← NUOVO
  RECHARGE
  MONTHLY_FEE
  UPGRADE_FEE
  ADJUSTMENT
  INITIAL_CREDIT
  BONUS
  INVOICE_PAID
}
```

#### 2. Nuovo campo `reminderCost` in `PlanConfiguration` (`schema.prisma`)
```prisma
model PlanConfiguration {
  // ... existing fields ...
  messageCost         Decimal  @db.Decimal(10, 2)  // €0.10
  orderCost           Decimal  @db.Decimal(10, 2)  // €1.00
  pushCost            Decimal  @db.Decimal(10, 2)  // €1.00
  reminderCost        Decimal  @db.Decimal(10, 2)  @default(0.50)  // ← NUOVO
}
```

#### 3. Nuovo entry in `PlatformConfig` seed (per display frontend)
```typescript
// packages/database/prisma/seed.ts — aggiungere nelle PlatformConfig entries:
{ key: "APPOINTMENT_REMINDER", value: "0.50", description: "Cost per WhatsApp appointment reminder" }
```

### Billing Service — Nuovo Metodo

```typescript
// apps/scheduler/src/services/billing.service.ts
async deductReminderCredit(workspaceId: string, appointmentId: string): Promise<void> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { owner: { include: { planConfiguration: true } } }
  })
  const cost = workspace.owner.planConfiguration.reminderCost // €0.50

  await prisma.billingTransaction.create({
    data: {
      userId: workspace.ownerId,
      workspaceId,
      type: 'APPOINTMENT_REMINDER',
      amount: -cost,
      description: `Appointment reminder for appointment ${appointmentId}`,
      metadata: { appointmentId }
    }
  })

  await prisma.user.update({
    where: { id: workspace.ownerId },
    data: { creditBalance: { decrement: cost } }
  })
}
```

### Reminder Job — Billing Integration

```typescript
// apps/scheduler/src/jobs/appointment-reminder.job.ts — in sendReminder():
const sentViaWhatsApp = !!customer.phoneNumber && channel !== 'EMAIL'

if (sentViaWhatsApp) {
  // Solo WhatsApp genera costo €0.50 — email è gratuita
  await billingService.deductReminderCredit(workspace.id, appointment.id)
  logger.info(`[REMINDER] Billed €0.50 for appointment ${appointment.id}`)
} else {
  logger.info(`[REMINDER] Email delivery — no billing for appointment ${appointment.id}`)
}
```

### Frontend — Homepage Billing Box

**File**: `apps/frontend/src/components/billing/BillingSection.tsx`

Aggiungere un nuovo box accanto a MESSAGE (€0.10) e PUSH_CAMPAIGN (€1.00):

```tsx
// Nella sezione "Usage costs are extra":
<CostBox
  icon="📅"
  label="Appointment Reminder"
  priceKey="APPOINTMENT_REMINDER"   // legge da PlatformConfig → €0.50
  note="WhatsApp only — email reminders are free"
/>
```

La riga di testo esistente diventa:
```
💡 Usage costs are extra:
  €0.10 per WhatsApp message
  €0.10 per Widget message
  €1.00 per Push campaign
  €0.50 per Appointment reminder (WhatsApp only)
```

### Storico Transazioni — Billing History

La billing history (tabella `BillingTransaction`) mostrerà entries con:
```
TYPE                  | AMOUNT | DESCRIPTION
----------------------|--------|--------------------------------------------
APPOINTMENT_REMINDER  | -€0.50 | Appointment reminder for appointment abc123
```

Il frontend (tabella transazioni in `BillingPage.tsx`) deve aggiungere:
- Label "Appointment Reminder" per il type `APPOINTMENT_REMINDER`
- Icona/colore differenziante (es. 📅 violetto)

### Nessun Costo per il Booking

La prenotazione in sé è gratuita. Il costo è solo per:
1. I messaggi della conversazione chat (già addebitati come `MESSAGE`)
2. Il messaggio reminder WhatsApp (€0.50 come `APPOINTMENT_REMINDER`)
3. Email reminder → GRATUITA

---

## 📋 Seed Data

### Default per Dentista (esempio)

```typescript
// Nel seed, se workspace.calendarEnabled = true:
const appointmentTypes = [
  {
    serviceType: "Pulizia denti",
    description: "Pulizia dentale professionale",
    duration: 30,
    reminderMessage: "Ciao {{customerName}}, ti ricordiamo che domani alle {{time}} hai la {{serviceType}} presso {{workspaceName}}. Durata: {{duration}} minuti. Ci sarai?",
    reminderHours: 24,
    isActive: true,
    color: "#3B82F6"
  },
  {
    serviceType: "TAC dentale",
    description: "Tomografia computerizzata",
    duration: 45,
    reminderMessage: "Ciao {{customerName}}, domani alle {{time}} hai la {{serviceType}} presso {{workspaceName}}. Durata: {{duration}} minuti. Ti aspettiamo!",
    reminderHours: 24,
    isActive: true,
    color: "#10B981"
  },
  {
    serviceType: "Visita di controllo",
    description: "Visita di controllo ordinaria",
    duration: 20,
    reminderMessage: "Ciao {{customerName}}, ricordati della {{serviceType}} domani alle {{time}} presso {{workspaceName}}. Ci vediamo!",
    reminderHours: 24,
    isActive: true,
    color: "#F59E0B"
  },
  {
    serviceType: "Demo gratuita",
    description: "Dimostrazione prodotto/servizio",
    duration: 30,
    reminderMessage: "Ciao {{customerName}}, domani alle {{time}} hai la {{serviceType}} con il nostro team. Ti aspettiamo!",
    reminderHours: 24,
    isActive: true,
    color: "#8B5CF6"
  },
  {
    serviceType: "Meeting commerciale",
    description: "Incontro con il reparto commerciale",
    duration: 45,
    reminderMessage: "Ciao {{customerName}}, domani alle {{time}} hai il {{serviceType}} presso {{workspaceName}}. Ci vediamo!",
    reminderHours: 24,
    isActive: true,
    color: "#EC4899"
  }
];
```

---

## 🔄 Flusso Completo End-to-End

### Scenario: Dentista "Studio Sorriso"

**Setup (una sola volta):**
1. Admin va su Settings → Calendar & Appointments → Toggle ON
2. Aggiunge 3 tipi: Pulizia (30min), TAC (45min), Controllo (20min)
3. Scrive i messaggi di reminder per ciascuno
4. Salva

**Runtime (ogni giorno):**

```
GIORNO 1 (Lunedì):
  10:00 - Mario scrive su WhatsApp: "Vorrei prenotare una pulizia"
  10:01 - LLM → Intent: BOOKING_REQUEST → mostra tipi disponibili
  10:02 - Mario: "Pulizia denti"
  10:02 - LLM → chiede data
  10:03 - Mario: "Mercoledì alle 10"
  10:03 - LLM → bookAppointment() → Appointment creato (CONFIRMED)
  10:03 - Bot: "✅ Confermato! Pulizia denti, Mer 8 Apr ore 10:00"

GIORNO 2 (Martedì) - 09:00:
  Scheduler: appointment-reminder.job.ts
  → Trova appuntamento di Mario (domani alle 10:00)
  → reminderHours = 24, now è 09:00, scheduledAt è domani 10:00
  → 25h prima → reminder dovuto!
  → Sostituisce variabili nel template
  → Traduce in italiano (lingua di Mario)
  → Inserisce in WhatsApp Queue
  
  09:01 - Mario riceve su WhatsApp:
  "Ciao Mario, ti ricordiamo che domani alle 10:00 hai la pulizia 
   denti presso Studio Sorriso. Durata: 30 minuti. Ci sarai?"

GIORNO 3 (Mercoledì):
  10:00 - Mario arriva → Admin marca "Completed" dal calendario
  
  // OPPURE:
  10:30 - Mario non si presenta → Admin marca "No-Show"
```

---

## 📊 Implementation Phases

### Phase 1 - Backend Core (Priority: HIGH)
1. ✅ Migration: Aggiungere `calendarEnabled` a Workspace
2. ✅ Migration: Aggiungere `timezone` a Workspace (v1 - timezone-aware scheduling)
3. ✅ Migration: Creare model `AppointmentType`
4. ✅ Migration: Creare models `GoogleCalendarConnection`, `PendingAppointment`, `ReminderLock`, `GoogleCalendarWebhook`, `LateCancellationAttempt`, `GdprLog` (NO `Appointment` - Google Calendar è source of truth)
5. ✅ Repository: `appointment-type.repository.ts`
6. ✅ Service: `appointment-type.service.ts`
7. ✅ Service: `google-calendar.service.ts` (wrapper OAuth + API operations)
8. ✅ Controller + Routes: CRUD AppointmentType
9. ✅ OAuth Setup: Google Cloud Console configuration + endpoints
10. ✅ Swagger: Documentazione API
11. ✅ Unit Tests

### Phase 2 - Chat Integration (Priority: HIGH)
1. ✅ Calling Function: `bookAppointment`
2. ✅ Calling Function: `cancelAppointment`
3. ✅ Calling Function: `getAppointments`
4. ✅ Calling Function: `getAvailableSlots`
5. ✅ Calling Function: `rescheduleAppointment` (v1 - Customer self-service via chat)
6. ✅ Agent Config: Prompt per booking (database)
7. ✅ Prompt Variables: `{{appointmentTypes}}`, `{{customerAppointments}}`
8. ✅ Router Agent Update: riconoscere intent BOOKING
9. ✅ Unit Tests per calling functions

### Phase 3 - Scheduler Reminder (Priority: HIGH)
1. ✅ Job: `appointment-reminder.job.ts`
2. ✅ Registration in scheduler index
3. ✅ Variable replacement con template
4. ✅ LLM Translation per lingua cliente
5. ✅ WhatsApp Queue integration
6. ✅ Billing: addebito reminder come messaggio
7. ✅ Unit Tests per job

### Phase 4 - Frontend Settings (Priority: MEDIUM)
1. ✅ Settings: Sezione "Calendar & Appointments"
2. ✅ Settings: Toggle calendarEnabled
3. ✅ Settings: Tabella AppointmentType CRUD
4. ✅ Settings: Form creazione/modifica (Sheet panel)
5. ✅ Settings: Variable helper (mostra variabili disponibili)

### Phase 5 - Frontend Calendar (Priority: MEDIUM)
1. ✅ Sidebar: Voce "Calendar" (condizionale)
2. ✅ Page: CalendarPage con vista mese/settimana/giorno
3. ✅ Calendar: Visualizzazione appuntamenti
4. ✅ Calendar: Click appuntamento → dettaglio Sheet
5. ✅ Calendar: "New Appointment" form manuale
6. ✅ Calendar: Filtri per tipo/status/periodo
7. ✅ Calendar: Cambio status (Complete, No-Show, Cancel)

### Phase 6 - Polish & Edge Cases (Priority: LOW / Future)
1. ⏳ Business hours configuration (v2 - currently 24/7, admin manages via BlackoutPeriods)
2. ⏳ Google Calendar / Outlook sync (future - currently Google Calendar only)
3. ⏳ Recurring appointments (future)
4. ⏳ Multiple reminder schedules per appointment (future - currently 1 reminder per AppointmentType)
5. ⏳ Calendar public shareable link (future - customer self-service page)
6. ⏳ SMS reminders (currently WhatsApp + Email only)
7. ⏳ Integration with Stripe/Calendly (future)

---

## ⚠️ Vincoli e Note Importanti

1. **NO HARDCODED DATA**: Tutti i tipi di appuntamento, messaggi reminder, durate vengono dal database
2. **WORKSPACE ISOLATION**: Ogni query filtra per `workspaceId`
3. **LINGUA CLIENTE**: Il reminder viene scritto in lingua base (IT) nel template, poi tradotto nella lingua del cliente dal LLM Translation Agent
4. **NO KEYWORD DETECTION**: L'intent "booking" viene riconosciuto dal LLM, MAI da `message.includes("prenotare")`
5. **CONDITIONAL UI**: Il calendario e tutto ciò che è correlato è visibile SOLO se `calendarEnabled === true`
6. **TESTS FIRST**: Scrivere unit test PRIMA dell'implementazione
7. **TEMPLATE VARIABLES**: Il reminderMessage supporta variabili `{{...}}` - stesso pattern di `PromptProcessorService`
8. **DOUBLE BOOKING**: Prevenzione overlap obbligatoria prima di confermare
9. **BILLING**: Reminder WhatsApp = €0.50 con `TransactionType.APPOINTMENT_REMINDER` (NON MESSAGE). Email reminder = gratuito. Prezzo configurabile in `PlanConfiguration.reminderCost`. Visibile in storico transazioni separatamente.
10. **CALENDAR LIBRARY FE**: Usare una libreria calendario React (es: `react-big-calendar` o `@fullcalendar/react`) per la visualizzazione

---

## 🧪 Test Scenarios

### Unit Tests da Scrivere

```
appointment-type.service.spec.ts:
  ✅ Should create appointment type with workspace isolation
  ✅ Should not create if calendarEnabled is false
  ✅ Should validate required fields (serviceType, duration, reminderMessage)
  ✅ Should allow any string as serviceType (no FK validation)
  ✅ Should soft-delete appointment type
  ✅ Should toggle isActive

appointment.service.spec.ts:
  ✅ Should create appointment for valid slot
  ✅ Should reject double-booking (overlap detection)
  ✅ Should cancel appointment and set reminderStatus to SKIPPED
  ✅ Should return only customer's appointments
  ✅ Should filter by status and date range
  ✅ Should calculate endAt from scheduledAt + duration

bookAppointment.spec.ts:
  ✅ Should book appointment via calling function
  ✅ Should reject if calendarEnabled is false
  ✅ Should reject if slot is taken
  ✅ Should match appointment type by fuzzy serviceType
  ✅ Should return confirmation message with details

appointment-reminder.job.spec.ts:
  ✅ Should find appointments due for reminder
  ✅ Should replace template variables correctly
  ✅ Should skip cancelled appointments
  ✅ Should handle translation via LLM
  ✅ Should insert into WhatsApp queue
  ✅ Should update reminderStatus to SENT
  ✅ Should not fail all if one reminder fails
```

---

## 🧠 ANALISI CRITICA: Multi-Turn Agent Routing & Continuità Conversazionale

### Il Problema: Come Funziona il "SI" dopo una Domanda del Sub-Agent

> **DOMANDA CHIAVE**: Quando BOOKING_AGENT chiede "Vuoi prenotare?" e il cliente risponde "SI", come fa il sistema a sapere che quel "SI" va al BOOKING_AGENT e non viene interpretato dal ROUTER come un generico "sì"?

### Risposta: Il Sistema Usa CONVERSATION HISTORY (Non Sticky Agent)

L'architettura attuale utilizza la **conversation history come source of truth**, NON un meccanismo "sticky agent":

```
OGNI messaggio segue SEMPRE questa pipeline:

Cliente: "SI"
    ↓
[chat-engine.service.ts] Riceve messaggio
    ↓
[llm-router.service.ts:1632] Carica TUTTA la conversation history
    ↓
La history include:
  • ConversationMessage role="assistant", agentType="BOOKING_AGENT"
    Content: "Vuoi prenotare la pulizia denti?"
  • ConversationMessage role="user"
    Content: "SI"
    ↓
[llm-router.service.ts:2001] Costruisce i messaggi per il Router LLM:
  {role: "system", content: routerSystemPrompt}
  {role: "assistant", agentType: "BOOKING_AGENT", content: "Vuoi prenotare?"}
  {role: "user", content: "SI"}
    ↓
Router LLM VEDE il contesto completo:
  → "L'ultimo assistant era BOOKING_AGENT che chiedeva conferma"
  → "L'utente risponde SI"
  → "Devo chiamare bookingAgent(query: 'conferma prenotazione')"
    ↓
[function-executor.service.ts] Esegue bookingAgent → delegateTo: "BOOKING_AGENT"
    ↓
BOOKING_AGENT gestisce la conferma
    ↓
Risposta salvata con agentType="BOOKING_AGENT" in ConversationMessage
```

### Evidenza dal Codice: ConversationMessage Salva l'agentType

```prisma
// packages/database/prisma/schema.prisma (linea 1293)
model ConversationMessage {
  id                String   @id @default(cuid())
  workspaceId       String
  customerId        String
  conversationId    String
  role              String   // "user", "assistant", "function"
  content           String   @db.Text
  agentType         String?  // ← "ROUTER", "PRODUCT_SEARCH", "BOOKING_AGENT" etc.
  // ...
}
```

**Ogni risposta di ogni agent viene salvata con il suo `agentType`**. Quando il messaggio successivo arriva, il Router LLM vede l'intera catena e capisce il contesto.

### Fast-Path per Conferme (Ottimizzazione Esistente)

Il sistema ha già un fast-path in `chat-engine.service.ts:2098-2175` che bypassa il Router per conferme semplici:

```typescript
// Esempio esistente per carello:
if (preprocessResult.inputType === "confirmation" && 
    pendingAction?.type === "ADD_TO_CART" && 
    pendingAction.productId) {
  // Salta ROUTER, va direttamente a CartManagement
}
```

**Per BOOKING_AGENT**, si può aggiungere lo stesso pattern:

```typescript
// Nuovo fast-path per conferma booking:
if (preprocessResult.inputType === "confirmation" && 
    pendingAction?.type === "CONFIRM_BOOKING" && 
    pendingAction.bookingDetails) {
  // Salta ROUTER, chiama direttamente bookAppointment()
  // Questo gestisce il "SI" dopo "Vuoi prenotare alle 10:30?"
}
```

### Scenari Multi-Turn con BOOKING_AGENT

#### Scenario A: Utente inizia dal nulla "VOGLIO UN APPUNTAMENTO"

```
Turno 1:
  User: "voglio un appuntamento"
  → Router LLM vede il messaggio + ha bookingAgent nei tools
  → Router chiama: bookingAgent({ query: "voglio un appuntamento" })
  → BOOKING_AGENT: "Che tipo di appuntamento vuoi? 1. Pulizia 2. TAC 3. Controllo"
  → Salvato: ConversationMessage { agentType: "BOOKING_AGENT" }

Turno 2:
  User: "1"
  → Router LLM vede: [BOOKING_AGENT chiese tipo] + [User disse "1"]
  → Router chiama: bookingAgent({ query: "pulizia denti" })  ← LLM CAPISCE dal contesto!
  → BOOKING_AGENT: "Per quando vuoi prenotare?"
  
Turno 3:
  User: "martedì"
  → Router LLM vede tutto il flusso booking nella history
  → Router chiama: bookingAgent({ query: "martedì" })
  → BOOKING_AGENT chiama getAvailableSlots() → mostra slot
  
Turno 4:
  User: "2"
  → Router vede: [lista slot] + [User dice "2"]
  → bookingAgent → BOOKING_AGENT chiama bookAppointment()
  → "✅ Prenotato!"
```

#### Scenario B: Utente cambia contesto A METÀ

```
Turno 1:
  User: "voglio un appuntamento"
  → BOOKING_AGENT: "Che tipo vuoi? 1. Pulizia 2. TAC"

Turno 2:
  User: "aspetta, quanto costa il parmigiano?"  ← CAMBIO CONTESTO!
  → Router LLM vede: booking in corso MA utente chiede prodotto
  → Router chiama: productSearchAgent({ query: "parmigiano" })
  → PRODUCT_SEARCH risponde con info prodotto
  
Turno 3:
  User: "ok torniamo all'appuntamento, voglio la pulizia"
  → Router LLM vede: booking precedente + deviazione prodotto + ritorno a booking
  → Router chiama: bookingAgent({ query: "pulizia denti" })
  → BOOKING_AGENT riprende il flusso
```

Questo funziona PERCHÉ:
1. Il Router ha la FULL history
2. Il Router è un LLM intelligente che capisce il contesto
3. NON c'è nessun "sticky state" da resettare

#### Scenario C: Utente chiede DAL NULLA "quando ho l'appuntamento?"

```
Turno 1 (dopo vari messaggi di e-commerce):
  User: "quando ho l'appuntamento?"
  → Router LLM ha bookingAgent nei tools
  → Router chiama: bookingAgent({ query: "quando ho l'appuntamento" })
  → BOOKING_AGENT chiama getAppointments() → mostra lista
```

#### Scenario D: Utente dal nulla "cancella il mio appuntamento"

```
User: "cancella il mio appuntamento del 15"
→ Router → bookingAgent({ query: "cancella appuntamento del 15" })
→ BOOKING_AGENT → getAppointments() → trova match → cancelAppointment()
→ "❌ Cancellato l'appuntamento del 15 aprile"
```

### Conclusione: NESSUN PROBLEMA di Routing

Il tuo sistema è **intrinsecamente capace** di gestire il multi-turn con BOOKING_AGENT perché:

1. ✅ **Conversation history include agentType** → il Router sa chi ha parlato prima
2. ✅ **Router è un LLM** → capisce che "SI" risponde alla domanda precedente
3. ✅ **Tools dinamici** → se `calendarEnabled=true`, `bookingAgent` appare nei tools
4. ✅ **Cambio contesto automatico** → l'utente può andare e tornare liberamente
5. ✅ **Nessun hardcoded pattern** → tutto gestito dal LLM

**L'unica cosa da implementare**: aggiungere `bookingAgent` ai ROUTER_FUNCTIONS e il `BOOKING_AGENT` come sub-agent delegato nel function-executor.

---

## 🔧 MAPPA ESATTA DEI FILE DA MODIFICARE (Codebase Integration)

Questa sezione elenca **OGNI file** che deve essere toccato, con il pattern ESATTO dal codice attuale.

### 1. Database Schema (`packages/database/prisma/schema.prisma`)

#### 1a. Aggiungere `calendarEnabled` a Workspace (dopo `sellsProductsAndServices`)

```prisma
// Dopo la linea: sellsProductsAndServices Boolean @default(true)
calendarEnabled               Boolean     @default(false) // Calendar & Appointments feature toggle
```

#### 1b. Aggiungere enum `AgentType.BOOKING_AGENT` 

```prisma
// Aggiungere alla enum AgentType:
BOOKING_AGENT         // order: 2.5 - Appointment booking specialist
```

#### 1c. Aggiungere `AppointmentType` e `Appointment` models (come definiti sopra)

#### 1d. Aggiungere relazioni inverse a `Workspace` e `Customers`

```prisma
// In Workspace:
appointmentTypes       AppointmentType[]
appointments           Appointment[]

// In Customers:
appointments           Appointment[]
```

#### 1e. Aggiungere pendingAction type al FSM

```prisma
// In conversation-state.service.ts - aggiungere a pendingAction types:
pendingAction?: {
  type: "ADD_TO_CART" | "CONFIRM_ORDER" | "START_CHECKOUT" | "CANCEL_ORDER" 
        | "CONFIRM_BOOKING" | "CANCEL_BOOKING"  // ← NUOVI
  // ... existing fields ...
  bookingDetails?: {    // ← NUOVO
    appointmentTypeId?: string
    serviceType?: string
    date?: string
    time?: string
    duration?: number
  }
}
```

### 2. Agent Functions Config (`apps/backend/src/config/agent-functions.config.ts`)

#### 2a. Aggiungere `bookingAgent` ai ROUTER_FUNCTIONS

Pattern: identico a `productSearchAgent`, `cartManagementAgent`, etc.

```typescript
// Aggiungere in ROUTER_FUNCTIONS array (dopo customerSupportAgent):
{
  type: "function",
  function: {
    name: "bookingAgent",
    description:
      "📅 Delega al Booking Agent. Usare quando cliente vuole prenotare, cancellare, modificare appuntamenti, chiedere i suoi appuntamenti, o chiedere disponibilità.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Richiesta booking del cliente",
        },
      },
      required: ["query"],
    },
  },
},
```

#### 2b. Aggiungere array `BOOKING_FUNCTIONS`

```typescript
/**
 * Booking Agent Functions
 * Chiamate dal BOOKING_AGENT per operazioni calendario
 */
export const BOOKING_FUNCTIONS: FunctionDefinition[] = [
  {
    type: "function",
    function: {
      name: "getAvailableSlots",
      description:
        "📅 Recupera gli slot disponibili per un tipo di appuntamento in una data specifica. OBBLIGATORIO prima di prenotare.",
      parameters: {
        type: "object",
        properties: {
          appointmentTypeId: {
            type: "string",
            description: "ID del tipo di appuntamento (ottenuto dalla lista numerata mostrata al cliente)",
          },
          date: {
            type: "string",
            description: "Data richiesta in formato ISO (es: '2026-04-15'). Se relativa ('domani', 'martedì'), il LLM la converte.",
          },
        },
        required: ["appointmentTypeId", "date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bookAppointment",
      description:
        "✅ Prenota un appuntamento per il cliente. Usare DOPO che il cliente ha scelto tipo, data e orario. Verifica automaticamente disponibilità.",
      parameters: {
        type: "object",
        properties: {
          appointmentTypeId: {
            type: "string",
            description: "ID del tipo di appuntamento",
          },
          date: {
            type: "string",
            description: "Data in formato ISO (es: '2026-04-15')",
          },
          time: {
            type: "string",
            description: "Orario scelto (es: '10:30')",
          },
          notes: {
            type: "string",
            description: "Note opzionali del cliente",
          },
        },
        required: ["appointmentTypeId", "date", "time"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getAppointments",
      description:
        "📋 Recupera la lista degli appuntamenti del cliente. Usare quando cliente chiede 'i miei appuntamenti', 'quando ho l'appuntamento?'",
      parameters: {
        type: "object",
        properties: {
          filter: {
            type: "string",
            enum: ["upcoming", "past", "all"],
            description: "Filtro: upcoming (futuri, default), past (passati), all (tutti)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancelAppointment",
      description:
        "❌ Cancella un appuntamento del cliente. Se eventId non specificato, mostra lista appuntamenti futuri per scegliere.",
      parameters: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            description: "Google Calendar event ID dell'appuntamento da cancellare. Se non specificato, il sistema chiede quale cancellare.",
          },
          reason: {
            type: "string",
            description: "Motivo della cancellazione (opzionale)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rescheduleAppointment",
      description:
        "🔄 Sposta un appuntamento a una nuova data/ora. Se eventId non specificato, mostra lista per scegliere.",
      parameters: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            description: "Google Calendar event ID dell'appuntamento da spostare",
          },
          newDate: {
            type: "string",
            description: "Nuova data in formato ISO",
          },
          newTime: {
            type: "string",
            description: "Nuovo orario (es: '14:00')",
          },
        },
        required: [],
      },
    },
  },
]
```

#### 2c. Aggiungere `BOOKING_AGENT` nel switch `getAgentFunctions()`

```typescript
case "BOOKING_AGENT":
  return BOOKING_FUNCTIONS
```

#### 2d. Aggiungere BOOKING_FUNCTIONS in `getAllFunctions()`

```typescript
export function getAllFunctions(): FunctionDefinition[] {
  return [
    ...ROUTER_FUNCTIONS,
    ...PRODUCT_SEARCH_FUNCTIONS,
    ...CART_MANAGEMENT_FUNCTIONS,
    ...ORDER_TRACKING_FUNCTIONS,
    ...CUSTOMER_SUPPORT_FUNCTIONS,
    ...SUMMARY_AGENT_FUNCTIONS,
    ...PROFILE_MANAGEMENT_FUNCTIONS,
    ...BOOKING_FUNCTIONS, // ← NUOVO
  ]
}
```

### 3. Function Executor (`apps/backend/src/services/function-executor.service.ts`)

#### 3a. Aggiungere delegation case per `bookingAgent`

```typescript
// Nel switch di dispatch (dopo "profileManagementAgent"):
case "bookingAgent":
  result = await this.delegateToBookingAgent(args, context)
  break
```

#### 3b. Aggiungere handler methods per le calling functions

```typescript
// Delegation function:
private async delegateToBookingAgent(
  args: Record<string, any>,
  context: ExecutionContext
): Promise<any> {
  logger.info("📅 Delegating to Booking Agent", { args, context })
  return {
    delegateTo: "BOOKING_AGENT",
    query: args.query,
    message: `Delegating to Booking Agent for: ${args.query}`,
  }
}

// Direct functions (chiamate dal BOOKING_AGENT):
case "getAvailableSlots":
  result = await this.getAvailableSlots(args, context)
  break

case "bookAppointment":
  result = await this.bookAppointment(args, context)
  break

case "getAppointments":
  result = await this.getAppointments(args, context)
  break

case "cancelAppointment":
  result = await this.cancelAppointment(args, context)
  break

case "rescheduleAppointment":
  result = await this.rescheduleAppointment(args, context)
  break
```

### 4. LLM Router Service (`apps/backend/src/services/llm-router.service.ts`)

#### 4a. Filtrare booking functions se `calendarEnabled=false`

Stesso pattern di `sellsProductsAndServices` (linea 1209-1220):

```typescript
// Dopo il filtro e-commerce esistente:
const bookingFunctions = ["bookingAgent"]
const filteredDbFunctions = dbFunctions.filter(fn => {
  // Filtro e-commerce esistente
  if (!workspace.sellsProductsAndServices && ecommerceFunctions.includes(fn.functionName)) {
    return false
  }
  // ← NUOVO: Filtro booking
  if (!workspace.calendarEnabled && bookingFunctions.includes(fn.functionName)) {
    return false
  }
  return true
})
```

#### 4b. Gestire delegation a BOOKING_AGENT nel handling di delegateTo

```typescript
// Nel blocco che gestisce delegateTo (dopo PROFILE_MANAGEMENT):
case "BOOKING_AGENT": {
  const bookingAgent = new BookingAgentLLM(this.prisma)
  subAgentResponse = await bookingAgent.handleQuery({
    workspaceId: params.workspaceId,
    customerId: params.customerId,
    query: delegationQuery,
    conversationHistory: conversationHistory,
    customerData: customerData
  })
  agentUsed = "BOOKING_AGENT"
  break
}
```

### 5. Prompt Variables Types (`apps/backend/src/types/prompt-variables.types.ts`)

```typescript
// Aggiungere:
appointmentTypes?: string       // Lista tipi appuntamento attivi
customerAppointments?: string   // Appuntamenti futuri del cliente
calendarEnabled?: boolean       // Flag per {{#if calendarEnabled}}
```

### 6. Prompt Variable Builder (`apps/backend/src/application/services/prompt-variable-builder.service.ts`)

```typescript
// Nel metodo build(), aggiungere la costruzione delle variabili:
static build(...) {
  const variables: PromptVariables = {
    // ... existing variables ...
    
    // Calendar variables (solo se calendarEnabled)
    calendarEnabled: workspace?.calendarEnabled ?? false,
    appointmentTypes: dynamicContent?.appointmentTypes || '',
    customerAppointments: dynamicContent?.customerAppointments || '',
  }
}
```

### 7. Prompt Processor Service (`apps/backend/src/services/prompt-processor.service.ts`)

#### 7a. Aggiungere `calendarEnabled` ai Handlebars conditionals (STEP 2)

```typescript
const conditionalVars = {
  // ... existing ...
  calendarEnabled: variables.calendarEnabled,
  hasAppointmentTypes: !!variables.appointmentTypes,
  hasCustomerAppointments: !!variables.customerAppointments,
}
```

#### 7b. Aggiungere replacement delle variabili (STEP 4)

```typescript
// In replaceStandardVariables():
const isCalendarEnabled = vars.calendarEnabled ?? false

// ... existing replacements ...
.replace(/\{\{appointmentTypes\}\}/g, isCalendarEnabled ? (vars.appointmentTypes || '') : '')
.replace(/\{\{customerAppointments\}\}/g, isCalendarEnabled ? (vars.customerAppointments || '') : '')
```

#### 7c. Aggiungere handleEmptyContent per appointmentTypes

```typescript
// In handleEmptyContent():
if (isCalendarEnabled) {
  if (result.includes("{{appointmentTypes}}") && (!vars.appointmentTypes || vars.appointmentTypes.trim() === "")) {
    result = result.replace(/\{\{appointmentTypes\}\}/g, 
      "⚠️ [CALENDARIO VUOTO]: Non ci sono tipi di appuntamento configurati.")
  }
}
```

### 8. Conversation State FSM (`apps/backend/src/application/chat-engine/conversation-state.service.ts`)

#### 8a. Aggiungere stati di booking

```typescript
// Nuovi stati FSM:
| "BROWSING_APPOINTMENT_TYPES"  // Lista tipi appuntamento
| "SELECTING_DATE"              // Scelta data
| "SELECTING_TIME_SLOT"         // Scelta orario
| "AWAITING_BOOKING_CONFIRM"    // Conferma prenotazione
```

#### 8b. Aggiungere pendingAction types

```typescript
pendingAction?: {
  type: "ADD_TO_CART" | "CONFIRM_ORDER" | "START_CHECKOUT" | "CANCEL_ORDER"
        | "CONFIRM_BOOKING" | "CANCEL_BOOKING"  // ← NUOVI
  // ... existing fields ...
  bookingDetails?: {
    appointmentTypeId?: string
    serviceType?: string
    date?: string
    time?: string
    duration?: number
  }
}
```

### 9. Data Loader / Dynamic Content Builder

Serve un loader che costruisca i testi delle variabili dal database:

```typescript
// Nuovo file: apps/backend/src/application/services/appointment-data-loader.service.ts

export class AppointmentDataLoader {
  
  /**
   * Costruisce {{appointmentTypes}} dal database
   * Output: "1. Pulizia denti - Pulizia dentale professionale (30 minuti)\n2. TAC..."
   */
  static async buildAppointmentTypesVariable(workspaceId: string): Promise<string> {
    const types = await prisma.appointmentType.findMany({
      where: { workspaceId, isActive: true, deletedAt: null },
      orderBy: { sortOrder: 'asc' }
    })
    
    if (types.length === 0) return ''
    
    return types.map((t, i) => 
      `${i + 1}. ${t.serviceType}${t.description ? ` - ${t.description}` : ''} (${t.duration} minuti)`
    ).join('\n')
  }
  
  /**
   * Costruisce {{customerAppointments}} dal database
   * Output: "📅 8 Apr 2026 ore 10:00 - Pulizia denti (confermato)\n📅 15 Apr..."
   */
  static async buildCustomerAppointmentsVariable(
    workspaceId: string, 
    customerId: string
  ): Promise<string> {
    const appointments = await prisma.appointment.findMany({
      where: {
        workspaceId,
        customerId,
        status: 'CONFIRMED',
        scheduledAt: { gte: new Date() }
      },
      include: { appointmentType: true },
      orderBy: { scheduledAt: 'asc' }
    })
    
    if (appointments.length === 0) return 'Non hai appuntamenti prenotati al momento.'
    
    return appointments.map(a => 
      `📅 ${formatDate(a.scheduledAt)} ore ${formatTime(a.scheduledAt)} - ${a.appointmentType.serviceType} (${a.status.toLowerCase()})`
    ).join('\n')
  }
}
```

### 10. Router Agent Prompt (Database - `AgentConfig` table)

Il prompt del ROUTER deve includere una sezione condizionale per il booking. Usando il pattern `{{#if}}` Handlebars già esistente:

```markdown
{{#if calendarEnabled}}

## 📅 CALENDARIO E APPUNTAMENTI

Questo workspace ha il sistema di prenotazione appuntamenti attivo.

### Tipi di appuntamento disponibili:
{{appointmentTypes}}

### Appuntamenti del cliente:
{{customerAppointments}}

### Quando delegare al Booking Agent:
- Cliente vuole prenotare un appuntamento → bookingAgent
- Cliente vuole cancellare un appuntamento → bookingAgent
- Cliente vuole spostare/modificare un appuntamento → bookingAgent
- Cliente chiede i propri appuntamenti → bookingAgent
- Cliente chiede disponibilità / orari liberi → bookingAgent
- Cliente chiede quando ha l'appuntamento → bookingAgent

{{/if}}
```

**NOTA CRITICA**: Questa sezione viene **automaticamente rimossa** se `calendarEnabled=false`, grazie al template engine Handlebars (STEP 2 del prompt-processor). Il Router NON vedrà mai `bookingAgent` nei tools E non avrà le istruzioni di booking nel prompt.

### 11. BOOKING_AGENT Prompt (Nuovo record in `AgentConfig`)

File markdown: `apps/backend/docs/prompts/booking-agent.md`

(Contenuto del system prompt come già definito nella sezione "LLM Agent Integration" sopra)

Seeding:

```typescript
// packages/database/prisma/data/defaultAgents.ts
// Aggiungere all'array:
{
  workspaceId,
  name: "Booking Agent",
  type: "BOOKING_AGENT",
  model: "openai/gpt-4o-mini",
  temperature: 0.2,
  maxTokens: 1000,
  order: 2.5,  // Tra PRODUCT_SEARCH(2) e CART_MANAGEMENT(3)
  isActive: true, // Attivo ma le funzioni filtrate se calendarEnabled=false
}
```

### 12. BookingAgentLLM Service (Nuovo)

```
apps/backend/src/agents/booking-agent-llm.service.ts
```

Pattern: identico a `ProductSearchAgentLLM`, `CartManagementAgentLLM`:

```typescript
export class BookingAgentLLM {
  constructor(private prisma: PrismaClient) {}

  async handleQuery(params: {
    workspaceId: string
    customerId: string
    query: string
    conversationHistory: ConversationMessage[]
    customerData: any
  }): Promise<SubAgentResponse> {
    // 1. Carica prompt da AgentConfig (type: BOOKING_AGENT)
    // 2. Replace variabili ({{appointmentTypes}}, {{customerAppointments}})
    // 3. Chiama LLM con functions: BOOKING_FUNCTIONS
    // 4. Gestisci function calling (getAvailableSlots, bookAppointment, etc.)
    // 5. Ritorna risposta
  }
}
```

### 13. ~~Workspace Service Side Effects~~ — APPROCCIO SCARTATO

> ❌ **QUESTO APPROCCIO NON VA IMPLEMENTATO** — era la versione iniziale, sostituita dall'approccio più semplice descritto sotto.
>
> **Approccio CORRETTO**: Le booking calling functions vengono seedate per TUTTI i workspace alla creazione (identico al pattern ecommerce). Nessun side-effect su `workspace.service.ts`. La visibilità al LLM è filtrata a runtime in `llm-router.service.ts` usando il flag `calendarEnabled`, esattamente come `sellsProductsAndServices` filtra le ecommerce functions.

### 14. Seeding per Calling Functions (Pattern Corretto)

```typescript
const bookingSystemFunctions = [
  {
    workspaceId,
    functionName: "bookingAgent",
    description: "📅 Delega al Booking Agent per prenotazioni",
    executionType: "DELEGATE_TO_AGENT",
    isSystemFunction: true,
    isActive: true, // Sarà filtrato da calendarEnabled
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
  },
  {
    workspaceId,
    functionName: "getAvailableSlots",
    description: "📅 Slot disponibili per appuntamento",
    executionType: "INTERNAL",
    isSystemFunction: true,
    isActive: true,
    parameters: { /* ... */ }
  },
  {
    workspaceId,
    functionName: "bookAppointment",
    description: "✅ Prenota appuntamento",
    executionType: "INTERNAL",
    isSystemFunction: true,
    isActive: true,
    parameters: { /* ... */ }
  },
  {
    workspaceId,
    functionName: "cancelAppointment",
    description: "❌ Cancella appuntamento",
    executionType: "INTERNAL",
    isSystemFunction: true,
    isActive: true,
    parameters: { /* ... */ }
  },
  {
    workspaceId,
    functionName: "getAppointments",
    description: "📋 Lista appuntamenti del cliente",
    executionType: "INTERNAL",
    isSystemFunction: true,
    isActive: true,
    parameters: { /* ... */ }
  },
  {
    workspaceId,
    functionName: "rescheduleAppointment",
    description: "🔄 Sposta appuntamento",
    executionType: "INTERNAL",
    isSystemFunction: true,
    isActive: true,
    parameters: { /* ... */ }
  },
]
```

### 15. Frontend - Settings Page (`apps/frontend/src/pages/SettingsPage.tsx`)

#### 15a. Aggiungere sezione al SECTIONS array

```typescript
const SECTIONS: SettingsSection[] = [
  { key: "business", label: "Business Config", description: "Company info and preferences" },
  { key: "ai-personality", label: "AI Personality", description: "Bot identity, messages and rules" },
  { key: "whatsapp", label: "WhatsApp Channel", description: "WhatsApp Business API settings" },
  { key: "widget", label: "Website Widget", description: "Chat widget for your website" },
  { key: "widget-support", label: "Human Support", description: "Escalation to human operators" },
  // ← NUOVA SEZIONE:
  { key: "calendar", label: "Calendar & Appointments", description: "Appointment booking and reminders" },
  { key: "security", label: "Security", description: "Access control and domains" },
  { key: "functions", label: "Custom Tools", description: "External functions and webhooks" },
]
```

#### 15b. Creare componente sezione

```
apps/frontend/src/components/settings/sections/CalendarSection.tsx
```

Contenuto: Toggle `calendarEnabled` + CRUD tabella `AppointmentType`. Pattern: identico a `WhatsAppChannelSection`.

### 16. Frontend - Sidebar (`apps/frontend/src/components/layout/Sidebar.tsx`)

```typescript
// Aggiungere voce condizionale (pattern spread operator):
...(workspace?.calendarEnabled === true ? [{
  href: "/calendar",
  label: "Calendar",
  icon: CalendarIcon,
}] : []),
```

### 17. Frontend - Pagina Calendario

```
apps/frontend/src/pages/CalendarPage.tsx
```

Con libreria `@fullcalendar/react` o `react-big-calendar`.

### 18. Scheduler - Reminder Job

```
apps/scheduler/src/jobs/appointment-reminder.job.ts
```

Registrazione in `apps/scheduler/src/index.ts`:

```typescript
import { appointmentReminderJob } from './jobs'

cron.schedule('*/30 * * * *', async () => {
  await runJob('appointment-reminder', appointmentReminderJob)
})
```

### 19. Email Service - Booking Confirmation (`apps/backend/src/application/services/email.service.ts`)

```typescript
async sendBookingConfirmationEmail(data: {
  to: string
  customerName: string
  serviceType: string
  date: string
  time: string
  duration: number
  workspaceName: string
}): Promise<boolean> {
  const htmlContent = this.generateBookingConfirmationHTML(data)
  
  const mailOptions = {
    from: `"${data.workspaceName}" <${process.env.SMTP_FROM}>`,
    to: data.to,
    subject: `📅 Appointment Confirmed - ${data.serviceType}`,
    html: htmlContent,
    // v1 INCLUDED: .ics attachment per aggiunta automatica a Google Calendar
    icalEvent: { content: generateICS(data) }  // Using simple-ics library
  }

  await this.getTransporter().sendMail(mailOptions)
  return true
}
```

### 20. API Endpoints - Routes Registration

```typescript
// apps/backend/src/interfaces/http/routes/index.ts
import appointmentTypeRoutes from './appointment-type.routes'
import appointmentRoutes from './appointment.routes'

router.use('/api/workspaces/:workspaceId/appointment-types', appointmentTypeRoutes)
router.use('/api/workspaces/:workspaceId/appointments', appointmentRoutes)
```

### 21. Swagger Documentation (`apps/backend/src/swagger.yaml`)

Aggiungere endpoints per AppointmentType CRUD e Appointment CRUD.

---

## 🔒 SICUREZZA - Checklist Completa

### Workspace Isolation (CRITICO)

**OGNI** query deve filtrare per `workspaceId`:

```typescript
// ✅ CORRETTO - Appointment Types
const types = await prisma.appointmentType.findMany({
  where: { workspaceId, isActive: true, deletedAt: null }
})

// ✅ CORRETTO - Appointments
const appointments = await prisma.appointment.findMany({
  where: { workspaceId, customerId, status: 'CONFIRMED' }
})

// ✅ CORRETTO - Available Slots
const existing = await prisma.appointment.findMany({
  where: { workspaceId, scheduledAt: { gte: startOfDay, lte: endOfDay }, status: 'CONFIRMED' }
})

// ❌ SBAGLIATO - Mai senza workspaceId!
const types = await prisma.appointmentType.findMany({ where: { isActive: true } })
```

### Double-Booking Prevention (Race Condition)

```typescript
// Usare Prisma transaction per prevenire race condition:
async function bookAppointmentSecure(workspaceId: string, data: BookingData) {
  return await prisma.$transaction(async (tx) => {
    // 1. Check overlap DENTRO la transaction
    const conflicting = await tx.appointment.findFirst({
      where: {
        workspaceId,
        status: 'CONFIRMED',
        OR: [
          { scheduledAt: { lte: data.scheduledAt }, endAt: { gt: data.scheduledAt } },
          { scheduledAt: { lt: data.endAt }, endAt: { gte: data.endAt } },
          { scheduledAt: { gte: data.scheduledAt }, endAt: { lte: data.endAt } }
        ]
      }
    })
    
    if (conflicting) {
      return { success: false, error: 'SLOT_TAKEN', message: 'Lo slot non è più disponibile' }
    }
    
    // 2. Creare DENTRO la transaction
    const appointment = await tx.appointment.create({ data: { ...data, workspaceId } })
    return { success: true, appointment }
  })
}
```

### Customer Isolation

Un cliente NON può:
- Vedere appuntamenti di altri clienti
- Cancellare appuntamenti di altri clienti
- Vedere slot occupati (solo "non disponibile")

```typescript
// cancelAppointment - verifica ownership:
const appointment = await prisma.appointment.findFirst({
  where: {
    id: appointmentId,
    workspaceId,
    customerId, // ← CRITICO: solo i propri!
    status: 'CONFIRMED'
  }
})
if (!appointment) throw new Error('Appointment not found')
```

### Middleware Stack per API Endpoints

```typescript
// TUTTI gli endpoint usano il 3-layer stack:
router.get('/',
  authMiddleware,
  sessionValidationMiddleware,
  validateWorkspaceOperation,
  controller.getAppointmentTypes.bind(controller)
)
```

---

## 📨 SCHEDULER: Comportamento del Reminder nella Conversazione

### Come il Reminder Entra nella Conversation History

Dall'analisi del codice, il sistema WhatsAppQueue ha un campo `conversationMessageId` che linka il messaggio alla ConversationMessage:

```prisma
model WhatsAppQueue {
  // ...
  conversationMessageId String?  // ← LINK a ConversationMessage per timeline
}
```

Questo significa che il reminder:

1. **VIENE salvato come ConversationMessage** con `role: "assistant"`, `agentType: "SYSTEM_REMINDER"`
2. **APPARE nella conversation history** del cliente
3. **Se il cliente RISPONDE al reminder**, il Router LLM vede:

```
[SYSTEM_REMINDER]: "Ciao Mario, ti ricordiamo che domani alle 10:00 hai la pulizia denti."
[USER]: "posso spostare alle 14?"
→ Router LLM: intent chiaro = reschedule booking → bookingAgent
```

### Implementazione del Reminder nel Contesto Chat

```typescript
// appointment-reminder.job.ts - Salvataggio del reminder come messaggio:

async function sendReminder(appointment: AppointmentWithRelations) {
  // 1. Sostituisci variabili nel template
  let message = replaceTemplateVars(
    appointment.appointmentType.reminderMessage,
    appointment
  )
  
  // 2. Traduci nella lingua del cliente
  if (appointment.customer.language !== 'it') {
    message = await translateMessage(message, appointment.customer.language)
  }
  
  // 3. Salva come ConversationMessage (entra nella history)
  const convMessage = await prisma.conversationMessage.create({
    data: {
      workspaceId: appointment.workspaceId,
      customerId: appointment.customerId,
      conversationId: activeConversation.id,
      role: 'assistant',
      agentType: 'SYSTEM_REMINDER', // Identifica come reminder automatico
      content: message,
    }
  })
  
  // 4. Inserisci in WhatsApp Queue per invio
  await prisma.whatsAppQueue.create({
    data: {
      workspaceId: appointment.workspaceId,
      customerId: appointment.customerId,
      phoneNumber: appointment.customer.phone,
      messageContent: message,
      conversationMessageId: convMessage.id, // ← LINK alla conversation history
      status: 'pending',
    }
  })
  
  // 5. Aggiorna reminder status
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { reminderStatus: 'SENT', reminderSentAt: new Date() }
  })
}
```

### Scenario: Cliente Risponde al Reminder

```
[Scheduler 09:00] → WhatsApp:
  "Ciao Mario, ti ricordiamo che domani alle 10:00 hai la pulizia denti 
   presso Studio Sorriso. Durata: 30 minuti. Ci sarai?"

[Mario 09:15] → Risponde al messaggio:
  "posso spostare alle 14?"

Pipeline:
  → ConversationMessage history include il reminder
  → Router LLM vede: [SYSTEM_REMINDER: reminder] + [USER: "spostare alle 14"]
  → Router: intent = reschedule → bookingAgent
  → BOOKING_AGENT: chiama rescheduleAppointment()
  → "✅ Appuntamento spostato alle 14:00!"

[Mario 09:16] → "grazie!"
  → Router: saluto, nessuna action → risposta friendly
```

---

## 🎯 ESEMPIO COMPLETO END-TO-END (Con Tutti i Dettagli Tecnici)

### Setup Iniziale (Admin)

```
1. Admin apre Settings → "Calendar & Appointments"
2. Toggle "Enable Calendar" → ON
   → API PATCH /api/workspaces/:id → { calendarEnabled: true }
   → workspace.service.ts:
     - Attiva bookingAgent in WorkspaceCallingFunction
     - Crea BOOKING_AGENT in AgentConfig (se non esiste)
     - Invalida cache
   → AutoRestart: prompt-processor ora include {{#if calendarEnabled}} section
   
3. Admin aggiunge AppointmentType:
   → API POST /api/workspaces/:id/appointment-types
   body: {
     serviceType: "Pulizia denti",
     description: "Pulizia dentale professionale",
     duration: 30,
     reminderMessage: "Ciao {{customerName}}, domani alle {{time}} hai la {{serviceType}}. Ci sarai?",
     reminderHours: 24,
     color: "#3B82F6"
   }
```

### Conversazione Completa (Behind The Scenes)

```
[09:00] Mario scrive su WhatsApp: "Ciao, vorrei prenotare"

  ┌── PIPELINE ──────────────────────────────────────────────────────────┐
  │ 1. chat-engine.service.ts: riceve messaggio                          │
  │ 2. Salva in ConversationMessage: { role: "user", content: "Ciao..." }│
  │ 3. llm-router.service.ts:                                           │
  │    a. Carica workspace → calendarEnabled=true                        │
  │    b. Carica DB functions → include "bookingAgent" (non filtrata)    │
  │    c. Carica Router prompt → {{#if calendarEnabled}} ATTIVO          │
  │    d. Replace variabili:                                             │
  │       {{appointmentTypes}} → "1. Pulizia denti (30 min)\n2. TAC..."  │
  │       {{customerAppointments}} → "Non hai appuntamenti"              │
  │    e. Chiama OpenAI con tools: [..., bookingAgent]                   │
  │    f. Router LLM: "utente vuole prenotare → bookingAgent"            │
  │    g. function_call: bookingAgent({ query: "vuole prenotare" })      │
  │ 4. function-executor.service.ts:                                     │
  │    → delegateToBookingAgent() → { delegateTo: "BOOKING_AGENT" }     │
  │ 5. llm-router.service.ts riconosce delegateTo:                      │
  │    → Crea BookingAgentLLM                                            │
  │    → Carica prompt BOOKING_AGENT da AgentConfig                      │
  │    → Replace {{appointmentTypes}}, {{customerAppointments}}          │
  │    → Chiama LLM con BOOKING_FUNCTIONS                                │
  │    → LLM risponde con lista tipi                                     │
  │ 6. Salva risposta: ConversationMessage {                             │
  │      role: "assistant",                                              │
  │      agentType: "BOOKING_AGENT",                                     │
  │      content: "Certo! Che tipo di appuntamento vuoi? 1. Pulizia..." │
  │    }                                                                 │
  │ 7. Inserisce in WhatsAppQueue per invio                              │
  └──────────────────────────────────────────────────────────────────────┘

Bot: "Certo! Che tipo di appuntamento ti interessa?
      1. Pulizia denti (30 min)
      2. TAC dentale (45 min)
      3. Visita di controllo (20 min)"

[09:01] Mario scrive: "1"

  ┌── PIPELINE ──────────────────────────────────────────────────────────┐
  │ 1. ConversationMessage salva: { role: "user", content: "1" }         │
  │ 2. Router LLM riceve history:                                        │
  │    [BOOKING_AGENT]: "Che tipo vuoi? 1. Pulizia 2. TAC 3. Controllo" │
  │    [USER]: "1"                                                       │
  │ 3. Router LLM: "utente sceglie tipo 1 = pulizia denti → bookingAgent"│
  │ 4. bookingAgent({ query: "pulizia denti" })                         │
  │ 5. BOOKING_AGENT LLM: "Per quando vuoi prenotare?"                   │
  │ 6. Salva: { agentType: "BOOKING_AGENT", content: "Per quando?" }    │
  └──────────────────────────────────────────────────────────────────────┘

Bot: "Per quando vorresti prenotare la pulizia denti?"

[09:01] Mario: "martedì prossimo"

  ┌── PIPELINE ──────────────────────────────────────────────────────────┐
  │ 1. Router → bookingAgent({ query: "martedì prossimo" })             │
  │ 2. BOOKING_AGENT LLM: interpreta "martedì prossimo" = 2026-04-07    │
  │ 3. BOOKING_AGENT chiama function: getAvailableSlots({                │
  │      serviceType: "Pulizia denti", date: "2026-04-07"               │
  │    })                                                                │
  │ 4. function-executor → appointment.service.ts:                       │
  │    a. Trova AppointmentType "Pulizia denti" → duration=30           │
  │    b. Query appuntamenti CONFIRMED per quel giorno (workspaceId!)   │
  │    c. Genera slot 09:00-18:00 ogni 30min, esclude occupati          │
  │    d. Ritorna: { availableSlots: ["09:00","10:30","14:00","15:30"] } │
  │ 5. BOOKING_AGENT LLM riceve slot e formatta risposta                │
  └──────────────────────────────────────────────────────────────────────┘

Bot: "Per martedì 7 aprile ho i seguenti orari disponibili:
      1. 09:00
      2. 10:30
      3. 14:00
      4. 15:30
      Quale preferisci?"

[09:02] Mario: "2"

  ┌── PIPELINE ──────────────────────────────────────────────────────────┐
  │ 1. Router vede: [BOOKING_AGENT: lista slot] + [USER: "2"]          │
  │ 2. Router → bookingAgent({ query: "scelta slot 2 = 10:30" })       │
  │ 3. BOOKING_AGENT chiama: bookAppointment({                          │
  │      serviceType: "Pulizia denti",                                   │
  │      date: "2026-04-07", time: "10:30"                              │
  │    })                                                                │
  │ 4. function-executor → appointment.service.ts:                       │
  │    a. $transaction aperta                                            │
  │    b. Check overlap → nessun conflitto                               │
  │    c. Crea Appointment { status: CONFIRMED, scheduledAt, endAt }    │
  │    d. $transaction commit                                            │
  │    e. Ritorna: { success: true, appointment: {...} }                │
  │ 5. BOOKING_AGENT formatta conferma                                   │
  │ 6. [OPZIONALE] Invia email conferma con .ics attachment             │
  └──────────────────────────────────────────────────────────────────────┘

Bot: "✅ Prenotazione confermata!
      📅 Pulizia denti
      📆 Martedì 7 Aprile 2026 ore 10:30
      ⏱️ Durata: 30 minuti
      📩 Riceverai un reminder il giorno prima!"

[GIORNO DOPO - 06 Apr 09:00] Scheduler appointment-reminder.job.ts:

  ┌── SCHEDULER PIPELINE ───────────────────────────────────────────────┐
  │ 1. Query: appointments CONFIRMED dove scheduledAt tra now e now+48h │
  │ 2. Trova appuntamento di Mario (domani 07 Apr ore 10:30)           │
  │ 3. reminderHours = 24 → reminder dovuto!                           │
  │ 4. Prende reminderMessage dal AppointmentType                       │
  │ 5. Sostituisce: {{customerName}}→Mario, {{time}}→10:30, etc.       │
  │ 6. Traduce in lingua Mario (IT) → nessuna traduzione necessaria    │
  │ 7. Salva ConversationMessage { agentType: "SYSTEM_REMINDER" }      │
  │ 8. Inserisce in WhatsAppQueue con conversationMessageId             │
  │ 9. Update: reminderStatus = SENT, reminderSentAt = now()           │
  └─────────────────────────────────────────────────────────────────────┘

→ Mario riceve su WhatsApp:
  "Ciao Mario, domani alle 10:30 hai la pulizia denti presso Studio Sorriso. 
   Durata: 30 minuti. Ci sarai?"

[Mario risponde al reminder] "sì ci sarò, grazie!"

  ┌── PIPELINE ──────────────────────────────────────────────────────────┐
  │ Router LLM vede:                                                     │
  │   [SYSTEM_REMINDER]: "reminder pulizia denti domani 10:30"          │
  │   [USER]: "sì ci sarò grazie"                                       │
  │ Router: saluto + conferma → risposta friendly (nessuna action)      │
  └──────────────────────────────────────────────────────────────────────┘

Bot: "Perfetto Mario, ci vediamo domani! 😊"

[Mario risponde al reminder] "posso spostare a venerdì?"

  ┌── PIPELINE ──────────────────────────────────────────────────────────┐
  │ Router LLM vede:                                                     │
  │   [SYSTEM_REMINDER]: "reminder pulizia domani 10:30"                │
  │   [USER]: "posso spostare a venerdì?"                               │
  │ Router: intent = reschedule → bookingAgent                          │
  │ BOOKING_AGENT: chiama rescheduleAppointment + getAvailableSlots     │
  └──────────────────────────────────────────────────────────────────────┘

Bot: "Certo! Per venerdì 10 aprile ho questi slot:
      1. 09:00
      2. 11:00
      3. 14:30
      Quale preferisci?"
```

---

## ⚠️ EDGE CASES & PROBLEMI POTENZIALI

### 1. Conversation History Truncation

Se la conversazione è molto lunga (>20 messaggi), la history potrebbe essere troncata. In questo caso, il Router potrebbe non vedere il contesto di booking precedente.

**Soluzione**: Il `pendingAction` nel FSM funge da backup:
```typescript
// Se pendingAction.type === "CONFIRM_BOOKING", il fast-path gestisce "SI"
// anche se la history è troncata
```

### 2. Concorrenza: Due Clienti Prenotano lo Stesso Slot

**Soluzione**: Prisma `$transaction` con check overlap DENTRO la transaction (vedi sezione Sicurezza).

### 3. Timezone ✅ v1 Included

v1: **`Workspace.timezone`** esiste nel v1 schema.

All calling functions usano `zonedTimeToUtc()` per conversione timezone-aware:
- `bookAppointment()` → converte date/time in workspace timezone
- `getAvailableSlots()` → genera slot in workspace timezone
- `scheduler job` → calcola reminder time in workspace timezone

**NO UTC fallback**: Tutti i calcoli sono timezone-aware da day 1.

### 4. Business Hours - v1 Zero Filter

v1: **NO business hours filtering**. `getAvailableSlots()` genera slot **24/7** per il workspace.

Admin deve gestire manualmente:
- Non offre slot durante week-end aggiungendo blackout periods (v2 feature)
- Oppure crea AppointmentTypes solo per orari lavorativi specifici

**Future (v2)**: Model `WorkspaceBusinessHours` con:
- Orari per ogni giorno della settimana
- `getAvailableSlots()` filtra automaticamente per business hours
- Admin configura in Settings → Calendar → Business Hours

### 5. Reminder per Canale Widget

✅ **v1 DECISION A (Email + .ics)**: Se cliente via Widget-only (no WhatsApp):
- Reminder via email CON .ics attachment (€0.00)
- Customer riceve email + file calendar per aggiunta automatica
- Cost: €0.00 (email = free, no WhatsApp charge)

**Logica implementazione**:
- If `customer.phone` exists → WhatsApp reminder (€0.50)
- If `customer.phone` = null AND `customer.email` exists → Email reminder (€0.00) con .ics attachment
- If neither phone nor email → skip reminder (no contact info available)

### 6. Utente Registrato vs Non Registrato

✅ **v1 DECISION A1a (Soft Gate - E-Commerce Style)**:
- `bookAppointment()` = NO hard check (come `addProductToCart()`)
- Clienti anonimi POSSONO tentare prenotazione senza registrazione
- **BOOKING_AGENT prompt** = soft gate: se `customer.registrationStatus ≠ ACTIVE` → nudge verso registrazione, ma non blocca
- Progressive reminders via RegistrationPromptService (già esistente) dopo N messaggi

**Implementazione**:
- NO check in `bookAppointment()` code
- BOOKING_AGENT prompt logic: "Per ricevere reminder e conferma, registrati qui: [LINK]. Comunque puoi continuare se preferisci."
- Consistency con e-commerce flow (soft nudge, non hard gate)

---

## 📝 Riassunto Decisioni di Design

| Decisione | Scelta | Motivazione |
|-----------|--------|-------------|
| Calendar flag | `Workspace.calendarEnabled` | Semplice ON/OFF, consistente con altri flag (sellsProductsAndServices, etc.) |
| Appointment Types | Model indipendente da Services | `serviceType` è stringa libera: massima flessibilità per qualsiasi tipo (servizi, demo, meeting, call) |
| No FK a Services | `serviceType: String` | Il calendario è indipendente dal catalogo e-commerce. Un dentista, un commerciale, un installatore possono creare tipi senza toccare il catalogo |
| Reminder template | In `AppointmentType.reminderMessage` | Database-first, customizzabile per tipo |
| Reminder timing | `AppointmentType.reminderHours` | Flessibile: 24h, 48h, 2h prima... per tipo |
| Reminder translation | LLM Translation Agent | Multilingua automatico, no hardcoded translations |
| Booking via chat | Calling functions | Consistente con architettura esistente (addProduct, confirmOrder, etc.) |
| Calendar UI | Libreria React dedicata | Non reinventare la ruota per vista calendario |
| Double booking check | Prisma $transaction + overlap query | Atomic e race-condition safe |
| Billing | TransactionType='APPOINTMENT_REMINDER' | Reminder = €0.50 per WhatsApp, separato da messaggi (€0.10) |
| Business hours | v1: default 09-18 lun-ven | Future: model BusinessHours configurabile |
| Routing multi-turn | Conversation history + Router LLM | Il sistema GIÀ funziona così per PRODUCT_SEARCH, CART, ORDER. Nessuna architettura nuova necessaria |
| Registration gate | A1a: Soft prompt (no hard check) | Come e-commerce: nudge verso registrazione, non blocca. Progressive reminder dopo N messaggi |
| Reminder in chat | Salvato come ConversationMessage | Il Router vede il reminder nella history e gestisce le risposte |
| Cambio contesto | Automatico via LLM | Utente può chiedere qualsiasi cosa in qualsiasi momento, il Router instrada |
| Prompt condizionale | `{{#if calendarEnabled}}...{{/if}}` | Sezione booking interamente nascosta se feature disattivata |
| Functions filtrate | `calendarEnabled` flag in llm-router | Booking tools NON disponibili se feature disattivata |
| Agent seeding | BOOKING_AGENT in defaultAgents | Creato per workspace, attivato solo con calendarEnabled |
| Fast-path conferme | `pendingAction.type: "CONFIRM_BOOKING"` | Ottimizzazione per "SI" → prenota senza passare dal Router |
| pendingAction | Esteso con `bookingDetails` | Contiene serviceType, date, time per fast-path |
| CRUD completo | 5 calling functions | getAvailableSlots, bookAppointment, getAppointments, cancelAppointment, rescheduleAppointment |
| Email conferma | Con allegato .ics | Cliente riceve email + .ics file per aggiunta automatica a Google Calendar / Outlook |

---

---

## 🗺️ ROAD MAP DI IMPLEMENTAZIONE

> **NOTA**: Le fasi devono essere eseguite **in ordine**. Ogni fase ha precondizioni dalla precedente.
> Le fasi 1-2 sono il blocco fondante: NIENTE può essere fatto senza di esse.

---

### FASE 1 — Schema DB

**Precondizione**: nessuna  
**Completata quando**: `prisma migrate dev` passa, `prisma generate` completo, Prisma Studio mostra le nuove tabelle.

> **🔥 CRITICAL FIX - Opzione A Confermata**: Google Calendar è l'**UNICA** fonte di verità da day 1.
> **OAuth 2.0 REQUIRED** per attivare feature. Nessuna tabella `Appointment` nel DB.
> Eventi vivono SOLO in Google Calendar. `calendarEnabled = false` by default perché richiede OAuth setup.
> Admin: Settings → Google Calendar → Connect → OAuth flow → isActive=true → Eventi creati in Calendar.
>
> **Multi-Workspace Validation (DECISION B)**: Durante OAuth callback:
> 1. Get userEmail from Google token
> 2. Check: `googleCalendarConnection.findFirst({ where: { externalId: userEmail } })`
> 3. If exists AND different workspace → ERROR "Google account already linked to another workspace"
> 4. If NO → proceed to create/update connection for this workspace
> NON sia già connesso ad altro workspace. 1 calendar = 1 workspace max.
>
> Implementation location: POST `/api/v1/google-oauth/callback` controller
> - Validation happens BEFORE storing new tokens
> - Reject with 400 if account already linked elsewhere
>
> **GDPR Compliance**: Implementare `deleteCustomerData()` function che elimina ANCHE eventi Google Calendar
> quando customer richiede cancellazione dati (GDPR Art. 17).
>
> **Late Cancellation Analytics**: Log `LateCancellationAttempt` quando cliente prova a cancellare <2h prima.
> Usato per analytics e prevenzione no-show.

#### File da Modificare

| File | Azione |
|------|--------|
| `packages/database/prisma/schema.prisma` | Aggiungere tutto il blocco Calendar |

#### Modifiche esatte allo schema

```prisma
// 1. Workspace model - aggiungere sotto sellsProductsAndServices:
calendarEnabled    Boolean   @default(false)

// 2. Workspace model - relazioni (dentro il model):
appointmentTypes   AppointmentType[]
appointments       Appointment[]

// 3. Customers model - relazione:
appointments       Appointment[]

// 4. AgentType enum - aggiungere:
BOOKING_AGENT
SYSTEM_REMINDER  // per messaggi automatici del scheduler

// 5. Nuovi enum:
enum AppointmentStatus {
  CONFIRMED
  CANCELLED
  COMPLETED
  NO_SHOW
  RESCHEDULED
}

enum ReminderStatus {
  PENDING
  SENT
  FAILED
  SKIPPED
}

// 6. TransactionType enum - aggiungere:
APPOINTMENT_REMINDER  // -€0.50 per WhatsApp reminder

// 7. PlanConfiguration model - aggiungere campo:
reminderCost  Decimal  @db.Decimal(10, 2)  @default(0.50)

// 8. Nuovi model: AppointmentType e Appointment
// (come da definizioni complete nella sezione "Database Schema Changes" sopra)
```

#### Comandi da eseguire (in ordine)

```bash
cd packages/database
npx prisma migrate dev --name add_calendar_appointments
npx prisma generate

# Verificare che seed funzioni ancora
cd ../../
npm run prisma:seed
```

#### ⚠️ ATTENZIONE

- La migrazione aggiunge `calendarEnabled BOOLEAN DEFAULT false` → nessun workspace esistente viene rotto (tutti partono con calendar OFF)
- Il campo `AgentType.BOOKING_AGENT` viene aggiunto all'enum PRIMA di creare i record → nessun problema di FK

---

### FASE 2 — Backend (Repository → Service → Controller → Route)

**Precondizione**: Fase 1 completata, `prisma generate` eseguito.  
**Completata quando**: tutti gli endpoint rispondono correttamente (verificabile con Swagger), workspace.service.ts gestisce il toggle `calendarEnabled`.

#### 2a. File da Creare (NUOVO)

| File | Contenuto |
|------|-----------|
| `apps/backend/src/repositories/appointment-type.repository.ts` | `findByWorkspace`, `findById`, `create`, `update`, `softDelete`, `toggleActive` |
| `apps/backend/src/repositories/appointment.repository.ts` | `findByWorkspace`, `findByCustomer`, `findById`, `create`, `updateStatus`, `findForReminder`, `findOverlapping` |
| `apps/backend/src/application/services/appointment-type.service.ts` | Business logic + workspace isolation |
| `apps/backend/src/application/services/appointment.service.ts` | Business logic + **double-booking check via `$transaction`** + slot calculation |
| `apps/backend/src/application/services/appointment-data-loader.service.ts` | `buildAppointmentTypesVariable()` + `buildCustomerAppointmentsVariable()` |
| `apps/backend/src/interfaces/http/controllers/appointment-type.controller.ts` | Controller CRUD con error handling |
| `apps/backend/src/interfaces/http/controllers/appointment.controller.ts` | Controller CRUD + `/calendar` + `/available-slots` |
| `apps/backend/src/interfaces/http/routes/appointment-type.routes.ts` | Routes con 3-layer middleware |
| `apps/backend/src/interfaces/http/routes/appointment.routes.ts` | Routes con 3-layer middleware |
| `apps/backend/src/domain/calling-functions/bookAppointment.ts` | Chiamata dal BOOKING_AGENT LLM |
| `apps/backend/src/domain/calling-functions/cancelAppointment.ts` | Chiamata dal BOOKING_AGENT LLM |
| `apps/backend/src/domain/calling-functions/getAppointments.ts` | Chiamata dal BOOKING_AGENT LLM |
| `apps/backend/src/domain/calling-functions/getAvailableSlots.ts` | Chiamata dal BOOKING_AGENT LLM |
| `apps/backend/src/domain/calling-functions/rescheduleAppointment.ts` | Chiamata dal BOOKING_AGENT LLM |
| `apps/backend/src/domain/calling-functions/confirmReminderResponse.ts` | Gestisce risposta cliente al reminder (confermo/cancello/sposto) ← NUOVO |
| `apps/backend/src/agents/booking-agent-llm.service.ts` | BookingAgentLLM class (pattern: identico a ProductSearchAgentLLM) |
| `apps/scheduler/src/services/billing.service.ts` | Aggiungere metodo `deductReminderCredit()` per €0.50 `APPOINTMENT_REMINDER` |

#### 2b. File da Modificare (ESISTENTI)

| File | Cosa Aggiungere |
|------|-----------------|
| `apps/backend/src/interfaces/http/routes/index.ts` | Registrare `appointment-type.routes` e `appointment.routes` |
| `apps/backend/src/application/services/email.service.ts` | Metodo `sendBookingConfirmationEmail()` con HTML template + opzionale allegato `.ics` |
| `packages/database/prisma/data/defaultAgents.ts` | Aggiungere `BOOKING_AGENT` all'array `defaultAgents()` — creato per ogni workspace, le sue functions vengono filtrate a runtime se `calendarEnabled=false` |
| `packages/database/prisma/seed.ts` | Seeding `AppointmentType` di esempio (solo se workspace demo ha `calendarEnabled=true`) + seeding `WorkspaceCallingFunction` per le **6** booking functions **per TUTTI i workspace** (seed sempre come ecommerce, filtro a runtime) + seeding `PlatformConfig` entry per `APPOINTMENT_REMINDER = 0.50` + seeding `PlanConfiguration.reminderCost = 0.50` per tutti i piani |

> ⚠️ **`workspace.service.ts` NON richiede side-effects** per il toggle `calendarEnabled`. Le booking functions sono seedate per ogni workspace alla creazione (identico al pattern ecommerce: `productSearchAgent`, `cartManagementAgent` esistono in `WorkspaceCallingFunction` per ogni workspace, ma vengono filtrati da `llm-router.service.ts` se `sellsProductsAndServices=false`). Stessa identica logica per le booking functions con `calendarEnabled`.

#### Endpoint Swagger da documentare

```yaml
# Aggiungere a apps/backend/src/swagger.yaml:

/api/workspaces/{workspaceId}/appointment-types:
  GET   → Lista tipi appuntamento attivi
  POST  → Crea nuovo tipo

/api/workspaces/{workspaceId}/appointment-types/{id}:
  PUT   → Modifica tipo
  DELETE → Soft delete

/api/workspaces/{workspaceId}/appointment-types/{id}/toggle:
  PATCH → Toggle isActive

/api/workspaces/{workspaceId}/appointments:
  GET   → Lista appuntamenti (filtri: date, status, customerId)
  POST  → Crea appuntamento manuale (da admin)

/api/workspaces/{workspaceId}/appointments/calendar:
  GET   → Vista calendario (range: from, to)

/api/workspaces/{workspaceId}/appointments/available-slots:
  GET   → Slot disponibili (params: serviceType, date)

/api/workspaces/{workspaceId}/appointments/{id}:
  GET   → Dettaglio appuntamento
  PUT   → Modifica

/api/workspaces/{workspaceId}/appointments/{id}/status:
  PATCH → Cambia status (confirm/cancel/complete/no-show)
```

---

### FASE 3 — Frontend Settings (CRUD)

**Precondizione**: Fase 2 completata (API disponibili).  
**Completata quando**: admin può accendere/spegnere il calendario, aggiungere/modificare/eliminare AppointmentType dalla UI.

#### File da Creare (NUOVO)

| File | Contenuto |
|------|-----------|
| `apps/frontend/src/services/appointmentTypeApi.ts` | `getAll`, `create`, `update`, `delete`, `toggle` — pattern: identico a `productApi.ts` |
| `apps/frontend/src/services/appointmentApi.ts` | `getAll`, `create`, `updateStatus`, `getCalendar`, `getAvailableSlots` |
| `apps/frontend/src/components/settings/sections/CalendarSection.tsx` | Sezione settings completa |
| `apps/frontend/src/pages/CalendarPage.tsx` | Vista admin del calendario con libreria React |

#### File da Modificare (ESISTENTI)

| File | Cosa Aggiungere |
|------|-----------------|
| `apps/frontend/src/pages/SettingsPage.tsx` | Aggiungere `{ key: "calendar", label: "Calendar & Appointments", description: "Appointment booking and reminders" }` al SECTIONS array |
| `apps/frontend/src/components/layout/Sidebar.tsx` | Aggiungere voce Calendar condizionale: `...(workspace?.calendarEnabled === true ? [{ href: "/calendar", label: "Calendar", icon: CalendarIcon }] : [])` |
| `apps/frontend/src/App.tsx` | Aggiungere route `/calendar` → `<CalendarPage />` |
| `apps/frontend/src/components/billing/BillingSection.tsx` | Aggiungere box "Appointment Reminder €0.50 (WhatsApp only)" nella lista costi — legge `APPOINTMENT_REMINDER` da `PlatformConfig` via `usePlatformConfig()` |

#### Struttura `CalendarSection.tsx`

```tsx
// SEZIONE 1: Toggle globale
<Toggle 
  label="Enable Calendar & Appointments" 
  description="Allow customers to book appointments via chat"
  checked={workspace.calendarEnabled}
  onChange={handleToggleCalendar}
/>

// SEZIONE 2: Tabella AppointmentTypes (visibile solo se calendarEnabled=true)
{calendarEnabled && (
  <>
    <Button onClick={openCreateSheet}>+ Add Appointment Type</Button>
    
    <Table>
      <Thead>Service Type | Duration | Reminder | Active | Actions</Thead>
      <Tbody>
        {appointmentTypes.map(type => (
          <Row>
            <Cell>{type.serviceType}</Cell>
            <Cell>{type.duration} min</Cell>
            <Cell>{type.reminderHours}h before</Cell>
            <Cell><Toggle checked={type.isActive} onChange={...} /></Cell>
            <Cell>
              <Button onClick={() => openEditSheet(type)}>Edit</Button>
              <Button onClick={() => handleDelete(type.id)}>Delete</Button>
            </Cell>
          </Row>
        ))}
      </Tbody>
    </Table>
    
    {/* Sheet Panel per Create/Edit */}
    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
      <SheetContent side="right" className="w-[600px]">
        <AppointmentTypeForm 
          type={editingType} 
          onSave={handleSave}
          onCancel={() => setIsSheetOpen(false)}
        />
      </SheetContent>
    </Sheet>
  </>
)}
```

#### `AppointmentTypeForm` - Campi

```
• Service Type *     → Input text libero ("Pulizia denti", "Demo", ...)
• Description        → Input text opzionale

• Duration *         → Select con preset (default: 1 hour):
                        Opzioni:
                          • 30 minutes
                          • 45 minutes
                          • 1 hour (60min)  ← DEFAULT
                          • 1.5 hours (90min)
                          • 2 hours (120min)
                          • Custom → mostra Number input libero in minuti
                        Valore salvato: `duration` (Int, es: 30, 45, 60, 90, 120)
                        Helper text: "How long does this appointment take"

• Reminder Timing *  → Select con preset (default: 24h prima):
                        Opzioni:
                          • 1 hour before
                          • 6 hours before
                          • 12 hours before
                          • 24 hours before (1 day)  ← DEFAULT
                          • 48 hours before (2 days)
                          • Custom → mostra Number input libero
                        Valore salvato: `reminderHours` (Int, es: 1, 6, 12, 24, 48)
                        Helper text: "When to send the WhatsApp reminder"

• Reminder Message * → Textarea con hint variabili disponibili:
                        {{customerName}}   → nome del cliente
                        {{serviceType}}    → tipo di servizio
                        {{dateFormatted}}  → data leggibile (es: "Martedì 8 Aprile")
                        {{time}}           → orario (es: "10:30")
                        {{duration}}       → durata in minuti
                        {{workspaceName}}  → nome del workspace
                        {{endTime}}        → orario di fine (es: "11:00")

                        Esempio default:
                        "Ciao {{customerName}}, hai {{serviceType}} prevista per
                        {{dateFormatted}} alle {{time}}. Ci sarai?"

                        ⚠️ IMPORTANTE: Il messaggio può includere una domanda
                        (es: "Ci sarai?") — la risposta SI/NO del cliente viene
                        gestita dal BookingAgentLLM (non dal job scheduler)

• Color              → Color picker (opzionale)
• Active             → Toggle
```

#### Libreria Calendario per `CalendarPage.tsx`

```bash
# Installare una delle due (Andrea sceglie):
npm install react-big-calendar date-fns
# oppure
npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid
```

**Vista admin**: mostra tutti gli appuntamenti del workspace per mese/settimana. Click su appuntamento → dettaglio. Colori per tipo di appuntamento.

---

### FASE 4 — Sicurezza API

**Precondizione**: Fase 2 completata.  
**Completata quando**: tutti gli endpoint usano il 3-layer middleware, ownership check funziona, workspace isolation verificata da test.

#### Middleware Stack (OBBLIGATORIO per tutti gli endpoint)

```typescript
// Ogni route booking DEVE avere TUTTI E TRE i middleware:
router.get('/',
  authMiddleware,                  // 1. JWT token validation
  sessionValidationMiddleware,     // 2. x-session-id header
  validateWorkspaceOperation,      // 3. x-workspace-id + param match
  controller.method.bind(controller)
)
```

#### Customer Ownership Check (CRITICO - prevenzione IDOR)

```typescript
// In appointment.service.ts - operazioni del cliente (cancel, reschedule, view):
async cancelCustomerAppointment(workspaceId: string, customerId: string, appointmentId: string) {
  // IDOR prevention: cerca con ENTRAMBI workspaceId E customerId
  const appointment = await this.appointmentRepository.findFirst({
    where: {
      id: appointmentId,
      workspaceId,      // ← workspace isolation
      customerId,       // ← ownership check, il cliente può solo le sue!
      status: 'CONFIRMED'
    }
  })
  
  if (!appointment) {
    // Non esporre se esiste ma non appartiene al cliente!
    throw new Error('Appointment not found')
  }
  
  return this.appointmentRepository.updateStatus(appointmentId, 'CANCELLED', workspaceId)
}
```

#### Calling Functions - Context Security

Le calling functions (bookAppointment, getAppointments, etc.) ricevono un `context` con `workspaceId` e `customerId` dal `function-executor.service.ts`. **NON accettano mai workspaceId dal payload LLM** — viene sempre iniettato dal server.

```typescript
// CORRETTO - workspaceId iniettato dal context, NON da args:
async function bookAppointment(args: BookingArgs, context: ExecutionContext) {
  const { workspaceId, customerId } = context  // ← da server, non da LLM
  const { serviceType, date, time } = args      // ← da LLM
  
  return await appointmentService.bookWithSecurityCheck(workspaceId, customerId, {
    serviceType, date, time
  })
}
```

#### Checklist di Sicurezza per ogni nuovo file

- [ ] Ogni `prisma.*` query ha `where: { workspaceId }` o `where: { workspaceId, customerId }`  
- [ ] Nessun ID viene accettato senza verifica ownership
- [ ] Errore generico per not-found / unauthorized (non esporre differenza)
- [ ] Route protetta da 3-layer middleware
- [ ] Input validation (date valide, duration > 0, serviceType.length > 0)
- [ ] Double-booking check dentro `$transaction`

---

### FASE 5 — LLM: BOOKING_AGENT + Calling Functions

**Precondizione**: Fasi 1, 2 completate.  
**Completata quando**: il cliente su WhatsApp E su Widget può prenotare end-to-end tramite chat; il Router delega correttamente a BOOKING_AGENT.

---

#### ❓ FAQ ARCHITETTURALE — Risposte alle domande chiave

**D: "SI" come fa il sistema a sapere di cosa si sta parlando? C'è un nuovo LLM?**

Sì — ci sono TRE livelli distinti che lavorano insieme:

```
Cliente: "SI"
    │
    ▼
[LIVELLO 1] ROUTER LLM  ← Chiamata OpenAI #1
  • Riceve: conversation history completa
  • La history include il messaggio precedente di BOOKING_AGENT con agentType="BOOKING_AGENT"
    Es: BOOKING_AGENT aveva chiesto "Vuoi confermare il martedì 8 alle 10:30?"
  • Il Router vede questo contesto e capisce: "è una conferma a una scelta di booking"
  • Chiama function: bookingAgent({ query: "conferma prenotazione" })
    │
    ▼
[LIVELLO 2] BookingAgentLLM  ← Chiamata OpenAI #2 (sub-agent, NON è un LLM separato fisicamente)
  • Riceve: system prompt BOOKING_AGENT + {{appointmentTypes}} + {{customerAppointments}}
  • Ha nel contesto la query arrivata dal Router: "conferma prenotazione"
  • Capisce: deve chiamare bookAppointment() con i dettagli già discussi
  • Chiama function: bookAppointment({ serviceType: "Pulizia", date: "2026-04-08", time: "10:30" })
    │
    ▼
[LIVELLO 3] bookAppointment.ts  ← TypeScript puro, ZERO LLM
  • Prisma $transaction → check overlap → crea Appointment → ritorna JSON
  • Risposta al BOOKING_AGENT LLM: { success: true, appointment: {...} }
    │
    ▼
BookingAgentLLM formula la risposta testuale:
  "✅ Prenotato! Pulizia denti martedì 8 aprile ore 10:30"
    │
    ▼
Translation Agent (step finale) traduce nella lingua del cliente
```

**La chiave**: il Router LLM conosce il contesto perché **ogni ConversationMessage ha `agentType`**. Il "SI" arrivato dopo una domanda con `agentType="BOOKING_AGENT"` viene interpretato correttamente.

---

**D: Seed — cosa va nel database per ogni nuovo workspace?**

| Cosa | Viene seedato? | Quando |
|------|----------------|--------|
| `WorkspaceCallingFunction` per `bookingAgent`, `bookAppointment`, etc. | ✅ **SÌ, per TUTTI i workspace** | Al momento della creazione workspace (come `productSearchAgent` e gli altri) |
| `AgentConfig` per BOOKING_AGENT | ✅ **SÌ, per tutti i workspace** | Stesso momento, in `defaultAgents.ts` |
| `AppointmentType` di esempio | Solo nel workspace di demo/seed | Opzionale |

**Le booking functions sono SEMPRE seedate** — la visibilità al LLM è controllata a runtime da `llm-router.service.ts` con il filtro `calendarEnabled`, identico al filtro ecommerce già esistente:

```typescript
// llm-router.service.ts — pattern ESISTENTE per ecommerce:
const ecommerceFunctions = ["productSearchAgent", "cartManagementAgent", "orderTrackingAgent"]
// ← NUOVO, stesso pattern:
const calendarFunctions  = ["bookingAgent", "getAvailableSlots", "bookAppointment",
                            "cancelAppointment", "getAppointments", "rescheduleAppointment"]

filteredFunctions = dbFunctions.filter(fn => {
  if (!workspace.sellsProductsAndServices && ecommerceFunctions.includes(fn.functionName)) return false
  if (!workspace.calendarEnabled         && calendarFunctions.includes(fn.functionName))  return false
  return true
})
```

**Risultato**: `workspace.service.ts` NON ha bisogno di side-effects. Zero complessità aggiuntiva.

---

**D: `calendarEnabled` default `false` — serve Google Calendar?**

**🔥 SÌ - OBBLIGATORIO** (Opzione A confermata). Google Calendar OAuth è il **prerequisito** per attivare.
Nessun sistema standalone. Il workflow è:

1. Admin: Settings → Calendar & Appointments
2. Click "Connect Google Calendar" → OAuth 2.0 flow
3. Google ritorna access_token + refresh_token
4. Backend salva in `GoogleCalendarConnection` → `isActive=true`
5. Admin aggiunge `AppointmentType` (nome, durata, reminder template)
6. **🔥 CRITICAL**: Durante OAuth callback, validare 1 calendar = 1 workspace max
7. Cliente prenota via chat → evento creato in Google Calendar

**GDPR**: `deleteCustomerData(customerId)` DEVE anche eliminare Google Calendar eventi.

**Late Cancellation**: Log tentativi cancellazione <2h prima per analytics no-show.

---

#### 5a. File da Modificare (ESISTENTI)

| File | Cosa Aggiungere |
|------|-----------------|
| `apps/backend/src/config/agent-functions.config.ts` | `BOOKING_FUNCTIONS` array, `bookingAgent` in `ROUTER_FUNCTIONS`, `case "BOOKING_AGENT"` in switch |
| `apps/backend/src/services/function-executor.service.ts` | `case "bookingAgent"` delegation + 5 direct function cases |
| `apps/backend/src/services/llm-router.service.ts` | Filtro `calendarEnabled` (come filtro ecommerce) + `case "BOOKING_AGENT"` delegation switch |
| `apps/backend/src/types/prompt-variables.types.ts` | `appointmentTypes?`, `customerAppointments?`, `calendarEnabled?` |
| `apps/backend/src/application/services/prompt-variable-builder.service.ts` | Build delle 3 nuove variabili |
| `apps/backend/src/services/prompt-processor.service.ts` | `calendarEnabled` nei `conditionalVars` + replacement in `replaceStandardVariables()` |
| `apps/backend/src/application/chat-engine/conversation-state.service.ts` | Stati FSM booking + `pendingAction` types |

#### 5b. File da Creare (NUOVO)

| File | Contenuto |
|------|-----------|
| `apps/backend/src/agents/booking-agent-llm.service.ts` | `BookingAgentLLM` class |
| `apps/backend/docs/prompts/booking-agent.md` | System prompt (content come da sezione "LLM Agent Integration") |

---

### ⚠️ CRITICO: Translation Agent - Come Funziona con BOOKING_AGENT

**PROBLEMA**: I clienti possono essere spagnoli, portoghesi, inglesi. Il BOOKING_AGENT risponde in italiano (lingua base). Come si traduce?

**RISPOSTA**: Il sistema ha già un `SAFETY_TRANSLATION` agent (o equivalente Translation Layer) che è **l'ultimo step** della pipeline per OGNI risposta di OGNI agent. Il BOOKING_AGENT è automaticamente coperto senza nessun lavoro aggiuntivo perché:

```
BOOKING_AGENT risponde → "Ho prenotato la pulizia denti per martedì 8 aprile"
     ↓
[llm-router.service.ts] Ultima elaborazione: Translation Agent
     ↓
Translation Agent vede customer.language = "es"
     ↓
Traduce: "He reservado la limpieza dental para el martes 8 de abril"
     ↓
Cliente spagnolo riceve risposta in spagnolo ✅
```

**Questo vale per TUTTE le risposte del BOOKING_AGENT** — prenotazioni, cancellazioni, lista appuntamenti, errori — tutto passa attraverso il Translation Agent esistente senza modifiche.

#### Il `reminderMessage` invece richiede traduzione esplicita

Il template del reminder vive nel DB in italiano (lingua base). Il job del scheduler deve tradurre prima di inviare:

```typescript
// apps/scheduler/src/jobs/appointment-reminder.job.ts

async function sendReminder(appointment: AppointmentWithRelations) {
  // 1. Sostituisci variabili nel template (sempre IT)
  let message = replaceTemplateVariables(
    appointment.appointmentType.reminderMessage,
    {
      customerName: appointment.customer.name || appointment.customer.firstName,
      serviceType:  appointment.appointmentType.serviceType,
      date:         formatDate(appointment.scheduledAt),
      time:         formatTime(appointment.scheduledAt),
      duration:     String(appointment.duration),
      workspaceName: appointment.workspace.name,
    }
  )

  // 2. Traduci nella lingua del cliente se NON è italiano
  const customerLanguage = appointment.customer.language || 'it'
  if (customerLanguage !== 'it') {
    // USA IL TRANSLATION LLM GIÀ ESISTENTE
    message = await translationLLMService.translate(message, customerLanguage)
    // Il TranslationLLMService (già esistente nel progetto) gestisce questo
  }

  // 3. Instrada in base al canale del cliente
  await routeReminderByChannel(appointment, message)
}
```

---

### ⚠️ CRITICO: Widget vs WhatsApp — Gestione del Canale per i Reminder

**PROBLEMA**: Il reminder va via WhatsApp. Ma se un cliente usa solo il Widget (niente numero di telefono), dove va il reminder?

**Analisi dal codice**:
- `WhatsAppQueue` → deliver via WhatsApp API (richiede `customer.phone`)
- Widget → deliver via WebSocket in tempo reale (se il cliente è connesso) o via email

**Soluzione**: Il job deve controllare il canale di consegna disponibile per ogni cliente:

```typescript
async function routeReminderByChannel(
  appointment: AppointmentWithRelations, 
  message: string
) {
  const customer = appointment.customer
  const workspace = appointment.workspace
  
  // CASO 1: Cliente ha numero WhatsApp → usa WhatsApp Queue
  if (customer.phone && workspace.enableWhatsapp) {
    await prisma.whatsAppQueue.create({
      data: {
        workspaceId: appointment.workspaceId,
        customerId:  appointment.customerId,
        phoneNumber: customer.phone,
        messageContent: message,
        conversationMessageId: convMessage.id,
        status: 'pending',
      }
    })
    return
  }
  
  // CASO 2: Solo Widget e cliente ha email → usa email
  if (customer.email && workspace.enableWidget) {
    await emailService.sendReminderEmail({
      to:           customer.email,
      customerName: customer.name || customer.firstName,
      serviceType:  appointment.appointmentType.serviceType,
      date:         formatDate(appointment.scheduledAt),
      time:         formatTime(appointment.scheduledAt),
      duration:     appointment.duration,
      workspaceName: workspace.name,
    })
    return
  }
  
  // CASO 3: Nessun canale disponibile → log warning, skip
  logger.warn(`[REMINDER] No delivery channel for customer ${customer.id}, skipping`, {
    workspaceId: appointment.workspaceId,
    appointmentId: appointment.id,
  })
  
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { reminderStatus: 'SKIPPED' }
  })
}
```

**Le prenotazioni via chat funzionano SU ENTRAMBI i canali** senza modifiche: il flusso di chat (Router → BOOKING_AGENT → calling functions) è agnostico rispetto al canale. La risposta del bot viene consegnata al canale da cui il cliente ha scritto (WhatsApp delivery queue per WhatsApp, WebSocket push per Widget) — questo è già gestito dall'architettura esistente del `chat-engine.service.ts`.

---

### FASE 6 — Scheduler (Reminder Job)

**Precondizione**: Fasi 1, 2 completate. Il Translation LLM è configurato nel progetto.  
**Completata quando**: il cron job gira, trova appuntamenti dovuti, invia reminder via WhatsApp E via email (per widget-only), aggiorna `reminderStatus`.

#### File da Modificare

| File | Cosa Aggiungere |
|------|-----------------|
| `apps/scheduler/src/index.ts` | Registrazione del job ogni 30 minuti |

#### File da Creare (NUOVO)

| File | Contenuto |
|------|-----------|
| `apps/scheduler/src/jobs/appointment-reminder.job.ts` | Job completo con traduzione e routing canale |

#### Registrazione nel Scheduler

```typescript
// apps/scheduler/src/index.ts
import { appointmentReminderJob } from './jobs/appointment-reminder.job'

// Ogni 30 minuti (per reminder precisi senza aspettare un'ora intera)
cron.schedule('*/30 * * * *', async () => {
  await runJob('appointment-reminder', appointmentReminderJob)
})
```

#### Record nel Database

```sql
INSERT INTO "SchedulerJobStatus" ("jobName", "status", "schedule")
VALUES ('APPOINTMENT_REMINDER', 'IDLE', '*/30 * * * *');
```

#### Algoritmo del Job

```
1. Query: Appointment { status: CONFIRMED, reminderStatus: PENDING, scheduledAt > NOW }
2. Include: customer, appointmentType, workspace (+ owner + planConfiguration)
3. Per ogni appuntamento:
   a. Calcola reminderTime = scheduledAt - appointmentType.reminderHours
   b. Se NOW >= reminderTime:
      - Sostituisci variabili nel reminderMessage (incluso {{dateFormatted}})
      - Traduci nella lingua del cliente (se != 'it')
      - Salva ConversationMessage { role: 'assistant', agentType: 'SYSTEM_REMINDER' }
      - channel = routeReminderByChannel(customer, workspace)
      - Se channel === 'WHATSAPP':
          → Inserisce in WhatsApp Queue
          → billingService.deductReminderCredit(workspaceId, appointmentId)
            (legge planConfiguration.reminderCost → €0.50)
            (crea BillingTransaction { type: 'APPOINTMENT_REMINDER', amount: -0.50 })
      - Se channel === 'EMAIL':
          → Invia email (GRATUITA — no billing)
      - Update appointment: reminderStatus = SENT, reminderSentAt = NOW
   c. Se appuntamento già cancellato: reminderStatus = SKIPPED
4. Log: { total, sent(whatsapp: N, email: N), skipped, failed, totalBilled }
```

#### Template Variables supportate in `reminderMessage`

```
{{customerName}}    → customer.name o customer.firstName
{{serviceType}}     → appointmentType.serviceType
{{dateFormatted}}   → data leggibile (es: "Martedì 8 Aprile 2026") ← NUOVO
{{date}}            → data ISO (es: "2026-04-08") — per uso tecnico
{{time}}            → orario (es: "10:30")
{{duration}}        → durata in minuti (es: "30")
{{workspaceName}}   → workspace.name
{{endTime}}         → orario fine calcolato (es: "11:00")
```

#### Reminder Interattivo — Flusso "Ci Sarai?"

Il reminder può includere una domanda di conferma (es: "Ci sarai?"). La risposta del cliente va gestita dal **BookingAgentLLM** — NON dal job scheduler.

**Come funziona:**

```
[Scheduler Job - giorno prima]
  ↓
Inserisce in WhatsApp Queue:
  "Ciao Mario, hai la Pulizia denti prevista per
   Martedì 8 Aprile alle 10:30. Ci sarai?"
  →  ConversationMessage { agentType: 'SYSTEM_REMINDER' }

[Cliente risponde: "Sì ci sarò!"]
  ↓
Router LLM vede: ultimo messaggio era [SYSTEM_REMINDER]
  → Delega a BOOKING_AGENT

[BookingAgentLLM]
  → Riconosce conferma di presenza
  → NON prenota nulla (appuntamento esiste già)
  → Risponde: "Perfetto! Ti aspettiamo martedì alle 10:30 😊"
  → Chiamata: confirmReminderResponse({ appointmentId, confirmed: true })

[Cliente risponde: "No, devo cancellare"]
  ↓
BookingAgentLLM → chiama cancelAppointment() → status: CANCELLED
  → Risponde: "Appuntamento cancellato. Vuoi riprenotare in un altro giorno?"
```

**Nuova calling function necessaria: `confirmReminderResponse`**

```typescript
// apps/backend/src/domain/calling-functions/confirmReminderResponse.ts
// Input: { appointmentId: string, confirmed: boolean, newDateRequest?: string }
// Se confirmed: true → nessuna azione (già confermato), risposta amichevole
// Se confirmed: false → chiama cancelAppointment internamente
// Se newDateRequest → avvia flusso reschedule
```

**Aggiunta in AgentType enum (schema.prisma):**
```prisma
SYSTEM_REMINDER  // Messaggi automatici del job scheduler
```

**Router prompt — aggiungere istruzione:**
```
Se l'ultimo messaggio del contesto ha agentType SYSTEM_REMINDER,
e il messaggio utente è una risposta di presenza/assenza/rinvio,
delega SEMPRE al BOOKING_AGENT.
```

**BookingAgent prompt — aggiungere sezione:**
```
## Gestione Risposta a Reminder

Se il contesto mostra un precedente messaggio [SYSTEM_REMINDER] che chiedeva
conferma di presenza per un appuntamento:

- Risposta POSITIVA (sì, ci sarò, confermo, etc.) →
  chiama confirmReminderResponse({ appointmentId, confirmed: true })
  Rispondi: "Perfetto! Ti aspettiamo [giorno] alle [ora] 😊"

- Risposta NEGATIVA (no, devo cancellare, non posso venire) →
  chiama cancelAppointment({ appointmentId })
  Rispondi: "Appuntamento cancellato. Vuoi riprenotare?"

- Richiesta di spostamento (posso spostare a giovedì?) →
  chiama getAvailableSlots() per il nuovo giorno
  poi rescheduleAppointment() se confermato
```

---

### FASE 7 — Variabili da Aggiungere in .ENV

> Le variabili .env NON vanno mai toccate direttamente — questa sezione documenta **quali variabili il sistema usa** così che Andrea possa aggiungerle manualmente.

#### Variabili GIÀ ESISTENTI (nessuna modifica necessaria)

Il calendar booking per **v1 non richiede nuove variabili .env** perché:
- Email reminders usano **SMTP già configurato** (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`)
- WhatsApp reminder usa le **variabili Meta/UltraMsg già presenti**
- LLM requests usano **OPENROUTER_API_KEY già presente**
- Database usa **DATABASE_URL già presente**

#### Variabili da Aggiungere per Feature Future (documentazione per Andrea)

Queste variabili servono **se** si implementano le feature opzionali:

```bash
# ── FEATURE: Allegato .ics nelle email di conferma ──────────────────────────
# Dominio usato nell'UID del file iCal (per evitare collisioni tra workspace)
CALENDAR_ICAL_DOMAIN=yourdomain.com

# ── FEATURE: Google Calendar Integration (v2 futura) ────────────────────────
# Client OAuth per sincronizzazione con Google Calendar
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
GOOGLE_CALENDAR_REDIRECT_URI=https://yourdomain.com/api/google-calendar/callback

# ── FEATURE: Calendly-style public booking link (v2 futura) ────────────────
# Non necessaria - il sistema usa SecureTokenService già esistente

# ── OPZIONALE: Finestra massima di avanzamento per reminder (default: 48h) ──
# Se non impostato, il job guarda appuntamenti fino a 48h in avanti
REMINDER_LOOKAHEAD_HOURS=48

# ── OPZIONALE: Business hours default per slot generation ──────────────────
# Se non impostato, default 09:00-18:00
APPOINTMENT_DEFAULT_START_HOUR=9
APPOINTMENT_DEFAULT_END_HOUR=18
```

#### Riepilogo .env v1

| Variabile | Stato | Note |
|-----------|-------|-------|
| `DATABASE_URL` | ✅ Già presente | Nessuna modifica |
| `OPENROUTER_API_KEY` | ✅ Già presente | Usata da Translation LLM per reminder |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | ✅ Già presenti | Per email reminder (widget-only customers) |
| `REMINDER_LOOKAHEAD_HOURS` | 🆕 Opzionale | Default 48. Andrea aggiunge se vuole override |
| `CALENDAR_ICAL_DOMAIN` | 🆕 Opzionale v1.1 | Solo se allegato .ics nelle email |

---

### FASE 8 — Test

**Precondizione**: Tutte le fasi precedenti completate (almeno le fasi 1, 2, 5).  
**Completata quando**: `npm run test:unit` passa al 100% per i nuovi file.

> **REGOLA SACRA**: i test vengono scritti **prima o durante** l'implementazione, mai dopo. I test sono la specifica.

#### File da Creare (TUTTI UNIT TEST — no integration!)

| File | Test Principali da Coprire |
|------|---------------------------|
| `apps/backend/__tests__/unit/services/appointment-type.service.spec.ts` | CRUD, workspace isolation, soft delete, toggle |
| `apps/backend/__tests__/unit/services/appointment.service.spec.ts` | Double-booking prevention, slot calculation, cancel ownership check |
| `apps/backend/__tests__/unit/calling-functions/bookAppointment.spec.ts` | Happy path, slot taken, calendarEnabled=false, workspaceId isolation |
| `apps/backend/__tests__/unit/calling-functions/cancelAppointment.spec.ts` | Ownership check, already-cancelled, not-found |
| `apps/backend/__tests__/unit/calling-functions/getAvailableSlots.spec.ts` | Slot calculation, overlap exclusion, no slots available |
| `apps/backend/__tests__/unit/calling-functions/getAppointments.spec.ts` | Upcoming filter, past filter, empty list |
| `apps/backend/__tests__/unit/calling-functions/rescheduleAppointment.spec.ts` | New slot available, new slot taken, not found |
| `apps/backend/__tests__/unit/agents/booking-agent.spec.ts` | Delegation from Router, calendarEnabled=false (no delegation) |
| `apps/backend/__tests__/unit/services/appointment-data-loader.spec.ts` | `buildAppointmentTypesVariable` output format, empty response |
| `apps/scheduler/__tests__/jobs/appointment-reminder.spec.ts` | Reminder timing, translation called, WhatsApp vs email routing, skip cancelled |

#### Scenari Critici da Testare (non derogabili)

```
✅ WORKSPACE ISOLATION: Cliente del workspace A non vede appuntamenti del workspace B
✅ CUSTOMER OWNERSHIP: Cliente A non può cancellare appuntamento del cliente B
✅ DOUBLE BOOKING: Due richieste simultanee per lo stesso slot → una viene rifiutata ($transaction)
✅ calendarEnabled=false: bookingAgent NON appare nei tools del Router LLM
✅ calendarEnabled=false: endpoint API ritorna 403 o 404
✅ REMINDER TRANSLATION: Template IT tradotto in ES/PT/EN prima dell'invio
✅ WIDGET CHANNEL: Cliente senza phone → reminder va via email (non via WhatsApp)
✅ WHATSAPP CHANNEL: Cliente con phone → reminder via WhatsApp queue
✅ EMPTY APPOINTMENT TYPES: {{appointmentTypes}} vuoto → messaggio "no types configured"
✅ RACE CONDITION Multi-Turn: "SI" dopo domanda BOOKING_AGENT → Router correttamente delega
```

#### Come Eseguire

```bash
# Tutti i test (inclusi i nuovi)
cd apps/backend && npm run test:unit

# Solo file specifici (durante sviluppo)
npm run test:unit -- apps/backend/__tests__/unit/services/appointment.service.spec.ts

# Con coverage sui nuovi file
npm run test:coverage -- --collectCoverageFrom="src/domain/calling-functions/book*.ts"
```

---

### FASE 9 — Documentazione da Fare

**Precondizione**: Tutte le fasi completate.  
**Completata quando**: tutti i documenti elencati sono aggiornati e coerenti con l'implementazione reale.

#### 9a. Documentazione Tecnica (Developer)

| File | Cosa Aggiornare |
|------|-----------------|
| `apps/backend/src/swagger.yaml` | Aggiungere TUTTI gli endpoint Calendar (CRUD AppointmentType + Appointment). **Obbligatorio dopo ogni API change** come da regola #6 |
| `packages/database/prisma/schema.prisma` | Aggiungere commenti ai nuovi model (`// Calendar feature - enabledby calendarEnabled flag`) |
| `apps/backend/docs/prompts/booking-agent.md` | **CREARE** — System prompt del BOOKING_AGENT da caricare nel DB via `npm run update:prompts` |
| `AGENTS.md` | Aggiungere sezione "BOOKING_AGENT" nel registro degli agenti. Pattern: identico alle sezioni ROUTER_AGENT, PRODUCT_SEARCH_AGENT esistenti |
| `CLAUDE.md` | Aggiornare sezione "Key Services" con `BookingAgentLLM` |

#### 9b. Business Documentation (PRD)

| File | Cosa Aggiornare |
|------|-----------------|
| `docs/PRD.md` | Aggiungere sezione Feature: Calendar & Appointments (obiettivo, user stories, flussi) |
| `docs/memory-bank/02-features/` | **CREARE** `calendar-appointments.md` con la specifica completa |
| `docs/memory-bank/03-architecture/` | Aggiornare il diagramma dell'architettura per includere BOOKING_AGENT nel pipeline |

#### 9c. Prompts da Caricare nel Database

Dopo la creazione del file `apps/backend/docs/prompts/booking-agent.md`:

```bash
# Carica il prompt nel database (usa il comando esistente):
cd apps/backend && npm run update:prompts

# Verificare che BOOKING_AGENT sia apparso in AgentConfig table
```

#### 9d. "Recent Changes" in AGENTS.md

Seguendo il pattern delle voci esistenti (es. "Sales Agent Routing", "Operator Summary AI"):

```markdown
### ✅ Calendar & Appointment Booking System
**Date**: [data implementazione]
**Status**: COMPLETED

**Feature**: Sistema prenotazione appuntamenti via chat (WhatsApp + Widget) con reminder automatici.

**New DB Models**: AppointmentType, Appointment (AppointmentStatus, ReminderStatus enums)
**New Flag**: Workspace.calendarEnabled (OFF by default)
**New Agent**: BOOKING_AGENT (prompt in docs/prompts/booking-agent.md)
**New Calling Functions**: bookAppointment, cancelAppointment, getAppointments, 
                           getAvailableSlots, rescheduleAppointment
**New Variables**: {{appointmentTypes}}, {{customerAppointments}}, {{calendarEnabled}}
**New Scheduler Job**: appointment-reminder (ogni 30 min)
**New Routes**: /appointment-types, /appointments, /appointments/calendar, /appointments/available-slots

**Files Modified**: [lista 16 file modificati]
**Files Created**: [lista 30 file creati]
**Test Results**: XX/XX unit tests passing
```

---

## 📊 RIEPILOGO TOTALE FILE (Organizzato per Fase)

| Fase | File Modificati | File Nuovi | Totale |
|------|----------------|------------|--------|
| 1 - Schema DB | 1 | 0 | 1 |
| 2 - Backend | 4 | 15 | 19 |
| 3 - FE Settings | 3 | 4 | 7 |
| 4 - Sicurezza | 0 | 0 | 0 (è trasversale) |
| 5 - LLM | 7 | 2 | 9 |
| 6 - Scheduler | 1 | 1 | 2 |
| 7 - .ENV | 0 | 0 | 0 (documentazione) |
| 8 - Test | 0 | 10 | 10 |
| 9 - Docs | 2 | 4 | 6 |
| **TOTALE** | **19** | **36** | **55** |

### File Modificati Completi

| # | File | Fase |
|---|------|------|
| 1 | `packages/database/prisma/schema.prisma` | 1 |
| 2 | `packages/database/prisma/data/defaultAgents.ts` | 2 |
| 3 | `packages/database/prisma/seed.ts` | 2 |
| 4 | `apps/backend/src/interfaces/http/routes/index.ts` | 2 |
| 5 | `apps/backend/src/application/services/email.service.ts` | 2 |
| 6 | `apps/frontend/src/pages/SettingsPage.tsx` | 3 |
| 7 | `apps/frontend/src/components/layout/Sidebar.tsx` | 3 |
| 8 | `apps/frontend/src/App.tsx` | 3 |
| 9 | `apps/backend/src/config/agent-functions.config.ts` | 5 |
| 10 | `apps/backend/src/services/function-executor.service.ts` | 5 |
| 11 | `apps/backend/src/services/llm-router.service.ts` | 5 — filtro `calendarEnabled` (stesso pattern filtro ecommerce) |
| 12 | `apps/backend/src/types/prompt-variables.types.ts` | 5 |
| 13 | `apps/backend/src/application/services/prompt-variable-builder.service.ts` | 5 |
| 14 | `apps/backend/src/services/prompt-processor.service.ts` | 5 |
| 15 | `apps/backend/src/application/chat-engine/conversation-state.service.ts` | 5 |
| 16 | `apps/scheduler/src/index.ts` | 6 |
| 17 | `apps/backend/src/swagger.yaml` | 9 |
| 19 | `AGENTS.md` | 9 |

### File Nuovi Completi

| # | File | Fase |
|---|------|------|
| 20 | `apps/backend/src/repositories/appointment-type.repository.ts` | 2 |
| 21 | `apps/backend/src/repositories/appointment.repository.ts` | 2 |
| 22 | `apps/backend/src/application/services/appointment-type.service.ts` | 2 |
| 23 | `apps/backend/src/application/services/appointment.service.ts` | 2 |
| 24 | `apps/backend/src/application/services/appointment-data-loader.service.ts` | 2 |
| 25 | `apps/backend/src/interfaces/http/controllers/appointment-type.controller.ts` | 2 |
| 26 | `apps/backend/src/interfaces/http/controllers/appointment.controller.ts` | 2 |
| 27 | `apps/backend/src/interfaces/http/routes/appointment-type.routes.ts` | 2 |
| 28 | `apps/backend/src/interfaces/http/routes/appointment.routes.ts` | 2 |
| 29 | `apps/backend/src/domain/calling-functions/bookAppointment.ts` | 2 |
| 30 | `apps/backend/src/domain/calling-functions/cancelAppointment.ts` | 2 |
| 31 | `apps/backend/src/domain/calling-functions/getAppointments.ts` | 2 |
| 32 | `apps/backend/src/domain/calling-functions/getAvailableSlots.ts` | 2 |
| 33 | `apps/backend/src/domain/calling-functions/rescheduleAppointment.ts` | 2 |
| 34 | `apps/backend/src/agents/booking-agent-llm.service.ts` | 5 |
| 35 | `apps/backend/docs/prompts/booking-agent.md` | 5 |
| 36 | `apps/frontend/src/services/appointmentTypeApi.ts` | 3 |
| 37 | `apps/frontend/src/services/appointmentApi.ts` | 3 |
| 38 | `apps/frontend/src/components/settings/sections/CalendarSection.tsx` | 3 |
| 39 | `apps/frontend/src/pages/CalendarPage.tsx` | 3 |
| 40 | `apps/scheduler/src/jobs/appointment-reminder.job.ts` | 6 |
| 41 | `apps/backend/__tests__/unit/services/appointment-type.service.spec.ts` | 8 |
| 42 | `apps/backend/__tests__/unit/services/appointment.service.spec.ts` | 8 |
| 43 | `apps/backend/__tests__/unit/services/appointment-data-loader.spec.ts` | 8 |
| 44 | `apps/backend/__tests__/unit/calling-functions/bookAppointment.spec.ts` | 8 |
| 45 | `apps/backend/__tests__/unit/calling-functions/cancelAppointment.spec.ts` | 8 |
| 46 | `apps/backend/__tests__/unit/calling-functions/getAvailableSlots.spec.ts` | 8 |
| 47 | `apps/backend/__tests__/unit/calling-functions/getAppointments.spec.ts` | 8 |
| 48 | `apps/backend/__tests__/unit/calling-functions/rescheduleAppointment.spec.ts` | 8 |
| 49 | `apps/backend/__tests__/unit/agents/booking-agent.spec.ts` | 8 |
| 50 | `apps/scheduler/__tests__/jobs/appointment-reminder.spec.ts` | 8 |
| 51 | `docs/memory-bank/02-features/calendar-appointments.md` | 9 |
| 52 | `docs/memory-bank/03-architecture/booking-agent-flow.md` | 9 |
| 53 | `CLAUDE.md` (update) | 9 |
| 54 | `docs/PRD.md` (update sezione) | 9 |

**TOTALE: 17 file modificati + 35 file nuovi = 52 file**

> **Nota**: `workspace.service.ts` rimosso dalla lista — NON serve toccarla. Le booking calling functions vengono seedate per tutti i workspace alla creazione (pattern ecommerce). Il filtro è in `llm-router.service.ts`.

---

## 🧪 UNIT TEST OUTLINE - Google Calendar Appointments v1

### Core Booking Tests

#### 1. Timezone Parsing
```
Test: bookAppointment deve usare Workspace.timezone per parsing date
- Input: appointmentDate="2026-04-15", time="14:00", timezone="Europe/Rome"
- Assert: evento Google Calendar creato con scheduledAt in UTC, non in local
- Assert: customer riceve reminder in Rome timezone
```

#### 2. Double Booking Prevention
```
Test: Non possibile prenotare lo stesso slot due volte
- Setup: crea appointment per Mario alle 14:00
- Action: tentativo prenotazione dello stesso slot da Anna
- Assert: secondo booking fallisce con "SLOT_NOT_AVAILABLE"
- Assert: primo booking rimane CONFIRMED in Google Calendar
```

#### 3. Workspace Isolation
```
Test: Customer non vede appointment di altri workspace
- Setup: Mario in Workspace A, Anna in Workspace B
- Action: Mario calls getAppointments()
- Assert: Mario vede solo i suoi appointment, NOT Anna's
- Assert: Query includes WHERE workspaceId = <current>
```

#### 4. Registration Gate (Soft)
```
Test: BOOKING_AGENT nudges unregistered customer
- Setup: customer.registrationStatus = "PENDING"
- Action: customer says "voglio prenotare"
- Assert: LLM suggests "Registrati per reminder: [LINK]"
- Assert: NON blocca booking (soft gate)
```

### Reminder & Escalation Tests

#### 5. Reminder Ambiguity Escalation
```
Test: After 2 failed clarifications, escalate
- Setup: reminder sent, customer responds "forse"
- Action: confirmReminderResponse called with unclear response
- Assert: first attempt: asks again "Si o No?"
- Assert: second attempt: asks again
- Assert: third attempt: logs escalation, sends notification (NO DB table)
```

#### 6. Late Cancellation Logging
```
Test: Log cancellations <2h before event
- Setup: appointment in 1 hour
- Action: cancelAppointment called
- Assert: LateCancellationAttempt record created
- Assert: record contains workspaceId, customerId, minutesBeforeEvent=60
```

#### 7. Reminder Email + .ics
```
Test: confirmation email includes .ics attachment
- Setup: appointment booked, email service triggered
- Action: sendConfirmationEmail called
- Assert: email contains .ics file (simple-ics library)
- Assert: .ics has START, END, SUMMARY properties
```

### Google Calendar Sync Tests

#### 8. Event Created in Google Calendar
```
Test: bookAppointment creates event in Google Calendar
- Setup: appointment booked via chat
- Action: bookAppointment called
- Assert: googleCalendarService.createEvent called
- Assert: event ID stored in database
- Assert: extendedProperties.customerId + appointmentTypeId stored
```

#### 9. Token Revocation Handling
```
Test: If Google token revoked, handle gracefully
- Setup: workspace with revoked token
- Action: scheduler tries to access Google Calendar
- Assert: detects 401 error
- Assert: calls handleTokenRevoked() → sets isActive=false
- Assert: logs "Token revoked, user must re-authorize"
```

#### 10. Webhook Renewal (Proactive)
```
Test: Renew webhook before 7-day expiry
- Setup: webhook.expiration = tomorrow
- Action: renewExpiringWebhooks() cronjob runs
- Assert: stopWebhook called for old channel
- Assert: createWebhook called for new channel
- Assert: expiration updated in DB
- Assert: if renewal fails 3x → fallback to polling (set isActive=false)
```

#### 11. Pending Appointment Sync Retry
```
Test: Retry failed syncs with backoff
- Setup: createEvent fails, pendingAppointment created with retryCount=0
- Action: syncPendingAppointments cronjob runs 5 times
- Assert: retry 1,2,3,4 with exponential backoff (2s,4s,8s)
- Assert: all 5 fail → syncStatus='FAILED', NO notification
- Assert: log contains "Failed to sync after 5 retries"
```

### Security Tests

#### 12. OAuth Multi-Workspace Validation
```
Test: Same Google account cannot link to 2 workspaces
- Setup: Workspace A linked to mario@gmail.com
- Action: OAuth callback for Workspace B with mario@gmail.com
- Assert: check googleCalendarConnection.findFirst({ externalId: mario@gmail.com })
- Assert: if already linked elsewhere → 400 error "Account already linked"
```

#### 13. GDPR Data Deletion
```
Test: deleteCustomerData also deletes Google Calendar events
- Setup: customer Mario ha 3 appointment in Google Calendar
- Action: deleteCustomerData(Mario) called
- Assert: listEvents returns 3 events
- Assert: deleteEvent called 3 times
- Assert: gdprLog.create records action with eventCount=3
```

#### 14. Conversation Isolation
```
Test: Customer reminder response goes to correct appointment
- Setup: Mario ha 2 appointment (pulizia denti, call)
- Action: reminder per pulizia inviato, Mario risponde "si"
- Assert: confirmReminderResponse maps risposta al CORRECT appointment
- Assert: pulizia denti marked CONFIRMED, call rimane PENDING
```

---

## 🎯 Test Implementation Notes

- **Each test MUST include workspaceId filter** to ensure tenant isolation
- **Mock external services** (Google Calendar API, notificationService)
- **Use Prisma transactions** in integration scenarios
- **Test failures MUST include assertion messages** for debugging
- **No hardcoded assumptions** about dates/times (use relative dates)

**Ready for implementation model!** 🚀
