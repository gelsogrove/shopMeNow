-- Add Zoom integration to Workspace
ALTER TABLE "Workspace" ADD COLUMN "zoomAccessToken" TEXT,
ADD COLUMN "zoomRefreshToken" TEXT,
ADD COLUMN "zoomConnected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "zoomUserId" TEXT;

-- Add Zoom meeting fields to Appointment
ALTER TABLE "appointments" ADD COLUMN "zoomLink" TEXT,
ADD COLUMN "zoomMeetingId" TEXT;

-- Index for Zoom meeting lookups
CREATE INDEX "appointments_zoomMeetingId_idx" ON "appointments"("zoomMeetingId");
