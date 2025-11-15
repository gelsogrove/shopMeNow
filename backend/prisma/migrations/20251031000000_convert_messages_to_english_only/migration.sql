-- Migration: Convert welcomeMessages and wipMessages from JSON to String (English only)
-- This migration extracts the 'en' value from JSON fields and converts to simple String

-- Step 1: Add new String columns
ALTER TABLE "Workspace" ADD COLUMN "welcomeMessage" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "wipMessage" TEXT;

-- Step 2: Migrate data - extract 'en' value from JSON
UPDATE "Workspace" 
SET "welcomeMessage" = COALESCE(
  "welcomeMessages"::jsonb->>'en',
  'Welcome! I''m SofiA, your digital assistant. I can help you discover Italian gourmet products, answer questions, and manage orders. How can I help you today?'
)
WHERE "welcomeMessages" IS NOT NULL;

UPDATE "Workspace" 
SET "wipMessage" = COALESCE(
  "wipMessages"::jsonb->>'en',
  'Work in progress. Please contact us later.'
)
WHERE "wipMessages" IS NOT NULL;

-- Step 3: Set default values for NULL rows
UPDATE "Workspace" 
SET "welcomeMessage" = 'Welcome! I''m SofiA, your digital assistant. I can help you discover Italian gourmet products, answer questions, and manage orders. How can I help you today?'
WHERE "welcomeMessage" IS NULL;

UPDATE "Workspace" 
SET "wipMessage" = 'Work in progress. Please contact us later.'
WHERE "wipMessage" IS NULL;

-- Step 4: Drop old JSON columns
ALTER TABLE "Workspace" DROP COLUMN "welcomeMessages";
ALTER TABLE "Workspace" DROP COLUMN "wipMessages";

-- Step 5: Set defaults for new columns
ALTER TABLE "Workspace" ALTER COLUMN "welcomeMessage" SET DEFAULT 'Welcome! I''m SofiA, your digital assistant. I can help you discover Italian gourmet products, answer questions, and manage orders. How can I help you today?';
ALTER TABLE "Workspace" ALTER COLUMN "wipMessage" SET DEFAULT 'Work in progress. Please contact us later.';
