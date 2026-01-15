-- Migration: Wizard Simplification + PayPal OAuth
-- Date: 2026-01-15
-- Features: 
--   - Simplified Wizard (channelType, operatorEmail)
--   - PayPal OAuth tokens for secure payment integration

-- ============================================
-- PART 1: WIZARD SIMPLIFICATION
-- ============================================

-- Add WIDGET to ChannelType enum
ALTER TYPE "ChannelType" ADD VALUE IF NOT EXISTS 'WIDGET';

-- Add channelType column to Workspace
ALTER TABLE "Workspace" 
ADD COLUMN IF NOT EXISTS "channelType" "ChannelType" NOT NULL DEFAULT 'WHATSAPP';

-- Add operatorEmail column to Workspace
ALTER TABLE "Workspace" 
ADD COLUMN IF NOT EXISTS "operatorEmail" TEXT;

-- Update existing records: set operatorEmail from notificationEmail or adminEmail
UPDATE "Workspace" 
SET "operatorEmail" = COALESCE("notificationEmail", 
  (SELECT email FROM "User" WHERE id = "Workspace"."ownerId" LIMIT 1))
WHERE "operatorEmail" IS NULL;

-- Update channelType based on enableWidget/enableWhatsapp
UPDATE "Workspace" 
SET "channelType" = CASE 
  WHEN "enableWidget" = true THEN 'WIDGET'::"ChannelType"
  ELSE 'WHATSAPP'::"ChannelType"
END;

COMMENT ON COLUMN "Workspace"."channelType" IS 'Channel type: WHATSAPP or WIDGET';
COMMENT ON COLUMN "Workspace"."operatorEmail" IS 'Email for human support notifications (from user profile)';

-- ============================================
-- PART 2: PAYPAL OAUTH TOKENS
-- ============================================

-- Add PayPal OAuth token columns to User table
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "paypalAccessTokenEncrypted" TEXT,
ADD COLUMN IF NOT EXISTS "paypalRefreshTokenEncrypted" TEXT,
ADD COLUMN IF NOT EXISTS "paypalTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "paypalTokenScope" TEXT;

COMMENT ON COLUMN "User"."paypalAccessTokenEncrypted" IS 'Encrypted PayPal access token for secure payments';
COMMENT ON COLUMN "User"."paypalRefreshTokenEncrypted" IS 'Encrypted PayPal refresh token for token renewal';
COMMENT ON COLUMN "User"."paypalTokenExpiresAt" IS 'PayPal access token expiration timestamp';
COMMENT ON COLUMN "User"."paypalTokenScope" IS 'PayPal OAuth scopes granted (e.g., openid, email, profile)';
