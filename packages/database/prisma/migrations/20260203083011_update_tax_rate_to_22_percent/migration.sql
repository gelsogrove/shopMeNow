-- AlterTable
ALTER TABLE "monthly_invoices" ALTER COLUMN "taxRate" SET DEFAULT 0.22;

-- Update existing invoices with 21% to 22%
UPDATE "monthly_invoices" SET "taxRate" = 0.22 WHERE "taxRate" = 0.21;
