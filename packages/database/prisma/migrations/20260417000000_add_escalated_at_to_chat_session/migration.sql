-- Add escalatedAt column to chat_sessions (E0b - session reset after operator escalation)
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3);
