-- Step 1: Rename Products.transportType column to type (idempotent)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='transportType') THEN
    ALTER TABLE "products" RENAME COLUMN "transportType" TO "type";
  END IF;
END $$;

-- Step 2: Rename TransportType table to Type (idempotent)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='TransportType') THEN
    ALTER TABLE "TransportType" RENAME TO "Type";
  END IF;
END $$;

-- Step 3: Rename ProductTransportType table to ProductType (idempotent)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='ProductTransportType') THEN
    ALTER TABLE "ProductTransportType" RENAME TO "ProductType";
  END IF;
END $$;

-- Step 4: Rename ProductType.transportTypeId column to typeId (idempotent)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ProductType' AND column_name='transportTypeId') THEN
    ALTER TABLE "ProductType" RENAME COLUMN "transportTypeId" TO "typeId";
  END IF;
END $$;

-- Step 5: Rename constraints (idempotent)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ProductTransportType_pkey') THEN
    ALTER TABLE "ProductType" RENAME CONSTRAINT "ProductTransportType_pkey" TO "ProductType_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='TransportType_pkey') THEN
    ALTER TABLE "Type" RENAME CONSTRAINT "TransportType_pkey" TO "Type_pkey";
  END IF;
END $$;

-- Step 6: Rename foreign keys (idempotent)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ProductTransportType_productId_fkey') THEN
    ALTER TABLE "ProductType" RENAME CONSTRAINT "ProductTransportType_productId_fkey" TO "ProductType_productId_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ProductTransportType_transportTypeId_fkey') THEN
    ALTER TABLE "ProductType" RENAME CONSTRAINT "ProductTransportType_transportTypeId_fkey" TO "ProductType_typeId_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='TransportType_workspaceId_fkey') THEN
    ALTER TABLE "Type" RENAME CONSTRAINT "TransportType_workspaceId_fkey" TO "Type_workspaceId_fkey";
  END IF;
END $$;

-- Step 7: Rename indexes (idempotent)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='ProductTransportType_productId_idx') THEN
    ALTER INDEX "ProductTransportType_productId_idx" RENAME TO "ProductType_productId_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='ProductTransportType_transportTypeId_idx') THEN
    ALTER INDEX "ProductTransportType_transportTypeId_idx" RENAME TO "ProductType_typeId_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='TransportType_isActive_idx') THEN
    ALTER INDEX "TransportType_isActive_idx" RENAME TO "Type_isActive_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='TransportType_name_idx') THEN
    ALTER INDEX "TransportType_name_idx" RENAME TO "Type_name_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='TransportType_workspaceId_idx') THEN
    ALTER INDEX "TransportType_workspaceId_idx" RENAME TO "Type_workspaceId_idx";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname='TransportType_workspaceId_name_key') THEN
    ALTER INDEX "TransportType_workspaceId_name_key" RENAME TO "Type_workspaceId_name_key";
  END IF;
END $$;
