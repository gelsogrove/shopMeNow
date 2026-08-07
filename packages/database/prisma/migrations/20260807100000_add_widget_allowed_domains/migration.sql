-- Sites allowed to embed /widget-embed in an iframe, as origins with scheme
-- (e.g. "https://acme.com"). The widget-embed middleware turns this list into
-- the CSP frame-ancestors header, so a customer site missing here is blocked
-- by the browser before the widget can load.
-- Defaults to an empty array: existing workspaces stay embeddable only from
-- echatbot.ai itself, exactly as before this column existed.
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "widgetAllowedDomains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
