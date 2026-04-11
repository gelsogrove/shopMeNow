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

-- 4. Seed issuer info (enum values now committed, safe to use)
INSERT INTO platform_config (id, type, key, value, description, "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'TEXT', 'ISSUER_NAME',    'eChatbot S.r.l.',              'Company name printed on invoices',    true, NOW(), NOW()),
  (gen_random_uuid(), 'TEXT', 'ISSUER_ADDRESS',  'Via Roma 123, 00100 Roma, IT', 'Company address printed on invoices', true, NOW(), NOW()),
  (gen_random_uuid(), 'TEXT', 'ISSUER_VAT',      'IT00000000000',                'Company VAT number on invoices',      true, NOW(), NOW()),
  (gen_random_uuid(), 'TEXT', 'ISSUER_EMAIL',    'hello@echatbot.ai',            'Company email on invoices',           true, NOW(), NOW()),
  (gen_random_uuid(), 'TEXT', 'ISSUER_PHONE',    '+39 000 0000000',              'Company phone on invoices',           true, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;
