-- Add language preference field to User table
-- Default is 'ENG' (English) for existing users
ALTER TABLE "users" ADD COLUMN "language" VARCHAR(3) NOT NULL DEFAULT 'ENG';

-- Add comment for documentation
COMMENT ON COLUMN "users"."language" IS 'User preferred language code: ENG, ITA, ESP, POR, FRA, DEU';
