-- Add missing reminderCost column to plan_configurations
ALTER TABLE "plan_configurations" ADD COLUMN IF NOT EXISTS "reminderCost" DECIMAL(10,2) NOT NULL DEFAULT 0.50;
