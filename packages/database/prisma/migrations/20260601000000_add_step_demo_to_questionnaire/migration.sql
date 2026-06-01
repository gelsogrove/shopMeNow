-- Add the demo-request answer captured by the survey's closing step.
-- "yes" means the lead wants demo access credentials emailed to them.
-- Table is @@map("onboarding_questionnaires") in the Prisma schema.
ALTER TABLE "onboarding_questionnaires" ADD COLUMN IF NOT EXISTS "stepDemo" TEXT;
