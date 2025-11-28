/*
  Warnings:

  - You are about to drop the column `apiSecret` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the column `blocklist` on the `Workspace` table. All the data in the column will be lost.
  - You are about to drop the column `ProductCode` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `sku` on the `products` table. All the data in the column will be lost.
  - You are about to drop the `Language` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `document_chunks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `faq_chunks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `otp_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `product_chunks` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `service_chunks` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."document_chunks" DROP CONSTRAINT "document_chunks_documentId_fkey";

-- DropForeignKey
ALTER TABLE "public"."faq_chunks" DROP CONSTRAINT "faq_chunks_faqId_fkey";

-- DropForeignKey
ALTER TABLE "public"."otp_tokens" DROP CONSTRAINT "otp_tokens_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."product_chunks" DROP CONSTRAINT "product_chunks_productId_fkey";

-- DropForeignKey
ALTER TABLE "public"."service_chunks" DROP CONSTRAINT "service_chunks_serviceId_fkey";

-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "apiSecret",
DROP COLUMN "blocklist";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "ProductCode",
DROP COLUMN "sku",
ADD COLUMN     "productCode" TEXT;

-- DropTable
DROP TABLE "public"."Language";

-- DropTable
DROP TABLE "public"."document_chunks";

-- DropTable
DROP TABLE "public"."faq_chunks";

-- DropTable
DROP TABLE "public"."otp_tokens";

-- DropTable
DROP TABLE "public"."product_chunks";

-- DropTable
DROP TABLE "public"."service_chunks";

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "messages_chatSessionId_idx" ON "messages"("chatSessionId");

-- CreateIndex
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");
