-- Daily send window per campaign (Andrea, 2026-09-01: "dalle 8 alle 19 di
-- default"): hours in the workspace's timezone; the scheduler postpones runs
-- outside the window. Idempotent: may be applied by hand before the
-- release-phase `prisma migrate deploy` runs the same file.
ALTER TABLE "push_campaigns"
    ADD COLUMN IF NOT EXISTS "sendWindowStart" INTEGER NOT NULL DEFAULT 8,
    ADD COLUMN IF NOT EXISTS "sendWindowEnd" INTEGER NOT NULL DEFAULT 19;
