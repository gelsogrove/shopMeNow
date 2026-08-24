-- Presentation video for customer copy: referenced as {{videoUrl}} in
-- welcomeMessage and friends, so the link lives in one editable field
-- instead of being pasted into the text (and duplicated).
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "videoUrl" TEXT;
