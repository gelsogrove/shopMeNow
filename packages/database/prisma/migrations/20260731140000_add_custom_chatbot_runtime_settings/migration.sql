-- Custom chatbot runtime settings editable from the Settings UI.
-- These mirror keys in custom-<module>/settings.json so a workspace can override
-- the module defaults without a code change. NULL means "use the module default".

ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "customChatbotMaxTokens" INTEGER;

-- Audio replies (ElevenLabs). audioVoices maps a language code to a voice id,
-- e.g. {"default":"EXAVITQu4vr4xnSDxMaL","it":"EXAVITQu4vr4xnSDxMaL"}.
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "audioOutput" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "audioVoices" JSONB;
