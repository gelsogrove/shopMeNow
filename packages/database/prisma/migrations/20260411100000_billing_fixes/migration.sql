-- Migration: Billing system fixes
--
-- 1. Add CANCELLED to SubscriptionStatus enum
--    Required by workspace-access.service.ts and monthly-billing.job.ts
--
-- 2. Add TEXT to ConfigType enum
--    Allows storing free-text platform settings (company name, address, etc.)
--
-- 3. Create invoice_year_sequences table
--    Year-based invoice numbering: 2026-0001, resets to 0001 each new year
--    Table-based (vs PostgreSQL sequence) to support per-year reset
--
-- 4. Seed ISSUER_* settings in platform_config
--    Company info printed on invoice PDFs — update before going live
--
-- NOTE: invoice_number_seq (old sequence) is intentionally NOT created.
--       The new invoice_year_sequences table replaces it entirely.

-- 1. Enum: CANCELLED subscription status
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- 2. Enum: TEXT config type for free-text platform settings
ALTER TYPE "ConfigType" ADD VALUE IF NOT EXISTS 'TEXT';

-- PostgreSQL requires new enum values to be committed before use in the same session.
-- COMMIT the current transaction so 'TEXT' becomes available, then start a new one.
COMMIT;
BEGIN;

-- 3. Table: invoice_year_sequences (replaces invoice_number_seq sequence)
CREATE TABLE IF NOT EXISTS "invoice_year_sequences" (
  "year"       INTEGER NOT NULL,
  "last_value" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "invoice_year_sequences_pkey" PRIMARY KEY ("year")
);

-- 4. Seed: issuer info for invoice PDF (update with real data before going live)
INSERT INTO platform_config (id, type, key, value, description, "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'TEXT', 'ISSUER_NAME',    'eChatbot S.r.l.',              'Company name printed on invoices',    true, NOW(), NOW()),
  (gen_random_uuid(), 'TEXT', 'ISSUER_ADDRESS',  'Via Roma 123, 00100 Roma, IT', 'Company address printed on invoices', true, NOW(), NOW()),
  (gen_random_uuid(), 'TEXT', 'ISSUER_VAT',      'IT00000000000',                'Company VAT number on invoices',      true, NOW(), NOW()),
  (gen_random_uuid(), 'TEXT', 'ISSUER_EMAIL',    'hello@echatbot.ai',            'Company email on invoices',           true, NOW(), NOW()),
  (gen_random_uuid(), 'TEXT', 'ISSUER_PHONE',    '+39 000 0000000',              'Company phone on invoices',           true, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;
