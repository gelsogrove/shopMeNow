-- Add widget text color (used by widget theme)
ALTER TABLE "Workspace"
ADD COLUMN IF NOT EXISTS "widgetTextColor" TEXT DEFAULT '#0f172a';
