-- CreateTable
CREATE TABLE "platform_config" (
    "id" TEXT NOT NULL,
    "type" "ConfigType" NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "originalValue" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_config_key_key" ON "platform_config"("key");

-- CreateIndex
CREATE INDEX "platform_config_type_idx" ON "platform_config"("type");

-- CreateIndex
CREATE INDEX "platform_config_key_idx" ON "platform_config"("key");

-- CreateIndex
CREATE INDEX "platform_config_isActive_idx" ON "platform_config"("isActive");
