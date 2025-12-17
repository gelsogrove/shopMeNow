-- Seed landing page flag to keep platform config in sync
INSERT INTO "platform_config" (
  "id",
  "type",
  "key",
  "value",
  "originalValue",
  "description",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'cfg-landing-page',
  'FLAG',
  'landingPageEnabled',
  'true',
  NULL,
  'When true, /index redirects to landing page. When false, redirect users to /auth/login',
  TRUE,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "platform_config" WHERE "key" = 'landingPageEnabled'
);
