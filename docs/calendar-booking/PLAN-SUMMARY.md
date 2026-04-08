# 📋 Calendar & Appointment Booking System - COMPLETE PLAN

**Generated**: April 8, 2026  
**Status**: ✅ READY FOR DEVELOPMENT  
**Total Duration**: ~10 weeks  
**Feature Owner**: Andrea  

---

## 🎯 Executive Summary

This document contains the **complete implementation plan** for the Calendar & Appointment Booking System with Google Calendar integration.

**What's Included**:
1. ✅ **research.md** - All design clarifications resolved
2. ✅ **data-model.md** - Complete database schema
3. ✅ **contracts/appointment-api.openapi.yaml** - Full API specification
4. ✅ **quickstart.md** - Setup guide for developers
5. ✅ **implementation-roadmap.md** - 10-week development plan

---

## 📁 Document Structure

```
docs/calendar-booking/
├── research.md                          # Design decisions & clarifications
├── data-model.md                        # Database schema + validations
├── quickstart.md                        # Developer setup guide  
├── implementation-roadmap.md            # 10-week phased roadmap
├── contracts/
│   └── appointment-api.openapi.yaml     # OpenAPI 3.0 specification
└── PLAN-SUMMARY.md                      # This file
```

---

## 🔑 Key Decisions (From Andrea)

| # | Decision | Impact | Documentation |
|---|----------|--------|---|
| **1** | Require booking confirmation (2-step flow) | Better UX, fewer mistakes | bookAppointment.ts |
| **2** | Response = text + Google Calendar link | User can open/modify directly | bookAppointment() return format |
| **3** | Google offline = save to Pending + manual sync | Transparent, admin-controlled | PendingAppointment model |
| **4** | NO auto-detection of calendar changes | Admin has full control | 10-min cache refresh only |

---

## 🏗️ Architecture Overview

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    CUSTOMER (Chat)                            │
│  "Vorrei prenotare pulizia denti martedì alle 10"            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │   LLM Router Intent Parser      │
        │   intent = BOOKING_REQUEST      │
        └────────────────┬────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │   bookAppointment() [STEP 1]    │
        │   getAvailableSlots() check     │
        │   Return: "Confirm booking?"    │
        └────────────────┬────────────────┘
                         │
        Customer: "sì"   │
                         ▼
        ┌────────────────────────────────┐
        │   bookAppointment() [STEP 2]    │
        │   confirmed=true                │
        │   Create in Google Calendar     │
        │   Return: "✅ Confirmed!"       │
        └────────────────┬────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │   Google Calendar               │
        │   Event stored with metadata:   │
        │   - shopMeSource=true           │
        │   - customerId, workspaceId     │
        │   - reminderSent=false          │
        └────────────────┬────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │   Scheduler Job (every 30 min)  │
        │   appointment-reminder.job.ts   │
        │   Find events needing reminders │
        │   Send WhatsApp (€0.50)         │
        │   Update reminderSent=true      │
        └────────────────────────────────┘
```

### Concurrency Safety

```
Rate Limiter Queue:
┌──────────────────────────────────┐
│  Real-time availability check    │
│  (during booking confirmation)   │
│                                  │
│  BullMQ Queue (max 10 concurrent)│
│  → Respects 180 req/min limit    │
│  → Fallback to cache if timeout  │
└──────────────────────────────────┘

Atomic Locks:
┌──────────────────────────────────┐
│  ReminderLock (unique per event) │
│  → Prevents duplicate reminders  │
│  → Used by scheduler job         │
└──────────────────────────────────┘

