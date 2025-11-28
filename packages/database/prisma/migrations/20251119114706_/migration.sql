/*
  Warnings:

  - You are about to drop the column `isDOP` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `isGlutenFree` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `isHalal` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `isOrganic` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `isVegan` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `isWholeGrain` on the `products` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "products" DROP COLUMN "isDOP",
DROP COLUMN "isGlutenFree",
DROP COLUMN "isHalal",
DROP COLUMN "isOrganic",
DROP COLUMN "isVegan",
DROP COLUMN "isWholeGrain";

-- RenameIndex
ALTER INDEX "unique_active_session" RENAME TO "chat_sessions_customerId_status_key";
