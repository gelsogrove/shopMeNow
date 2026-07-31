-- Documentation-only field: languages the client has requested support for.
-- Does NOT restrict runtime chatbot behaviour — language is still detected
-- from the customer's message (CLAUDE.md §14, no keyword/list-based gating).

ALTER TABLE "Workspace" ADD COLUMN "enabledLanguages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
