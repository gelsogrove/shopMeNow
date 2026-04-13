-- CreateEnum
CREATE TYPE "ChannelMode" AS ENUM ('ECOMMERCE', 'INFORMATIONAL', 'FLOW');

-- AddColumn
ALTER TABLE "Workspace" ADD COLUMN "channelMode" "ChannelMode" NOT NULL DEFAULT 'INFORMATIONAL';

-- BackfillData: true → ECOMMERCE, false → INFORMATIONAL
UPDATE "Workspace" SET "channelMode" = CASE
  WHEN "sellsProductsAndServices" = true THEN 'ECOMMERCE'::"ChannelMode"
  ELSE 'INFORMATIONAL'::"ChannelMode"
END;

-- DropColumn
ALTER TABLE "Workspace" DROP COLUMN "sellsProductsAndServices";
