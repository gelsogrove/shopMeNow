-- CreateTable
CREATE TABLE IF NOT EXISTS "flow_node_configs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "flowKey" TEXT NOT NULL,
    "flowLabel" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "maxTokens" INTEGER NOT NULL DEFAULT 2048,
    "availableFunctions" JSONB NOT NULL DEFAULT '[]',
    "flows" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_node_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "flow_node_configs_workspaceId_idx" ON "flow_node_configs"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "flow_node_configs_workspaceId_flowKey_key" ON "flow_node_configs"("workspaceId", "flowKey");

-- AddForeignKey (drop-then-add so it is idempotent on a partially-pushed DB)
ALTER TABLE "flow_node_configs" DROP CONSTRAINT IF EXISTS "flow_node_configs_workspaceId_fkey";
ALTER TABLE "flow_node_configs" ADD CONSTRAINT "flow_node_configs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
