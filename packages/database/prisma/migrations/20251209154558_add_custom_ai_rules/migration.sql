-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "customAiRules" TEXT;

-- CreateTable
CREATE TABLE "workspace_calling_functions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "functionName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_calling_functions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_calling_functions_workspaceId_isActive_idx" ON "workspace_calling_functions"("workspaceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_calling_functions_workspaceId_functionName_key" ON "workspace_calling_functions"("workspaceId", "functionName");

-- AddForeignKey
ALTER TABLE "workspace_calling_functions" ADD CONSTRAINT "workspace_calling_functions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
