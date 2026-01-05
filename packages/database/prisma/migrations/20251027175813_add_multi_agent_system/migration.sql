/*
  Warnings:

  - You are about to drop the column `prompt` on the `agent_configs` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[workspaceId,type]` on the table `agent_configs` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `agent_configs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `systemPrompt` to the `agent_configs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `agent_configs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('ROUTER', 'PRODUCT_SEARCH', 'CART_MANAGEMENT', 'ORDER_TRACKING', 'CUSTOMER_SUPPORT', 'PROFILE_MANAGEMENT', 'NOTIFICATIONS', 'SAFETY_TRANSLATION', 'CUSTOM');

-- DropForeignKey
ALTER TABLE "public"."agent_configs" DROP CONSTRAINT "agent_configs_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "public"."faqs" DROP CONSTRAINT "faqs_workspaceId_fkey";

-- AlterTable: Step 1 - Add new columns as NULLABLE first
ALTER TABLE "agent_configs" 
ADD COLUMN     "availableFunctions" JSONB,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "order" INTEGER DEFAULT 0,
ADD COLUMN     "systemPrompt" TEXT,
ADD COLUMN     "type" "AgentType",
ALTER COLUMN "maxTokens" SET DEFAULT 4096;

-- Step 2: Migrate existing data from 'prompt' to 'systemPrompt' and set defaults
UPDATE "agent_configs" SET 
  "name" = 'Legacy Agent',
  "type" = 'CUSTOM',
  "systemPrompt" = COALESCE("prompt", 'You are a helpful assistant.'),
  "order" = 1,
  "description" = 'Migrated from old agent config'
WHERE "name" IS NULL;

-- Step 3: Now make columns NOT NULL and drop old 'prompt' column
ALTER TABLE "agent_configs" 
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "systemPrompt" SET NOT NULL,
ALTER COLUMN "type" SET NOT NULL,
ALTER COLUMN "order" SET NOT NULL,
DROP COLUMN "prompt";

-- AlterTable
ALTER TABLE "faqs" ADD COLUMN     "category" TEXT,
ADD COLUMN     "keywords" TEXT[],
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "agent_conversation_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "agentType" TEXT NOT NULL,
    "agentAction" TEXT NOT NULL,
    "inputMessage" TEXT NOT NULL,
    "agentPrompt" TEXT,
    "llmModel" TEXT,
    "llmResponse" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "reasoning" TEXT,
    "tokensUsed" INTEGER,
    "executionTimeMs" INTEGER,
    "functionsCalled" JSONB,
    "hasError" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_conversation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_conversation_logs_workspaceId_customerId_idx" ON "agent_conversation_logs"("workspaceId", "customerId");

-- CreateIndex
CREATE INDEX "agent_conversation_logs_conversationId_idx" ON "agent_conversation_logs"("conversationId");

-- CreateIndex
CREATE INDEX "agent_conversation_logs_createdAt_idx" ON "agent_conversation_logs"("createdAt");

-- CreateIndex
CREATE INDEX "agent_conversation_logs_agentType_idx" ON "agent_conversation_logs"("agentType");

-- CreateIndex
CREATE INDEX "agent_conversation_logs_hasError_idx" ON "agent_conversation_logs"("hasError");

-- CreateIndex
CREATE INDEX "agent_configs_workspaceId_isActive_idx" ON "agent_configs"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "agent_configs_order_idx" ON "agent_configs"("order");

-- CreateIndex
CREATE UNIQUE INDEX "agent_configs_workspaceId_type_key" ON "agent_configs"("workspaceId", "type");

-- CreateIndex
CREATE INDEX "faqs_workspaceId_isActive_idx" ON "faqs"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "faqs_keywords_idx" ON "faqs"("keywords");

-- CreateIndex
CREATE INDEX "faqs_category_idx" ON "faqs"("category");

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_conversation_logs" ADD CONSTRAINT "agent_conversation_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_conversation_logs" ADD CONSTRAINT "agent_conversation_logs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
