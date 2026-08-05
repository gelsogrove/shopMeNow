-- Drops the "view/edit prompt" feature: the AI-written plain-language instructions
-- were never read by the runtime (which executes off compiledPrompt + the node
-- graph directly), only shown to the user for manual review.
ALTER TABLE "demorobot_flows" DROP COLUMN "humanPrompt";
