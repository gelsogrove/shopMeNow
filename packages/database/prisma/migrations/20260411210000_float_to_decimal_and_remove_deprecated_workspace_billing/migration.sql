-- ============================================================
-- 1. Float → Decimal(10,2) for all financial fields
-- ============================================================

-- Products.price
ALTER TABLE "products" ALTER COLUMN "price" TYPE DECIMAL(10, 2) USING "price"::DECIMAL(10, 2);

-- Services.price
ALTER TABLE "services" ALTER COLUMN "price" TYPE DECIMAL(10, 2) USING "price"::DECIMAL(10, 2);

-- Orders money fields
ALTER TABLE "orders" ALTER COLUMN "totalAmount"    TYPE DECIMAL(10, 2) USING "totalAmount"::DECIMAL(10, 2);
ALTER TABLE "orders" ALTER COLUMN "shippingAmount" TYPE DECIMAL(10, 2) USING "shippingAmount"::DECIMAL(10, 2);
ALTER TABLE "orders" ALTER COLUMN "taxAmount"      TYPE DECIMAL(10, 2) USING "taxAmount"::DECIMAL(10, 2);
ALTER TABLE "orders" ALTER COLUMN "discountAmount" TYPE DECIMAL(10, 2) USING "discountAmount"::DECIMAL(10, 2);

-- OrderItems money fields
ALTER TABLE "order_items" ALTER COLUMN "unitPrice"  TYPE DECIMAL(10, 2) USING "unitPrice"::DECIMAL(10, 2);
ALTER TABLE "order_items" ALTER COLUMN "totalPrice" TYPE DECIMAL(10, 2) USING "totalPrice"::DECIMAL(10, 2);

-- CreditNote.amount
ALTER TABLE "credit_notes" ALTER COLUMN "amount" TYPE DECIMAL(10, 2) USING "amount"::DECIMAL(10, 2);

-- PaymentDetails.amount
ALTER TABLE "payment_details" ALTER COLUMN "amount" TYPE DECIMAL(10, 2) USING "amount"::DECIMAL(10, 2);

-- Usage.price
ALTER TABLE "usage" ALTER COLUMN "price" TYPE DECIMAL(10, 4) USING "price"::DECIMAL(10, 4);

-- Billing (legacy) money fields
ALTER TABLE "Billing" ALTER COLUMN "amount"        TYPE DECIMAL(10, 2) USING "amount"::DECIMAL(10, 2);
ALTER TABLE "Billing" ALTER COLUMN "previousTotal" TYPE DECIMAL(10, 2) USING "previousTotal"::DECIMAL(10, 2);
ALTER TABLE "Billing" ALTER COLUMN "currentCharge" TYPE DECIMAL(10, 2) USING "currentCharge"::DECIMAL(10, 2);
ALTER TABLE "Billing" ALTER COLUMN "newTotal"      TYPE DECIMAL(10, 2) USING "newTotal"::DECIMAL(10, 2);

-- ============================================================
-- 2. Remove deprecated Workspace billing fields (migrated to User model)
-- ============================================================
DROP INDEX IF EXISTS "Workspace_planType_idx";

ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "planType";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "creditBalance";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "trialEndsAt";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "planStartedAt";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "nextBillingDate";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "lowBalanceNotifiedAt";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "subscriptionStatus";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "pausedAt";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "pauseRequestedAt";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "pendingPlanType";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "pendingPlanEffectiveDate";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "lastPaymentFailedAt";
ALTER TABLE "Workspace" DROP COLUMN IF EXISTS "paymentFailureCount";
