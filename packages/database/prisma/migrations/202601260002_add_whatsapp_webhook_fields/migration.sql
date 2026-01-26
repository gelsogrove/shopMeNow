-- Add webhook identifiers per WhatsApp channel (workspace-level)
ALTER TABLE "whatsapp_settings"
ADD COLUMN "webhookId" VARCHAR(50),
ADD COLUMN "webhookToken" VARCHAR(64);

-- Backfill existing rows with generated values
UPDATE "whatsapp_settings"
SET
  "webhookId" = CONCAT('wh_', substr(md5(random()::text || clock_timestamp()::text), 1, 24)),
  "webhookToken" = CONCAT('tok_', substr(md5(random()::text || clock_timestamp()::text), 1, 32))
WHERE "webhookId" IS NULL OR "webhookToken" IS NULL;

-- Enforce uniqueness and non-null
ALTER TABLE "whatsapp_settings"
ALTER COLUMN "webhookId" SET NOT NULL,
ALTER COLUMN "webhookToken" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_settings_webhookId_key" ON "whatsapp_settings"("webhookId");
