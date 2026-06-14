-- Consolidate the welcome/presentation video onto a single source of truth.
--
-- Historically two columns held the same concept:
--   • "welcomeVideoUrl"        — read by every consumer that actually SHOWS the
--                                 video (demo page, playground, operator chat,
--                                 WhatsApp inbound/ultramsg/wasender pipelines)
--   • "widgetWelcomeVideoUrl"  — the only column the Widget Settings UI and the
--                                 widget-embed endpoint wrote/read
-- The UI wrote one column while the demo/WhatsApp paths read the other, so a
-- video configured from the UI never appeared on the demo. We converge on
-- "welcomeVideoUrl" and drop the redundant column.

-- 1) Preserve any value that lived ONLY in the column we're about to drop.
UPDATE "Workspace"
SET "welcomeVideoUrl" = "widgetWelcomeVideoUrl"
WHERE "welcomeVideoUrl" IS NULL
  AND "widgetWelcomeVideoUrl" IS NOT NULL;

-- 2) Drop the now-redundant column.
ALTER TABLE "Workspace" DROP COLUMN "widgetWelcomeVideoUrl";
