-- Widget client-side error copy (rule 1A: customer-facing copy lives in the DB,
-- never in code). Shown by the widget when a chat turn fails at the transport
-- level (network error, malformed body). NULL = the widget shows nothing.
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "widgetErrorMessage" TEXT;
