/*
  Warnings:

  - You are about to drop the column `hasSuppliers` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the column `supplierId` on the `products` table. All the data in the column will be lost.
  - You are about to drop the `suppliers` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "AgentType" ADD VALUE 'CONVERSATION_HISTORY';

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_supplierId_fkey";

-- DropForeignKey
ALTER TABLE "suppliers" DROP CONSTRAINT "suppliers_workspaceId_fkey";

-- AlterTable
ALTER TABLE "TransportType" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "price" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "hasSuppliers",
ADD COLUMN     "catalogBaseLanguage" TEXT NOT NULL DEFAULT 'it',
ADD COLUMN     "frustrationEscalationInstructions" TEXT,
ADD COLUMN     "logoKey" TEXT,
ADD COLUMN     "translateCategoryNames" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "translateProductNames" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "translateServiceNames" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "invoiceDate" TIMESTAMP(3),
ADD COLUMN     "invoiceKey" TEXT,
ADD COLUMN     "invoiceUrl" TEXT;

-- AlterTable
ALTER TABLE "products" DROP COLUMN "supplierId",
ADD COLUMN     "imageKey" TEXT;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "imageKey" TEXT;

-- DropTable
DROP TABLE "suppliers";

-- CreateIndex
CREATE INDEX "TransportType_isActive_idx" ON "TransportType"("isActive");

-- CreateIndex
CREATE INDEX "orders_invoiceKey_idx" ON "orders"("invoiceKey");

-- CreateIndex
CREATE INDEX "products_imageKey_idx" ON "products"("imageKey");

-- CreateIndex
CREATE INDEX "services_imageKey_idx" ON "services"("imageKey");
