# 📊 Data Model: Calendar & Appointment Booking System

Generated: April 8, 2026
Status: Ready for Implementation

---

## 🗄️ Database Schema Changes

### Overview
- **NO `Appointment` table** - events live exclusively in Google Calendar
- Database contains: configuration, OAuth tokens, business rules, analytics, fallback storage
- All appointments are read/written via Google Calendar API

---

## 📋 New Models

### 1. `AppointmentType`
Configurable by workspace owner. Represents types of services that can be booked.

```prisma
model AppointmentType {
  id              String    @id @default(cuid())
  workspaceId     String
  
  // SERVICE CONFIGURATION
  serviceType     String    // "Pulizia denti", "Demo", "TAC", etc.
                            // Stringa libera, NON FK a Services table
  description     String?   // Optional description for customer
  
  // DURATION & SPACING
  duration        Int       @default(60)        // Minutes (default 60)
  bufferMinutes   Int       @default(15)        // Time between appointments (prevents back-to-back)
  
  // REMINDERS
  reminderMessage String    @db.Text            // Template: "Ciao {{customerName}}, domani alle {{time}}"
  reminderHours   Int       @default(24)        // Hours before appointment to send reminder
  
  // STATE
  isActive        Boolean   @default(true)      // Can be disabled without deleting
  color           String?   @default("#3B82F6") // Color in calendar UI
  sortOrder       Int       @default(0)         // Display order
  
  // TIMESTAMPS
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime? // Soft delete
  
  // RELATIONS
  workspace           Workspace            @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  pendingAppointments PendingAppointment[]
  
  @@index([workspaceId])
  @@index([workspaceId, isActive])
  @@index([workspaceId, deletedAt])
}
```

**Validation Rules**:
- `duration` >= 15 minutes
- `bufferMinutes` >= 0
- `reminderHours` >= 1
- `serviceType` not empty
- `reminderMessage` must contain valid template variables

---

### 2. `GoogleCalendarConnection`
OAuth tokens for workspace owner's Google Calendar account.

```prisma
model GoogleCalendarConnection {
  id             String    @id @default(cuid())
  workspaceId    String    @unique  // One calendar per workspace
  
  // GOOGLE OAUTH TOKENS
  googleEmail    String              // Email account (e.g., "dentista@clinica.it")
  accessToken    String    @db.Text  // Google OAuth access_token
  refreshToken   String    @db.Text  // Google OAuth refresh_token (long-lived)
  tokenExpiresAt DateTime            // Access token expiration
  scopes         String[]            // ["calendar.events", "calendar.readonly"]
  
  // METADATA
  connectedAt    DateTime  @default(now())
  lastSyncAt     DateTime?           // Last successful sync/refresh
  lastError      String?             // Last error message (for debugging)
  isActive       Boolean   @default(true)  // Can be disabled if token revoked
  
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  
  // RELATIONS
  workspace      Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  
  @@index([workspaceId])
  @@index([tokenExpiresAt]) // For auto-refresh job
}
```

**State Transitions**:
- NEW → CONNECTED (after OAuth callback)
- CONNECTED → DISCONNECTED (token revoked by user)
- DISCONNECTED → CONNECTED (user reconnects)

---

### 3. `WorkspaceBusinessHours`
Configurable business hours per day of week.

```prisma
model WorkspaceBusinessHours {
  id          String    @id @default(cuid())
  workspaceId String
  
  // DAY & HOURS
  dayOfWeek   Int                 // 0=Sunday, 1=Monday, ..., 6=Saturday
  isOpen      Boolean   @default(true)  // Closed on this day?
  openTime    String?             // "09:00" (HH:mm format)
  closeTime   String?             // "18:00"
  
  // BREAKS (optional)
  breakStart  String?             // "13:00" (lunch break)
  breakEnd    String?             // "14:00"
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  // RELATIONS
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  
  @@unique([workspaceId, dayOfWeek])
  @@index([workspaceId])
}
```

**Default Business Hours** (if not configured):
- Monday-Friday: 09:00-18:00 (no break)
- Saturday-Sunday: closed

