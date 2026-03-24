-- Drop product_searches table (unused feature, filling DB with 40k+ duplicate logs)
-- Migration: remove-product-searches-table
-- Date: 2026-03-24

BEGIN;

-- Drop the table if exists
DROP TABLE IF EXISTS "product_searches" CASCADE;

COMMIT;
