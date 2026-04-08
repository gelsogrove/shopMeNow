# 🚀 Quick Start: Calendar & Appointment Booking System

Generated: April 8, 2026
Status: Ready for Development

---

## ✅ Prerequisites

- Workspace already exists in eChatbot
- Node.js 18+ installed
- PostgreSQL 13+ running
- Google Cloud Project created with Calendar API enabled

---

## 🔧 Step 1: Google Cloud Console Setup

### 1.1 Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create project
3. **Enable Google Calendar API**:
   - Navigation menu → APIs & Services → Library
   - Search "Google Calendar API"
   - Click → Enable
4. **Create OAuth 2.0 Credentials**:
   - APIs & Services → Credentials
   - Click "Create Credentials" → OAuth client ID
   - Application type: **Web application**
   - Name: "eChatbot Appointments"
   - Add Authorized redirect URIs:
     ```
     http://localhost:3001/api/v1/google-oauth/callback   (dev)
     https://yourdomain.com/api/v1/google-oauth/callback  (prod)
     ```

### 1.2 Download Credentials

- Download JSON file with `client_id` and `client_secret`
- Save securely (git-ignored)

---

## 🗄️ Step 2: Database Migration

### 2.1 Create Prisma Migration

```bash
cd apps/backend
npx prisma migrate dev --name add_calendar_appointment_models
```

This creates all new tables:
- AppointmentType
- GoogleCalendarConnection
- WorkspaceBusinessHours
- BlackoutPeriod
- PendingAppointment
- ReminderLock
- LateCancellationAttempt
- GdprLog

### 2.2 Verify Schema

```bash
npx prisma studio
```

Check all tables created successfully.

---

## 🔐 Step 3: Environment Configuration

### 3.1 Update `.env`

```bash
# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret_here
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3001/api/v1/google-oauth/callback

# Redis (for rate-limit queue and cache)
REDIS_URL=redis://localhost:6379/0

# Feature toggle
FEATURE_CALENDAR_APPOINTMENTS_ENABLED=true
```

### 3.2 Verify Redis

```bash
redis-cli ping
# Should return: PONG
```

---

## 🏗️ Step 4: Backend Implementation

### 4.1 Install Dependencies

```bash
cd apps/backend
npm install googleapis date-fns-tz bullmq
```

### 4.2 Create Service Classes

```
apps/backend/src/services/
├── google-calendar.service.ts      # Google Calendar API wrapper
├── google-oauth.service.ts         # OAuth flow handler
├── google-calendar-rate-limiter.service.ts
└── slot-calculator.service.ts      # Slot availability logic
```

### 4.3 Create Repositories

```
apps/backend/src/repositories/
├── appointment-type.repository.ts
├── google-calendar-connection.repository.ts
├── business-hours.repository.ts
├── blackout-period.repository.ts
└── pending-appointment.repository.ts
```

### 4.4 Create Controllers

```
apps/backend/src/interfaces/http/controllers/
├── appointment-type.controller.ts
├── appointment.controller.ts
├── google-oauth.controller.ts
├── business-hours.controller.ts
└── blackout-period.controller.ts
```

### 4.5 Create Routes

```
apps/backend/src/interfaces/http/routes/
├── appointment-type.routes.ts
├── appointment.routes.ts
├── google-oauth.routes.ts
├── business-hours.routes.ts
└── blackout-period.routes.ts
```

### 4.6 Register Routes in Main Router

Update `apps/backend/src/routes/index.ts`:

```typescript
import appointmentTypesRoutes from './appointment-type.routes';
import appointmentRoutes from './appointment.routes';
import googleOAuthRoutes from './google-oauth.routes';
import businessHoursRoutes from './business-hours.routes';
import blackoutPeriodRoutes from './blackout-period.routes';

router.use('/workspaces', appointmentTypesRoutes);
router.use('/workspaces', appointmentRoutes);
router.use('/workspaces', businessHoursRoutes);
router.use('/workspaces', blackoutPeriodRoutes);
router.use('/api/v1/google-oauth', googleOAuthRoutes);
```

---

## 🔄 Step 5: Calling Functions (LLM Integration)

### 5.1 Create Calling Functions

```
apps/backend/src/domain/calling-functions/
├── bookAppointment.ts
├── cancelAppointment.ts
├── getAppointments.ts
├── getAvailableSlots.ts
├── rescheduleAppointment.ts
└── confirmBookingResponse.ts
```

### 5.2 Register with LLM Router

Update `apps/backend/src/application/agents/router-agent.ts` to recognize intents:

```typescript
if (intent === 'BOOKING_REQUEST') {
  return {
    agent: 'BOOKING_AGENT',
    appointmentTypeId: extracted.typeId,
    date: extracted.date,
    time: extracted.time
  };
}
```

---

## ⏲️ Step 6: Scheduler Jobs

### 6.1 Create Cache Sync Job

```
apps/scheduler/src/jobs/
└── calendar-cache-sync.job.ts  # Every 10 minutes
```

**What it does**:
- For each workspace with Google Calendar connected
- Fetch events from Google Calendar API
- Update local cache (TTL 10 min)
- Track sync status

### 6.2 Create Reminder Job

```
apps/scheduler/src/jobs/
└── appointment-reminder.job.ts  # Every 30 minutes
```

