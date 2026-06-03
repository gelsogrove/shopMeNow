-- Add WhatsApp-style reaction emoji column to conversation_messages.
-- Single, nullable: NULL = no reaction. Server-synced between operator + demo.
--
-- IF NOT EXISTS keeps this idempotent across environments where the column may
-- already exist (e.g. a dev DB that was synced via `prisma db push` before this
-- migration was committed). `prisma migrate deploy` (run in the Heroku release
-- phase) applies it on the demo/prod DB where the column is still missing.
ALTER TABLE "conversation_messages" ADD COLUMN IF NOT EXISTS "reaction" TEXT;
