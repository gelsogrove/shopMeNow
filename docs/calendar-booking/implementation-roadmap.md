# 📅 Implementation Roadmap: Calendar & Appointment Booking

Generated: April 8, 2026
Total Estimated Duration: 8-10 weeks

---

## 🎯 Overview

```
PHASE 0: Prep (1 week) → PHASE 1: Core (3 weeks) → PHASE 2: Features (2 weeks) 
→ PHASE 3: Testing (2 weeks) → PHASE 4: Deploy (1 week)
```

---

## 📌 PHASE 0: Preparation (1 Week)

**Goal**: Setup infrastructure, dependencies, and project structure

### Week 1: Dev Setup

**Monday-Tuesday**:
- [ ] Setup Google Cloud Project
- [ ] Create OAuth 2.0 credentials
- [ ] Enable Google Calendar API
- [ ] Document credentials securely

**Wednesday-Thursday**:
- [ ] Install `googleapis`, `date-fns-tz`, `bullmq` npm packages
- [ ] Setup Redis local instance (or use cloud)
- [ ] Create database migration files (ready for Phase 1)
- [ ] Create directory structure for Phase 1

**Friday**:
- [ ] Create stub service classes
- [ ] MVP: Can run `npm run dev` without errors
- [ ] All new code paths covered by pre-commit linting

**Deliverables**:
- ✅ Google OAuth credentials
- ✅ Dependencies installed & locked
- ✅ Directory structure ready
- ✅ Environment template (.env.example)

---

## 🔧 PHASE 1: Core Backend (3 Weeks)

**Goal**: Implement core appointment booking logic + Google Calendar integration

### Week 2: Services Layer

**Focus**: Google Calendar API wrapper + Auth

**Monday-Tuesday**:
- [ ] Implement `GoogleCalendarService.getCalendarClient()`
  - OAuth token management
  - Token refresh logic
  - Error handling (401, quota exceeded)
- [ ] Unit tests: 90% coverage
  - Test token expiration handling
  - Test Unauthorized error scenarios

**Wednesday**:
- [ ] Implement `GoogleOAuthService.initiate()`
  - Generate OAuth consent URL
  - CSRF state parameter
- [ ] Implement `GoogleOAuthService.callback()`
  - Exchange auth code for tokens
  - Save to GoogleCalendarConnection
  - Handle error states

**Thursday-Friday**:
- [ ] Implement slot calculator with cache
  - `GoogleCalendarService.getAvailableSlots()`
  - Mock calendar data (no real Google calls yet)
- [ ] Unit tests for slot calculation
  - Business hours filtering
  - Buffer time enforcement
  - Blackout period handling
  - Timezone conversion

**Deliverables**:
- ✅ GoogleCalendarService (70% functional)
- ✅ GoogleOAuthService complete
- ✅ Unit tests > 90% coverage
- ✅ Slot calculator logic complete

---

### Week 3: Data Layer & Controllers

**Focus**: Database access + API endpoints

**Monday-Tuesday**:
- [ ] Create repositories:
  - `AppointmentTypeRepository`
  - `GoogleCalendarConnectionRepository`
  - `BusinessHoursRepository`
  - `BlackoutPeriodRepository`
  - `PendingAppointmentRepository`
- [ ] Unit tests: Repository queries work correctly

**Wednesday**:
- [ ] Create controllers:
  - `AppointmentTypeController` (CRUD)
  - `GoogleOAuthController` (connect/disconnect)
  - `BusinessHoursController` (list/update)
  - `BlackoutPeriodController` (CRUD)
- [ ] Add 3-layer middleware (auth → session → workspace)

**Thursday-Friday**:
- [ ] Register all routes
- [ ] Test HTTP endpoints manually (Postman)
- [ ] Integration tests (200 status codes at minimum)
- [ ] Swagger documentation updated

**Deliverables**:
- ✅ All repositories working
- ✅ All CRUD endpoints working
- ✅ OAuth endpoints working (real Google calls)
- ✅ Swagger docs updated
- ✅ API ready for LLM integration

