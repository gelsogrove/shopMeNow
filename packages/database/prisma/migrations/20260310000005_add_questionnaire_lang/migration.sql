-- AddColumn lang to onboarding_questionnaires
ALTER TABLE "onboarding_questionnaires" ADD COLUMN IF NOT EXISTS "lang" TEXT;
