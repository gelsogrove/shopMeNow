-- CreateTable
CREATE TABLE "TransportType" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTransportType" (
    "productId" TEXT NOT NULL,
    "transportTypeId" TEXT NOT NULL,

    CONSTRAINT "ProductTransportType_pkey" PRIMARY KEY ("productId","transportTypeId")
);

-- CreateIndex
CREATE INDEX "TransportType_workspaceId_idx" ON "TransportType"("workspaceId");

-- CreateIndex
CREATE INDEX "TransportType_name_idx" ON "TransportType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TransportType_workspaceId_name_key" ON "TransportType"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "ProductTransportType_productId_idx" ON "ProductTransportType"("productId");

-- CreateIndex
CREATE INDEX "ProductTransportType_transportTypeId_idx" ON "ProductTransportType"("transportTypeId");

-- AddForeignKey
ALTER TABLE "TransportType" ADD CONSTRAINT "TransportType_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTransportType" ADD CONSTRAINT "ProductTransportType_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTransportType" ADD CONSTRAINT "ProductTransportType_transportTypeId_fkey" FOREIGN KEY ("transportTypeId") REFERENCES "TransportType"("id") ON DELETE CASCADE ON UPDATE CASCADE;