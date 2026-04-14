-- Migration: Remove frustrationEscalationInstructions field
-- Date: 2026-04-14

ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "frustrationEscalationInstructions";
