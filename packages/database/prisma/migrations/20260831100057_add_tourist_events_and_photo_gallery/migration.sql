-- PRO_LOCO tourism: Events table + polymorphic photo gallery (Andrea, 2026-08-31).
-- Replaces the single photoBase64 column on the 4 content tables with a
-- gallery: "non mi piace il concetto di foto [singola], mi piacerebbe avere
-- un concetto di fotogallery".

-- DropColumn (single-photo field, superseded by tourist_photos)
ALTER TABLE "tourist_restaurants" DROP COLUMN "photoBase64";
ALTER TABLE "tourist_hotels" DROP COLUMN "photoBase64";
ALTER TABLE "tourist_excursions" DROP COLUMN "photoBase64";
ALTER TABLE "tourist_refuges" DROP COLUMN "photoBase64";

-- CreateEnum
CREATE TYPE "TouristContentType" AS ENUM ('RESTAURANT', 'HOTEL', 'EXCURSION', 'REFUGE', 'EVENT');

-- CreateTable
CREATE TABLE "tourist_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "price" TEXT,
    "ticketInfo" TEXT,
    "link" TEXT,
    "ticketLink" TEXT,
    "videoUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tourist_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tourist_photos" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contentType" "TouristContentType" NOT NULL,
    "contentId" TEXT NOT NULL,
    "imageBase64" TEXT NOT NULL,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tourist_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tourist_events_workspaceId_isActive_idx" ON "tourist_events"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "tourist_photos_workspaceId_contentType_contentId_idx" ON "tourist_photos"("workspaceId", "contentType", "contentId");

-- AddForeignKey
ALTER TABLE "tourist_events" ADD CONSTRAINT "tourist_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tourist_photos" ADD CONSTRAINT "tourist_photos_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
