-- Andrea 2026-08-02: greet a returning customer by name, and never hand an
-- anonymous customer to an operator.
--
-- welcomeBackMessage  — replaces welcomeMessage once we know the customer's
--                       name, so a returning visitor is greeted personally.
-- humanSupportMessage — the sentence sent when escalating to a human. The bot
--                       asks for the name first when it has none, so this is
--                       always addressed to someone.
--
-- Both are per-workspace and editable in the app. {{customerName}} is
-- substituted at runtime; the LLM translates into the customer's language, so
-- no per-language copies are stored (CLAUDE.md §1: no hardcoded translations).

ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "welcomeBackMessage" TEXT
    DEFAULT 'Welcome back, {{customerName}}! How can I help you today?';

ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "humanSupportMessage" TEXT
    DEFAULT 'Hi {{customerName}}, I''m putting you in touch with our operator as soon as possible.';