**Validation Rules**:
- `openTime` < `closeTime` (if both set)
- `breakStart` < `breakEnd` (if both set)
- `breakStart` must be between open and close
- Format: HH:mm (24-hour)

---

### 4. `BlackoutPeriod`
Periods when appointments cannot be booked (vacations, holidays, training).

```prisma
model BlackoutPeriod {
  id          String    @id @default(cuid())
  workspaceId String
  
  // DATES
  startDate   DateTime            // Start of period (timezone converted to workspace TZ)
  endDate     DateTime            // End of period
  reason      String?             // "Vacanze estive", "Festività", "Training"
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  deletedAt   DateTime? // Soft delete
  
  // RELATIONS
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  
  @@index([workspaceId])
  @@index([workspaceId, startDate, endDate])
  @@index([workspaceId, deletedAt])
}
```

**Validation Rules**:
- `startDate` <= `endDate`
- Cannot overlap with other blackout periods (business rule, not DB constraint)
- Cannot be in the past (business rule, configurable by admin)

---

### 5. `PendingAppointment` (Fallback for Google Offline)
Appointments waiting to be synced to Google Calendar.

```prisma
model PendingAppointment {
  id                String    @id @default(cuid())
  workspaceId       String
  customerId        String
  appointmentTypeId String
  
  // APPOINTMENT DETAILS
  scheduledAt       DateTime            // When appointment is scheduled (UTC)
  duration          Int                 // Minutes
  bufferMinutes     Int                 // Minutes
  notes             String?             // Additional notes
  
  // SYNC STATUS
  syncStatus        String    @default("PENDING")  // PENDING, SYNCED, FAILED
  googleEventId     String?             // Google Calendar event ID (set after sync)
  lastSyncAttempt   DateTime?           // When we last tried to sync
  syncError         String?             // Error message from last attempt
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
  @@index([customerId])
}
```

**State Transitions**:
- NEW → PENDING (created when Google Calendar unavailable)
- PENDING → SYNCED (successfully created in Google Calendar)
- PENDING → FAILED (max retries reached)

**Retry Logic**:
- Max 5 retries before marking FAILED
- Retry delay: exponential backoff (1 min, 5 min, 15 min, 1 hour, 4 hours)

---

### 6. `ReminderLock` (Atomic Lock for Reminders)
Prevents duplicate reminders from multiple job instances.

```prisma
model ReminderLock {
  id           String    @id @default(cuid())
  eventId      String    @unique  // Google Calendar event ID
  workspaceId  String
  
  // LOCK STATE
  lockedAt     DateTime  @default(now())
  processedAt  DateTime?           // When processing completed
  status       String    @default("LOCKED")  // LOCKED, SENT, FAILED
  errorMessage String?
  
  createdAt    DateTime  @default(now())
  
  @@index([eventId])
  @@index([workspaceId])
  @@index([lockedAt])  // For cleanup of old locks
}
```

**Lock Acquisition**:
```typescript
// Atomic lock - unique constraint violation = already processing
const locked = await prisma.reminderLock.create({
  data: { eventId, workspaceId }
}).catch(() => null);  // Unique constraint violated = skip

if (!locked) continue;  // Another instance has the lock
```

---

### 7. `LateCancellationAttempt` (Analytics)
Track cancellations happening < 2 hours before event.

```prisma
model LateCancellationAttempt {
  id                String    @id @default(cuid())
  workspaceId       String
  customerId        String
  eventId           String    // Google Calendar event ID
  
  // ANALYTICS
  minutesBeforeEvent Int      // How many minutes before event
  
  createdAt         DateTime  @default(now())
  
  // RELATIONS
  workspace         Workspace @relation(fields: [workspaceId], references: [id])
  customer          Customers @relation(fields: [customerId], references: [id])
  
  @@index([workspaceId])
  @@index([customerId])
  @@index([createdAt]) // For analytics queries
}
```

**Usage**:
- Logged whenever `cancelAppointment()` is called AND event < 2 hours away
- Used for analytics dashboard: "X% of cancellations are last-minute"

---

