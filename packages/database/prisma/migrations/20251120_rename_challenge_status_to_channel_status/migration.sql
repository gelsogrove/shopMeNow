-- Rename channelStatus column to channelStatus
-- Context: "channel" was an error - the correct term is "channel"
-- This column controls whether the chatbot/channel is enabled or disabled

ALTER TABLE "Workspace" RENAME COLUMN "channelStatus" TO "channelStatus";
