-- Drop product_searches table (unused feature, filling DB with 40k+ duplicate logs)
-- Migration: remove-product-searches-table
-- Date: 2026-03-24

-- Drop the table if exists (Prisma wraps migrations in its own transaction)
DROP TABLE IF EXISTS "product_searches" CASCADE;
