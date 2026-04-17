-- Add escalatedAt column to ChatSession (E0b - session reset after operator escalation)
ALTER TABLE "ChatSession" ADD COLUMN "escalatedAt" TIMESTAMP(3);
