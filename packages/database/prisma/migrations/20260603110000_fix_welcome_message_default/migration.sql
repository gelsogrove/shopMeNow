-- ✏️ Fix the generic welcome message.
-- The old default mentioned "Italian gourmet products" (left over from the
-- Ecolaundry food demo), which is wrong for DemoWash and any non-food tenant.
-- Genericize it. Only rewrites rows that still hold the old default, so any
-- workspace with a custom welcome message is left untouched.
--
-- NOTE: this affects workspaces that use the platform welcome (workspace.
-- welcomeMessage). Custom chatbots like DemoWash generate their own greeting
-- from the prompt and ignore this field.

-- Change the column default for new workspaces.
ALTER TABLE "Workspace"
ALTER COLUMN "welcomeMessage"
SET DEFAULT 'Welcome! I''m {{chatbotName}}, your digital assistant. How can I help you today?';

-- Rewrite existing rows that still hold the old (food-specific) default.
UPDATE "Workspace"
SET "welcomeMessage" = 'Welcome! I''m {{chatbotName}}, your digital assistant. How can I help you today?'
WHERE "welcomeMessage" = 'Welcome! I''m {{chatbotName}}, your digital assistant. I can help you discover Italian gourmet products, answer questions, and manage orders. How can I help you today?';
