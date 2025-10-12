-- WhatsApp Integration Migration
-- Drops isMain column and adds WhatsApp fields to messages table

-- Step 1: Drop isMain column from workspace (if exists)
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "isMain";

-- Step 2: Add WhatsApp integration fields to messages table
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "whatsappStatus" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "whatsappError" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "whatsappMessageId" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "sentBy" TEXT;

-- Step 3: Create indexes for WhatsApp fields
CREATE INDEX IF NOT EXISTS "messages_whatsappStatus_idx" ON "messages"("whatsappStatus");
CREATE INDEX IF NOT EXISTS "messages_whatsappMessageId_idx" ON "messages"("whatsappMessageId");
CREATE INDEX IF NOT EXISTS "messages_sentBy_idx" ON "messages"("sentBy");

-- Step 4: Add comment for documentation
COMMENT ON COLUMN "messages"."whatsappStatus" IS 'Status del messaggio WhatsApp: sent, failed, pending, delivered, read';
COMMENT ON COLUMN "messages"."whatsappError" IS 'Messaggio di errore se invio fallito';
COMMENT ON COLUMN "messages"."whatsappMessageId" IS 'ID del messaggio WhatsApp per tracking';
COMMENT ON COLUMN "messages"."sentBy" IS 'userId dell operatore che ha inviato il messaggio manualmente';
