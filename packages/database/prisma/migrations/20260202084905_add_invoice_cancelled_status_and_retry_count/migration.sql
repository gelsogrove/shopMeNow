-- AlterTable
ALTER TABLE "monthly_invoices" ADD COLUMN     "paymentRetryCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "whatsapp_settings" ADD COLUMN     "businessAccountId" TEXT;
