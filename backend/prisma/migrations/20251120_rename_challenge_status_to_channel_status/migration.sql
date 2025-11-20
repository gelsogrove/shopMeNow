-- Rename challengeStatus column to channelStatus
-- Context: "challenge" was an error - the correct term is "channel"
-- This column controls whether the chatbot/channel is enabled or disabled

ALTER TABLE "Workspace" RENAME COLUMN "challengeStatus" TO "channelStatus";
