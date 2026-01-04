-- CreateEnum
CREATE TYPE "PricingType" AS ENUM ('PLAN', 'USAGE', 'THRESHOLD');

-- CreateTable
CREATE TABLE "pricing_config" (
    "id" TEXT NOT NULL,
    "type" "PricingType" NOT NULL,
    "key" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pricing_config_key_key" ON "pricing_config"("key");

-- CreateIndex
CREATE INDEX "pricing_config_type_idx" ON "pricing_config"("type");

-- CreateIndex
CREATE INDEX "pricing_config_key_idx" ON "pricing_config"("key");

-- CreateIndex
CREATE INDEX "pricing_config_isActive_idx" ON "pricing_config"("isActive");