### 8. `GdprLog` (Audit Trail)
Audit trail for GDPR data deletion operations.

```prisma
model GdprLog {
  id           String    @id @default(cuid())
  workspaceId  String
  customerId   String
  
  // ACTION
  action       String              // 'DELETE_CALENDAR_DATA', etc.
  eventCount   Int       @default(0)  // Number of events deleted
  
  completedAt  DateTime
  createdAt    DateTime  @default(now())
  
  @@index([workspaceId])
  @@index([customerId])
  @@index([createdAt])
}
```

---

## 🔄 Workspace Model Updates

Add these fields to existing `Workspace` model:

```prisma
model Workspace {
  // ... existing fields ...
  
  // CALENDAR FEATURE
  calendarEnabled       Boolean   @default(false)   // Feature toggle
  timezone              String    @default("Europe/Rome")  // Workspace timezone (CRITICAL)
  maxActiveAppointments Int       @default(3)       // Anti-spam: max concurrent bookings per customer
  
  // CACHE FLAGS
  hasWebhookPendingEvents Boolean @default(false)  // Set by webhook, cleared by sync job
  
  // RELATIONS
  googleCalendarConnection GoogleCalendarConnection?
  appointmentTypes         AppointmentType[]
  pendingAppointments      PendingAppointment[]
  reminderLocks            ReminderLock[]
  lateCancellationAttempts LateCancellationAttempt[]
  businessHours            WorkspaceBusinessHours[]
  blackoutPeriods          BlackoutPeriod[]
  gdprLogs                 GdprLog[]
}
```

---

## 🔄 Customers Model Updates

Add relations for calendar tracking:

```prisma
model Customers {
  // ... existing fields ...
  
  // RELATIONS
  pendingAppointments      PendingAppointment[]
  lateCancellationAttempts LateCancellationAttempt[]
}
```

---

## 🔄 PlanConfiguration Model Updates

```prisma
model PlanConfiguration {
  // ... existing fields ...
  
  // REMINDER BILLING
  reminderCost     Float   @default(0.50)  // €0.50 per WhatsApp reminder (email = free)
}
```

---

## 📊 Relationships Diagram

```
Workspace (1)
├── GoogleCalendarConnection (1)
├── AppointmentType (*)
│   └── PendingAppointment (*)
├── PendingAppointment (*)
│   ├── Customer (1)
│   └── AppointmentType (1)
├── WorkspaceBusinessHours (7, one per day)
├── BlackoutPeriod (*)
├── ReminderLock (*)
├── LateCancellationAttempt (*)
└── GdprLog (*)

Customer (1)
├── PendingAppointment (*)
└── LateCancellationAttempt (*)
```

---

## ✅ Schema Validation Rules

| Model | Field | Rule | Impact |
|-------|-------|------|--------|
| AppointmentType | duration | >= 15 | Minimum booking length |
| AppointmentType | serviceType | not empty | Required field |
| WorkspaceBusinessHours | dayOfWeek | 0-6 | Day of week constraint |
| BlackoutPeriod | startDate | <= endDate | Date range validity |
| ReminderLock | eventId | UNIQUE | Atomic lock enforcement |
| Workspace | timezone | valid IANA | Timezone format validation |

---

## 📝 Migration Plan

### Step 1: Create new tables
```bash
npx prisma migrate dev --name add_calendar_appointment_models
```

### Step 2: Add fields to existing tables
```bash
# Combined in same migration
```

### Step 3: Seed defaults
```sql
-- Insert default business hours for new workspaces
INSERT INTO WorkspaceBusinessHours (workspaceId, dayOfWeek, isOpen, openTime, closeTime)
VALUES 
  ('{workspaceId}', 1, true, '09:00', '18:00'),  -- Monday
  ('{workspaceId}', 2, true, '09:00', '18:00'),  -- Tuesday
  -- ... etc
```

### Step 4: Generate Prisma client
```bash
npx prisma generate
```

---

## 🎯 Phase 1 Complete

All database entities are defined and validated. Ready for:
- **Phase 2**: API Contracts (OpenAPI spec)
- **Phase 3**: Implementation
