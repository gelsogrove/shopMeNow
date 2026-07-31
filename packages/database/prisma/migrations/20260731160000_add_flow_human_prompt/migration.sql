-- Plain-language instructions generated from a flow's compiledPrompt by an LLM,
-- reviewed (and optionally edited) by the user before saving.
-- Nullable: existing flows simply have no generated prompt yet.
ALTER TABLE "demorobot_flows" ADD COLUMN IF NOT EXISTS "humanPrompt" TEXT;
