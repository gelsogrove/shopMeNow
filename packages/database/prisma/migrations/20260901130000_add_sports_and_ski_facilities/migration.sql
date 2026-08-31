-- PRO_LOCO tourism: sports facilities + ski facilities tables (Andrea,
-- 2026-09-01: "strutture sportive per esempio qui mettiamo il golf di
-- sappada... e poi anche impianti di sci... tipo di pista blu rosso nera").
-- Same shape as the other tourist content tables; photos live in
-- tourist_photos via the two new TouristContentType values.

-- AlterEnum
ALTER TYPE "TouristContentType" ADD VALUE 'SPORTS_FACILITY';
ALTER TYPE "TouristContentType" ADD VALUE 'SKI_FACILITY';

-- CreateTable
CREATE TABLE "tourist_sports_facilities" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sport" TEXT,
    "location" TEXT,
    "link" TEXT,
    "videoUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tourist_sports_facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tourist_ski_facilities" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slopeType" TEXT,
    "location" TEXT,
    "link" TEXT,
    "videoUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tourist_ski_facilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tourist_sports_facilities_workspaceId_isActive_idx" ON "tourist_sports_facilities"("workspaceId", "isActive");
CREATE INDEX "tourist_ski_facilities_workspaceId_isActive_idx" ON "tourist_ski_facilities"("workspaceId", "isActive");

-- AddForeignKey
ALTER TABLE "tourist_sports_facilities" ADD CONSTRAINT "tourist_sports_facilities_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tourist_ski_facilities" ADD CONSTRAINT "tourist_ski_facilities_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
