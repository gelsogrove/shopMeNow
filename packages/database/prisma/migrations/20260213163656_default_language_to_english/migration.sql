-- AlterTable: Change default language from "it" to "en"
ALTER TABLE "Workspace" ALTER COLUMN "defaultLanguage" SET DEFAULT 'en';
ALTER TABLE "Workspace" ALTER COLUMN "widgetLanguage" SET DEFAULT 'en';
ALTER TABLE "customers" ALTER COLUMN "language" SET DEFAULT 'en';
