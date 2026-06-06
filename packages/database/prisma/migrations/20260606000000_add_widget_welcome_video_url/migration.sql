-- Add optional welcome video URL for the chat widget (YouTube/Vimeo/.mp4)
-- Shown when the widget opens. Nullable, no default (DB-first: empty = no video).
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "widgetWelcomeVideoUrl" TEXT;
