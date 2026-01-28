-- Step 1: Rename Products.transportType column to type
ALTER TABLE "products" RENAME COLUMN "transportType" TO "type";

-- Step 2: Rename TransportType table to Type
ALTER TABLE "TransportType" RENAME TO "Type";

-- Step 3: Rename ProductTransportType table to ProductType  
ALTER TABLE "ProductTransportType" RENAME TO "ProductType";

-- Step 4: Rename ProductType.transportTypeId column to typeId
ALTER TABLE "ProductType" RENAME COLUMN "transportTypeId" TO "typeId";

-- Step 5: Rename constraints
ALTER TABLE "ProductType" RENAME CONSTRAINT "ProductTransportType_pkey" TO "ProductType_pkey";
ALTER TABLE "Type" RENAME CONSTRAINT "TransportType_pkey" TO "Type_pkey";

-- Step 6: Rename foreign keys
ALTER TABLE "ProductType" RENAME CONSTRAINT "ProductTransportType_productId_fkey" TO "ProductType_productId_fkey";
ALTER TABLE "ProductType" RENAME CONSTRAINT "ProductTransportType_transportTypeId_fkey" TO "ProductType_typeId_fkey";
ALTER TABLE "Type" RENAME CONSTRAINT "TransportType_workspaceId_fkey" TO "Type_workspaceId_fkey";

-- Step 7: Rename indexes
ALTER INDEX "ProductTransportType_productId_idx" RENAME TO "ProductType_productId_idx";
ALTER INDEX "ProductTransportType_transportTypeId_idx" RENAME TO "ProductType_typeId_idx";
ALTER INDEX "TransportType_isActive_idx" RENAME TO "Type_isActive_idx";
ALTER INDEX "TransportType_name_idx" RENAME TO "Type_name_idx";
ALTER INDEX "TransportType_workspaceId_idx" RENAME TO "Type_workspaceId_idx";
ALTER INDEX "TransportType_workspaceId_name_key" RENAME TO "Type_workspaceId_name_key";
