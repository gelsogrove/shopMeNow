-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "defaultLanguage" TEXT NOT NULL DEFAULT 'it';

-- AlterTable
ALTER TABLE "monthly_invoices" ALTER COLUMN "taxRate" SET DEFAULT 0.21;
