-- CreateEnum
CREATE TYPE "SearchConversationState" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED', 'EXPIRED');

-- CreateTable
CREATE TABLE "search_conversations" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "state" "SearchConversationState" NOT NULL DEFAULT 'ACTIVE',
    "lastQuery" TEXT,
    "lastResponse" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "search_conversations_sessionId_key" ON "search_conversations"("sessionId");

-- CreateIndex
CREATE INDEX "search_conversations_sessionId_idx" ON "search_conversations"("sessionId");

-- CreateIndex
CREATE INDEX "search_conversations_customerId_idx" ON "search_conversations"("customerId");

-- CreateIndex
CREATE INDEX "search_conversations_expiresAt_idx" ON "search_conversations"("expiresAt");

-- AddForeignKey
ALTER TABLE "search_conversations" ADD CONSTRAINT "search_conversations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
