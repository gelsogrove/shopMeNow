-- AlterEnum
ALTER TYPE "MessageType" ADD VALUE 'AUDIO';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "audioDuration" INTEGER,
ADD COLUMN     "audioTranscript" TEXT,
ADD COLUMN     "audioUrl" TEXT;
