-- CreateEnum
CREATE TYPE "PayPalStatus" AS ENUM ('DISCONNECTED', 'CONNECTED');

-- CreateEnum
CREATE TYPE "PayPalTransactionStatus" AS ENUM ('SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "paypalClientId" TEXT,
ADD COLUMN     "paypalConnectedAt" TIMESTAMP(3),
ADD COLUMN     "paypalEmail" TEXT,
ADD COLUMN     "paypalEnvironment" TEXT,
ADD COLUMN     "paypalMerchantId" TEXT,
ADD COLUMN     "paypalStatus" "PayPalStatus" NOT NULL DEFAULT 'DISCONNECTED';

-- CreateTable
CREATE TABLE "paypal_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "PayPalTransactionStatus" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminUserId" TEXT,

    CONSTRAINT "paypal_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "paypal_transactions_userId_idx" ON "paypal_transactions"("userId");

-- CreateIndex
CREATE INDEX "paypal_transactions_invoiceId_idx" ON "paypal_transactions"("invoiceId");

-- CreateIndex
CREATE INDEX "paypal_transactions_status_idx" ON "paypal_transactions"("status");

-- CreateIndex
CREATE INDEX "paypal_transactions_createdAt_idx" ON "paypal_transactions"("createdAt");

-- AddForeignKey
ALTER TABLE "paypal_transactions" ADD CONSTRAINT "paypal_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paypal_transactions" ADD CONSTRAINT "paypal_transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "monthly_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paypal_transactions" ADD CONSTRAINT "paypal_transactions_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
