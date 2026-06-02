-- 📺 Per-laundromat welcome videos (and fix the non-embeddable placeholder).
--
-- DemoWash and Ecolaundry are DIFFERENT tenants, so they get DIFFERENT videos.
-- The previous placeholder (F0dmzlSYMeY) also had embedding DISABLED by its
-- owner ("This content is blocked" in the in-app player), so we replace it with
-- KNOWN-EMBEDDABLE placeholders. These are demo stand-ins — each laundromat
-- should set its own real presentation video in workspace.welcomeVideoUrl.
--
-- Only rewrites rows that still hold the non-embeddable placeholder, so any
-- workspace that already has a real custom video is left untouched.

-- DemoWash → Big Buck Bunny (Blender, Creative Commons, embeddable)
UPDATE "Workspace"
SET "welcomeVideoUrl" = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'
WHERE "customChatbotId" = 'demowash'
  AND "welcomeVideoUrl" = 'https://www.youtube.com/watch?v=F0dmzlSYMeY';

-- Ecolaundry → a different embeddable placeholder
UPDATE "Workspace"
SET "welcomeVideoUrl" = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
WHERE "customChatbotId" = 'ecolaundry'
  AND "welcomeVideoUrl" = 'https://www.youtube.com/watch?v=F0dmzlSYMeY';

-- Any OTHER workspace still on the non-embeddable placeholder → Big Buck Bunny.
UPDATE "Workspace"
SET "welcomeVideoUrl" = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'
WHERE "welcomeVideoUrl" = 'https://www.youtube.com/watch?v=F0dmzlSYMeY';
