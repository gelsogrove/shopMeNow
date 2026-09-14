-- End-of-stay feedback (Andrea, 2026-09-14).
--
-- 1. ON_STAY_END: a campaign whose date belongs to each GUEST (their
--    departure), not to the campaign. Run by its own job, never by the
--    generic "is this campaign due?" runner.
-- 2. stayKey + unique index: the guarantee that a guest is asked ONCE per
--    holiday, and asked AGAIN for the next one. Keying dedup on the customer
--    would silence every later stay.
-- 3. customer_feedback: one row per stay instead of three columns that the
--    next holiday overwrote.

ALTER TYPE "CampaignFrequency" ADD VALUE IF NOT EXISTS 'ON_STAY_END';

ALTER TABLE "push_campaigns"
  ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "stayEndSendHour" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "stayEndDelayDays" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "push_campaign_recipients"
  ADD COLUMN IF NOT EXISTS "stayKey" TEXT;

-- Postgres treats NULLs as distinct, so ordinary campaigns (stayKey NULL) are
-- unaffected by this constraint; only ON_STAY_END rows are deduplicated.
CREATE UNIQUE INDEX IF NOT EXISTS "push_campaign_recipients_campaignId_customerId_stayKey_key"
  ON "push_campaign_recipients"("campaignId", "customerId", "stayKey");

CREATE TABLE IF NOT EXISTS "customer_feedback" (
  "id"            TEXT NOT NULL,
  "workspaceId"   TEXT NOT NULL,
  "customerId"    TEXT NOT NULL,
  "rating"        INTEGER,
  "comment"       TEXT,
  "stayKey"       TEXT,
  "arrivalDate"   TEXT,
  "departureDate" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "customer_feedback_customerId_stayKey_key"
  ON "customer_feedback"("customerId", "stayKey");
CREATE INDEX IF NOT EXISTS "customer_feedback_workspaceId_createdAt_idx"
  ON "customer_feedback"("workspaceId", "createdAt");

ALTER TABLE "customer_feedback"
  ADD CONSTRAINT "customer_feedback_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_feedback"
  ADD CONSTRAINT "customer_feedback_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
