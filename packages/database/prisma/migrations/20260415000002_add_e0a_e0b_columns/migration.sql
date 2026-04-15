-- Add missing columns to Workspace table
-- Feature E0a: Welcome Message Toggle
-- Feature E0b: Session Reset Timeout

ALTER TABLE "Workspace" ADD COLUMN "enableWelcomeMessage" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Workspace" ADD COLUMN "sessionResetTimeout" INTEGER NOT NULL DEFAULT 3600;
