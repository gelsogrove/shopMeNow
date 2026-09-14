-- PRO_LOCO tourism: churches, castles, viewpoints and venues (Andrea,
-- 2026-09-14: "per la proloco dobbiamo aggiungere delle categorie: chiese,
-- castelli, punti panoramici, locali"). Same shape as the other tourist
-- content tables; photos live in tourist_photos via the four new
-- TouristContentType values.
--
-- "Locali" (tourist_venues) is deliberately separate from tourist_restaurants:
-- a place you go for a drink is not a place you go to eat, and venueType
-- ("bar", "pub", "birreria") is the term that wins chatbot retrieval.

-- AlterEnum
ALTER TYPE "TouristContentType" ADD VALUE 'CHURCH';
ALTER TYPE "TouristContentType" ADD VALUE 'CASTLE';
ALTER TYPE "TouristContentType" ADD VALUE 'VIEWPOINT';
ALTER TYPE "TouristContentType" ADD VALUE 'VENUE';

-- CreateTable
CREATE TABLE "tourist_churches" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "century" TEXT,
    "style" TEXT,
    "location" TEXT,
    "phone" TEXT,
    "link" TEXT,
    "videoUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tourist_churches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tourist_castles" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "century" TEXT,
    "visitInfo" TEXT,
    "location" TEXT,
    "phone" TEXT,
    "link" TEXT,
    "videoUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tourist_castles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tourist_viewpoints" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "altitude" INTEGER,
    "access" TEXT,
    "difficulty" TEXT,
    "location" TEXT,
    "link" TEXT,
    "videoUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tourist_viewpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tourist_venues" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "venueType" TEXT,
    "openingHours" TEXT,
    "location" TEXT,
    "phone" TEXT,
    "link" TEXT,
    "videoUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tourist_venues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tourist_churches_workspaceId_isActive_idx" ON "tourist_churches"("workspaceId", "isActive");
CREATE INDEX "tourist_castles_workspaceId_isActive_idx" ON "tourist_castles"("workspaceId", "isActive");
CREATE INDEX "tourist_viewpoints_workspaceId_isActive_idx" ON "tourist_viewpoints"("workspaceId", "isActive");
CREATE INDEX "tourist_venues_workspaceId_isActive_idx" ON "tourist_venues"("workspaceId", "isActive");

-- AddForeignKey
ALTER TABLE "tourist_churches" ADD CONSTRAINT "tourist_churches_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tourist_castles" ADD CONSTRAINT "tourist_castles_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tourist_viewpoints" ADD CONSTRAINT "tourist_viewpoints_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tourist_venues" ADD CONSTRAINT "tourist_venues_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
