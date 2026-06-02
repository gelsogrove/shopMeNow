-- Playground UI overlays persisted server-side on the chat session so they
-- survive logout (localStorage.clear()), browser changes and deploys.
-- All columns are nullable/additive — no existing data is affected.
ALTER TABLE "chat_sessions" ADD COLUMN "title" TEXT;
ALTER TABLE "chat_sessions" ADD COLUMN "feedback" TEXT;
ALTER TABLE "chat_sessions" ADD COLUMN "sortOrder" INTEGER;
