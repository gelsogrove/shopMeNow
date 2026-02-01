-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('NEW', 'PENDING_APPROVAL', 'ACTIVE');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "registrationPage" TEXT;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "registrationStatus" "RegistrationStatus" NOT NULL DEFAULT 'NEW';

-- CreateTable
CREATE TABLE "ProductCharacteristic" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCharacteristic_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductCharacteristic_productId_idx" ON "ProductCharacteristic"("productId");

-- CreateIndex
CREATE INDEX "ProductCharacteristic_name_idx" ON "ProductCharacteristic"("name");

-- AddForeignKey
ALTER TABLE "ProductCharacteristic" ADD CONSTRAINT "ProductCharacteristic_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
