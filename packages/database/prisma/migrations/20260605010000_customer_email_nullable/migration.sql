-- Make Customers.email nullable.
-- WhatsApp customers arrive without an email; we no longer fabricate
-- temp_<phone>@pending.com placeholders. Email is captured only when the
-- customer actually provides it (e.g. for an invoice).
ALTER TABLE "customers" ALTER COLUMN "email" DROP NOT NULL;

-- Clean up existing placeholder emails so they don't leak into invoices/UI.
UPDATE "customers" SET "email" = NULL WHERE "email" LIKE 'temp\_%@pending.com';
