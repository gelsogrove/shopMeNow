# 🔍 Research: Calendar & Appointment Booking System

Generated: April 8, 2026
Feature: Calendar & Appointment Booking with Google Calendar Integration
Status: CLARIFICATIONS RESOLVED ✅

---

## 📋 Clarifications Resolved

### 1. **Slot Availability Check Strategy**
**Question**: Come calcoli gli slot liberi quando il cliente dice "martedì alle 10"?

**Decision**: **Hybrid Cache + Real-time Double-Check**
- Cache locale aggiornato ogni 10 minuti da background job
- Listed slots letti dal cache (instant, <10ms)
- Durante conferma: double-check realtime con timeout 3 secondi
- Se timeout: fallback a cache + crea appointment comunque (graceful)

**Rationale**:
- Fast listing per UX (no 2-3sec delay per ogni slot display)
- Previene double-booking con atomic check prima di create
- Scalabile a 1000+ workspace (NOT polling every booking)

**Alternatives considered**:
- ❌ Pure realtime: slow (~2-3sec per slot) + rate limit exceeded
- ❌ Pure cache: risk di double-booking se outdated
- ✅ Hybrid: balance tra speed e safety

**Implementation**:
```
.specify/services/google-calendar-slot-calculator.service.ts
.specify/jobs/calendar-sync-cache.job.ts
```

---

### 2. **Google Calendar API Rate Limit at Scale (1000+ Workspace)**
**Question**: Con 1000 workspace e 30.000 eventi/giorno, come non esplodo il rate limit (180 req/min)?

**Decision**: **Weighted Rate-Limit Queue + Efficient Sync Strategy**

**Math**:
- Cache sync 1000 workspace ogni 10 min = 1000 API calls / 10 min = 100 req/min ✅ SAFE
- Real-time checks (selective): max 500 concurrent bookings/min = 500 req/min ✗ OVER

**Solution**:
- Cache sync: spread over 10 minutes (not spike)
- Realtime checks: max 10 concurrent via BullMQ queue (respects rate limit)
- Priority: booking confirm > late cancellation > admin queries
- Fallback: if queue > 50 items or rate limit approaching → use cache + create pending

**Alternatives considered**:
- ❌ Poll all workspace every 5 min: 1000×5 = 5000 calls/hour = 83 req/min, still scales bad
- ❌ Only check when customer clicks: no cache, slow + rate limit exceeded
- ✅ Efficient sync + weighted queue: scales linearly

**Implementation**:
```
.specify/services/google-calendar-rate-limiter.service.ts
.specify/jobs/calendar-cache-sync.job.ts (BullMQ)
```

---

### 3. **Booking Confirmation Flow**
**Question**: Should booking be immediate or require confirmation?

