-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "enableWelcomeMessage" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Workspace" ADD COLUMN "sessionResetTimeout" INTEGER NOT NULL DEFAULT 3600;
