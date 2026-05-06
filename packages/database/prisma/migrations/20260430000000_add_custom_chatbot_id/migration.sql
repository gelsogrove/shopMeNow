-- Add customChatbotId field to workspaces
-- Used by FLOW workspaces to identify which custom chatbot module handles the conversation
-- Example value: "ecolaundry" maps to apps/backend/custom-ecolaundry/

ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "customChatbotId" TEXT;

-- Set customChatbotId for existing FLOW workspaces with slug "ecolaundry" (Ecolaundry)
UPDATE "Workspace"
SET "customChatbotId" = 'ecolaundry'
WHERE "slug" = 'ecolaundry';
