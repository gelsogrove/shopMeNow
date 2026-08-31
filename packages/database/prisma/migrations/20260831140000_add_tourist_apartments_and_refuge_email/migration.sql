-- PRO_LOCO tourism: vacation houses & apartments table + email on refuges
-- (Andrea, 2026-08-31). Source: the Pro Loco's official "Case e appartamenti
-- per vacanze" list — one row per rentable unit (apartments, affittacamere,
-- residences, agencies, consortia), with capacity as integers so the bot can
-- reason about party size.

-- AlterTable (Andrea: "mi piacerebbe alle strutture rifugi avere anche un campo email")
ALTER TABLE "tourist_refuges" ADD COLUMN "email" TEXT;

-- AlterEnum
ALTER TYPE "TouristContentType" ADD VALUE 'APARTMENT';

-- CreateTable
CREATE TABLE "tourist_apartments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "location" TEXT,
    "streetNumber" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "rooms" INTEGER,
    "beds" INTEGER,
    "bathrooms" INTEGER,
    "link" TEXT,
    "videoUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tourist_apartments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tourist_apartments_workspaceId_isActive_idx" ON "tourist_apartments"("workspaceId", "isActive");

-- AddForeignKey
ALTER TABLE "tourist_apartments" ADD CONSTRAINT "tourist_apartments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
