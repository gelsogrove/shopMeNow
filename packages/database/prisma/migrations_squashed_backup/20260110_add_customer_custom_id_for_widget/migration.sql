-- AlterTable
ALTER TABLE "customers" ADD COLUMN "customId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "customers_customId_key" ON "customers"("customId");
