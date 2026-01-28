-- Rename Products.transportType to Products.type
ALTER TABLE "products" RENAME COLUMN "transportType" TO "type";

-- Rename TransportType table to Type
ALTER TABLE "TransportType" RENAME TO "Type";

-- Rename ProductTransportType table to ProductType
ALTER TABLE "ProductTransportType" RENAME TO "ProductType";

-- Rename ProductType columns
ALTER TABLE "ProductType" RENAME COLUMN "transportTypeId" TO "typeId";

-- Update indexes and constraints (PostgreSQL handles automatically on RENAME)
