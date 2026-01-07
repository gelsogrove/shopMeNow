-- Make maxTeamMembers nullable to support unlimited team members
-- Specification: FREE_TRIAL=0, BASIC=3, PREMIUM=NULL, ENTERPRISE=NULL

-- Recreate the column as nullable (drop if exists to be safe)
ALTER TABLE plan_configurations 
DROP COLUMN IF EXISTS "maxTeamMembers" CASCADE;

-- Create new max_team_members column as nullable
ALTER TABLE plan_configurations 
ADD COLUMN max_team_members INTEGER;

-- Map it in Prisma schema with @map("max_team_members")
-- Update values per specification
UPDATE plan_configurations 
SET max_team_members = 0 
WHERE "planType" = 'FREE_TRIAL';

UPDATE plan_configurations 
SET max_team_members = 3 
WHERE "planType" = 'BASIC';

UPDATE plan_configurations 
SET max_team_members = NULL 
WHERE "planType" IN ('PREMIUM', 'ENTERPRISE');
