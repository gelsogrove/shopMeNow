-- AlterTable: Add credentialsMapping JSON column to workspace_calling_functions
ALTER TABLE "workspace_calling_functions" ADD COLUMN "credentialsMapping" JSONB;

-- CreateTable: workspace_environment_variables - Secure encrypted storage for API keys/credentials per workspace
CREATE TABLE "workspace_environment_variables" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "variableName" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_environment_variables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique constraint on (workspaceId, variableName)
CREATE UNIQUE INDEX "workspace_environment_variables_workspaceId_variableName_key" ON "workspace_environment_variables"("workspaceId", "variableName");

-- CreateIndex: workspace lookup index
CREATE INDEX "workspace_environment_variables_workspaceId_idx" ON "workspace_environment_variables"("workspaceId");

-- CreateIndex: audit/cleanup index
CREATE INDEX "workspace_environment_variables_createdAt_idx" ON "workspace_environment_variables"("createdAt");

-- AddForeignKey: cascade delete when workspace is deleted
ALTER TABLE "workspace_environment_variables" ADD CONSTRAINT "workspace_environment_variables_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
