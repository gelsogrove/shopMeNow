-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "monthly_invoices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "subscriptionAmount" DECIMAL(10,2) NOT NULL,
    "creditUsage" DECIMAL(10,2) NOT NULL,
    "creditDebt" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "paidAt" TIMESTAMP(3),
    "paypalTransactionId" TEXT,
    "planType" "PlanType" NOT NULL,
    "itemsBreakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monthly_invoices_userId_idx" ON "monthly_invoices"("userId");

-- CreateIndex
CREATE INDEX "monthly_invoices_status_idx" ON "monthly_invoices"("status");

-- CreateIndex
CREATE INDEX "monthly_invoices_periodYear_periodMonth_idx" ON "monthly_invoices"("periodYear", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_invoices_userId_periodYear_periodMonth_key" ON "monthly_invoices"("userId", "periodYear", "periodMonth");

-- AddForeignKey
ALTER TABLE "monthly_invoices" ADD CONSTRAINT "monthly_invoices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
