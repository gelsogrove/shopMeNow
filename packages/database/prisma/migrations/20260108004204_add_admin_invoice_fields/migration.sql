-- AlterTable
ALTER TABLE "monthly_invoices" ADD COLUMN     "adminMarkedAt" TIMESTAMP(3),
ADD COLUMN     "adminMarkedById" TEXT,
ADD COLUMN     "adminNotes" TEXT;
