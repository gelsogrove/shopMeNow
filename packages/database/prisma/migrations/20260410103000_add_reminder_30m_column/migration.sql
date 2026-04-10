-- Add missing reminder30mSentAt column to appointments
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "reminder30mSentAt" TIMESTAMP(3);
