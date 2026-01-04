-- Migration: Pulizia database - Rimozione tabelle e campi inutili
-- Created: 2025-10-20
-- Description: Rimuove tabelle chunks, OtpToken, Language, campi inutilizzati e rinomina ProductCode

BEGIN;

-- ============================================
-- STEP 1: DROP TABELLE CHUNKS (MAI USATE)
-- ============================================

-- Rimuovi prima le relazioni (foreign keys saranno droppate con CASCADE automatico da Prisma)
DROP TABLE IF EXISTS "DocumentChunks" CASCADE;
DROP TABLE IF EXISTS "FAQChunks" CASCADE;
DROP TABLE IF EXISTS "ServiceChunks" CASCADE;
DROP TABLE IF EXISTS "ProductChunks" CASCADE;

-- ============================================
-- STEP 2: DROP TABELLE INUTILIZZATE
-- ============================================

-- OtpToken: 2FA non implementato
DROP TABLE IF EXISTS "OtpToken" CASCADE;

-- Language: Duplicato di Languages (plurale)
DROP TABLE IF EXISTS "Language" CASCADE;

-- ============================================
-- STEP 3: RIMUOVI CAMPI INUTILI DA WORKSPACE
-- ============================================

-- apiSecret: Mai usato nel codice
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "apiSecret";

-- blocklist: Sempre stringa vuota, mai popolato (usare isBlacklisted su Customer)
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "blocklist";

-- ============================================
-- STEP 4: RIMUOVI CAMPO SKU DA PRODUCTS
-- ============================================

-- sku: Duplicato di ProductCode
ALTER TABLE "Products" DROP COLUMN IF EXISTS "sku";

-- ============================================
-- STEP 5: RINOMINA ProductCode → productCode
-- ============================================

-- Fix naming convention (PascalCase → camelCase)
ALTER TABLE "Products" RENAME COLUMN "ProductCode" TO "productCode";

-- ============================================
-- STEP 6: AGGIUNGI INDICI MANCANTI
-- ============================================

-- Indice su customers.phone per ricerche WhatsApp veloci
CREATE INDEX IF NOT EXISTS "idx_customers_phone" ON "Customers"("phone");

-- Indice su messages.chatSessionId per query messaggi chat
CREATE INDEX IF NOT EXISTS "idx_messages_chatSessionId" ON "Message"("chatSessionId");

-- Indice su orders.customerId per query ordini cliente
CREATE INDEX IF NOT EXISTS "idx_orders_customerId" ON "Orders"("customerId");

COMMIT;
