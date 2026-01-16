-- Create enums
CREATE TYPE "PushCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "PushCampaignBillingStatus" AS ENUM ('PENDING', 'PARTIAL', 'BILLED', 'FAILED');
CREATE TYPE "PushCampaignChannel" AS ENUM ('WHATSAPP');
CREATE TYPE "PushCampaignRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- PushCampaign table
CREATE TABLE "PushCampaign" (
    "id" TEXT PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "name" TEXT NOT NULL,
    "status" "PushCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "channel" "PushCampaignChannel" NOT NULL DEFAULT 'WHATSAPP',
    "sendAt" TIMESTAMP(3),
    "templateId" TEXT,
    "templateLocale" TEXT,
    "bodyPreview" TEXT,
    "mediaUrl" TEXT,
    "expectedRecipients" INTEGER NOT NULL DEFAULT 0,
    "actualSent" INTEGER NOT NULL DEFAULT 0,
    "actualFailed" INTEGER NOT NULL DEFAULT 0,
    "actualSkipped" INTEGER NOT NULL DEFAULT 0,
    "costPerMessage" DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
    "billingStatus" "PushCampaignBillingStatus" NOT NULL DEFAULT 'PENDING',
    "throttlePerSecond" INTEGER NOT NULL DEFAULT 10,
    "batchSize" INTEGER NOT NULL DEFAULT 50,
    "lastError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- PushCampaignRecipient table
CREATE TABLE "PushCampaignRecipient" (
    "id" TEXT PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT,
    "phone" TEXT NOT NULL,
    "status" "PushCampaignRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "messageId" TEXT,
    "priceCharged" DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT FALSE,
    "isBlocked" BOOLEAN NOT NULL DEFAULT FALSE,
    "isFake" BOOLEAN NOT NULL DEFAULT FALSE,
    "optOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Foreign keys
ALTER TABLE "PushCampaign" ADD CONSTRAINT "PushCampaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushCampaign" ADD CONSTRAINT "PushCampaign_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PushCampaignRecipient" ADD CONSTRAINT "PushCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PushCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushCampaignRecipient" ADD CONSTRAINT "PushCampaignRecipient_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PushCampaignRecipient" ADD CONSTRAINT "PushCampaignRecipient_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "PushCampaign_workspaceId_idx" ON "PushCampaign"("workspaceId");
CREATE INDEX "PushCampaign_status_idx" ON "PushCampaign"("status");
CREATE INDEX "PushCampaign_sendAt_idx" ON "PushCampaign"("sendAt");

CREATE INDEX "PushCampaignRecipient_campaignId_idx" ON "PushCampaignRecipient"("campaignId");
CREATE INDEX "PushCampaignRecipient_workspaceId_idx" ON "PushCampaignRecipient"("workspaceId");
CREATE INDEX "PushCampaignRecipient_status_idx" ON "PushCampaignRecipient"("status");
CREATE UNIQUE INDEX "PushCampaignRecipient_campaignId_phone_key" ON "PushCampaignRecipient"("campaignId", "phone");

-- Align CustomerFeedback workspace FK with Prisma relation
ALTER TABLE "CustomerFeedback" ADD CONSTRAINT "CustomerFeedback_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