---

### Week 4: Calling Functions

**Focus**: LLM-facing calling functions

**Monday-Tuesday**:
- [ ] Implement `bookAppointment()` calling function
  - 2-step flow with confirmation
  - Double-check slot availability
  - Handle Google Calendar errors
  - Save to PendingAppointment if offline
- [ ] Unit tests: 85%+ coverage
  - Happy path (successful booking)
  - Slot unavailable
  - Google offline (fallback)
  - Anti-spam (maxActiveAppointments)

**Wednesday**:
- [ ] Implement `cancelAppointment()` calling function
  - List customer's appointments
  - Late cancellation detection (<2h)
  - Google Calendar deletion
  - Audit logging
- [ ] Unit tests: 85%+ coverage

**Thursday**:
- [ ] Implement `getAvailableSlots()` calling function
  - Format slots list for chat
  - Group by morning/afternoon
  - Handle no-slots case
- [ ] Implement `getAppointments()` calling function

**Friday**:
- [ ] Implement `confirmBookingResponse()` for handling "sì"/"no"
- [ ] Implement `rescheduleAppointment()`
- [ ] All calling functions registered with LLM router
- [ ] End-to-end test: chat → LLM → bookAppointment → Google Calendar

**Deliverables**:
- ✅ All 5 calling functions working
- ✅ LLM router integration complete
- ✅ End-to-end chat booking flow works
- ✅ Unit tests 85%+ coverage
- ✅ Ready for scheduler jobs (Phase 2)

---

## ⏰ PHASE 2: Scheduler & Advanced Features (2 Weeks)

**Goal**: Implement backgrounds jobs + reminder system

### Week 5: Cache Sync & Reminders

**Monday**:
- [ ] Implement `calendar-cache-sync.job.ts`
  - Runs every 10 minutes
  - Fetches events from Google Calendar API
  - Updates Redis cache
  - Tracks sync timing
- [ ] Unit tests: mock Google Calendar responses

**Tuesday**:
- [ ] Implement `appointment-reminder.job.ts`
  - Finds appointments in reminder window
  - Uses ReminderLock for atomic safety
  - Sends WhatsApp (€0.50) + Email (free) reminders
  - Updates billing for WhatsApp
  - Handle failover to retry

**Wednesday-Thursday**:
- [ ] Implement rate-limiting queue
  - `GoogleCalendarRateLimiter` with BullMQ
  - Max 10 concurrent real-time checks
  - Priority queue (booking > cancellation > admin)
  - Graceful degradation when queue full
- [ ] Unit tests: Queue behavior under load

**Friday**:
- [ ] Implement admin sync endpoint
  - POST `/admin/appointments/sync-pending`
  - Batch sync PendingAppointments to Google Calendar
  - Return sync stats (synced, failed, errors)
- [ ] Admin can manual trigger sync

**Deliverables**:
- ✅ Cache sync job working (10 min schedule)
- ✅ Reminder job working (30 min schedule, €0.50 charge)
- ✅ Rate-limiter queue operational
- ✅ Admin sync endpoint working
- ✅ Reminders being sent to customers

---

### Week 6: Analytics & Edge Cases

**Monday-Tuesday**:
- [ ] Implement analytics dashboard
  - Late cancellation tracking (LateCancellationAttempt table)
  - Analytics endpoint: GET `/admin/appointments/analytics`
  - Show: total, confirmed, cancelled, late%
- [ ] Unit tests for analytics queries

**Wednesday**:
- [ ] Implement GDPR data deletion
  - `deleteCustomerData()` cascade delete from Google Calendar
  - Audit log in GdprLog table
  - Triggered when customer deleted
- [ ] Integration tests: GDPR compliance

**Thursday**:
- [ ] Handle edge cases:
  - Google Calendar token revoked → auto-disable connection
  - Admin deletes event manually → next sync detects deletion
  - Concurrent bookings same slot → double-check prevents race
  - Timeout on Google API → fallback to PendingAppointment

