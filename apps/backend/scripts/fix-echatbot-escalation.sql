-- CRITICAL FIX: Set frustration escalation instructions for eChatbot workspace
-- Run with: psql $DATABASE_URL -f scripts/fix-echatbot-escalation.sql

UPDATE "Workspace"
SET "frustrationEscalationInstructions" = '- quando utente chiede di parlare con un operatore
- quando un untete si lamenta  
- quando dice "non funziona nulla"
- quando esprime frustrazione'
WHERE name LIKE '%eChatbot%'
  AND "deletedAt" IS NULL;

-- Verify the update
SELECT 
  id,
  name,
  "hasHumanSupport",
  "operatorWhatsappNumber",
  LENGTH("frustrationEscalationInstructions") as "escalation_length"
FROM "Workspace"
WHERE name LIKE '%eChatbot%'
  AND "deletedAt" IS NULL;
