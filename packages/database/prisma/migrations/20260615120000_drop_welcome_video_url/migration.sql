-- Remove the standalone presentation-video column.
--
-- The welcome/presentation video URL now lives INSIDE the welcome message text
-- (authored in the custom module greeting, e.g. demowash/demohouse common.md).
-- The rendering layer extracts it: WhatsApp via formatWelcomeReply (inbound +
-- ultramsg + wasender pipelines), the widget/playground via the frontend
-- welcome-video extractor. There is no separate workspace field anymore.
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "welcomeVideoUrl";
