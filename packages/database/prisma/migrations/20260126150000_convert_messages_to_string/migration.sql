-- AlterTable: Convert Json to Text for message fields
-- This migration converts welcomeMessage, wipMessage, and afterRegistrationMessages
-- from Json (multilingual object) to Text (plain string in English)
-- The Translation Agent will handle multilingual translation dynamically

ALTER TABLE "Workspace" ALTER COLUMN "welcomeMessage" TYPE TEXT;
ALTER TABLE "Workspace" ALTER COLUMN "wipMessage" TYPE TEXT;
ALTER TABLE "Workspace" ALTER COLUMN "afterRegistrationMessages" TYPE TEXT;
