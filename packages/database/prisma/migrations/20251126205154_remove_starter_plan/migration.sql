/*
  Warnings:

  - The values [STARTER] on the enum `PlanType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PlanType_new" AS ENUM ('FREE_TRIAL', 'BASIC', 'PREMIUM', 'ENTERPRISE');
ALTER TABLE "public"."Workspace" ALTER COLUMN "planType" DROP DEFAULT;
ALTER TABLE "Workspace" ALTER COLUMN "planType" TYPE "PlanType_new" USING ("planType"::text::"PlanType_new");
ALTER TABLE "plan_configurations" ALTER COLUMN "planType" TYPE "PlanType_new" USING ("planType"::text::"PlanType_new");
ALTER TYPE "PlanType" RENAME TO "PlanType_old";
ALTER TYPE "PlanType_new" RENAME TO "PlanType";
DROP TYPE "public"."PlanType_old";
ALTER TABLE "Workspace" ALTER COLUMN "planType" SET DEFAULT 'FREE_TRIAL';
COMMIT;
