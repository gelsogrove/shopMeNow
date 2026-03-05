-- Update OnboardingQuestionnaire for v2 questionnaire redesign
-- Make v1 fields nullable (backward compat), add new v2 fields

-- Make v1 contact fields nullable
ALTER TABLE "onboarding_questionnaires" ALTER COLUMN "fullName" DROP NOT NULL;
ALTER TABLE "onboarding_questionnaires" ALTER COLUMN "email" DROP NOT NULL;

-- Make v1 step fields nullable
ALTER TABLE "onboarding_questionnaires" ALTER COLUMN "stepChannel" DROP NOT NULL;
ALTER TABLE "onboarding_questionnaires" ALTER COLUMN "stepTimeSaving" DROP NOT NULL;
ALTER TABLE "onboarding_questionnaires" ALTER COLUMN "stepEcommerce" DROP NOT NULL;
ALTER TABLE "onboarding_questionnaires" ALTER COLUMN "stepDocuments" DROP NOT NULL;
ALTER TABLE "onboarding_questionnaires" ALTER COLUMN "stepIntegration" DROP NOT NULL;
ALTER TABLE "onboarding_questionnaires" ALTER COLUMN "stepHandoff" DROP NOT NULL;
ALTER TABLE "onboarding_questionnaires" ALTER COLUMN "stepMarketing" DROP NOT NULL;

-- Add v2 step fields
ALTER TABLE "onboarding_questionnaires" ADD COLUMN "stepHumanSupport" TEXT;
ALTER TABLE "onboarding_questionnaires" ADD COLUMN "stepPushMarketing" TEXT;
ALTER TABLE "onboarding_questionnaires" ADD COLUMN "stepWidget" TEXT;
ALTER TABLE "onboarding_questionnaires" ADD COLUMN "stepSalesAgents" TEXT;
ALTER TABLE "onboarding_questionnaires" ADD COLUMN "stepEcommercePlatform" TEXT;
ALTER TABLE "onboarding_questionnaires" ADD COLUMN "stepPrivacy" TEXT;
ALTER TABLE "onboarding_questionnaires" ADD COLUMN "stepHelpful" TEXT;
ALTER TABLE "onboarding_questionnaires" ADD COLUMN "stepOther" TEXT;
ALTER TABLE "onboarding_questionnaires" ADD COLUMN "wantsContact" BOOLEAN NOT NULL DEFAULT false;
