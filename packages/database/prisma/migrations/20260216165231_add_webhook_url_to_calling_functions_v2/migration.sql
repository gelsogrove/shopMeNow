/*
  Warnings:

  - The `frequency` column on the `PushCampaign` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `targetingType` column on the `PushCampaign` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `Campaign` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CampaignSent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CustomerFeedback` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Campaign" DROP CONSTRAINT "Campaign_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "CampaignSent" DROP CONSTRAINT "CampaignSent_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "CampaignSent" DROP CONSTRAINT "CampaignSent_customerId_fkey";

-- DropForeignKey
ALTER TABLE "CustomerFeedback" DROP CONSTRAINT "CustomerFeedback_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "CustomerFeedback" DROP CONSTRAINT "CustomerFeedback_customerId_fkey";

-- DropForeignKey
ALTER TABLE "CustomerFeedback" DROP CONSTRAINT "CustomerFeedback_workspaceId_fkey";

-- DropIndex
DROP INDEX "PushCampaignRecipient_campaignId_phone_key";

-- AlterTable
ALTER TABLE "PushCampaign" DROP COLUMN "frequency",
ADD COLUMN     "frequency" "CampaignFrequency" NOT NULL DEFAULT 'ONCE',
DROP COLUMN "targetingType",
ADD COLUMN     "targetingType" "CampaignTargetType" NOT NULL DEFAULT 'ALL';

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "webhookSecret" TEXT,
ADD COLUMN     "webhookTimeout" INTEGER DEFAULT 10000,
ALTER COLUMN "debugMode" SET DEFAULT false;

-- AlterTable
ALTER TABLE "whatsapp_queue" ADD COLUMN     "skipSecurityCheck" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "workspace_calling_functions" ADD COLUMN     "executionType" TEXT NOT NULL DEFAULT 'WEBHOOK',
ADD COLUMN     "isSystemFunction" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "parameters" JSONB,
ADD COLUMN     "responseInstructions" TEXT,
ADD COLUMN     "webhookUrl" TEXT;

-- DropTable
DROP TABLE "Campaign";

-- DropTable
DROP TABLE "CampaignSent";

-- DropTable
DROP TABLE "CustomerFeedback";

-- CreateIndex
CREATE INDEX "PushCampaign_nextRunAt_idx" ON "PushCampaign"("nextRunAt");
