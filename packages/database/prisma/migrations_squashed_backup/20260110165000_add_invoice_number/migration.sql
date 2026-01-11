ALTER TABLE "monthly_invoices" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;

UPDATE "monthly_invoices"
SET "invoiceNumber" =
  'INV-' || "periodYear" || '-' || LPAD("periodMonth"::text, 2, '0') || '-' || SUBSTRING("id", 1, 8)
WHERE "invoiceNumber" IS NULL OR "invoiceNumber" = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'monthly_invoices_invoiceNumber_key'
  ) THEN
    CREATE UNIQUE INDEX "monthly_invoices_invoiceNumber_key" ON "monthly_invoices"("invoiceNumber");
  END IF;
END $$;
