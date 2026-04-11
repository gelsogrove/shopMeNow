-- Migration: Add TEXT to ConfigType enum and seed issuer settings
--
-- ISSUER_* keys store the company info printed on every invoice PDF.
-- Update these values in the backoffice (or directly in DB) before going live.

ALTER TYPE "ConfigType" ADD VALUE IF NOT EXISTS 'TEXT';

-- Seed default issuer settings (UPDATE these with real data before going live)
INSERT INTO platform_config (id, type, key, value, description, "isActive", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'TEXT', 'ISSUER_NAME',    'eChatbot S.r.l.',              'Company name printed on invoices',    true, NOW(), NOW()),
  (gen_random_uuid(), 'TEXT', 'ISSUER_ADDRESS',  'Via Roma 123, 00100 Roma, IT', 'Company address printed on invoices', true, NOW(), NOW()),
  (gen_random_uuid(), 'TEXT', 'ISSUER_VAT',      'IT00000000000',                'Company VAT number on invoices',      true, NOW(), NOW()),
  (gen_random_uuid(), 'TEXT', 'ISSUER_EMAIL',    'hello@echatbot.ai',            'Company email on invoices',           true, NOW(), NOW()),
  (gen_random_uuid(), 'TEXT', 'ISSUER_PHONE',    '+39 000 0000000',              'Company phone on invoices',           true, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;
