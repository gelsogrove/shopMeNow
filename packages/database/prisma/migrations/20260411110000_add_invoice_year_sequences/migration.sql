-- Migration: Add invoice_year_sequences table for year-based invoice numbering
--
-- Format: 2026-0001, 2026-0002 ... 2027-0001 (resets each year)
--
-- Using a dedicated table instead of a PostgreSQL sequence allows:
-- - Per-year reset (SELECT FOR UPDATE ensures no gaps/duplicates under concurrent load)
-- - Audit trail of last assigned number per year

CREATE TABLE IF NOT EXISTS "invoice_year_sequences" (
  "year"       INTEGER NOT NULL,
  "last_value" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "invoice_year_sequences_pkey" PRIMARY KEY ("year")
);
