-- Add enableWelcomeMessage column to Workspace table (Feature E0a - Welcome Message Toggle)
ALTER TABLE "Workspace" ADD COLUMN "enableWelcomeMessage" BOOLEAN NOT NULL DEFAULT true;
