-- Migration: add_appointments_and_calendar_flag
-- Created: 2026-04-08 (fixed 2026-04-09)
-- Description:
--   Complete calendar/booking feature migration:
--   1. Add enableCalendarBooking flag to Workspace table
--   2. Create appointment_types table
--   3. Create appointments table (confirmed bookings)
--   4. Create google_calendar_connections table
--   5. Create workspace_business_hours table
--   6. Create blackout_periods table
--   7. Create pending_appointments table
--   8. Create reminder_locks table
--   9. Create late_cancellation_attempts table
--  10. Create appointment_gdpr_logs table
--
-- NOTE: Table "Workspace" is PascalCase (no @@map in schema)

-- ==============================================================
-- 1. Add enableCalendarBooking to Workspace
-- ==============================================================
ALTER TABLE "Workspace" ADD COLUMN "enableCalendarBooking" BOOLEAN NOT NULL DEFAULT false;

-- ==============================================================
-- 2. Create appointment_types table
-- ==============================================================
CREATE TABLE "appointment_types" (
    "id"          TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "duration"    INTEGER NOT NULL,
    "bufferTime"  INTEGER NOT NULL DEFAULT 0,
    "price"       DECIMAL(10,2),
    "color"       TEXT NOT NULL DEFAULT '#3b82f6',
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "appointment_types_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "appointment_types"
    ADD CONSTRAINT "appointment_types_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "appointment_types_workspaceId_isActive_idx"
    ON "appointment_types"("workspaceId", "isActive");

-- ==============================================================
-- 3. Create appointments table (confirmed bookings)
-- ==============================================================
CREATE TABLE "appointments" (
    "id"                    TEXT NOT NULL,
    "workspaceId"           TEXT NOT NULL,
    "customerId"            TEXT NOT NULL,
    "appointmentTypeId"     TEXT NOT NULL,
    "startTime"             TIMESTAMP(3) NOT NULL,
    "endTime"               TIMESTAMP(3) NOT NULL,
    "timezone"              TEXT NOT NULL DEFAULT 'Europe/Rome',
    "googleEventId"         TEXT,
    "googleEventLink"       TEXT,
    "googleCalendarId"      TEXT,
    "status"                TEXT NOT NULL DEFAULT 'confirmed',
    "cancelledAt"           TIMESTAMP(3),
    "cancellationReason"    TEXT,
    "cancelledBy"           TEXT,
    "customerName"          TEXT,
    "customerPhone"         TEXT,
    "customerEmail"         TEXT,
    "customerNotes"         TEXT,
    "adminNotes"            TEXT,
    "bookedVia"             TEXT NOT NULL DEFAULT 'whatsapp',
    "reminder24hSentAt"     TIMESTAMP(3),
    "reminder1hSentAt"      TIMESTAMP(3),
    "reminderChannel"       TEXT,
    "reminderBilledAt"      TIMESTAMP(3),
    "reminderBillingTotal"  DECIMAL(10,2) DEFAULT 0,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_appointmentTypeId_fkey"
    FOREIGN KEY ("appointmentTypeId") REFERENCES "appointment_types"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "appointments_workspaceId_status_idx"
    ON "appointments"("workspaceId", "status");

CREATE INDEX "appointments_workspaceId_startTime_idx"
    ON "appointments"("workspaceId", "startTime");

CREATE INDEX "appointments_customerId_status_idx"
    ON "appointments"("customerId", "status");

CREATE UNIQUE INDEX "appointments_googleEventId_key"
    ON "appointments"("googleEventId")
    WHERE "googleEventId" IS NOT NULL;

CREATE INDEX "appointments_startTime_idx"
    ON "appointments"("startTime");

-- ==============================================================
-- 4. Create google_calendar_connections table
-- ==============================================================
CREATE TABLE "google_calendar_connections" (
    "id"           TEXT NOT NULL,
    "workspaceId"  TEXT NOT NULL,
    "calendarId"   TEXT NOT NULL DEFAULT 'primary',
    "accessToken"  TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry"  TIMESTAMP(3) NOT NULL,
    "scope"        TEXT[] DEFAULT ARRAY['https://www.googleapis.com/auth/calendar'],
    "connectedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt"   TIMESTAMP(3),
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    CONSTRAINT "google_calendar_connections_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "google_calendar_connections"
    ADD CONSTRAINT "google_calendar_connections_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "google_calendar_connections_workspaceId_key"
    ON "google_calendar_connections"("workspaceId");

CREATE INDEX "google_calendar_connections_workspaceId_idx"
    ON "google_calendar_connections"("workspaceId");

-- ==============================================================
-- 5. Create workspace_business_hours table
-- ==============================================================
CREATE TABLE "workspace_business_hours" (
    "id"          TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dayOfWeek"   INTEGER NOT NULL,
    "startTime"   TEXT NOT NULL,
    "endTime"     TEXT NOT NULL,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "workspace_business_hours_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "workspace_business_hours"
    ADD CONSTRAINT "workspace_business_hours_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "workspace_business_hours_workspaceId_dayOfWeek_key"
    ON "workspace_business_hours"("workspaceId", "dayOfWeek");

CREATE INDEX "workspace_business_hours_workspaceId_isActive_idx"
    ON "workspace_business_hours"("workspaceId", "isActive");

-- ==============================================================
-- 6. Create blackout_periods table
-- ==============================================================
CREATE TABLE "blackout_periods" (
    "id"          TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "startDate"   TIMESTAMP(3) NOT NULL,
    "endDate"     TIMESTAMP(3) NOT NULL,
    "reason"      TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "blackout_periods_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "blackout_periods"
    ADD CONSTRAINT "blackout_periods_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "blackout_periods_workspaceId_startDate_endDate_idx"
    ON "blackout_periods"("workspaceId", "startDate", "endDate");

-- ==============================================================
-- 7. Create pending_appointments table
-- ==============================================================
CREATE TABLE "pending_appointments" (
    "id"                   TEXT NOT NULL,
    "workspaceId"          TEXT NOT NULL,
    "customerId"           TEXT NOT NULL,
    "appointmentTypeId"    TEXT NOT NULL,
    "requestedStartTime"   TIMESTAMP(3) NOT NULL,
    "requestedEndTime"     TIMESTAMP(3) NOT NULL,
    "customerNotes"        TEXT,
    "adminNotes"           TEXT,
    "status"               TEXT NOT NULL DEFAULT 'pending',
    "syncedEventId"        TEXT,
    "syncedAt"             TIMESTAMP(3),
    "rejectedAt"           TIMESTAMP(3),
    "rejectionReason"      TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pending_appointments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "pending_appointments"
    ADD CONSTRAINT "pending_appointments_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pending_appointments"
    ADD CONSTRAINT "pending_appointments_appointmentTypeId_fkey"
    FOREIGN KEY ("appointmentTypeId") REFERENCES "appointment_types"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "pending_appointments_workspaceId_status_idx"
    ON "pending_appointments"("workspaceId", "status");

CREATE INDEX "pending_appointments_customerId_idx"
    ON "pending_appointments"("customerId");

-- ==============================================================
-- 8. Create reminder_locks table
-- ==============================================================
CREATE TABLE "reminder_locks" (
    "id"             TEXT NOT NULL,
    "workspaceId"    TEXT NOT NULL,
    "appointmentId"  TEXT NOT NULL,
    "googleEventId"  TEXT,
    "reminderType"   TEXT NOT NULL,
    "lockKey"        TEXT NOT NULL,
    "sentAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reminder_locks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "reminder_locks"
    ADD CONSTRAINT "reminder_locks_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "reminder_locks_lockKey_key"
    ON "reminder_locks"("lockKey");

CREATE UNIQUE INDEX "reminder_locks_appointmentId_reminderType_key"
    ON "reminder_locks"("appointmentId", "reminderType");

CREATE INDEX "reminder_locks_expiresAt_idx"
    ON "reminder_locks"("expiresAt");

-- ==============================================================
-- 9. Create late_cancellation_attempts table
-- ==============================================================
CREATE TABLE "late_cancellation_attempts" (
    "id"                  TEXT NOT NULL,
    "workspaceId"         TEXT NOT NULL,
    "customerId"          TEXT NOT NULL,
    "appointmentTypeId"   TEXT NOT NULL,
    "googleEventId"       TEXT,
    "scheduledStartTime"  TIMESTAMP(3) NOT NULL,
    "attemptedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tooLateThreshold"    INTEGER NOT NULL,
    CONSTRAINT "late_cancellation_attempts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "late_cancellation_attempts"
    ADD CONSTRAINT "late_cancellation_attempts_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "late_cancellation_attempts"
    ADD CONSTRAINT "late_cancellation_attempts_appointmentTypeId_fkey"
    FOREIGN KEY ("appointmentTypeId") REFERENCES "appointment_types"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "late_cancellation_attempts_workspaceId_customerId_idx"
    ON "late_cancellation_attempts"("workspaceId", "customerId");

CREATE INDEX "late_cancellation_attempts_attemptedAt_idx"
    ON "late_cancellation_attempts"("attemptedAt");

-- ==============================================================
-- 10. Create appointment_gdpr_logs table
-- ==============================================================
CREATE TABLE "appointment_gdpr_logs" (
    "id"           TEXT NOT NULL,
    "workspaceId"  TEXT NOT NULL,
    "customerId"   TEXT NOT NULL,
    "googleEventId" TEXT,
    "deletedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedBy"    TEXT NOT NULL DEFAULT 'customer',
    "reason"       TEXT,
    CONSTRAINT "appointment_gdpr_logs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "appointment_gdpr_logs"
    ADD CONSTRAINT "appointment_gdpr_logs_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "appointment_gdpr_logs_workspaceId_customerId_idx"
    ON "appointment_gdpr_logs"("workspaceId", "customerId");

CREATE INDEX "appointment_gdpr_logs_deletedAt_idx"
    ON "appointment_gdpr_logs"("deletedAt");
