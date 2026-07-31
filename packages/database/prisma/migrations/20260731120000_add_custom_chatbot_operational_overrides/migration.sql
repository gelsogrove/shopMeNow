-- Per-workspace overrides for custom chatbot module operational settings
-- (model, temperature, operator briefing language/email, escalation email
-- headers, audio/TTS policy). Custom chatbot modules (apps/backend/custom-*)
-- read these operational fields from their own settings.json at
-- process-import time — a file that's read once per process and lives on
-- Heroku's ephemeral filesystem, so it can never be edited live from a web
-- UI. These columns are read per-request by the module (input.config
-- overrides) and fall back to settings.json when null, mirroring the
-- existing customChatbotSystemPrompt pattern.

ALTER TABLE "Workspace" ADD COLUMN "customChatbotModel" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "customChatbotTemperature" DOUBLE PRECISION;
ALTER TABLE "Workspace" ADD COLUMN "customChatbotOperatorBriefingLanguage" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "customChatbotOperatorEmail" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "customChatbotEmailFrom" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "customChatbotEmailSubjectPrefix" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "customChatbotAudioOutput" BOOLEAN;
ALTER TABLE "Workspace" ADD COLUMN "customChatbotAudioVoices" JSONB;
