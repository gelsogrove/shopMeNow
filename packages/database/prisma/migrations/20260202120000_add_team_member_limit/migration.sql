-- Add maxTeamMembers to plan_configurations
ALTER TABLE "plan_configurations"
ADD COLUMN "maxTeamMembers" INTEGER NOT NULL DEFAULT 0;
