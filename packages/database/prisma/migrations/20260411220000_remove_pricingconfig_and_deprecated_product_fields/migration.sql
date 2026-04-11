-- ============================================================
-- 1. Remove deprecated Product fields (categoryId, certifications)
--    These were replaced by productCategories relation and
--    productCertifications relation respectively.
-- ============================================================

-- Drop FK constraint for categoryId (may not exist if already dropped)
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_categoryId_fkey";

-- Drop deprecated columns
ALTER TABLE "products" DROP COLUMN IF EXISTS "categoryId";
ALTER TABLE "products" DROP COLUMN IF EXISTS "certifications";

-- ============================================================
-- 2. Drop PricingConfig table (replaced by PlatformConfig)
-- ============================================================
DROP TABLE IF EXISTS "pricing_config";
