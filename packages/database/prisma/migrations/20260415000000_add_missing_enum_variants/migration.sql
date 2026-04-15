-- Add TEXT variant to ConfigType enum
ALTER TYPE "ConfigType" ADD VALUE IF NOT EXISTS 'TEXT';

-- Add CANCELLED variant to SubscriptionStatus enum
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