**What it does**:
- Find appointments within reminder window (24h before, etc.)
- Send WhatsApp/Email reminders
- Update event reminderSent flag
- Charge billing (€0.50 per WhatsApp)

### 6.3 Register Jobs

Update `apps/scheduler/src/index.ts`:

```typescript
// Every 10 minutes - sync cache
cron.schedule('*/10 * * * *', async () => {
  await calendarCacheSyncJob();
});

// Every 30 minutes - send reminders
cron.schedule('*/30 * * * *', async () => {
  await appointmentReminderJob();
});
```

---

## 📱 Step 7: Frontend Integration

### 7.1 Create API Service

```typescript
// frontend/src/services/appointmentApi.ts

export const appointmentApi = {
  async getAvailableSlots(workspaceId: string, appointmentTypeId: string, date: string) {
    const { data } = await api.get(`/workspaces/${workspaceId}/appointments/available-slots`, {
      params: { appointmentTypeId, date }
    });
    return data.slots;
  },

  async bookAppointment(workspaceId: string, appointment: BookAppointmentRequest) {
    const { data } = await api.post(`/workspaces/${workspaceId}/appointments`, appointment);
    return data;
  },

  // ... other methods
};
```

### 7.2 Create Calendar Settings Page

```typescript
// frontend/src/pages/CalendarSettingsPage.tsx

// Displays:
// - Connect Google Calendar button
// - Appointment Types CRUD
// - Business Hours configuration
// - Blackout Periods management
```

---

## 🧪 Step 8: Testing

### 8.1 Unit Tests

Create test files:

```
apps/backend/__tests__/unit/services/
├── google-calendar.service.spec.ts
├── google-oauth.service.spec.ts
└── slot-calculator.service.spec.ts

apps/backend/__tests__/unit/domain/calling-functions/
├── bookAppointment.spec.ts
├── cancelAppointment.spec.ts
└── getAvailableSlots.spec.ts
```

### 8.2 Run Tests

```bash
cd apps/backend
npm run test:unit -- __tests__/unit/services/google-calendar.service.spec.ts
```

### 8.3 Test Coverage Target

- Services: >= 90% (critical logic)
- Controllers: >= 80% (validation, error handling)
- Calling functions: >= 85% (business logic)

---

## 🚀 Step 9: First Workspace Setup

### 9.1 Enable Calendar Feature

```bash
# Admin goes to workspace settings
# Toggle: Calendar Appointments → ON
```

### 9.2 Connect Google Calendar

```bash
# Admin clicks "Connect Google Calendar"
# Redirects to Google OAuth consent screen
# After consent, tokens saved in GoogleCalendarConnection
```

### 9.3 Configure Appointment Types

```bash
# Admin creates appointment types:
# - Service: "Pulizia denti"
# - Duration: 30 min
# - Buffer: 15 min
# - Reminder: 24h before
```

### 9.4 Set Business Hours

```bash
# Admin configures:
# - Mon-Fri: 09:00-18:00
# - Sat-Sun: closed
# - Lunch: 13:00-14:00
```

---

## 📊 Step 10: Monitoring

### 10.1 Check Logs

```bash
# Backend logs
tail -f apps/backend/logs/app.log

# Scheduler logs
tail -f apps/scheduler/logs/scheduler.log
```

### 10.2 Monitor Rate Limiting

```bash
# Check queue status
redis-cli
LLEN "bullmq:realtime-check:wait"
LLEN "bullmq:realtime-check:active"
```

### 10.3 Check Pending Appointments

```bash
# Admin dashboard - Pending Sync section shows:
# - Number of pending appointments
# - Last sync attempt
# - Errors (if any)
```

---

## 🎯 Key Endpoints to Test

```bash
# Connect Google Calendar
GET http://localhost:3001/api/v1/google-oauth/connect/{workspaceId}

# Create appointment type
POST http://localhost:3001/api/workspaces/{workspaceId}/appointment-types
{
  "serviceType": "Pulizia denti",
  "duration": 30,
  "bufferMinutes": 15,
  "reminderHours": 24
}

# Get available slots
GET http://localhost:3001/api/workspaces/{workspaceId}/appointments/available-slots?appointmentTypeId=clx123&date=2026-04-15

# Book appointment
POST http://localhost:3001/api/workspaces/{workspaceId}/appointments
{
  "customerId": "cust_456",
  "appointmentTypeId": "clx123",
  "date": "2026-04-15",
  "time": "10:00",
  "confirmed": true
}
```

---

## ✅ Checklist

- [ ] Google OAuth credentials created
- [ ] Google Calendar API enabled
- [ ] `.env` configured with OAuth credentials
- [ ] Database migration completed
- [ ] Redis running
- [ ] All service classes created
- [ ] All controllers & routes registered
- [ ] Calling functions registered with LLM router
- [ ] Scheduler jobs running
- [ ] Frontend API service created
- [ ] Calendar settings page built
- [ ] Unit tests written and passing
- [ ] First workspace set up successfully
- [ ] Test booking from chat working

---

## 🚀 Next Steps

1. **Phase 2**: Deploy to staging
2. **Phase 3**: Load testing (1000+ concurrent bookings)
3. **Phase 4**: Monitor production for 2 weeks
4. **Phase 5**: GA (General Availability)

