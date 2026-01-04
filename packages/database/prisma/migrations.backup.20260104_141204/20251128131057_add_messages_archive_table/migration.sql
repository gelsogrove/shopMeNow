-- CreateTable
CREATE TABLE "messages_archive" (
    "id" TEXT NOT NULL,
    "originalId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB DEFAULT '{}',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chatSessionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "whatsappStatus" TEXT,
    "whatsappError" TEXT,
    "whatsappMessageId" TEXT,

    CONSTRAINT "messages_archive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messages_archive_workspaceId_idx" ON "messages_archive"("workspaceId");

-- CreateIndex
CREATE INDEX "messages_archive_customerId_idx" ON "messages_archive"("customerId");

-- CreateIndex
CREATE INDEX "messages_archive_createdAt_idx" ON "messages_archive"("createdAt");

-- CreateIndex
CREATE INDEX "messages_archive_archivedAt_idx" ON "messages_archive"("archivedAt");
