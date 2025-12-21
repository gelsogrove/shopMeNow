-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "postRegistrationPendingMessage" JSONB,
ADD COLUMN     "registrationPromptMessage" JSONB,
ADD COLUMN     "userActivatedMessage" JSONB;
