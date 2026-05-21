-- AddColumn: translateOperatorMessages on Workspace
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "translateOperatorMessages" BOOLEAN NOT NULL DEFAULT true;
