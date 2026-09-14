-- Throttle column for the trial-expiry warning.
--
-- Until now nothing warned an owner that the free trial was about to end:
-- the trial simply lapsed and the chatbot went silent, for them and for
-- their customers, with no email at all (Andrea, 2026-09-14).
--
-- The daily job runs every morning, so it needs to remember that it already
-- warned this owner — same role lowBalanceNotifiedAt plays for the
-- low-credit alert. NULL means "never warned".

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trialExpiringNotifiedAt" TIMESTAMP(3);
