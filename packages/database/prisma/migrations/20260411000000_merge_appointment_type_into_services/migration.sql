-- Migration: Merge AppointmentType into Services
-- AppointmentType is being removed. Services now has enableForBooking, bufferTime, color fields.
-- Appointment/PendingAppointment/LateCancellationAttempt FK changes: appointmentTypeId -> serviceId

-- Step 1: Add new columns to services table
ALTER TABLE "services" ADD COLUMN "enableForBooking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "services" ADD COLUMN "bufferTime" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "services" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#3b82f6';

-- Step 2: Migrate data from appointment_types to services
-- For each AppointmentType, create a corresponding Service with enableForBooking=true
INSERT INTO "services" ("id", "code", "name", "description", "price", "currency", "isActive", "workspaceId", "duration", "enableForBooking", "bufferTime", "color", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'booking-' || LOWER(REPLACE(REPLACE(at.name, ' ', '-'), '''', '')),
  at.name,
  COALESCE(at.description, at.name),
  COALESCE(at.price::float, 0),
  'EUR',
  at."isActive",
  at."workspaceId",
  at.duration,
  true,
  at."bufferTime",
  at.color,
  at."createdAt",
  at."updatedAt"
FROM "appointment_types" at
ON CONFLICT ("code") DO UPDATE SET
  "enableForBooking" = true,
  "bufferTime" = EXCLUDED."bufferTime",
  "color" = EXCLUDED.color,
  "duration" = EXCLUDED.duration;

-- Step 3: Add serviceId columns (nullable initially)
ALTER TABLE "appointments" ADD COLUMN "serviceId" TEXT;
ALTER TABLE "pending_appointments" ADD COLUMN "serviceId" TEXT;
ALTER TABLE "late_cancellation_attempts" ADD COLUMN "serviceId" TEXT;

-- Step 4: Populate serviceId from appointmentTypeId via name matching
UPDATE "appointments" a
SET "serviceId" = s.id
FROM "appointment_types" at, "services" s
WHERE a."appointmentTypeId" = at.id
  AND s.name = at.name
  AND s."workspaceId" = at."workspaceId"
  AND s."enableForBooking" = true;

UPDATE "pending_appointments" pa
SET "serviceId" = s.id
FROM "appointment_types" at, "services" s
WHERE pa."appointmentTypeId" = at.id
  AND s.name = at.name
  AND s."workspaceId" = at."workspaceId"
  AND s."enableForBooking" = true;

UPDATE "late_cancellation_attempts" lca
SET "serviceId" = s.id
FROM "appointment_types" at, "services" s
WHERE lca."appointmentTypeId" = at.id
  AND s.name = at.name
  AND s."workspaceId" = at."workspaceId"
  AND s."enableForBooking" = true;

-- Step 5: For any remaining NULL serviceId (orphans), set a default
-- This handles edge cases where name matching failed
-- We pick the first booking-enabled service in the same workspace
UPDATE "appointments" a
SET "serviceId" = (
  SELECT s.id FROM "services" s
  WHERE s."workspaceId" = a."workspaceId" AND s."enableForBooking" = true
  LIMIT 1
)
WHERE a."serviceId" IS NULL AND EXISTS (
  SELECT 1 FROM "services" s WHERE s."workspaceId" = a."workspaceId" AND s."enableForBooking" = true
);

UPDATE "pending_appointments" pa
SET "serviceId" = (
  SELECT s.id FROM "services" s
  WHERE s."workspaceId" = pa."workspaceId" AND s."enableForBooking" = true
  LIMIT 1
)
WHERE pa."serviceId" IS NULL AND EXISTS (
  SELECT 1 FROM "services" s WHERE s."workspaceId" = pa."workspaceId" AND s."enableForBooking" = true
);

UPDATE "late_cancellation_attempts" lca
SET "serviceId" = (
  SELECT s.id FROM "services" s
  WHERE s."workspaceId" = lca."workspaceId" AND s."enableForBooking" = true
  LIMIT 1
)
WHERE lca."serviceId" IS NULL AND EXISTS (
  SELECT 1 FROM "services" s WHERE s."workspaceId" = lca."workspaceId" AND s."enableForBooking" = true
);

-- Step 6: Delete any remaining orphan records that couldn't be migrated
DELETE FROM "late_cancellation_attempts" WHERE "serviceId" IS NULL;
DELETE FROM "pending_appointments" WHERE "serviceId" IS NULL;
DELETE FROM "appointments" WHERE "serviceId" IS NULL;

-- Step 7: Make serviceId NOT NULL and add FK constraints
ALTER TABLE "appointments" ALTER COLUMN "serviceId" SET NOT NULL;
ALTER TABLE "pending_appointments" ALTER COLUMN "serviceId" SET NOT NULL;
ALTER TABLE "late_cancellation_attempts" ALTER COLUMN "serviceId" SET NOT NULL;

ALTER TABLE "appointments" ADD CONSTRAINT "appointments_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pending_appointments" ADD CONSTRAINT "pending_appointments_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "late_cancellation_attempts" ADD CONSTRAINT "late_cancellation_attempts_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 8: Drop old FK constraints and columns
ALTER TABLE "appointments" DROP CONSTRAINT IF EXISTS "appointments_appointmentTypeId_fkey";
ALTER TABLE "pending_appointments" DROP CONSTRAINT IF EXISTS "pending_appointments_appointmentTypeId_fkey";
ALTER TABLE "late_cancellation_attempts" DROP CONSTRAINT IF EXISTS "late_cancellation_attempts_appointmentTypeId_fkey";

ALTER TABLE "appointments" DROP COLUMN "appointmentTypeId";
ALTER TABLE "pending_appointments" DROP COLUMN "appointmentTypeId";
ALTER TABLE "late_cancellation_attempts" DROP COLUMN "appointmentTypeId";

-- Step 9: Drop appointment_types table
DROP TABLE IF EXISTS "appointment_types";

-- Step 10: Create indexes
CREATE INDEX "services_workspaceId_enableForBooking_idx" ON "services"("workspaceId", "enableForBooking");
