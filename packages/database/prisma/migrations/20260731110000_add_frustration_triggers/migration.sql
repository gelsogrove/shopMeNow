-- Signals of customer frustration/panic that should trigger immediate
-- escalation to a human operator, complementing humanSupportInstructions.

ALTER TABLE "Workspace" ADD COLUMN "frustrationTriggers" TEXT;
