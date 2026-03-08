-- AlterTable: add stepIndustry and stepGoal columns to onboarding_questionnaires
ALTER TABLE "onboarding_questionnaires" ADD COLUMN IF NOT EXISTS "stepIndustry" TEXT;
ALTER TABLE "onboarding_questionnaires" ADD COLUMN IF NOT EXISTS "stepGoal" TEXT;
