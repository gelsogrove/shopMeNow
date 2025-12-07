-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSE_PENDING', 'PAUSED', 'PAYMENT_FAILED');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "lastPaymentFailedAt" TIMESTAMP(3),
ADD COLUMN     "pauseRequestedAt" TIMESTAMP(3),
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "paymentFailureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pendingPlanEffectiveDate" TIMESTAMP(3),
ADD COLUMN     "pendingPlanType" "PlanType",
ADD COLUMN     "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE';
