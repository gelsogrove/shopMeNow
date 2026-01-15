-- Migration: Add channelType and operatorEmail fields
-- Date: 2026-01-15
-- Feature: Simplified Wizard (Andrea's requirements)

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
  WHEN "enableWidget" = true THEN 'WIDGET'::  "ChannelType"
  ELSE 'WHATSAPP'::"ChannelType"
END;

COMMENT ON COLUMN "Workspace"."channelType" IS 'Channel type: WHATSAPP or WIDGET';
COMMENT ON COLUMN "Workspace"."operatorEmail" IS 'Email for human support notifications (from user profile)';
