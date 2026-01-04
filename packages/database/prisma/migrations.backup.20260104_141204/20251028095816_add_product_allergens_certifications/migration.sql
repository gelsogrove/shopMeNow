-- AlterTable
ALTER TABLE "products" ADD COLUMN     "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "products_allergens_idx" ON "products"("allergens");

-- CreateIndex
CREATE INDEX "products_certifications_idx" ON "products"("certifications");
