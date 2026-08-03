-- custom-demoam — one-time setup for the amrobots channel on Heroku
--
-- Andrea 2026-08-04. The DATABASE is the single source of truth: these values
-- live on the Workspace row, and every save from the app's Settings form
-- regenerates custom-demoam/settings.json on the server from them
-- (chatbot-settings-json.service.ts → writeChatbotSettingsJson). The file in
-- git only carries the module defaults.
--
-- HOW TO RUN (Andrea, manually — never from the assistant):
--   heroku pg:psql -a <app-name> < apps/backend/custom-demoam/heroku-amrobots-setup.sql
--
-- STEP 0 — verify the target row first. Adjust the WHERE if the name differs:
--   SELECT id, name, "customChatbotId" FROM "Workspace" WHERE name ILIKE '%amrobots%';

-- ── 1. Point the channel at the demoam module ──────────────────────────────
UPDATE "Workspace"
SET "customChatbotId" = 'demoam'
WHERE name ILIKE '%amrobots%';

-- ── 2. Dedicated columns (each editable in the app's Settings form) ────────
-- Only set what is empty; values already set from the app win — remove any
-- line you don't want to overwrite.
UPDATE "Workspace"
SET
  "welcomeMessage"      = 'Welcome! I''m your digital assistant. How can I help you today?',
  "welcomeBackMessage"  = 'Welcome back, {{customerName}}! How can I help you today?',
  "wipMessage"          = 'This service is temporarily unavailable. Please try again later.',
  "humanSupportMessage" = '{{customerName}}, I''m putting you through to our operator, they''ll get back to you shortly.',
  "defaultLanguage"     = 'en',
  "enabledLanguages"    = ARRAY['en']
WHERE name ILIKE '%amrobots%';

-- ── 3. Advanced settings JSON (keys with no dedicated column) ──────────────
-- Merged as-is onto settings.json at every save. Edit later from the app's
-- "Advanced Settings (JSON)" box — this is just the initial value.
UPDATE "Workspace"
SET "customChatbotAdvancedSettings" = COALESCE("customChatbotAdvancedSettings", '{}'::jsonb) || '{
  "serialNumberPattern": "^HK.{17}$",
  "serialNumberFormatHint": "19 characters, starting with HK",
  "rateLimitedMessage": "You''re sending messages a bit too fast — please slow down a little.",
  "sessionTooLongMessage": "This conversation has gone on for a while. Let''s continue with one of our operators.",
  "gateQuestions": {
    "serialNumber": "Can you give me the device''s serial number?",
    "problemDescription": "Can you briefly describe what''s happening?",
    "robotPoweredOn": "Is the device powered on?",
    "wifiActive": "Is the wifi active?",
    "cutSchedulingActive": "Is it currently on a scheduled cutting cycle?",
    "batterySufficient": "Is the battery sufficiently charged?",
    "name": "Can I have your name, please?"
  }
}'::jsonb
WHERE name ILIKE '%amrobots%';

-- ── 4. Verify ──────────────────────────────────────────────────────────────
-- SELECT "customChatbotId", "welcomeMessage", "welcomeBackMessage",
--        "customChatbotAdvancedSettings"
-- FROM "Workspace" WHERE name ILIKE '%amrobots%';
--
-- Then open the app's Settings page for the workspace and hit SAVE once:
-- that triggers writeChatbotSettingsJson and regenerates
-- custom-demoam/settings.json on the dyno with all of the above merged in.
