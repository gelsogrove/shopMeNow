-- AlterTable
ALTER TABLE "products" ADD COLUMN     "imageUrl" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "imageUrl" TEXT[] DEFAULT ARRAY[]::TEXT[];
