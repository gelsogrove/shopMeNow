-- CreateTable
CREATE TABLE "flow_node_configs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 2048,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "availableFunctions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_node_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flow_node_configs_workspaceId_order_idx" ON "flow_node_configs"("workspaceId", "order");

-- AddForeignKey
ALTER TABLE "flow_node_configs" ADD CONSTRAINT "flow_node_configs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
