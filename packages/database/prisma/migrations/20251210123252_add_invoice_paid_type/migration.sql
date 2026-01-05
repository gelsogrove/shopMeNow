-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'INVOICE_PAID';

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "logoUrl" TEXT;
