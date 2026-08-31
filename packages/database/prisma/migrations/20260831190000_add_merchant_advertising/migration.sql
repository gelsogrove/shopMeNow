-- Merchant advertising (Andrea, 2026-08-31): the Pro Loco resells push
-- packages to local merchants. Merchants (anagrafica + invoicing data),
-- their reusable creatives (merchant_pushes), the package sales audit trail
-- (merchant_quota_topups), and the campaign link (merchantId/merchantPushId
-- + validity window on push_campaigns).

-- CreateTable
CREATE TABLE IF NOT EXISTS "merchants" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "billingName" TEXT,
    "vatNumber" TEXT,
    "taxCode" TEXT,
    "sdiCode" TEXT,
    "pec" TEXT,
    "billingAddress" TEXT,
    "billingCity" TEXT,
    "billingZip" TEXT,
    "billingProvince" TEXT,
    "billingCountry" TEXT DEFAULT 'IT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "quotaRemaining" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "merchant_pushes" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "photoUrl" TEXT,
    "videoUrl" TEXT,
    "location" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "merchant_pushes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "merchant_quota_topups" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_quota_topups_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "push_campaigns"
    ADD COLUMN IF NOT EXISTS "merchantId" TEXT,
    ADD COLUMN IF NOT EXISTS "merchantPushId" TEXT,
    ADD COLUMN IF NOT EXISTS "validFrom" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "validTo" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "merchants_workspaceId_isActive_idx" ON "merchants"("workspaceId", "isActive");
CREATE INDEX IF NOT EXISTS "merchant_pushes_workspaceId_merchantId_isActive_idx" ON "merchant_pushes"("workspaceId", "merchantId", "isActive");
CREATE INDEX IF NOT EXISTS "merchant_quota_topups_workspaceId_merchantId_idx" ON "merchant_quota_topups"("workspaceId", "merchantId");
CREATE INDEX IF NOT EXISTS "push_campaigns_workspaceId_merchantId_idx" ON "push_campaigns"("workspaceId", "merchantId");

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "merchant_pushes" ADD CONSTRAINT "merchant_pushes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "merchant_pushes" ADD CONSTRAINT "merchant_pushes_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "merchant_quota_topups" ADD CONSTRAINT "merchant_quota_topups_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "merchant_quota_topups" ADD CONSTRAINT "merchant_quota_topups_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "push_campaigns" ADD CONSTRAINT "push_campaigns_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "push_campaigns" ADD CONSTRAINT "push_campaigns_merchantPushId_fkey" FOREIGN KEY ("merchantPushId") REFERENCES "merchant_pushes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
