-- AddColumn: translateOperatorMessages on Workspace
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "translateOperatorMessages" BOOLEAN NOT NULL DEFAULT true;
