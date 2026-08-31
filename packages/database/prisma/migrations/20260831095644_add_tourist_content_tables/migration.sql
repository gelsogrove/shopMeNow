-- PRO_LOCO tourism content tables (Andrea, 2026-08-31).
-- Only used/shown for channelMode=PRO_LOCO workspaces (e.g. demosappada).
-- Photos stored as base64 text, per Andrea's explicit instruction.

-- CreateTable
CREATE TABLE "tourist_restaurants" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cuisineType" TEXT,
    "celiacFriendly" BOOLEAN NOT NULL DEFAULT false,
    "needsReservation" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "phone" TEXT,
    "link" TEXT,
    "photoBase64" TEXT,
    "videoUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tourist_restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tourist_hotels" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stars" INTEGER,
    "location" TEXT,
    "phone" TEXT,
    "link" TEXT,
    "photoBase64" TEXT,
    "videoUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tourist_hotels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tourist_excursions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "difficulty" TEXT,
    "duration" TEXT,
    "location" TEXT,
    "link" TEXT,
    "photoBase64" TEXT,
    "videoUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tourist_excursions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tourist_refuges" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "climbTime" TEXT,
    "difficulty" TEXT,
    "openFrom" TEXT,
    "openTo" TEXT,
    "location" TEXT,
    "phone" TEXT,
    "link" TEXT,
    "photoBase64" TEXT,
    "videoUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tourist_refuges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tourist_restaurants_workspaceId_isActive_idx" ON "tourist_restaurants"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "tourist_hotels_workspaceId_isActive_idx" ON "tourist_hotels"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "tourist_excursions_workspaceId_isActive_idx" ON "tourist_excursions"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "tourist_refuges_workspaceId_isActive_idx" ON "tourist_refuges"("workspaceId", "isActive");

-- AddForeignKey
ALTER TABLE "tourist_restaurants" ADD CONSTRAINT "tourist_restaurants_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tourist_hotels" ADD CONSTRAINT "tourist_hotels_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tourist_excursions" ADD CONSTRAINT "tourist_excursions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tourist_refuges" ADD CONSTRAINT "tourist_refuges_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
