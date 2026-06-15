-- Rebrand the real-estate demo from "DemoHouse" to "DemoRealEstate".
--
-- The custom-chatbot demo workspace is resolved by URL slug: the public page
-- /demo/<slug> calls GET /api/v1/playground/resolve-demo/:slug, which looks up
-- the workspace whose "customChatbotId" equals the slug. The code-based module
-- folder was renamed apps/backend/custom-demohouse → custom-demorealestate and
-- the frontend route is now /demo/demorealestate, so the workspace row must
-- follow: otherwise /demo/demorealestate resolves to nothing and the old
-- /demo/demohouse no longer has a matching module.
--
-- This realigns the existing row's identifiers (and display name) in one shot.
-- Guarded on the old value so it is idempotent and a no-op once applied.

UPDATE "Workspace"
SET "customChatbotId" = 'demorealestate',
    "slug"            = 'demorealestate',
    "name"            = 'DemoRealEstate'
WHERE "customChatbotId" = 'demohouse';
