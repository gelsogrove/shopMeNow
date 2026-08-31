-- Uploaded image for FREE-message campaigns (Andrea, 2026-09-01: "se è FREE
-- manca l'immagine"). Served publicly, attached by the queue processor as
-- media+caption. Idempotent for the release-phase migrate deploy.
ALTER TABLE "push_campaigns" ADD COLUMN IF NOT EXISTS "mediaBase64" TEXT;
