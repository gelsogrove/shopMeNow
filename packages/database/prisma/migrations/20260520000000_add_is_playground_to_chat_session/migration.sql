-- AddColumn: isPlayground on ChatSession
ALTER TABLE "ChatSession" ADD COLUMN "isPlayground" BOOLEAN NOT NULL DEFAULT false;
