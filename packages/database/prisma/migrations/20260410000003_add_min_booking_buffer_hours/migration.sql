-- AlterTable: Add configurable minimum booking buffer hours (default 12h)
-- Slots must be at least this many hours in the future to be bookable
ALTER TABLE "Workspace" ADD COLUMN "minBookingBufferHours" INTEGER NOT NULL DEFAULT 12;
