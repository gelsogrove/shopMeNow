-- Tourism stay profile + end-of-stay feedback on the customer record.
-- Used by custom-demosappada: the assistant collects who is on holiday and
-- until when, so every turn can compute the days remaining and concentrate
-- the suggestions into the time actually left.
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "stayProfile" JSONB;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "feedbackRating" INTEGER;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "feedbackComment" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "feedbackAt" TIMESTAMP(3);
