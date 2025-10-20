/*
  Warnings:

  - You are about to drop the column `promptId` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the `Prompts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Prompts" DROP CONSTRAINT "Prompts_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."messages" DROP CONSTRAINT "messages_promptId_fkey";

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "promptId";

-- DropTable
DROP TABLE "public"."Prompts";
