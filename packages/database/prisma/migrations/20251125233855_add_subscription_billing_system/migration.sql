-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE_TRIAL', 'BASIC', 'PREMIUM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('MESSAGE', 'NEW_ORDER', 'PUSH_NOTIFICATION', 'RECHARGE', 'MONTHLY_FEE', 'UPGRADE_FEE', 'ADJUSTMENT', 'INITIAL_CREDIT');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "creditBalance" DECIMAL(10,2) NOT NULL DEFAULT 29.00,
ADD COLUMN     "lowBalanceNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "nextBillingDate" TIMESTAMP(3),
ADD COLUMN     "planStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "planType" "PlanType" NOT NULL DEFAULT 'FREE_TRIAL',
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "billing_transactions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "balanceAfter" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_configurations" (
    "id" TEXT NOT NULL,
    "planType" "PlanType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "monthlyFee" DECIMAL(10,2) NOT NULL,
    "maxChannels" INTEGER NOT NULL,
    "maxProducts" INTEGER NOT NULL,
    "maxCustomers" INTEGER NOT NULL,
    "messageCost" DECIMAL(10,2) NOT NULL,
    "orderCost" DECIMAL(10,2) NOT NULL,
    "pushCost" DECIMAL(10,2) NOT NULL,
    "lowBalanceThreshold" DECIMAL(10,2) NOT NULL,
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "initialCredit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_transactions_workspaceId_idx" ON "billing_transactions"("workspaceId");

-- CreateIndex
CREATE INDEX "billing_transactions_type_idx" ON "billing_transactions"("type");

-- CreateIndex
CREATE INDEX "billing_transactions_createdAt_idx" ON "billing_transactions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "plan_configurations_planType_key" ON "plan_configurations"("planType");

-- CreateIndex
CREATE INDEX "plan_configurations_planType_idx" ON "plan_configurations"("planType");

-- CreateIndex
CREATE INDEX "plan_configurations_isActive_idx" ON "plan_configurations"("isActive");

-- CreateIndex
CREATE INDEX "Workspace_planType_idx" ON "Workspace"("planType");

-- AddForeignKey
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