Cache (10-min TTL):
┌──────────────────────────────────┐
│  Redis cache of Google Calendar  │
│  Sync job runs every 10 minutes  │
│  100 req/min from sync job       │
│  (safely under 180 req/min limit)│
└──────────────────────────────────┘
```

---

## 📊 Database Entities

### New Tables (8)

1. **AppointmentType** - Configurable service types
   - Fields: serviceType, duration, bufferMinutes, reminderMessage, reminderHours
   - Indexed: (workspaceId, isActive), (workspaceId, deletedAt)

2. **GoogleCalendarConnection** - OAuth tokens
   - Fields: googleEmail, accessToken, refreshToken, tokenExpiresAt, isActive
   - Indexed: (tokenExpiresAt) for auto-refresh

3. **WorkspaceBusinessHours** - Hours per day
   - Fields: dayOfWeek (0-6), openTime, closeTime, breakStart, breakEnd
   - Unique: (workspaceId, dayOfWeek)

4. **BlackoutPeriod** - Vacation/closure periods
   - Fields: startDate, endDate, reason
   - Indexed: (workspaceId, startDate, endDate)

5. **PendingAppointment** - Fallback when Google offline
   - Fields: customerId, appointmentTypeId, scheduledAt, syncStatus, googleEventId
   - Indexed: (syncStatus), (lastSyncAttempt)

6. **ReminderLock** - Atomic lock for reminders
   - Fields: eventId (unique), status (LOCKED/SENT/FAILED)
   - Indexed: (eventId), (lockedAt)

7. **LateCancellationAttempt** - Analytics tracking
   - Fields: customerId, eventId, minutesBeforeEvent
   - Indexed: (customerId), (createdAt)

8. **GdprLog** - Audit trail for deletions
   - Fields: customerId, action, eventCount, completedAt
   - Indexed: (customerId), (createdAt)

### Updated Tables (2)

- **Workspace** - Add: calendarEnabled, timezone, maxActiveAppointments, hasWebhookPendingEvents
- **Customers** - Add relations: pendingAppointments, lateCancellationAttempts

---

## 🔌 API Endpoints

### Appointment Types (Admin CRUD)
```
GET    /workspaces/{workspaceId}/appointment-types
POST   /workspaces/{workspaceId}/appointment-types
PUT    /workspaces/{workspaceId}/appointment-types/{typeId}
DELETE /workspaces/{workspaceId}/appointment-types/{typeId}
```

### Google OAuth
```
GET    /v1/google-oauth/connect/{workspaceId}          → OAuth consent URL
GET    /v1/google-oauth/callback?code=...&state=...   → OAuth callback
DELETE /v1/google-oauth/disconnect/{workspaceId}       → Revoke connection
GET    /v1/google-oauth/status/{workspaceId}           → Check status
```

### Business Hours
```
GET    /workspaces/{workspaceId}/business-hours
POST   /workspaces/{workspaceId}/business-hours
PUT    /workspaces/{workspaceId}/business-hours/{dayOfWeek}
```

### Blackout Periods
```
GET    /workspaces/{workspaceId}/blackout-periods
POST   /workspaces/{workspaceId}/blackout-periods
DELETE /workspaces/{workspaceId}/blackout-periods/{id}
```

### Appointments (Core)
```
GET    /workspaces/{workspaceId}/appointments
GET    /workspaces/{workspaceId}/appointments/{eventId}
POST   /workspaces/{workspaceId}/appointments           → Create
DELETE /workspaces/{workspaceId}/appointments/{eventId} → Cancel
PATCH  /workspaces/{workspaceId}/appointments/{eventId} → Reschedule
GET    /workspaces/{workspaceId}/appointments/available-slots
```

### Admin Operations
```
POST   /workspaces/{workspaceId}/admin/appointments/sync-pending
GET    /workspaces/{workspaceId}/admin/appointments/analytics
```

---

## 🎭 Calling Functions (LLM Integration)

5 main calling functions available to LLM agents:

1. **bookAppointment()**
   - 2-step: propose → confirm
   - Validates slot + anti-spam
   - Creates in Google Calendar or PendingAppointment
   - Returns: text + link + reminder info

2. **cancelAppointment()**
   - Lists customer's appointments
   - Detects late cancellations (<2h)
   - Logs analytics + audit trail
   - Deletes from Google Calendar

3. **getAppointments()**
   - List customer's upcoming or past appointments
   - Format: human-readable with emojis

4. **getAvailableSlots()**
   - Get slots for specific date + appointment type
   - Respects business hours + buffer time
   - Grouped by morning/afternoon

5. **confirmBookingResponse()**
   - Handle customer's "sì"/"no" to confirmation
   - If yes → create appointment
   - If no → suggest alternatives

---

## ⏱️ Scheduler Jobs

### 1. calendar-cache-sync.job.ts
**Schedule**: Every 10 minutes  
**What**: Syncs Google Calendar events to local cache  
**Impact**: Fast slot listing (cache hit < 10ms)  

```
For each workspace with Google Calendar connected:
- Call Google Calendar API listEvents()
- Update Redis cache (TTL 10 minutes)
- Count: 1000 workspace × 1 call = 100 req/min ✓ (safe)
```

### 2. appointment-reminder.job.ts
**Schedule**: Every 30 minutes  
**What**: Sends reminders to customers  
**Impact**: €0.50 charge per WhatsApp reminder  

```
For each appointment in reminder window:
- Use ReminderLock for atomic safety
- Send WhatsApp (€0.50) or Email (free)
- Update event.reminderSent = true
- Deduct from workspace billing
```

---

## 🧪 Testing Strategy

### Unit Tests (Target: 85%+ coverage)
- Services: GoogleCalendarService, SlotCalculatorService, etc.
- Controllers: Validation, error handling
- Calling functions: Business logic + edge cases
- **Files**: ~40 test specs

### Integration Tests (Target: 80%+ coverage)
- OAuth flow: token exchange, auto-refresh
- Full booking flow: end-to-end
- Database transactions: rollback scenarios
- Google Calendar API integration
- **Files**: ~15 test specs

### Security Tests
- Workspace isolation: can't see other workspace calendars
- Customer isolation: can't cancel other customers' appointments
- GDPR deletion: admin-only, cascades properly
- **Files**: ~10 security test specs

### Load Tests
- 1000 concurrent booking requests
- Verify rate limiter works
- Check cache hit rate
- Measure response times

---

## 🚀 Deployment

### Prerequisites
- Google OAuth credentials in .env
- Redis running (cache + queue)
- PostgreSQL with migrations applied
- All dependencies installed

### Deployment Steps
```bash
# 1. Database
npx prisma migrate deploy

