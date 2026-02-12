-- Add widget auto-suggestions fields
ALTER TABLE "Workspace"
ADD COLUMN IF NOT EXISTS "widgetAutoSuggestionsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "widgetQuickReplies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
