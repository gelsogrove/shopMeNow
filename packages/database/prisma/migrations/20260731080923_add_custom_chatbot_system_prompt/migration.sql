-- Editable main/system prompt for custom chatbot modules (e.g. demorobot).
--
-- Falls back to the module's own static prompt file (e.g. common.md) when
-- null/empty — additive, no impact on existing custom chatbots that don't
-- set this field.

ALTER TABLE "Workspace" ADD COLUMN "customChatbotSystemPrompt" TEXT;
