-- Re-alignment migration.
--
-- Background: on 2026-07-31 production returned 500 on GET /api/v1/workspaces and
-- /workspaces/badge-stats because `Workspace.escalationTrigger` and `Workspace.flowsEnabled`
-- were declared in schema.prisma but absent from the database. Prisma selects every declared
-- scalar on `workspace.findMany()`, so both endpoints failed on the missing columns.
--
-- The columns originate from 20260731150000_add_multi_operator_and_faq_toggle, which was
-- recorded in _prisma_migrations as applied (finished_at set, no rolled_back_at) while some of
-- its columns never landed. Because Prisma considers that migration done, `migrate deploy`
-- skips it permanently — no amount of redeploying could ever repair the drift.
--
-- Production was fixed by executing the DDL directly, which leaves the migration history
-- unaware of the repair. This migration exists so that a fresh database, a reset, or any new
-- environment converges to the same schema instead of reproducing the outage.
--
-- Every statement is idempotent (ADD COLUMN IF NOT EXISTS), so applying this against the
-- already-repaired production database is a no-op. Defaults match the original migration.

-- Master switch for flow retrieval. Defaults to true so existing workspaces keep the
-- behaviour they have today.
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "flowsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Master switch for the FAQ block injected into the chatbot prompt.
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "faqsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Customer-facing sentence explaining how to reach a human operator.
-- Injectable into any prompt or message via {{escalationTrigger}}.
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "escalationTrigger" TEXT;
