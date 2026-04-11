-- ============================================================
-- DB Audit: Indexes, Unique Constraints, onDelete, @@map fixes
-- ============================================================

-- 1. Products: drop global @unique on slug, add compound @@unique([slug, workspaceId])
--    Remove unused @@index([certifications]), add @@index([workspaceId, status])
DROP INDEX IF EXISTS "products_slug_key";
ALTER TABLE "products" ADD CONSTRAINT "products_slug_workspaceId_key" UNIQUE ("slug", "workspaceId");
DROP INDEX IF EXISTS "products_certifications_idx";
CREATE INDEX IF NOT EXISTS "products_workspaceId_status_idx" ON "products"("workspaceId", "status");

-- 2. Services: drop global @unique on code, add compound @@unique([code, workspaceId])
--    Also add @@index([workspaceId])
DROP INDEX IF EXISTS "services_code_key";
ALTER TABLE "services" ADD CONSTRAINT "services_code_workspaceId_key" UNIQUE ("code", "workspaceId");
CREATE INDEX IF NOT EXISTS "services_workspaceId_idx" ON "services"("workspaceId");

-- 3. OrderItems: add @@index([orderId]) and @@index([orderId, deletedAt])
--    Update FK for orderId: RESTRICT -> CASCADE (delete order = delete its items)
CREATE INDEX IF NOT EXISTS "order_items_orderId_idx" ON "order_items"("orderId");
CREATE INDEX IF NOT EXISTS "order_items_orderId_deletedAt_idx" ON "order_items"("orderId", "deletedAt");

ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_orderId_fkey";
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Note: order_items_serviceId_fkey already SET NULL from init migration - no change needed
-- Note: appointments/pending_appointments/late_cancellation_attempts already RESTRICT from 20260411000000 - no change needed

-- 4. Orders: add @@index([workspaceId, status]) and @@index([workspaceId, createdAt])
CREATE INDEX IF NOT EXISTS "orders_workspaceId_status_idx" ON "orders"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "orders_workspaceId_createdAt_idx" ON "orders"("workspaceId", "createdAt");

-- 5. CartItems: add @@index([cartId])
CREATE INDEX IF NOT EXISTS "cart_items_cartId_idx" ON "cart_items"("cartId");

-- 6. Customers: add @@index([workspaceId])
CREATE INDEX IF NOT EXISTS "customers_workspaceId_idx" ON "customers"("workspaceId");

-- 7. Type: remove redundant @@index([name]) - already covered by @@unique([workspaceId, name])
DROP INDEX IF EXISTS "Type_name_idx";

-- 8. PushCampaign table rename to push_campaigns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PushCampaign' AND table_schema = 'public') THEN
    ALTER TABLE "PushCampaign" RENAME TO "push_campaigns";
  END IF;
END $$;

-- 9. PushCampaignRecipient table rename to push_campaign_recipients
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'PushCampaignRecipient' AND table_schema = 'public') THEN
    ALTER TABLE "PushCampaignRecipient" RENAME TO "push_campaign_recipients";
  END IF;
END $$;
