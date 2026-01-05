-- AlterTable
ALTER TABLE "whatsapp_queue" ADD COLUMN     "conversationMessageId" TEXT;

-- CreateIndex
CREATE INDEX "whatsapp_queue_conversationMessageId_idx" ON "whatsapp_queue"("conversationMessageId");

-- AddForeignKey
ALTER TABLE "whatsapp_queue" ADD CONSTRAINT "whatsapp_queue_conversationMessageId_fkey" FOREIGN KEY ("conversationMessageId") REFERENCES "conversation_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
