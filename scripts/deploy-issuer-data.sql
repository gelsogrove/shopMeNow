-- Script per aggiornare i dati Issuer in produzione
-- Da eseguire con: heroku pg:psql -a echatbot-app < scripts/deploy-issuer-data.sql

-- Aggiorna i dati dell'emittente fatture
UPDATE "PlatformConfig" SET value = 'eChatbot S.r.l.' WHERE key = 'ISSUER_NAME';
UPDATE "PlatformConfig" SET value = 'Via Example 123, 20100 Milano, Italia' WHERE key = 'ISSUER_ADDRESS';
UPDATE "PlatformConfig" SET value = 'IT12345678901' WHERE key = 'ISSUER_VAT';
UPDATE "PlatformConfig" SET value = 'billing@echatbot.ai' WHERE key = 'ISSUER_EMAIL';
UPDATE "PlatformConfig" SET value = '+39 02 1234567' WHERE key = 'ISSUER_PHONE';

-- Verifica i valori aggiornati
SELECT key, value FROM "PlatformConfig" WHERE key LIKE 'ISSUER_%' ORDER BY key;
