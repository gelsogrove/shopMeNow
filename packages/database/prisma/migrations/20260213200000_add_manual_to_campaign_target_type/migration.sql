-- Add MANUAL value to CampaignTargetType enum
-- The Prisma schema uses MANUAL but only ALL and SELECTED exist in PostgreSQL.

-- Add MANUAL to the enum
ALTER TYPE "CampaignTargetType" ADD VALUE IF NOT EXISTS 'MANUAL';

-- Update any existing SELECTED values to MANUAL (backward compatibility)
-- Note: targetingType column is TEXT type, so this updates text values
UPDATE "PushCampaign" SET "targetingType" = 'MANUAL' WHERE "targetingType" = 'SELECTED';
