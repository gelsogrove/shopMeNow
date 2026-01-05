/*
  Warnings:

  - The values [NEW_FAQ,ACTIVE_OFFER] on the enum `BillingType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BillingType_new" AS ENUM ('MONTHLY_CHANNEL', 'MESSAGE', 'NEW_CUSTOMER', 'NEW_ORDER', 'HUMAN_SUPPORT', 'PUSH_MESSAGE', 'PUSH_CAMPAIGN', 'FEEDBACK', 'ORDER_REVIEW', 'CAMPAIGN_LINK');
ALTER TABLE "Billing" ALTER COLUMN "type" TYPE "BillingType_new" USING ("type"::text::"BillingType_new");
ALTER TYPE "BillingType" RENAME TO "BillingType_old";
ALTER TYPE "BillingType_new" RENAME TO "BillingType";
DROP TYPE "public"."BillingType_old";
COMMIT;
