-- Add the demo-request answer captured by the survey's closing step.
-- "yes" means the lead wants demo access credentials emailed to them.
ALTER TABLE "OnboardingQuestionnaire" ADD COLUMN "stepDemo" TEXT;
