-- Fix the seed RobotModel's lookupRules to use the real serial number
-- prefix confirmed by the client, instead of the invented placeholder
-- "RCX200" from the original seed migration.
--
-- Real format: 19 chars, prefix HKX (2025 models) or HKA (2026 models),
-- e.g. HKX3EB100JD25070076. Using "HKX" here (the seed model plays the
-- role of a 2025 model) so a serial like HKX3EB100JD25070076 resolves via
-- matchSerialNumberToModel's startsWith prefix check.
--
-- Idempotent (guarded UPDATE), no-op if the seed row doesn't exist.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "robot_models" WHERE id = 'cm_seed_demorobot_x200') THEN
    RAISE NOTICE 'cm_seed_demorobot_x200 not found — skipping.';
    RETURN;
  END IF;

  UPDATE "robot_models"
  SET "lookupRules" = '{"prefix": "HKX"}'::jsonb,
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE id = 'cm_seed_demorobot_x200';
END $$;
