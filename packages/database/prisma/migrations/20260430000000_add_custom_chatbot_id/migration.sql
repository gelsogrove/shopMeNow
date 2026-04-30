-- Add customChatbotId field to workspaces
-- Used by FLOW workspaces to identify which custom chatbot module handles the conversation
-- Example value: "cliente-0" maps to apps/backend/custom-client-0/

ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "customChatbotId" TEXT;

-- Set customChatbotId for existing FLOW workspaces with slug "cliente-0" (Ecolaundry)
UPDATE "workspaces"
SET "customChatbotId" = 'cliente-0'
WHERE "slug" = 'cliente-0';
