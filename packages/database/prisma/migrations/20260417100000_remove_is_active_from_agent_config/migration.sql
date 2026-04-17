-- AlterTable: Remove isActive from agent_configs (always active, field unused)
ALTER TABLE "agent_configs" DROP COLUMN IF EXISTS "isActive";

-- DropIndex: Remove composite index that included isActive
DROP INDEX IF EXISTS "agent_configs_workspaceId_isActive_idx";

-- CreateIndex: Replace with workspaceId-only index
CREATE INDEX IF NOT EXISTS "agent_configs_workspaceId_idx" ON "agent_configs"("workspaceId");
