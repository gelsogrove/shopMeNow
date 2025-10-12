-- CreateEnum
CREATE TYPE "public"."CampaignFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "public"."CampaignTargetType" AS ENUM ('ALL', 'SELECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."BillingType" ADD VALUE 'FEEDBACK';
ALTER TYPE "public"."BillingType" ADD VALUE 'ORDER_REVIEW';
ALTER TYPE "public"."BillingType" ADD VALUE 'CAMPAIGN_LINK';

-- CreateTable
CREATE TABLE "public"."Campaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "messagePreview" TEXT NOT NULL,
    "frequency" "public"."CampaignFrequency" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "targetType" "public"."CampaignTargetType" NOT NULL DEFAULT 'ALL',
    "customerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "templateName" TEXT,
    "templateParams" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CampaignSent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenUsed" TEXT,
    "clickedAt" TIMESTAMP(3),

    CONSTRAINT "CampaignSent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerFeedback" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Campaign_workspaceId_idx" ON "public"."Campaign"("workspaceId");

-- CreateIndex
CREATE INDEX "Campaign_isActive_idx" ON "public"."Campaign"("isActive");

-- CreateIndex
CREATE INDEX "Campaign_frequency_idx" ON "public"."Campaign"("frequency");

-- CreateIndex
CREATE INDEX "CampaignSent_campaignId_idx" ON "public"."CampaignSent"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignSent_customerId_idx" ON "public"."CampaignSent"("customerId");

-- CreateIndex
CREATE INDEX "CampaignSent_workspaceId_idx" ON "public"."CampaignSent"("workspaceId");

-- CreateIndex
CREATE INDEX "CampaignSent_sentAt_idx" ON "public"."CampaignSent"("sentAt");

-- CreateIndex
CREATE INDEX "CustomerFeedback_customerId_idx" ON "public"."CustomerFeedback"("customerId");

-- CreateIndex
CREATE INDEX "CustomerFeedback_workspaceId_idx" ON "public"."CustomerFeedback"("workspaceId");

-- CreateIndex
CREATE INDEX "CustomerFeedback_campaignId_idx" ON "public"."CustomerFeedback"("campaignId");

-- CreateIndex
CREATE INDEX "CustomerFeedback_createdAt_idx" ON "public"."CustomerFeedback"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."Campaign" ADD CONSTRAINT "Campaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CampaignSent" ADD CONSTRAINT "CampaignSent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CampaignSent" ADD CONSTRAINT "CampaignSent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerFeedback" ADD CONSTRAINT "CustomerFeedback_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerFeedback" ADD CONSTRAINT "CustomerFeedback_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
