-- Unify sellsProducts and sellsServices into single sellsProductsAndServices field
-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "sellsProductsAndServices" BOOLEAN NOT NULL DEFAULT true;

-- Drop old columns (they were both BOOLEAN with DEFAULT true/false)
ALTER TABLE "Workspace" DROP COLUMN "sellsProducts";
ALTER TABLE "Workspace" DROP COLUMN "sellsServices";
