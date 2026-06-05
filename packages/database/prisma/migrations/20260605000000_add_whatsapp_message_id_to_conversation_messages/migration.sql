-- Add WhatsApp provider message ID (wamid) to conversation_messages.
-- Needed to send operator reactions to WhatsApp (sendReaction API requires
-- the wamid of the target message) and to give context to inbound reactions
-- from customers on operator-sent messages.
--
-- Populated when: operator sends text (via sendMessage) or file (via uploadAttachments).
-- IF NOT EXISTS keeps this idempotent across envs.
ALTER TABLE "conversation_messages" ADD COLUMN IF NOT EXISTS "whatsappMessageId" TEXT;
CREATE INDEX IF NOT EXISTS "conversation_messages_whatsappMessageId_idx" ON "conversation_messages"("whatsappMessageId");
