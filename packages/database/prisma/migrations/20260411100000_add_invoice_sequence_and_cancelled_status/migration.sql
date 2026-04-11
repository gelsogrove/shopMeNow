-- Migration: Add invoice_number_seq and CANCELLED SubscriptionStatus
--
-- 1. Create invoice_number_seq PostgreSQL sequence
--    Used by InvoiceService.ensureInvoiceNumber() to assign unique invoice numbers
--    Format: YYYYMMDD-NNNN (e.g. 20260411-0001)
--
-- 2. Add CANCELLED to SubscriptionStatus enum
--    Required by workspace-access.service.ts and monthly-billing.job.ts

-- Create the invoice number sequence (starts at 1, no max)
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MAXVALUE
  CACHE 1;

-- Add CANCELLED to SubscriptionStatus enum
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
