-- AlterTable: Add billedAt field to Orders table
-- Purpose: Track when NEW_ORDER billing (€1.00) was applied to prevent double-billing
-- Author: Andrea
-- Date: 2025-11-17

ALTER TABLE "orders" ADD COLUMN "billedAt" TIMESTAMP(3);

-- Add comment for documentation
COMMENT ON COLUMN "orders"."billedAt" IS 'Timestamp when NEW_ORDER billing (€1.00) was applied - prevents double-billing if order re-confirmed';
