-- Migration: Wizard Simplification + PayPal OAuth
-- Date: 2026-01-15
-- Features: 
--   - Simplified Wizard (channelType, operatorEmail)
--   - PayPal OAuth tokens for secure payment integration

-- ============================================
-- PART 1: WIZARD SIMPLIFICATION
-- ============================================

-- Add channelType column to Workspace
ALTER TABLE "Workspace" 
ADD COLUMN IF NOT EXISTS "channelType" "ChannelType" NOT NULL DEFAULT 'WHATSAPP';

-- Ensure legacy channel flags exist before mapping
ALTER TABLE "Workspace"
ADD COLUMN IF NOT EXISTS "enableWhatsapp" BOOLEAN DEFAULT true;

ALTER TABLE "Workspace"
ADD COLUMN IF NOT EXISTS "enableWidget" BOOLEAN DEFAULT false;

-- Add operatorEmail column to Workspace
ALTER TABLE "Workspace" 
ADD COLUMN IF NOT EXISTS "operatorEmail" TEXT;

-- Update existing records: set operatorEmail from notificationEmail or adminEmail
UPDATE "Workspace" 
SET "operatorEmail" = COALESCE("notificationEmail", 
  (SELECT email FROM "users" WHERE id = "Workspace"."ownerId" LIMIT 1))
WHERE "operatorEmail" IS NULL;

-- Initialize channelType safely (WIDGET backfill handled after enum commit)
UPDATE "Workspace"
SET "channelType" = 'WHATSAPP'::"ChannelType"
WHERE "channelType" IS NULL;

COMMENT ON COLUMN "Workspace"."channelType" IS 'Channel type: WHATSAPP or WIDGET';
COMMENT ON COLUMN "Workspace"."operatorEmail" IS 'Email for human support notifications (from user profile)';

-- ============================================
-- PART 2: PAYPAL OAUTH TOKENS
-- ============================================

-- Add PayPal OAuth token columns to User table
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "paypalAccessTokenEncrypted" TEXT,
ADD COLUMN IF NOT EXISTS "paypalRefreshTokenEncrypted" TEXT,
ADD COLUMN IF NOT EXISTS "paypalTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "paypalTokenScope" TEXT;

COMMENT ON COLUMN "users"."paypalAccessTokenEncrypted" IS 'Encrypted PayPal access token for secure payments';
COMMENT ON COLUMN "users"."paypalRefreshTokenEncrypted" IS 'Encrypted PayPal refresh token for token renewal';
COMMENT ON COLUMN "users"."paypalTokenExpiresAt" IS 'PayPal access token expiration timestamp';
COMMENT ON COLUMN "users"."paypalTokenScope" IS 'PayPal OAuth scopes granted (e.g., openid, email, profile)';
