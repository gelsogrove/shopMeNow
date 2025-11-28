-- Migrate existing SAFETY_TRANSLATION agents to TRANSLATION
UPDATE "agent_configs" SET type = 'TRANSLATION' WHERE type = 'SAFETY_TRANSLATION';
