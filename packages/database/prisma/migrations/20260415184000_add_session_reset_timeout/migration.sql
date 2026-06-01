-- Add sessionResetTimeout column (E0b)
-- Note: enableWelcomeMessage was already added in previous partial migration
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "sessionResetTimeout" INTEGER NOT NULL DEFAULT 3600;
