-- Auto-translate operator messages is now always on (Andrea, 2026-08-16):
-- the opt-out toggle added no value and was removed from FE/BE.
ALTER TABLE "Workspace" DROP COLUMN "translateOperatorMessages";
