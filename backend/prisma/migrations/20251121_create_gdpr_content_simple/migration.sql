-- Drop existing gdpr_content index and table if they exist
DROP INDEX IF EXISTS "gdpr_content_workspaceId_key" CASCADE;
DROP TABLE IF EXISTS "gdpr_content" CASCADE;

-- Create GDPR content table with simple structure
-- One row per workspace with all 4 languages in separate columns
CREATE TABLE "gdpr_content" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "gdpr_ita" TEXT NOT NULL,
    "gdpr_esp" TEXT NOT NULL,
    "gdpr_eng" TEXT NOT NULL,
    "gdpr_prt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gdpr_content_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE
);

-- Create unique constraint on workspaceId (one row per workspace)
ALTER TABLE "gdpr_content" ADD CONSTRAINT "gdpr_content_workspaceId_key" UNIQUE ("workspaceId");
CREATE INDEX "gdpr_content_workspaceId_idx" ON "gdpr_content"("workspaceId");
