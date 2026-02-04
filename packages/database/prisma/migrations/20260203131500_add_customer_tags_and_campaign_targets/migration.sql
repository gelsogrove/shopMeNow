-- Add new target type for tag-based campaigns
ALTER TYPE "CampaignTargetType" ADD VALUE 'TAGS';

-- Add tags to customers
ALTER TABLE "customers" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Add target tags to legacy campaigns
ALTER TABLE "Campaign" ADD COLUMN "targetTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Add target tags to push campaigns
ALTER TABLE "PushCampaign" ADD COLUMN "targetTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Index for faster tag filtering on customers
CREATE INDEX "customers_tags_idx" ON "customers" USING GIN ("tags");
