/*
  Warnings:

  - Added the required column `updatedAt` to the `messages_archive` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "messages_archive" ADD COLUMN     "debugInfo" TEXT,
ADD COLUMN     "functionCallsDebug" TEXT,
ADD COLUMN     "processedPrompt" TEXT,
ADD COLUMN     "processingSource" TEXT,
ADD COLUMN     "sentBy" TEXT,
ADD COLUMN     "translatedQuery" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "messages_archive_chatSessionId_idx" ON "messages_archive"("chatSessionId");

-- CreateIndex
CREATE INDEX "messages_archive_originalId_idx" ON "messages_archive"("originalId");
