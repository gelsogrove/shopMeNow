-- AlterTable
ALTER TABLE "Workspace" ALTER COLUMN "creditBalance" SET DEFAULT 19.00;

-- CreateIndex
CREATE INDEX "offers_workspaceId_idx" ON "offers"("workspaceId");

-- CreateIndex
CREATE INDEX "products_workspaceId_idx" ON "products"("workspaceId");
