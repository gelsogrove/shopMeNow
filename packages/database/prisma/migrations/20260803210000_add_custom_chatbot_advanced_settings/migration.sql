-- Free-form JSON merged onto custom-<module>/settings.json on every workspace
-- save. Lets fields with no dedicated column (maxToolHops, rateLimitedMessage,
-- intakeQuestions, etc.) reach the module without a migration per field.
ALTER TABLE "Workspace" ADD COLUMN "customChatbotAdvancedSettings" JSONB;