# 2. Backend
npm run build:backend
npm run start:backend

# 3. Scheduler
npm run start:scheduler

# 4. Frontend
npm run build:frontend
npm run start:frontend
```

### Monitoring
- Error rates (target: < 0.1%)
- API response times (target: < 500ms)
- Cache hit rate (target: > 90%)
- Reminder delivery success (target: > 99%)
- Google API quota usage (target: < 50% of limit)

---

## ✅ Milestones

| Milestone | Date | Criteria |
|-----------|------|----------|
| Phase 0 Complete | Week 1 | ✓ Setup done, dependencies installed |
| Phase 1 Complete | Week 4 | ✓ Core backend working, end-to-end flow |
| Phase 2 Complete | Week 6 | ✓ Jobs running, analytics working |
| Phase 3 Complete | Week 8 | ✓ All tests passing, frontend integrated |
| Staging Ready | Week 9 | ✓ UAT sign-off from Andrea |
| **PRODUCTION** | **Week 10** | **✓ GA - Live!** |

---

## 🚨 Known Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Google API rate limit exceeded** | MEDIUM | Weighted queue limits requests to 10/sec |
| **Double-booking race condition** | MEDIUM | Double-check + atomic lock prevents |
| **Timezone DST bugs** | MEDIUM | Use `date-fns-tz` (battle-tested) |
| **Token revocation** | LOW | Auto-detect + disable + admin notification |
| **Cache staleness** | LOW | 10-min refresh ensures max 10min staleness |
| **Reminder delivery failure** | LOW | Retry logic + admin can resend |

---

## 📚 Files to Review

### Research & Design (Start Here)
- `research.md` - All design decisions explained
- `data-model.md` - Database schema (60+ lines detail)
- `contracts/appointment-api.openapi.yaml` - Full OpenAPI spec

### Implementation Guides
- `quickstart.md` - Step-by-step setup for devs
- `implementation-roadmap.md` - 10-week phased plan
- `PLAN-SUMMARY.md` - This overview

### Code Location (When Implementing)
- Services: `apps/backend/src/services/`
- Controllers: `apps/backend/src/interfaces/http/controllers/`
- Routes: `apps/backend/src/interfaces/http/routes/`
- Calling Functions: `apps/backend/src/domain/calling-functions/`
- Jobs: `apps/scheduler/src/jobs/`
- Tests: `apps/backend/__tests__/unit/` & `__tests__/integration/`

---

## 🎯 Next Steps

1. **Immediately**:
   - [ ] Read `research.md` (5 min) - understand design choices
   - [ ] Review `data-model.md` (10 min) - see database schema
   - [ ] Check `contracts/` OpenAPI (10 min) - see API surface

2. **Before Starting Development** (Week 1):
   - [ ] Setup Google OAuth credentials (follow quickstart.md)
   - [ ] Install dependencies
   - [ ] Create feature branch
   - [ ] Assign Phase 0 tasks to team

3. **Development Start** (Week 2):
   - [ ] Follow `implementation-roadmap.md` phases sequentially
   - [ ] Update this roadmap with actual timelines
   - [ ] Run daily stand-ups to track progress

4. **Quality Gates**:
   - [ ] Unit tests 85%+ coverage before Phase 3
   - [ ] All security tests passing before staging
   - [ ] Load tests OK before production

---

## 📞 Questions?

- **Design Question**: Check `research.md`
- **Database Question**: Check `data-model.md`
- **API Question**: Check `contracts/appointment-api.openapi.yaml`
- **Setup Question**: Check `quickstart.md`
- **Timeline Question**: Check `implementation-roadmap.md`

---

**Status**: ✅ **READY FOR DEVELOPMENT**

**Prepared by**: Copilot  
**For**: Andrea  
**Date**: April 8, 2026  

---

*This plan is a living document. Update as development progresses.*

