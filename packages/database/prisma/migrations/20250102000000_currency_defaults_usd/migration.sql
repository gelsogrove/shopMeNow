-- Set default currency for channel-facing data to USD
ALTER TABLE "Workspace" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "customers" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "services" ALTER COLUMN "currency" SET DEFAULT 'USD';
ALTER TABLE "payment_details" ALTER COLUMN "currency" SET DEFAULT 'USD';
