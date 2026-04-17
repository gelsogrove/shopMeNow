-- Add dynamic pipeline flags to workspaces
-- These flags control which agents/calling-functions appear in the pipeline graph and runtime

ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "hasProductCatalog" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "hasCart" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "hasOrderTracking" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "needRegistration" BOOLEAN NOT NULL DEFAULT true;

-- Set correct defaults for INFORMATIONAL workspaces (no ecommerce features)
UPDATE "workspaces"
SET "hasProductCatalog" = false,
    "hasCart" = false,
    "hasOrderTracking" = false,
    "needRegistration" = true
WHERE "channelMode" = 'INFORMATIONAL';

-- Set correct defaults for FLOW workspaces (all off by default)
UPDATE "workspaces"
SET "hasProductCatalog" = false,
    "hasCart" = false,
    "hasOrderTracking" = false,
    "needRegistration" = false,
    "hasHumanSupport" = false
WHERE "channelMode" = 'FLOW';
