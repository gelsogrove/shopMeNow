-- 📺 Welcome presentation video.
-- A YouTube (or .mp4) URL shown ONLY on the first welcome message of a chat.
-- Nullable; backfilled for existing workspaces with the current demo video so
-- the feature is visible out of the box. New workspaces default to NULL and an
-- admin sets the value per workspace.

-- AddColumn
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "welcomeVideoUrl" TEXT;

-- Backfill existing workspaces with the demo presentation video (only where unset).
UPDATE "Workspace"
SET "welcomeVideoUrl" = 'https://www.youtube.com/watch?v=F0dmzlSYMeY'
WHERE "welcomeVideoUrl" IS NULL;
