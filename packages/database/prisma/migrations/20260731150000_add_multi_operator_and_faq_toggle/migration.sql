-- Multi-operator escalation routing.
-- The existing singular columns (operatorEmail / operatorWhatsappNumber) are kept
-- untouched as the fallback, so workspaces that never configure a list keep working.
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "operatorEmails" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "operatorWhatsappNumbers" TEXT[] NOT NULL DEFAULT '{}';

-- 'all'    -> notify every configured operator
-- 'random' -> pick one at random (spreads the load)
-- 'custom' -> the custom chatbot module applies its own routing rule
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "operatorDeliveryMode" TEXT DEFAULT 'all';

-- Master switch for the FAQ block injected into the chatbot prompt.
-- Defaults to true so existing workspaces keep the behaviour they have today.
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "faqsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Master switch for flow retrieval. Defaults to true so existing workspaces
-- keep the behaviour they have today.
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "flowsEnabled" BOOLEAN NOT NULL DEFAULT true;
