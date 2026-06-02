-- 📺 Fix: replace the non-embeddable welcome video with an embeddable one.
--
-- The previous placeholder (F0dmzlSYMeY) had embedding DISABLED by its owner,
-- so the in-app iframe player showed "This content is blocked". We switch to
-- Big Buck Bunny (aqz-KE-bpKQ, Creative Commons, embeddable) so the demo plays
-- in-app. Replace it with the real company video (which should allow embedding)
-- per workspace whenever it's ready.
--
-- Only overwrites the known non-embeddable placeholder, so any workspace that
-- already has a real custom video is left untouched.

UPDATE "Workspace"
SET "welcomeVideoUrl" = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'
WHERE "welcomeVideoUrl" = 'https://www.youtube.com/watch?v=F0dmzlSYMeY';
