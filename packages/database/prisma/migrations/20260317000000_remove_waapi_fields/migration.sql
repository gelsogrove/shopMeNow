-- Remove WaAPI fields from Workspace table
-- WaAPI provider is no longer supported; WasenderAPI is the QR-based provider

ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "waapiInstanceId";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "waapiInstanceStatus";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "waapiPhoneNumber";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "waapiPhoneName";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "waapiWebhookUrl";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "waapiWebhookEvents";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "waapiQrCodeData";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "waapiQrGeneratedAt";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "waapiIsActive";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "waapiLastSyncAt";

-- Drop index on waapiInstanceId
DROP INDEX IF EXISTS "Workspace_waapiInstanceId_idx";

-- Update default provider from 'waapi' to 'wasender'
ALTER TABLE "Workspace" ALTER COLUMN "whatsappProvider" SET DEFAULT 'wasender';

-- Migrate any existing waapi workspaces to wasender (cleanup)
UPDATE "Workspace" SET "whatsappProvider" = 'wasender' WHERE "whatsappProvider" = 'waapi';
