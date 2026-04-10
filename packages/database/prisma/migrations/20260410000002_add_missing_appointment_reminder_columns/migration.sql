-- Migration: Add missing appointment reminder columns to Workspace
-- Purpose: Fix schema mismatch - these columns are in Prisma schema but missing from database
-- Affects: Workspace table (Appointment Reminders feature)

-- Add missing appointment reminder configuration columns
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "appointmentReminder24hEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "appointmentReminder24hMessage" TEXT DEFAULT 'Hi {{customerName}}, reminder: your {{appointmentType}} appointment is tomorrow {{appointmentDate}} at {{appointmentTime}}. Confirm your presence?';
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "appointmentReminder1hEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "appointmentReminder1hMessage" TEXT DEFAULT 'Hi {{customerName}}, your {{appointmentType}} appointment starts in 1 hour at {{appointmentTime}}. See you soon!';
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "appointmentReminder30mEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "appointmentReminder30mMessage" TEXT DEFAULT 'Hi {{customerName}}, your {{appointmentType}} appointment starts in 30 minutes at {{appointmentTime}}. We''re waiting for you!';
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "appointmentReminderChannel" TEXT NOT NULL DEFAULT 'whatsapp';
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'Europe/Rome';
