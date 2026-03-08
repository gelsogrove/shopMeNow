-- Add missing v2 questionnaire columns: stepIntegrations and stepInterest
-- These were in the Prisma schema but accidentally omitted from the v2 migration

ALTER TABLE "onboarding_questionnaires" ADD COLUMN IF NOT EXISTS "stepIntegrations" TEXT;
ALTER TABLE "onboarding_questionnaires" ADD COLUMN IF NOT EXISTS "stepInterest" TEXT;
