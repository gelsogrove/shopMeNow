-- Migration: Cleanup database with data migration
-- Created: 2025-10-20
-- Description: Migra dati prima di rimuovere colonne

BEGIN;

-- ============================================
-- STEP 0: MIGRA DATI PRIMA DI ELIMINARE
-- ============================================

-- Migra ProductCode → productCode (rename preserva dati)
-- Già fatto con ALTER TABLE RENAME COLUMN

-- blocklist: Migra eventuali valori non vuoti in Customer.isBlacklisted
-- (Se workspace ha blocklist popolato, marca tutti i customer come blacklisted)
DO $$
DECLARE
  ws_record RECORD;
BEGIN
  FOR ws_record IN 
    SELECT id, blocklist 
    FROM "Workspace" 
    WHERE blocklist IS NOT NULL AND blocklist != ''
  LOOP
    -- Marca tutti i customer del workspace come blacklisted
    -- (Nota: questo è un'interpretazione - potrebbe servire logica più sofisticata)
    UPDATE "Customers" 
    SET "isBlacklisted" = true 
    WHERE "workspaceId" = ws_record.id 
      AND phone IN (
        SELECT unnest(string_to_array(ws_record.blocklist, ','))
      );
  END LOOP;
END $$;

-- ============================================
-- STEP 1: DROP TABELLE CHUNKS (MAI USATE)
-- ============================================

DROP TABLE IF EXISTS "document_chunks" CASCADE;
DROP TABLE IF EXISTS "faq_chunks" CASCADE;
DROP TABLE IF EXISTS "service_chunks" CASCADE;
DROP TABLE IF EXISTS "product_chunks" CASCADE;

-- ============================================
-- STEP 2: DROP TABELLE INUTILIZZATE
-- ============================================

DROP TABLE IF EXISTS "otp_tokens" CASCADE;
DROP TABLE IF EXISTS "Language" CASCADE;

-- ============================================
-- STEP 3: RIMUOVI CAMPI DA WORKSPACE
-- ============================================

ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "apiSecret";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "blocklist";

-- ============================================
-- STEP 4: RIMUOVI CAMPO SKU DA PRODUCTS
-- ============================================

ALTER TABLE "products" DROP COLUMN IF EXISTS "sku";

-- ============================================
-- STEP 5: RINOMINA ProductCode → productCode
-- ============================================

-- Prisma genera automaticamente questa rename nella migration

-- ============================================
-- STEP 6: AGGIUNGI INDICI MANCANTI
-- ============================================

CREATE INDEX IF NOT EXISTS "Customers_phone_idx" ON "Customers"("phone");
CREATE INDEX IF NOT EXISTS "Message_chatSessionId_idx" ON "Message"("chatSessionId");
CREATE INDEX IF NOT EXISTS "Orders_customerId_idx" ON "Orders"("customerId");

COMMIT;
