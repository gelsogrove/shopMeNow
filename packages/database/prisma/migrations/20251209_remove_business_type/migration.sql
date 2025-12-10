-- DropColumn: Remove unused businessType from Workspace
ALTER TABLE "public"."Workspace" DROP COLUMN IF EXISTS "businessType";

-- DropEnum: Remove unused BusinessType enum
DROP TYPE IF EXISTS "public"."BusinessType";
