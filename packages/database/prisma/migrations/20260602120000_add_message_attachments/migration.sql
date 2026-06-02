-- 📎 Chat message attachments (images / PDFs).
-- Anchored to conversation_messages (the LIVE chat table), NOT the legacy
-- messages table. Mirrors the support_attachments pattern: url + storageKey +
-- mimeType + size, FK ON DELETE CASCADE so attachment rows vanish with their
-- parent conversation message (which itself cascades from customer/workspace).
-- The physical Cloudinary binary is removed separately, via storageKey, by the
-- lifecycle/deletion service.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AttachmentKind" AS ENUM ('IMAGE', 'DOCUMENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "message_attachments" (
    "id" TEXT NOT NULL,
    "conversationMessageId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "filename" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "waMediaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "message_attachments_conversationMessageId_idx" ON "message_attachments"("conversationMessageId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "message_attachments_workspaceId_idx" ON "message_attachments"("workspaceId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_conversationMessageId_fkey" FOREIGN KEY ("conversationMessageId") REFERENCES "conversation_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
