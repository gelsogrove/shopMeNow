/*
  Warnings:

  - The values [AUDIO] on the enum `MessageType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `audioDuration` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `audioTranscript` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `audioUrl` on the `messages` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "CampaignFrequency" ADD VALUE 'ONCE';

-- AlterEnum
BEGIN;
CREATE TYPE "MessageType_new" AS ENUM ('TEXT', 'IMAGE', 'DOCUMENT', 'LOCATION', 'CONTACT');
ALTER TABLE "public"."messages" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "messages" ALTER COLUMN "type" TYPE "MessageType_new" USING ("type"::text::"MessageType_new");
ALTER TYPE "MessageType" RENAME TO "MessageType_old";
ALTER TYPE "MessageType_new" RENAME TO "MessageType";
DROP TYPE "public"."MessageType_old";
ALTER TABLE "messages" ALTER COLUMN "type" SET DEFAULT 'TEXT';
COMMIT;

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "audioDuration",
DROP COLUMN "audioTranscript",
DROP COLUMN "audioUrl";
