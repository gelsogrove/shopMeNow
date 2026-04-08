-- Migration: add_appointments_and_calendar_flag
-- Created: 2026-04-08
-- Description:
--   1. Add enableCalendarBooking flag to workspaces table
--   2. Create confirmed appointments table (source of truth for billing/reminders)
--
-- Run with: npx prisma migrate deploy (from packages/database)

-- ==============================================================
-- 1. Add enableCalendarBooking to workspaces
-- ==============================================================
ALTER TABLE "workspaces" ADD COLUMN "enableCalendarBooking" BOOLEAN NOT NULL DEFAULT false;

-- ==============================================================
-- 2. Create appointments table (confirmed bookings)
-- ==============================================================
CREATE TABLE "appointments" (
    "id"                    TEXT NOT NULL,
    "workspaceId"           TEXT NOT NULL,
    "customerId"            TEXT NOT NULL,
    "appointmentTypeId"     TEXT NOT NULL,

    -- Timing (UTC)
    "startTime"             TIMESTAMP(3) NOT NULL,
    "endTime"               TIMESTAMP(3) NOT NULL,
    "timezone"              TEXT NOT NULL DEFAULT 'Europe/Rome',

    -- Google Calendar sync
    "googleEventId"         TEXT,
    "googleEventLink"       TEXT,
    "googleCalendarId"      TEXT,

    -- Status
    "status"                TEXT NOT NULL DEFAULT 'confirmed',
    "cancelledAt"           TIMESTAMP(3),
    "cancellationReason"    TEXT,
    "cancelledBy"           TEXT,

    -- Customer snapshot (preserved even if customer is deleted)
    "customerName"          TEXT,
    "customerPhone"         TEXT,
    "customerEmail"         TEXT,
    "customerNotes"         TEXT,
    "adminNotes"            TEXT,

    -- Booking channel (determines reminder channel)
    "bookedVia"             TEXT NOT NULL DEFAULT 'whatsapp',

    -- Reminder tracking
    "reminder24hSentAt"     TIMESTAMP(3),
    "reminder1hSentAt"      TIMESTAMP(3),
    "reminderChannel"       TEXT,

    -- Billing
    "reminderBilledAt"      TIMESTAMP(3),
    "reminderBillingTotal"  DECIMAL(10,2) DEFAULT 0,

    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- ==============================================================
-- 3. Foreign keys on appointments
-- ==============================================================
ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_workspaceId_fkey"
    FOREIGN KEY ("workspaceId")
    REFERENCES "workspaces"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_customerId_fkey"
    FOREIGN KEY ("customerId")
    REFERENCES "customers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_appointmentTypeId_fkey"
    FOREIGN KEY ("appointmentTypeId")
    REFERENCES "appointment_types"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==============================================================
-- 4. Indexes for performance
-- ==============================================================
CREATE INDEX "appointments_workspaceId_status_idx"
    ON "appointments"("workspaceId", "status");

CREATE INDEX "appointments_workspaceId_startTime_idx"
    ON "appointments"("workspaceId", "startTime");

CREATE INDEX "appointments_customerId_status_idx"
    ON "appointments"("customerId", "status");

-- Google event ID deduplication (UNIQUE allows NULL for non-synced appointments)
CREATE UNIQUE INDEX "appointments_googleEventId_key"
    ON "appointments"("googleEventId")
    WHERE "googleEventId" IS NOT NULL;

CREATE INDEX "appointments_startTime_idx"
    ON "appointments"("startTime");

-- ==============================================================
-- 5. Auto-update updatedAt trigger (PostgreSQL)
-- ==============================================================
CREATE OR REPLACE FUNCTION update_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW."updatedAt" = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appointments_updated_at
    BEFORE UPDATE ON "appointments"
    FOR EACH ROW
    EXECUTE FUNCTION update_appointments_updated_at();
