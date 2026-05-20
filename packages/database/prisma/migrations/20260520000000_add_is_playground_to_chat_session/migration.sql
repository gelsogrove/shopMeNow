-- AddColumn: isPlayground on ChatSession
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "isPlayground" BOOLEAN NOT NULL DEFAULT false;