**Decision**: **2-Step Confirmation (Andrea's Decision #1)**

**Flow**:
1. Customer: "Vorrei prenotare una pulizia denti martedì alle 10"
2. LLM recognizes intent + extracts TYPE/DATE/TIME
3. Bot proposes: "Confermi prenotazione martedì 15 Aprile ore 10:00?"
   - Store `conversationState.pendingBooking`
4. Customer: "sì" or "no"
5. IF "sì" → bookAppointment(confirmed=true) → create in Google Calendar
6. IF "no" → suggest alternatives

**Rationale**:
- Reduces accidental bookings (confirmation = user intent validation)
- Better UX for mobile/WhatsApp (customer sees full details before commit)
- Matches real-world appointment booking (dentist, salon, etc.)

**Alternatives considered**:
- ❌ Immediate booking (no confirmation): higher accidental bookings, poor UX
- ✅ 2-step confirmation: explicit user intent, matches expectations

**Implementation**:
```
domain/calling-functions/bookAppointment.ts (STEP 2-4 logic)
domain/calling-functions/confirmBookingResponse.ts (NEW - handle "sì"/"no")
```

---

### 4. **Google Calendar Offline Fallback**
**Question**: What happens when Google Calendar API is down?

**Decision**: **Graceful Fallback to PendingAppointment + Manual Admin Sync (Andrea's Decision #3)**

**Flow**:
1. bookAppointment() tries to create event in Google Calendar
2. If API error (503, timeout, etc.): 
   - Save to `PendingAppointment` table
   - Respond to customer: "⚠️ Prenotazione in sospeso, ti faremo sapere!"
   - Alert admin: "Pending calendar syncs waiting"
3. Admin manually syncs via Dashboard button "Sync Now"
   - Triggers batch sync of all pending appointments
   - Updates events created in Google Calendar if successful
4. NO automatic retry (Andrea decision: admin controls the risk)

**Rationale**:
- Prevents data loss (fallback to DB)
- Transparent to customer ("in sospeso" = honest messaging)
- Admin has full control (prevents cascading failures)
- No automated cascade that could compound errors

**Alternatives considered**:
- ❌ Auto-retry every 5 min: could cascade if Google down for hours
- ❌ Queue event indefinitely: silently fails with no notification
- ✅ Graceful fallback + manual: transparent + controlled

**Implementation**:
```
PendingAppointment model (added to schema.prisma)
domain/calling-functions/bookAppointment.ts (catch + save to pending)
controllers/appointment.controller.ts (admin sync endpoint - POST /sync-pending)
```

---

### 5. **Admin Calendar Changes Detection**
**Question**: Se admin cancella evento da Google Calendar manualmente, lo scopri?

**Decision**: **NO real-time detection. Manual workflow (Andrea's Decision #4)**

**Flow**:
1. Admin deletes event directly in Google Calendar UI
2. Our system doesn't auto-detect (NO webhook polling)
3. At next cache sync (10 min): event gone from Google Calendar
4. Our cache updated to reflect deletion
5. Admin sees updated availability on next page reload
6. Customer will see cancellation at next cache sync

**Rationale** (Andrea's requirement):
- Admin has FULL control over calendar
- NO surprise auto-deletions or cascading changes
- Simple logic (no complex webhook handling)
- Acceptable delay (10 min cache refresh)

**Alternatives considered**:
- ❌ Google Calendar Push Notifications: complex, webhook infrastructure
- ❌ Real-time polling: expensive + rate limit issues
- ✅ 10-min cache refresh: simple, acceptable for most use cases

**Implementation**:
```
Cache invalidation happens on 10-min sync job schedule
NO additional webhook handlers needed
```

---

### 6. **Response Format: Text + Link**
**Question**: Come formatto il messaggio di conferma?

**Decision**: **Text message + Direct Google Calendar Link (Andrea's Decision #2)**

**Format**:
```
✅ Prenotazione confermata!

📅 Pulizia denti
📆 Martedì 15 Aprile 2026 ore 10:00 (CET)
⏱️ Durata: 30 minuti + 15 min buffer
📩 Riceverai un reminder 24h prima!
🔗 Apri in Google Calendar: https://calendar.google.com/calendar/event?eid=xyz
```

**Rationale**:
- Text: human-readable, customer understands details
- Link: customer can open directly in Google Calendar if wants to see/modify
- Emoji: visual hierarchy (WhatsApp friendly)

**Implementation**:
```
bookAppointment() return string formatted with:
  - Appointment type
  - Date/time in workspace timezone
  - Duration + buffer
  - Reminder hours
  - Direct Google Calendar link
```

---

### 7. **Timezone Handling**
**Question**: Come gestisci timezone se admin è in Roma ma customer in NY?

**Decision**: **Workspace-Level Timezone + Customer Language for Display**

**Implementation**:
- `workspace.timezone` = admin's business timezone (set during setup)
- All events stored in UTC internally (Google Calendar standard)
- Display times converted to workspace timezone for admin
- Customer sees times in their language (translated by LLM)
- Reminder calculations use workspace timezone

**Example**:
```
Workspace: timezone = "Europe/Rome" (UTC+2 in April)
Customer in NY (UTC-4)

Event in Google Calendar:
  start: 2026-04-15T10:00:00+02:00 (Rome time = 04:00 NY time)

Customer message in Italian: "martedì 15 Aprile ore 10:00"
Translation layer converts to customer's language/timezone if needed
```

**Rationale**:
- Single timezone per workspace (admin's perspective)
- Customers see times as admin scheduled them
- LLM handles translation to customer's preferred language
- Respects customer's local time context if they provide it

**Implementation**:
```
workspace.timezone (added to schema)
zonedTimeToUtc() + utcToZonedTime() from date-fns-tz
Prompt variables: {{scheduledTime}}, {{scheduledDate}} already timezone-aware
```

---

### 8. **Anti-Spam: Max Active Appointments**
**Question**: Come previeni che uno customer booking 100 appuntamenti in 5 minuti?

**Decision**: **workspace.maxActiveAppointments limit (default 3)**

**Implementation**:
```typescript
// Before creating appointment
const futureEvents = await googleCalendarService.listEvents({
  workspaceId,
  customerId,
  timeMin: now(),
  timeMax: addMonths(now(), 6)  // Future window
});

if (futureEvents.length >= workspace.maxActiveAppointments) {
  return "❌ Hai già 3 prenotazioni attive..."
}
```

**Config**:
- `workspace.maxActiveAppointments` = 3 (default, configurable)
- Prevents spam booking
- Reasonable for most use cases (dentist, salon, etc.)

**Rationale**:
- Simple, effective anti-spam
- Configurable per workspace
- Respects legitimate users with multiple upcoming appointments

**Implementation**:
```
workspace model update (add field)
bookAppointment.ts (add check before create)
admin endpoint PATCH /workspaces/:id (allow config change)
```

---

### 9. **Late Cancellation Analytics**
**Question**: Como tracki cancellazioni < 2h prima dell'evento?

**Decision**: **LateCancellationAttempt table + Analytics dashboard**

**Implementation**:
```
model LateCancellationAttempt {
  id: string                    // CUID
  workspaceId: string           // Workspace
  customerId: string             // Customer
  eventId: string               // Google Calendar event ID
  minutesBeforeEvent: int       // How many minutes before event
  createdAt: DateTime
}

// Triggered in cancelAppointment() when minutes < 120
```

**Analytics**:
- Dashboard shows: "30% of cancellations are <2h before"
- Identifies problematic customers (frequent late cancellations)
- Helps admin understand pattern

**Rationale**:
- Data-driven insights for business
- Simple to implement (one model + log in cancelAppointment)
- No performance impact

**Implementation**:
```
LateCancellationAttempt model (Prisma schema)
cancelAppointment.ts (add logging)
admin/analytics/cancellations endpoint (NEW)
```

---

### 10. **GDPR: Customer Data Deletion**
**Question**: If customer asks to delete all appointments?

**Decision**: **Cascade delete from Google Calendar + Audit log**

**Implementation**:
```typescript
// When customer deleted (soft-delete or explicit GDPR request)
async deleteCustomerData(workspaceId, customerId) {
  // 1. List all customer's events from Google Calendar
  const events = await googleCalendarService.listEvents({
    workspaceId,
    customerId,
    timeMin: subMonths(now(), 12),
    timeMax: addMonths(now(), 12),
    maxResults: 500
  });

  // 2. Delete each event
  for (const event of events) {
    await googleCalendarService.deleteEvent(workspaceId, event.id);
  }

  // 3. Audit log
  await prisma.gdprLog.create({
    data: {
      workspaceId,
      customerId,
      action: 'DELETE_CALENDAR_DATA',
      eventCount: events.length,
      completedAt: now()
    }
  });
}
```

**Rationale**:
- GDPR compliance (right to erasure)
- Audit trail for legal compliance
- No orphaned events in Google Calendar

**Implementation**:
```
GdprLog model (Prisma schema)
GoogleCalendarService.deleteCustomerData() (NEW method)
customer-deletion-handler.ts (trigger on customer deletion)
```

---

## 🎯 Technology Choices

| Component | Technology | Decision | Rationale |
|-----------|-----------|----------|-----------|
| Calendar API | Google Calendar API v3 | OAuth 2.0 + googleapis npm | Industry standard, trusted for appointments |
| Rate Limiting | BullMQ (Redis) | Queue-based rate limiter | Scales to 1000+ workspaces, respects API quotas |
| Caching | Redis | In-memory cache TTL 10min | Fast slot listing, simple cache invalidation |
| Timezone | date-fns-tz | Precise timezone calculations | Battle-tested library, handles DST |
| Database | Prisma + PostgreSQL | Existing stack | Consistency with current arch |
| Scheduling | Existing scheduler | appointment-reminder.job.ts | Existing infrastructure |

---

## ✅ Clarifications Summary

| # | Question | Decision | Status |
|----|----------|----------|--------|
| 1 | Slot availability | Hybrid cache + realtime check | ✅ RESOLVED |
| 2 | Rate limiting 1000x | Weighted queue + efficient sync | ✅ RESOLVED |
| 3 | Booking confirmation | 2-step with "sì"/"no" | ✅ RESOLVED |
| 4 | Google offline | Graceful fallback + manual sync | ✅ RESOLVED |
| 5 | Admin calendar changes | 10-min cache refresh (no real-time) | ✅ RESOLVED |
| 6 | Response format | Text + direct link | ✅ RESOLVED |
| 7 | Timezone handling | Workspace-level + LLM translation | ✅ RESOLVED |
| 8 | Anti-spam | maxActiveAppointments = 3 | ✅ RESOLVED |
| 9 | Late cancellations | Analytics table + tracking | ✅ RESOLVED |
| 10 | GDPR deletion | Cascade delete + audit log | ✅ RESOLVED |

All NEEDS CLARIFICATION from prompt.md are now **RESOLVED**. ✅

Ready for **PHASE 1: Design & Contracts** →
