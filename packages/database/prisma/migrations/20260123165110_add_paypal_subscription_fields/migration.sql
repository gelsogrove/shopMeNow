-- AlterTable
ALTER TABLE "users" ADD COLUMN     "paypalCyclesCompleted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paypalFailedPaymentsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paypalLastPaymentTime" TIMESTAMP(3),
ADD COLUMN     "paypalNextBillingTime" TIMESTAMP(3),
ADD COLUMN     "paypalOutstandingBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paypalPlanId" TEXT,
ADD COLUMN     "paypalSubscriptionApprovedAt" TIMESTAMP(3),
ADD COLUMN     "paypalSubscriptionId" TEXT,
ADD COLUMN     "paypalSubscriptionStatus" TEXT;
