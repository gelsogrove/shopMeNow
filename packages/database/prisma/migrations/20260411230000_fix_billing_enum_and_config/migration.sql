-- Fix: Split enum operations and insert into separate statements
-- PostgreSQL requires new enum values to be committed before use

-- 1. Add CANCELLED to SubscriptionStatus enum
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- 2. Add TEXT to ConfigType enum
ALTER TYPE "ConfigType" ADD VALUE IF NOT EXISTS 'TEXT';

-- 3. Create invoice_year_sequences table
CREATE TABLE IF NOT EXISTS "invoice_year_sequences" (
  "year"       INTEGER NOT NULL,
  "last_value" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "invoice_year_sequences_pkey" PRIMARY KEY ("year")
);
