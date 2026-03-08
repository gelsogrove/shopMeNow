-- AlterTable: add stepReminders column to onboarding_questionnaires
ALTER TABLE "onboarding_questionnaires" ADD COLUMN IF NOT EXISTS "stepReminders" TEXT;
