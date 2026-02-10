-- Add missing WaAPI fields to Workspace table
ALTER TABLE "Workspace" 
  ADD COLUMN IF NOT EXISTS "waapiWebhookEvents" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "waapiQrCodeData" TEXT,
  ADD COLUMN IF NOT EXISTS "waapiQrGeneratedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "waapiIsActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "waapiLastSyncAt" TIMESTAMP(3);
