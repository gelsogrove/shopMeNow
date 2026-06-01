-- CreateEnum (idempotent — a prior db push may have created it already)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChannelMode') THEN
    CREATE TYPE "ChannelMode" AS ENUM ('ECOMMERCE', 'INFORMATIONAL', 'FLOW');
  END IF;
END $$;

-- AddColumn
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "channelMode" "ChannelMode" NOT NULL DEFAULT 'INFORMATIONAL';

-- BackfillData: true → ECOMMERCE, false → INFORMATIONAL.
-- Only run while the legacy boolean column still exists (skip on re-run
-- after the DROP COLUMN below has already executed).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Workspace' AND column_name = 'sellsProductsAndServices'
  ) THEN
    UPDATE "Workspace" SET "channelMode" = CASE
      WHEN "sellsProductsAndServices" = true THEN 'ECOMMERCE'::"ChannelMode"
      ELSE 'INFORMATIONAL'::"ChannelMode"
    END;
  END IF;
END $$;

-- DropColumn
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "sellsProductsAndServices";
