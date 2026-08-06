-- Speech-to-text toggle for the chat widget (Settings → Human Support).
-- When true the widget composer shows a microphone; recorded voice notes are
-- transcribed via Whisper using the language the system detected for the
-- visitor, and the transcription feeds the normal bot turn.
-- Defaults false: existing workspaces keep a text-only composer exactly as before.
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "speechToTextEnabled" BOOLEAN NOT NULL DEFAULT false;