**Friday**:
- [ ] Load test: 1000 concurrent booking requests
  - Verify rate limiter works at scale
  - Verify no duplicate reminders (ReminderLock)
  - Check cache hit rate
- [ ] Performance baseline: <500ms response time for slots

**Deliverables**:
- ✅ Analytics dashboard working
- ✅ GDPR deletion implemented
- ✅ Edge cases handled
- ✅ Load tests passing (1000 concurrent)
- ✅ Performance baseline established

---

## 🧪 PHASE 3: Testing & Frontend (2 Weeks)

**Goal**: Full test coverage + UI integration

### Week 7: Unit & Integration Tests

**Monday-Tuesday**:
- [ ] Add 15 unit tests for each service (90%+ coverage)
  - GoogleCalendarService
  - SlotCalculatorService
  - RateLimiterService
  - Calling functions (book, cancel, list)
- [ ] All tests running in CI/CD

**Wednesday**:
- [ ] Add 10+ integration tests
  - Full flow: OAuth → book → reminder → cancel
  - Google Calendar API integration tests
  - Database transaction tests
- [ ] Integration tests in CI (runs on staging DB)

**Thursday-Friday**:
- [ ] Security tests:
  - Workspace isolation (can't see other workspace calendars)
  - Customer can only book/cancel own appointments
  - Admin can sync pending (authorization check)
  - GDPR deletion verifies workspace ownership
- [ ] Penetration testing: No SQL injection, XSS, etc.

**Deliverables**:
- ✅ Unit tests 90%+ coverage
- ✅ Integration tests 80%+ coverage
- ✅ Security tests passing
- ✅ CI/CD pipeline updated

---

### Week 8: Frontend & Polish

**Monday-Tuesday**:
- [ ] Create API service: `appointmentApi.ts`
  - Wrapper methods for all endpoints
  - Error handling with toast notifications
- [ ] Create Calendar Settings page
  - Connect Google Calendar button
  - Appointment Types CRUD (table)
  - Business Hours editor
  - Blackout Periods manager

**Wednesday**:
- [ ] Create Admin Dashboard page
  - Pending sync status
  - Analytics charts (cancellations %, top services)
  - Latest appointments list
  - Manual sync button

**Thursday**:
- [ ] Create public booking widget (optional)
  - Display available slots
  - Book without logging in
  - Confirmation email
- [ ] Update Swagger with all endpoints
- [ ] API documentation review

**Friday**:
- [ ] End-to-end testing:
  - Admin connects Google Calendar ✓
  - Creates appointment type ✓
  - Customer books from chat ✓
  - Receives reminder 24h before ✓
  - Can cancel ✓
  - Appears in Google Calendar ✓
- [ ] Performance optimization (Lighthouse 90+)

**Deliverables**:
- ✅ Calendar settings page complete
- ✅ Admin dashboard working
- ✅ End-to-end flows tested
- ✅ Swagger complete + validated
- ✅ Frontend performance optimized

---

## 🚀 PHASE 4: Staging & Production (1 Week)

**Goal**: Deploy to staging, final testing, production release

### Week 9: Staging Deployment

**Monday**:
- [ ] Deploy to staging environment
  - Backend on staging
  - Frontend on staging
  - PostgreSQL on staging
  - Redis on staging
- [ ] Verify all endpoints working

**Tuesday**:
- [ ] Create test workspaces on staging
  - Setup one workspace as "dentist" profile
  - Setup one workspace as "salon" profile
  - Test both appointment types

**Wednesday**:
- [ ] Smoke tests on staging:
  - OAuth flow works
  - Can book appointments
  - Reminders sending
  - At scale: 100 concurrent bookings
- [ ] Monitor logs for any errors

**Thursday**:
- [ ] User acceptance testing (Andrea testing)
  - Does it feel right?
  - Any missing features?
  - Performance acceptable?
- [ ] Document any issues

**Friday**:
- [ ] Fix issues found in UAT
- [ ] Final sign-off from Andrea
- [ ] Prepare prod deployment runbook

**Deliverables**:
- ✅ Staging environment stable
- ✅ Smoke tests passing
- ✅ UAT sign-off
- ✅ Deployment runbook

---

### Week 10: Production Release

**Monday**:
- [ ] Final code review (Andrea)
- [ ] Update CHANGELOG.md
- [ ] Tag release: v1.0.0-calendar

**Tuesday**:
- [ ] Deploy to production
  - Database migration
  - Backend deployment
  - Frontend deployment
  - Redis cache pre-warm
- [ ] Smoke tests on production

**Wednesday**:
- [ ] Monitor production:
  - Error rates
  - API response times
  - Cache hit rate
  - Reminder delivery success
- [ ] Enable logging + alerting
- [ ] Setup runbooks for escalation

**Thursday-Friday**:
- [ ] Ongoing monitoring
  - Fix any production bugs (hot-fix)
  - Gather customer feedback
  - Performance validation

**Deliverables**:
- ✅ Production deployed & stable
- ✅ Monitoring configured
- ✅ Support runbooks ready
- ✅ Feature GA (General Availability)

---

## 📊 Timeline Summary

| Phase | Duration | Start | End | Status |
|-------|----------|-------|-----|--------|
| 0: Prep | 1 week | Week 1 | Week 1 | 📋 Planning |
| 1: Core | 3 weeks | Week 2 | Week 4 | 🔧 Development |
| 2: Advanced | 2 weeks | Week 5 | Week 6 | ⏰ Development |
| 3: Testing | 2 weeks | Week 7 | Week 8 | 🧪 Testing |
| 4: Deployment | 1-2 weeks | Week 9 | Week 10 | 🚀 Release |
| **TOTAL** | **~10 weeks** | | | |

---

## 🎯 Success Criteria

- [ ] All unit tests > 85% code coverage
- [ ] All integration tests passing
- [ ] Load test: 1000 concurrent bookings < 500ms response
- [ ] Zero double-bookings in production (atomic checks work)
- [ ] Reminders deliver 99%+ success rate
- [ ] Admin sync catches 100% of pending appointments
- [ ] Zero data loss (GDPR compliance verified)
- [ ] Workspace isolation enforced (security tests)
- [ ] End-to-end booking flow: chat → book → remind → cancel
- [ ] Customer satisfaction: NPS 8+ (if applicable)

---

## 🚨 Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Google API rate limit exceeded | Medium | High | Rate limiter queue + graceful fallback |
| Double-booking race condition | Medium | High | Atomic lock + pessimistic locking |
| Token revocation | Low | Medium | Auto-disable + admin notification |
| Timezone DST bugs | Medium | Medium | Use battle-tested `date-fns-tz` library |
| Redis failure | Low | Medium | Graceful fallback to PendingAppointment |
| Reminder delivery failure | Low | Medium | Retry logic + admin can manual resend |

---

## 📚 Dependencies

- **googleapis** (Google Calendar API client)
- **date-fns-tz** (Timezone calculations)
- **bullmq** (Distributed job queue)
- **redis** (Cache + queue backend)
- **prisma** (ORM - already installed)

---

## ✅ Acceptance Checklist

- [ ] All deliverables completed on schedule
- [ ] Code coverage > 85%
- [ ] Load tests passing
- [ ] Production monitoring configured
- [ ] Documentation complete
- [ ] Andrea sign-off received
- [ ] Feature flag ready to disable (if needed)

---

## 📞 Questions & Decisions

**Q: What if Google Calendar API is down for > 24 hours?**
- A: PendingAppointments queue grows. Admin can sync manually. System reaches degraded mode but doesn't lose data.

**Q: What if customer deletes Google Calendar?**
- A: GoogleCalendarConnection.isActive → false. Admin gets notification. Bookings disabled until reconnected.

**Q: Should we sync MORE frequently than 10 min?**
- A: No. 10 min balances between freshness (acceptable for most use cases) and rate limit (100 req/min is safe).

**Q: Do we need Push Notifications from Google Calendar?**
- A: No. Andrea requirement: admin has full control. Manual 10-min refresh is acceptable.

