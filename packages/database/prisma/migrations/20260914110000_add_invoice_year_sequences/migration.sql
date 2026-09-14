-- Invoice numbering sequence table.
--
-- invoice.service.ts → nextInvoiceSequence() has always written to
-- invoice_year_sequences, but no migration ever created it: every call to
-- ensureInvoiceNumber() raised "relation does not exist". Because the
-- month-end run numbers the invoice BEFORE charging it, and the per-owner
-- try/catch swallowed the error, the whole billing run produced zero
-- invoices and zero charges — silently (Andrea, 2026-09-14).
--
-- Not a Prisma model on purpose: the counter is bumped with a raw
-- UPDATE ... RETURNING inside the same transaction that assigns the number,
-- which is what makes concurrent numbering gap-free.

CREATE TABLE IF NOT EXISTS "invoice_year_sequences" (
  "year"       INTEGER NOT NULL,
  "last_value" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "invoice_year_sequences_pkey" PRIMARY KEY ("year")
);

-- Backfill from invoices already numbered in the YYYY-NNNN format this code
-- emits, so numbering resumes after the highest existing number instead of
-- restarting at 1 and colliding with the unique index on "invoiceNumber".
-- Legacy demo/seed numbers (YYYYMMDD-NNNN) do not match and are ignored.
INSERT INTO "invoice_year_sequences" ("year", "last_value")
SELECT
  CAST(SUBSTRING("invoiceNumber" FROM 1 FOR 4) AS INTEGER) AS year,
  MAX(CAST(SUBSTRING("invoiceNumber" FROM 6 FOR 4) AS INTEGER)) AS last_value
FROM "monthly_invoices"
WHERE "invoiceNumber" ~ '^\d{4}-\d{4}$'
GROUP BY 1
ON CONFLICT ("year") DO UPDATE
  SET "last_value" = GREATEST(
    "invoice_year_sequences"."last_value",
    EXCLUDED."last_value"
  );
