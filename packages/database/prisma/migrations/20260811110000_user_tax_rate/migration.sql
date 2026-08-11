-- Per-user VAT rate (Feature: unified tax handling).
--
-- Until now the rate lived in three inconsistent places: 22% hardcoded in
-- invoice.service, 21% hardcoded in the frontend Plans card, and 0% in the
-- monthly billing job. The single source of truth becomes users."taxRate";
-- every calculation reads it from there. Default 0.22 matches the rate all
-- existing invoices were computed with.
--
-- IF NOT EXISTS: the column is applied to production ahead of the deploy via
-- direct SQL, so this migration must be idempotent when migrate deploy runs.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0.22;
