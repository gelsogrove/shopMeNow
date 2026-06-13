-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('IMAGE', 'DOCUMENT', 'AUDIO');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ChannelMode" AS ENUM ('ECOMMERCE', 'INFORMATIONAL', 'FLOW');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT', 'OUT_OF_STOCK');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'PROCESSED', 'ERROR');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'PAYPAL', 'CASH_ON_DELIVERY', 'CRYPTO');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_PAID');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'DOCUMENT', 'LOCATION', 'CONTACT');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('NEW', 'PENDING_APPROVAL', 'ACTIVE');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('WHATSAPP', 'WIDGET', 'TELEGRAM', 'MESSENGER', 'LINE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE_TRIAL', 'BASIC', 'PREMIUM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSE_PENDING', 'PAUSED', 'PAYMENT_FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('MESSAGE', 'NEW_ORDER', 'PUSH_NOTIFICATION', 'APPOINTMENT_REMINDER', 'RECHARGE', 'MONTHLY_FEE', 'UPGRADE_FEE', 'ADJUSTMENT', 'INITIAL_CREDIT', 'BONUS', 'INVOICE_PAID');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayPalStatus" AS ENUM ('DISCONNECTED', 'CONNECTED');

-- CreateEnum
CREATE TYPE "PayPalTransactionStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('MONTHLY_CHANNEL', 'MESSAGE', 'NEW_CUSTOMER', 'NEW_ORDER', 'PUSH_CAMPAIGN', 'FEEDBACK', 'ORDER_REVIEW', 'CAMPAIGN_LINK');

-- CreateEnum
CREATE TYPE "CampaignFrequency" AS ENUM ('ONCE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "CampaignTargetType" AS ENUM ('ALL', 'MANUAL', 'TAGS', 'SELECTED');

-- CreateEnum
CREATE TYPE "PushCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PushCampaignBillingStatus" AS ENUM ('PENDING', 'PARTIAL', 'BILLED', 'FAILED');

-- CreateEnum
CREATE TYPE "PushCampaignChannel" AS ENUM ('WHATSAPP');

-- CreateEnum
CREATE TYPE "PushCampaignRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ConfigType" AS ENUM ('PRICE', 'FLAG', 'LIMIT', 'TEXT');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('ROUTER', 'OPERATOR', 'PRODUCT_SEARCH', 'CART_MANAGEMENT', 'ORDER_TRACKING', 'CUSTOMER_SUPPORT', 'INFO_AGENT', 'SUMMARY_AGENT', 'PROFILE_MANAGEMENT', 'NOTIFICATIONS', 'CONVERSATION_HISTORY', 'SAFETY_TRANSLATION', 'SECURITY', 'TRANSLATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SearchConversationState" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SupportIssueType" AS ENUM ('ACCOUNT_ISSUE', 'PLAN_AND_BILLING', 'WHATSAPP', 'WIDGET', 'SALES_AGENT', 'SUPPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportSenderType" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "whatsappPhoneNumber" TEXT,
    "whatsappApiKey" TEXT,
    "whatsappPhoneNumberId" TEXT,
    "whatsappVerifyToken" TEXT,
    "notificationEmail" TEXT,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "webhookTimeout" INTEGER DEFAULT 10000,
    "language" TEXT NOT NULL DEFAULT 'ENG',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en',
    "channelStatus" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "messageLimit" INTEGER NOT NULL DEFAULT 50,
    "url" TEXT,
    "welcomeMessage" TEXT DEFAULT 'Welcome! I''m {{chatbotName}}, your digital assistant. How can I help you today?',
    "enableWelcomeMessage" BOOLEAN NOT NULL DEFAULT true,
    "welcomeVideoUrl" TEXT,
    "sessionResetTimeout" INTEGER NOT NULL DEFAULT 3600,
    "wipMessage" TEXT DEFAULT 'Work in progress. Please contact us later.',
    "afterRegistrationMessages" TEXT DEFAULT 'Thank you for registering, {{customerName}}! How can I help you today? Would you like to see your orders? The offers? Or do you need other information?',
    "debugMode" BOOLEAN NOT NULL DEFAULT false,
    "apiKey" TEXT,
    "metadata" JSONB,
    "allowedExternalLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logoUrl" TEXT,
    "logoKey" TEXT,
    "websiteUrl" TEXT,
    "widgetLogoUrl" TEXT,
    "widgetLogoKey" TEXT,
    "widgetTitle" TEXT,
    "widgetLanguage" TEXT DEFAULT 'en',
    "widgetPrimaryColor" TEXT DEFAULT '#22c55e',
    "widgetTextColor" TEXT DEFAULT '#0f172a',
    "widgetIcon" TEXT DEFAULT 'chat',
    "widgetUseChannelLogo" BOOLEAN NOT NULL DEFAULT false,
    "widgetAutoSuggestionsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "widgetQuickReplies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "widgetSuggestionsModel" TEXT,
    "widgetWelcomeVideoUrl" TEXT,
    "channelType" "ChannelType" NOT NULL DEFAULT 'WHATSAPP',
    "enableWhatsapp" BOOLEAN NOT NULL DEFAULT true,
    "enableWidget" BOOLEAN NOT NULL DEFAULT false,
    "channelMode" "ChannelMode" NOT NULL DEFAULT 'INFORMATIONAL',
    "enableCalendarBooking" BOOLEAN NOT NULL DEFAULT false,
    "hasSalesAgents" BOOLEAN NOT NULL DEFAULT false,
    "hasHumanSupport" BOOLEAN NOT NULL DEFAULT true,
    "hasProductCatalog" BOOLEAN NOT NULL DEFAULT true,
    "hasCart" BOOLEAN NOT NULL DEFAULT true,
    "hasOrderTracking" BOOLEAN NOT NULL DEFAULT true,
    "needRegistration" BOOLEAN NOT NULL DEFAULT true,
    "humanSupportInstructions" TEXT,
    "operatorContactMethod" TEXT DEFAULT 'email',
    "operatorEmail" TEXT,
    "operatorWhatsappNumber" TEXT,
    "toneOfVoice" TEXT DEFAULT 'friendly',
    "translateOperatorMessages" BOOLEAN NOT NULL DEFAULT true,
    "whatsappProvider" TEXT NOT NULL DEFAULT 'wasender',
    "metaPhoneNumberId" TEXT,
    "metaAccessToken" TEXT,
    "webhookVerifyToken" TEXT,
    "ultraMsgInstanceId" TEXT,
    "ultraMsgToken" TEXT,
    "ultraMsgApiUrl" TEXT,
    "wasenderSessionId" TEXT,
    "wasenderApiKey" TEXT,
    "wasenderSessionStatus" TEXT,
    "wasenderPhoneNumber" TEXT,
    "wasenderQrString" TEXT,
    "wasenderQrGeneratedAt" TIMESTAMP(3),
    "wasenderIsActive" BOOLEAN NOT NULL DEFAULT false,
    "botIdentityResponse" TEXT,
    "customAiRules" TEXT,
    "address" TEXT,
    "chatbotName" TEXT DEFAULT 'Assistente',
    "businessType" TEXT DEFAULT 'other',
    "customChatbotId" TEXT,
    "registrationPage" TEXT,
    "requireManualApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvalMessage" TEXT,
    "translateProductNames" BOOLEAN NOT NULL DEFAULT false,
    "translateCategoryNames" BOOLEAN NOT NULL DEFAULT false,
    "translateServiceNames" BOOLEAN NOT NULL DEFAULT true,
    "catalogBaseLanguage" TEXT NOT NULL DEFAULT 'it',
    "ownerId" TEXT,
    "timezone" TEXT DEFAULT 'Europe/Rome',
    "appointmentReminder24hEnabled" BOOLEAN NOT NULL DEFAULT true,
    "appointmentReminder24hMessage" TEXT DEFAULT 'Hi {{customerName}}, reminder: your {{appointmentType}} appointment is tomorrow {{appointmentDate}} at {{appointmentTime}}. Confirm your presence?',
    "appointmentReminder1hEnabled" BOOLEAN NOT NULL DEFAULT true,
    "appointmentReminder1hMessage" TEXT DEFAULT 'Hi {{customerName}}, your {{appointmentType}} appointment starts in 1 hour at {{appointmentTime}}. See you soon!',
    "appointmentReminder30mEnabled" BOOLEAN NOT NULL DEFAULT false,
    "appointmentReminder30mMessage" TEXT DEFAULT 'Hi {{customerName}}, your {{appointmentType}} appointment starts in 30 minutes at {{appointmentTime}}. We''re waiting for you!',
    "appointmentReminderChannel" TEXT NOT NULL DEFAULT 'whatsapp',
    "appointmentReminderHours" INTEGER[] DEFAULT ARRAY[24, 1]::INTEGER[],
    "minBookingBufferHours" INTEGER NOT NULL DEFAULT 12,
    "zoomAccessToken" TEXT,
    "zoomRefreshToken" TEXT,
    "zoomConnected" BOOLEAN NOT NULL DEFAULT false,
    "zoomUserId" TEXT,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flow_node_configs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "flowKey" TEXT NOT NULL,
    "flowLabel" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "maxTokens" INTEGER NOT NULL DEFAULT 2048,
    "availableFunctions" JSONB NOT NULL DEFAULT '[]',
    "flows" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flow_node_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "workspaceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "languages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "formato" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "workspaceId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "link" VARCHAR(120),
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "imageUrl" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageKey" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Temperatura ambiente',
    "region" TEXT,
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCertification" (
    "productId" TEXT NOT NULL,
    "certificationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCertification_pkey" PRIMARY KEY ("productId","certificationId")
);

-- CreateTable
CREATE TABLE "Type" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductType" (
    "productId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,

    CONSTRAINT "ProductType_pkey" PRIMARY KEY ("productId","typeId")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "productId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId")
);

-- CreateTable
CREATE TABLE "ProductCharacteristic" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCharacteristic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_queue" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "messageContent" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "conversationMessageId" TEXT,
    "pushCampaignId" TEXT,
    "pushCampaignRecipientId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "visitorId" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "responsePayload" JSONB,
    "pollingAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastPolledAt" TIMESTAMP(3),
    "isPlayground" BOOLEAN NOT NULL DEFAULT false,
    "skipSecurityCheck" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "whatsapp_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_webhook_events" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "externalMessageId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "customId" TEXT,
    "address" TEXT,
    "company" TEXT,
    "discount" DOUBLE PRECISION DEFAULT 0,
    "language" TEXT DEFAULT 'en',
    "currency" TEXT DEFAULT 'EUR',
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "serviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "registrationStatus" "RegistrationStatus" NOT NULL DEFAULT 'NEW',
    "workspaceId" TEXT NOT NULL,
    "last_privacy_version_accepted" TEXT,
    "privacy_accepted_at" TIMESTAMP(3),
    "push_notifications_consent" BOOLEAN NOT NULL DEFAULT false,
    "push_notifications_consent_at" TIMESTAMP(3),
    "activeChatbot" BOOLEAN NOT NULL DEFAULT true,
    "operatorRequestedAt" TIMESTAMP(3),
    "originChannel" TEXT,
    "operatorQueuePosition" INTEGER,
    "operatorQueueEnteredAt" TIMESTAMP(3),
    "invoiceAddress" JSONB,
    "salesId" TEXT,
    "maxActiveAppointments" INTEGER DEFAULT 5,
    "lastAppointmentDate" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_conversations" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "state" "SearchConversationState" NOT NULL DEFAULT 'ACTIVE',
    "activeAgent" "AgentType",
    "lastQuery" TEXT,
    "lastResponse" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "PaymentMethod",
    "paymentStatus" "PaymentStatus" DEFAULT 'PENDING',
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "shippingAmount" DECIMAL(10,2) DEFAULT 0,
    "taxAmount" DECIMAL(10,2) DEFAULT 0,
    "shippingAddress" JSONB,
    "billingAddress" JSONB,
    "notes" TEXT,
    "discountCode" TEXT,
    "discountAmount" DECIMAL(10,2) DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "billedAt" TIMESTAMP(3),
    "customerId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "trackingNumber" TEXT,
    "invoiceUrl" TEXT,
    "invoiceKey" TEXT,
    "invoiceDate" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "creditNoteCode" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL DEFAULT 'PRODUCT',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "productVariant" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "serviceId" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "itemType" "ItemType" NOT NULL DEFAULT 'PRODUCT',
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT,
    "serviceId" TEXT,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isDeveloperUser" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorEnabledAt" TIMESTAMP(3),
    "recoveryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "authProvider" TEXT NOT NULL DEFAULT 'email',
    "profilePicture" TEXT,
    "logo" TEXT,
    "linkedProviders" JSONB DEFAULT '[]',
    "gdprAccepted" TIMESTAMP(3),
    "phoneNumber" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ENG',
    "companyName" TEXT,
    "vatNumber" TEXT,
    "website" TEXT,
    "billingPhone" TEXT,
    "billingAddress" TEXT,
    "planType" "PlanType" NOT NULL DEFAULT 'FREE_TRIAL',
    "creditBalance" DECIMAL(10,2) NOT NULL DEFAULT 19.00,
    "trialEndsAt" TIMESTAMP(3),
    "planStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextBillingDate" TIMESTAMP(3),
    "lowBalanceNotifiedAt" TIMESTAMP(3),
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "pausedAt" TIMESTAMP(3),
    "pauseRequestedAt" TIMESTAMP(3),
    "pendingPlanType" "PlanType",
    "pendingPlanEffectiveDate" TIMESTAMP(3),
    "lastPaymentFailedAt" TIMESTAMP(3),
    "paymentFailureCount" INTEGER NOT NULL DEFAULT 0,
    "paypalStatus" "PayPalStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "isPaymentConnected" BOOLEAN NOT NULL DEFAULT false,
    "paypalClientId" TEXT,
    "paypalMerchantId" TEXT,
    "paypalEmail" TEXT,
    "paypalEnvironment" TEXT,
    "paypalConnectedAt" TIMESTAMP(3),
    "paypalAccessTokenEncrypted" TEXT,
    "paypalRefreshTokenEncrypted" TEXT,
    "paypalTokenExpiresAt" TIMESTAMP(3),
    "paypalTokenScope" TEXT,
    "paypalSubscriptionId" TEXT,
    "paypalPlanId" TEXT,
    "paypalSubscriptionStatus" TEXT,
    "paypalNextBillingTime" TIMESTAMP(3),
    "paypalLastPaymentTime" TIMESTAMP(3),
    "paypalFailedPaymentsCount" INTEGER NOT NULL DEFAULT 0,
    "paypalCyclesCompleted" INTEGER NOT NULL DEFAULT 0,
    "paypalOutstandingBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paypalSubscriptionApprovedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "two_factor_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" VARCHAR(36) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByAdminId" TEXT NOT NULL,
    "passwordAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "two_factor_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authentication_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "attemptType" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "failureReason" TEXT,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authentication_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWorkspace" (
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWorkspace_pkey" PRIMARY KEY ("userId","workspaceId")
);

-- CreateTable
CREATE TABLE "whatsapp_settings" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "appName" TEXT,
    "appSecret" TEXT,
    "webhookUrl" TEXT,
    "webhookId" TEXT NOT NULL,
    "webhookToken" TEXT NOT NULL,
    "businessAccountId" TEXT,
    "settings" JSONB DEFAULT '{}',
    "adminEmail" TEXT,
    "smtpHost" TEXT DEFAULT 'smtp.ethereal.email',
    "smtpPort" INTEGER DEFAULT 587,
    "smtpSecure" BOOLEAN DEFAULT false,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "smtpFrom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "gdpr" TEXT,

    CONSTRAINT "whatsapp_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_details" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "providerResponse" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT NOT NULL,

    CONSTRAINT "payment_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "context" JSONB DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "visitorId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "isPlayground" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "feedback" TEXT,
    "sortOrder" INTEGER,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB DEFAULT '{}',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "chatSessionId" TEXT NOT NULL,
    "functionCallsDebug" TEXT,
    "processingSource" TEXT,
    "translatedQuery" TEXT,
    "processedPrompt" TEXT,
    "debugInfo" TEXT,
    "whatsappStatus" TEXT,
    "whatsappError" TEXT,
    "whatsappMessageId" TEXT,
    "sentBy" TEXT,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachments" (
    "id" TEXT NOT NULL,
    "conversationMessageId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "filename" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "waMediaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages_archive" (
    "id" TEXT NOT NULL,
    "originalId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "content" TEXT NOT NULL,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB DEFAULT '{}',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chatSessionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "functionCallsDebug" TEXT,
    "processingSource" TEXT,
    "translatedQuery" TEXT,
    "processedPrompt" TEXT,
    "debugInfo" TEXT,
    "whatsappStatus" TEXT,
    "whatsappError" TEXT,
    "whatsappMessageId" TEXT,
    "sentBy" TEXT,

    CONSTRAINT "messages_archive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "secure_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "phoneNumber" TEXT,
    "payload" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT,

    CONSTRAINT "secure_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 60,
    "imageUrl" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageKey" TEXT,
    "enableForBooking" BOOLEAN NOT NULL DEFAULT false,
    "bufferTime" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "keywords" TEXT[],
    "category" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "discountPercent" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_configs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AgentType" NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "systemPrompt" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 4096,
    "order" INTEGER NOT NULL DEFAULT 0,
    "availableFunctions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gdpr_content" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "gdpr_ita" TEXT NOT NULL,
    "gdpr_esp" TEXT NOT NULL,
    "gdpr_eng" TEXT NOT NULL,
    "gdpr_prt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gdpr_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "price" DECIMAL(10,4) NOT NULL DEFAULT 0.005,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_attempts" (
    "id" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registration_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_invitations" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "workspaceId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShortUrls" (
    "id" TEXT NOT NULL,
    "shortCode" VARCHAR(10) NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShortUrls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Billing" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" "BillingType" NOT NULL,
    "description" TEXT NOT NULL,
    "userQuery" TEXT,
    "previousTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currentCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "newTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Billing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_conversation_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "agentType" TEXT NOT NULL,
    "agentAction" TEXT NOT NULL,
    "inputMessage" TEXT NOT NULL,
    "agentPrompt" TEXT,
    "llmModel" TEXT,
    "llmResponse" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "reasoning" TEXT,
    "tokensUsed" INTEGER,
    "executionTimeMs" INTEGER,
    "functionsCalled" JSONB,
    "hasError" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_conversation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "agentType" TEXT,
    "functionName" TEXT,
    "functionArguments" JSONB,
    "tokensUsed" INTEGER,
    "debugInfo" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "deliveryStatus" TEXT NOT NULL DEFAULT 'not_queued',
    "reaction" TEXT,
    "whatsappMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "balanceAfter" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paypal_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "PayPalTransactionStatus" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminUserId" TEXT,

    CONSTRAINT "paypal_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_invoices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "subscriptionAmount" DECIMAL(10,2) NOT NULL,
    "creditUsage" DECIMAL(10,2) NOT NULL,
    "creditDebt" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "creditNotesTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "subtotalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0.22,
    "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "paidAt" TIMESTAMP(3),
    "paypalTransactionId" TEXT,
    "paymentRetryCount" INTEGER NOT NULL DEFAULT 0,
    "adminNotes" TEXT,
    "adminMarkedById" TEXT,
    "adminMarkedAt" TIMESTAMP(3),
    "planType" "PlanType" NOT NULL,
    "itemsBreakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_adjustments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdByEmail" TEXT,

    CONSTRAINT "invoice_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_credit_notes" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdByEmail" TEXT,

    CONSTRAINT "invoice_credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_configurations" (
    "id" TEXT NOT NULL,
    "planType" "PlanType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "monthlyFee" DECIMAL(10,2) NOT NULL,
    "maxChannels" INTEGER NOT NULL,
    "maxProducts" INTEGER NOT NULL,
    "maxCustomers" INTEGER NOT NULL,
    "max_team_members" INTEGER,
    "messageCost" DECIMAL(10,2) NOT NULL,
    "orderCost" DECIMAL(10,2) NOT NULL,
    "pushCost" DECIMAL(10,2) NOT NULL,
    "reminderCost" DECIMAL(10,2) NOT NULL DEFAULT 0.50,
    "lowBalanceThreshold" DECIMAL(10,2) NOT NULL,
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "initialCredit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_campaigns" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "name" TEXT NOT NULL,
    "status" "PushCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "channel" "PushCampaignChannel" NOT NULL DEFAULT 'WHATSAPP',
    "frequency" "CampaignFrequency" NOT NULL DEFAULT 'ONCE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "targetingType" "CampaignTargetType" NOT NULL DEFAULT 'ALL',
    "targetCustomerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tagId" TEXT,
    "message" TEXT,
    "sendAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "templateId" TEXT,
    "templateLocale" TEXT,
    "bodyPreview" TEXT,
    "targetTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mediaUrl" TEXT,
    "expectedRecipients" INTEGER NOT NULL DEFAULT 0,
    "actualSent" INTEGER NOT NULL DEFAULT 0,
    "actualFailed" INTEGER NOT NULL DEFAULT 0,
    "actualSkipped" INTEGER NOT NULL DEFAULT 0,
    "costPerMessage" DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    "billingStatus" "PushCampaignBillingStatus" NOT NULL DEFAULT 'PENDING',
    "throttlePerSecond" INTEGER NOT NULL DEFAULT 10,
    "batchSize" INTEGER NOT NULL DEFAULT 50,
    "lastError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_campaign_recipients" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT,
    "phone" TEXT NOT NULL,
    "status" "PushCampaignRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "messageId" TEXT,
    "priceCharged" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "isFake" BOOLEAN NOT NULL DEFAULT false,
    "optOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_campaign_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" TEXT NOT NULL,
    "sessionId" VARCHAR(64) NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_config" (
    "id" TEXT NOT NULL,
    "type" "ConfigType" NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "originalValue" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduler_job_status" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT NOT NULL DEFAULT 'NEVER_RUN',
    "lastError" TEXT,
    "lastDuration" INTEGER,
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduler_job_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soft_delete_audit_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "deletedIds" TEXT[],
    "deletedIdCount" INTEGER NOT NULL,
    "reason" TEXT,
    "deletedByUserId" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "soft_delete_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_calling_functions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "functionName" TEXT NOT NULL,
    "description" TEXT,
    "responseInstructions" TEXT,
    "parameters" JSONB,
    "isSystemFunction" BOOLEAN NOT NULL DEFAULT false,
    "executionType" TEXT NOT NULL DEFAULT 'WEBHOOK',
    "attachedLlm" TEXT,
    "attachedFlowKey" TEXT,
    "webhookUrl" TEXT,
    "credentialsMapping" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_calling_functions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_environment_variables" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "variableName" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_environment_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "ticketCode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "issueType" "SupportIssueType" NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderType" "SupportSenderType" NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_attachments" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Rome',
    "googleEventId" TEXT,
    "googleEventLink" TEXT,
    "googleCalendarId" TEXT,
    "zoomLink" TEXT,
    "zoomMeetingId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "cancelledBy" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "customerNotes" TEXT,
    "adminNotes" TEXT,
    "bookedVia" TEXT NOT NULL DEFAULT 'whatsapp',
    "reminder24hSentAt" TIMESTAMP(3),
    "reminder1hSentAt" TIMESTAMP(3),
    "reminder30mSentAt" TIMESTAMP(3),
    "reminderChannel" TEXT,
    "reminderBilledAt" TIMESTAMP(3),
    "reminderBillingTotal" DECIMAL(10,2) DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_calendar_connections" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3) NOT NULL,
    "scope" TEXT[] DEFAULT ARRAY['https://www.googleapis.com/auth/calendar']::TEXT[],
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,

    CONSTRAINT "google_calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_business_hours" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "workspace_business_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blackout_periods" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blackout_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_appointments" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "requestedStartTime" TIMESTAMP(3) NOT NULL,
    "requestedEndTime" TIMESTAMP(3) NOT NULL,
    "customerNotes" TEXT,
    "adminNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "syncedEventId" TEXT,
    "syncedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_locks" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "googleEventId" TEXT,
    "reminderType" TEXT NOT NULL,
    "lockKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminder_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "late_cancellation_attempts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "googleEventId" TEXT,
    "scheduledStartTime" TIMESTAMP(3) NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tooLateThreshold" INTEGER NOT NULL,

    CONSTRAINT "late_cancellation_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_gdpr_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "googleEventId" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedBy" TEXT NOT NULL DEFAULT 'customer',
    "reason" TEXT,

    CONSTRAINT "appointment_gdpr_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_questionnaires" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fullName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "stepIndustry" TEXT,
    "stepGoal" TEXT,
    "stepHumanSupport" TEXT,
    "stepPushMarketing" TEXT,
    "stepReminders" TEXT,
    "stepWidget" TEXT,
    "stepSalesAgents" TEXT,
    "stepEcommerce" TEXT,
    "stepEcommercePlatform" TEXT,
    "stepIntegrations" TEXT,
    "stepPrivacy" TEXT,
    "stepOnPremise" TEXT,
    "stepHelpful" TEXT,
    "stepInterest" TEXT,
    "stepOther" TEXT,
    "stepDemo" TEXT,
    "lang" TEXT,
    "wantsContact" BOOLEAN NOT NULL DEFAULT false,
    "stepChannel" TEXT,
    "stepTimeSaving" TEXT,
    "stepDocuments" TEXT,
    "stepIntegration" TEXT,
    "stepHandoff" TEXT,
    "stepMarketing" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "adminNotes" TEXT,

    CONSTRAINT "onboarding_questionnaires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playground_todos" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "dialogId" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "messageContent" TEXT NOT NULL,
    "chatbotResponse" TEXT,
    "commentTitle" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'Medio',
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playground_todos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playground_comments" (
    "id" TEXT NOT NULL,
    "todoId" TEXT NOT NULL,
    "commentText" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playground_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_OfferCategories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_OfferCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");

-- CreateIndex
CREATE INDEX "Workspace_deletedAt_idx" ON "Workspace"("deletedAt");

-- CreateIndex
CREATE INDEX "Workspace_wasenderApiKey_idx" ON "Workspace"("wasenderApiKey");

-- CreateIndex
CREATE INDEX "flow_node_configs_workspaceId_idx" ON "flow_node_configs"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "flow_node_configs_workspaceId_flowKey_key" ON "flow_node_configs"("workspaceId", "flowKey");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_workspaceId_key" ON "categories"("slug", "workspaceId");

-- CreateIndex
CREATE INDEX "products_workspaceId_idx" ON "products"("workspaceId");

-- CreateIndex
CREATE INDEX "products_workspaceId_status_idx" ON "products"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "products_allergens_idx" ON "products"("allergens");

-- CreateIndex
CREATE INDEX "products_imageKey_idx" ON "products"("imageKey");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_workspaceId_key" ON "products"("slug", "workspaceId");

-- CreateIndex
CREATE INDEX "Certification_workspaceId_idx" ON "Certification"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Certification_workspaceId_name_key" ON "Certification"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "ProductCertification_certificationId_idx" ON "ProductCertification"("certificationId");

-- CreateIndex
CREATE INDEX "Type_workspaceId_idx" ON "Type"("workspaceId");

-- CreateIndex
CREATE INDEX "Type_isActive_idx" ON "Type"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Type_workspaceId_name_key" ON "Type"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "ProductType_productId_idx" ON "ProductType"("productId");

-- CreateIndex
CREATE INDEX "ProductType_typeId_idx" ON "ProductType"("typeId");

-- CreateIndex
CREATE INDEX "ProductCategory_productId_idx" ON "ProductCategory"("productId");

-- CreateIndex
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

-- CreateIndex
CREATE INDEX "ProductCharacteristic_productId_idx" ON "ProductCharacteristic"("productId");

-- CreateIndex
CREATE INDEX "ProductCharacteristic_name_idx" ON "ProductCharacteristic"("name");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_queue_pushCampaignRecipientId_key" ON "whatsapp_queue"("pushCampaignRecipientId");

-- CreateIndex
CREATE INDEX "whatsapp_queue_workspaceId_status_idx" ON "whatsapp_queue"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "whatsapp_queue_workspaceId_channel_idx" ON "whatsapp_queue"("workspaceId", "channel");

-- CreateIndex
CREATE INDEX "whatsapp_queue_customerId_idx" ON "whatsapp_queue"("customerId");

-- CreateIndex
CREATE INDEX "whatsapp_queue_visitorId_idx" ON "whatsapp_queue"("visitorId");

-- CreateIndex
CREATE INDEX "whatsapp_queue_createdAt_idx" ON "whatsapp_queue"("createdAt");

-- CreateIndex
CREATE INDEX "whatsapp_queue_conversationMessageId_idx" ON "whatsapp_queue"("conversationMessageId");

-- CreateIndex
CREATE INDEX "whatsapp_queue_expiresAt_idx" ON "whatsapp_queue"("expiresAt");

-- CreateIndex
CREATE INDEX "whatsapp_webhook_events_workspaceId_idx" ON "whatsapp_webhook_events"("workspaceId");

-- CreateIndex
CREATE INDEX "whatsapp_webhook_events_receivedAt_idx" ON "whatsapp_webhook_events"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_webhook_events_workspaceId_channel_externalMessage_key" ON "whatsapp_webhook_events"("workspaceId", "channel", "externalMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_customId_key" ON "customers"("customId");

-- CreateIndex
CREATE INDEX "customers_workspaceId_idx" ON "customers"("workspaceId");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_deletedAt_idx" ON "customers"("deletedAt");

-- CreateIndex
CREATE INDEX "customers_workspaceId_deletedAt_idx" ON "customers"("workspaceId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "customers_workspaceId_phone_key" ON "customers"("workspaceId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "search_conversations_sessionId_key" ON "search_conversations"("sessionId");

-- CreateIndex
CREATE INDEX "search_conversations_sessionId_idx" ON "search_conversations"("sessionId");

-- CreateIndex
CREATE INDEX "search_conversations_customerId_idx" ON "search_conversations"("customerId");

-- CreateIndex
CREATE INDEX "search_conversations_expiresAt_idx" ON "search_conversations"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderCode_key" ON "orders"("orderCode");

-- CreateIndex
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");

-- CreateIndex
CREATE INDEX "orders_workspaceId_status_idx" ON "orders"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "orders_workspaceId_createdAt_idx" ON "orders"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_deletedAt_idx" ON "orders"("deletedAt");

-- CreateIndex
CREATE INDEX "orders_workspaceId_deletedAt_idx" ON "orders"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "orders_invoiceKey_idx" ON "orders"("invoiceKey");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_creditNoteCode_key" ON "credit_notes"("creditNoteCode");

-- CreateIndex
CREATE INDEX "credit_notes_orderId_idx" ON "credit_notes"("orderId");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_items_orderId_deletedAt_idx" ON "order_items"("orderId", "deletedAt");

-- CreateIndex
CREATE INDEX "order_items_deletedAt_idx" ON "order_items"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "carts_customerId_key" ON "carts"("customerId");

-- CreateIndex
CREATE INDEX "cart_items_cartId_idx" ON "cart_items"("cartId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE INDEX "users_planType_idx" ON "users"("planType");

-- CreateIndex
CREATE INDEX "users_subscriptionStatus_idx" ON "users"("subscriptionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_reset_tokens_token_key" ON "two_factor_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "two_factor_reset_tokens_token_idx" ON "two_factor_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "two_factor_reset_tokens_userId_createdAt_idx" ON "two_factor_reset_tokens"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "two_factor_reset_tokens_expiresAt_idx" ON "two_factor_reset_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "authentication_attempts_email_timestamp_idx" ON "authentication_attempts"("email", "timestamp");

-- CreateIndex
CREATE INDEX "authentication_attempts_ipAddress_timestamp_idx" ON "authentication_attempts"("ipAddress", "timestamp");

-- CreateIndex
CREATE INDEX "authentication_attempts_attemptType_success_idx" ON "authentication_attempts"("attemptType", "success");

-- CreateIndex
CREATE INDEX "authentication_attempts_timestamp_idx" ON "authentication_attempts"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_settings_phoneNumber_key" ON "whatsapp_settings"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_settings_webhookId_key" ON "whatsapp_settings"("webhookId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_settings_workspaceId_key" ON "whatsapp_settings"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_details_orderId_key" ON "payment_details"("orderId");

-- CreateIndex
CREATE INDEX "idx_customer_status" ON "chat_sessions"("customerId", "status");

-- CreateIndex
CREATE INDEX "idx_workspace" ON "chat_sessions"("workspaceId");

-- CreateIndex
CREATE INDEX "idx_workspace_customer" ON "chat_sessions"("workspaceId", "customerId");

-- CreateIndex
CREATE INDEX "idx_chat_session_created" ON "chat_sessions"("createdAt");

-- CreateIndex
CREATE INDEX "idx_workspace_created" ON "chat_sessions"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "chat_sessions_deletedAt_idx" ON "chat_sessions"("deletedAt");

-- CreateIndex
CREATE INDEX "chat_sessions_workspaceId_deletedAt_idx" ON "chat_sessions"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "chat_sessions_visitorId_idx" ON "chat_sessions"("visitorId");

-- CreateIndex
CREATE INDEX "chat_sessions_channel_idx" ON "chat_sessions"("channel");

-- CreateIndex
CREATE INDEX "chat_sessions_expiresAt_idx" ON "chat_sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "chat_sessions_customerId_status_key" ON "chat_sessions"("customerId", "status");

-- CreateIndex
CREATE INDEX "messages_chatSessionId_idx" ON "messages"("chatSessionId");

-- CreateIndex
CREATE INDEX "messages_whatsappStatus_idx" ON "messages"("whatsappStatus");

-- CreateIndex
CREATE INDEX "messages_whatsappMessageId_idx" ON "messages"("whatsappMessageId");

-- CreateIndex
CREATE INDEX "messages_sentBy_idx" ON "messages"("sentBy");

-- CreateIndex
CREATE INDEX "idx_message_created" ON "messages"("createdAt");

-- CreateIndex
CREATE INDEX "idx_direction_created" ON "messages"("direction", "createdAt");

-- CreateIndex
CREATE INDEX "idx_msg_session_created" ON "messages"("chatSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_session_direction" ON "messages"("chatSessionId", "direction");

-- CreateIndex
CREATE INDEX "messages_deletedAt_idx" ON "messages"("deletedAt");

-- CreateIndex
CREATE INDEX "message_attachments_conversationMessageId_idx" ON "message_attachments"("conversationMessageId");

-- CreateIndex
CREATE INDEX "message_attachments_workspaceId_idx" ON "message_attachments"("workspaceId");

-- CreateIndex
CREATE INDEX "messages_archive_workspaceId_idx" ON "messages_archive"("workspaceId");

-- CreateIndex
CREATE INDEX "messages_archive_customerId_idx" ON "messages_archive"("customerId");

-- CreateIndex
CREATE INDEX "messages_archive_chatSessionId_idx" ON "messages_archive"("chatSessionId");

-- CreateIndex
CREATE INDEX "messages_archive_createdAt_idx" ON "messages_archive"("createdAt");

-- CreateIndex
CREATE INDEX "messages_archive_archivedAt_idx" ON "messages_archive"("archivedAt");

-- CreateIndex
CREATE INDEX "messages_archive_originalId_idx" ON "messages_archive"("originalId");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_key" ON "password_resets"("token");

-- CreateIndex
CREATE UNIQUE INDEX "registration_tokens_token_key" ON "registration_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "secure_tokens_token_key" ON "secure_tokens"("token");

-- CreateIndex
CREATE INDEX "secure_tokens_token_idx" ON "secure_tokens"("token");

-- CreateIndex
CREATE INDEX "secure_tokens_expiresAt_idx" ON "secure_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "secure_tokens_workspaceId_idx" ON "secure_tokens"("workspaceId");

-- CreateIndex
CREATE INDEX "secure_tokens_customerId_idx" ON "secure_tokens"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "unique_customer_token_non_null" ON "secure_tokens"("customerId", "type", "workspaceId");

-- CreateIndex
CREATE INDEX "services_workspaceId_idx" ON "services"("workspaceId");

-- CreateIndex
CREATE INDEX "services_imageKey_idx" ON "services"("imageKey");

-- CreateIndex
CREATE INDEX "services_workspaceId_enableForBooking_idx" ON "services"("workspaceId", "enableForBooking");

-- CreateIndex
CREATE UNIQUE INDEX "services_code_workspaceId_key" ON "services"("code", "workspaceId");

-- CreateIndex
CREATE INDEX "faqs_workspaceId_isActive_idx" ON "faqs"("workspaceId", "isActive");

-- CreateIndex
CREATE INDEX "faqs_keywords_idx" ON "faqs"("keywords");

-- CreateIndex
CREATE INDEX "faqs_category_idx" ON "faqs"("category");

-- CreateIndex
CREATE INDEX "offers_workspaceId_idx" ON "offers"("workspaceId");

-- CreateIndex
CREATE INDEX "documents_workspaceId_idx" ON "documents"("workspaceId");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "documents_isActive_idx" ON "documents"("isActive");

-- CreateIndex
CREATE INDEX "agent_configs_workspaceId_idx" ON "agent_configs"("workspaceId");

-- CreateIndex
CREATE INDEX "agent_configs_order_idx" ON "agent_configs"("order");

-- CreateIndex
CREATE UNIQUE INDEX "agent_configs_workspaceId_type_key" ON "agent_configs"("workspaceId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "gdpr_content_workspaceId_key" ON "gdpr_content"("workspaceId");

-- CreateIndex
CREATE INDEX "usage_workspaceId_idx" ON "usage"("workspaceId");

-- CreateIndex
CREATE INDEX "usage_clientId_idx" ON "usage"("clientId");

-- CreateIndex
CREATE INDEX "usage_createdAt_idx" ON "usage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "registration_attempts_phoneNumber_workspaceId_key" ON "registration_attempts"("phoneNumber", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invitations_tokenHash_key" ON "workspace_invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "workspace_invitations_workspaceId_idx" ON "workspace_invitations"("workspaceId");

-- CreateIndex
CREATE INDEX "workspace_invitations_email_idx" ON "workspace_invitations"("email");

-- CreateIndex
CREATE INDEX "workspace_invitations_status_idx" ON "workspace_invitations"("status");

-- CreateIndex
CREATE INDEX "workspace_invitations_tokenHash_idx" ON "workspace_invitations"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "ShortUrls_shortCode_key" ON "ShortUrls"("shortCode");

-- CreateIndex
CREATE INDEX "ShortUrls_shortCode_idx" ON "ShortUrls"("shortCode");

-- CreateIndex
CREATE INDEX "ShortUrls_workspaceId_idx" ON "ShortUrls"("workspaceId");

-- CreateIndex
CREATE INDEX "ShortUrls_expiresAt_idx" ON "ShortUrls"("expiresAt");

-- CreateIndex
CREATE INDEX "Billing_workspaceId_idx" ON "Billing"("workspaceId");

-- CreateIndex
CREATE INDEX "Billing_customerId_idx" ON "Billing"("customerId");

-- CreateIndex
CREATE INDEX "Billing_type_idx" ON "Billing"("type");

-- CreateIndex
CREATE INDEX "Billing_createdAt_idx" ON "Billing"("createdAt");

-- CreateIndex
CREATE INDEX "agent_conversation_logs_workspaceId_customerId_idx" ON "agent_conversation_logs"("workspaceId", "customerId");

-- CreateIndex
CREATE INDEX "agent_conversation_logs_conversationId_idx" ON "agent_conversation_logs"("conversationId");

-- CreateIndex
CREATE INDEX "agent_conversation_logs_createdAt_idx" ON "agent_conversation_logs"("createdAt");

-- CreateIndex
CREATE INDEX "agent_conversation_logs_agentType_idx" ON "agent_conversation_logs"("agentType");

-- CreateIndex
CREATE INDEX "agent_conversation_logs_hasError_idx" ON "agent_conversation_logs"("hasError");

-- CreateIndex
CREATE INDEX "conversation_messages_conversationId_createdAt_idx" ON "conversation_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "conversation_messages_workspaceId_customerId_idx" ON "conversation_messages"("workspaceId", "customerId");

-- CreateIndex
CREATE INDEX "conversation_messages_createdAt_idx" ON "conversation_messages"("createdAt");

-- CreateIndex
CREATE INDEX "conversation_messages_whatsappMessageId_idx" ON "conversation_messages"("whatsappMessageId");

-- CreateIndex
CREATE INDEX "billing_transactions_userId_idx" ON "billing_transactions"("userId");

-- CreateIndex
CREATE INDEX "billing_transactions_workspaceId_idx" ON "billing_transactions"("workspaceId");

-- CreateIndex
CREATE INDEX "billing_transactions_type_idx" ON "billing_transactions"("type");

-- CreateIndex
CREATE INDEX "billing_transactions_createdAt_idx" ON "billing_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "paypal_transactions_userId_idx" ON "paypal_transactions"("userId");

-- CreateIndex
CREATE INDEX "paypal_transactions_invoiceId_idx" ON "paypal_transactions"("invoiceId");

-- CreateIndex
CREATE INDEX "paypal_transactions_status_idx" ON "paypal_transactions"("status");

-- CreateIndex
CREATE INDEX "paypal_transactions_createdAt_idx" ON "paypal_transactions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_invoices_invoiceNumber_key" ON "monthly_invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "monthly_invoices_userId_idx" ON "monthly_invoices"("userId");

-- CreateIndex
CREATE INDEX "monthly_invoices_status_idx" ON "monthly_invoices"("status");

-- CreateIndex
CREATE INDEX "monthly_invoices_periodYear_periodMonth_idx" ON "monthly_invoices"("periodYear", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_invoices_userId_periodYear_periodMonth_key" ON "monthly_invoices"("userId", "periodYear", "periodMonth");

-- CreateIndex
CREATE INDEX "invoice_adjustments_invoiceId_idx" ON "invoice_adjustments"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_adjustments_userId_idx" ON "invoice_adjustments"("userId");

-- CreateIndex
CREATE INDEX "invoice_credit_notes_invoiceId_idx" ON "invoice_credit_notes"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_credit_notes_userId_idx" ON "invoice_credit_notes"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "plan_configurations_planType_key" ON "plan_configurations"("planType");

-- CreateIndex
CREATE INDEX "plan_configurations_planType_idx" ON "plan_configurations"("planType");

-- CreateIndex
CREATE INDEX "plan_configurations_isActive_idx" ON "plan_configurations"("isActive");

-- CreateIndex
CREATE INDEX "push_campaigns_workspaceId_idx" ON "push_campaigns"("workspaceId");

-- CreateIndex
CREATE INDEX "push_campaigns_status_idx" ON "push_campaigns"("status");

-- CreateIndex
CREATE INDEX "push_campaigns_sendAt_idx" ON "push_campaigns"("sendAt");

-- CreateIndex
CREATE INDEX "push_campaigns_nextRunAt_idx" ON "push_campaigns"("nextRunAt");

-- CreateIndex
CREATE INDEX "push_campaign_recipients_campaignId_idx" ON "push_campaign_recipients"("campaignId");

-- CreateIndex
CREATE INDEX "push_campaign_recipients_workspaceId_idx" ON "push_campaign_recipients"("workspaceId");

-- CreateIndex
CREATE INDEX "push_campaign_recipients_status_idx" ON "push_campaign_recipients"("status");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_sessionId_key" ON "admin_sessions"("sessionId");

-- CreateIndex
CREATE INDEX "admin_sessions_sessionId_idx" ON "admin_sessions"("sessionId");

-- CreateIndex
CREATE INDEX "admin_sessions_userId_idx" ON "admin_sessions"("userId");

-- CreateIndex
CREATE INDEX "admin_sessions_expiresAt_idx" ON "admin_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "admin_sessions_isActive_idx" ON "admin_sessions"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "platform_config_key_key" ON "platform_config"("key");

-- CreateIndex
CREATE INDEX "platform_config_type_idx" ON "platform_config"("type");

-- CreateIndex
CREATE INDEX "platform_config_key_idx" ON "platform_config"("key");

-- CreateIndex
CREATE INDEX "platform_config_isActive_idx" ON "platform_config"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "scheduler_job_status_jobName_key" ON "scheduler_job_status"("jobName");

-- CreateIndex
CREATE INDEX "soft_delete_audit_logs_workspaceId_deletedAt_idx" ON "soft_delete_audit_logs"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "soft_delete_audit_logs_deletedAt_idx" ON "soft_delete_audit_logs"("deletedAt");

-- CreateIndex
CREATE INDEX "workspace_calling_functions_workspaceId_isActive_idx" ON "workspace_calling_functions"("workspaceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_calling_functions_workspaceId_functionName_key" ON "workspace_calling_functions"("workspaceId", "functionName");

-- CreateIndex
CREATE INDEX "workspace_environment_variables_workspaceId_idx" ON "workspace_environment_variables"("workspaceId");

-- CreateIndex
CREATE INDEX "workspace_environment_variables_createdAt_idx" ON "workspace_environment_variables"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_environment_variables_workspaceId_variableName_key" ON "workspace_environment_variables"("workspaceId", "variableName");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticketCode_key" ON "support_tickets"("ticketCode");

-- CreateIndex
CREATE INDEX "support_tickets_userId_idx" ON "support_tickets"("userId");

-- CreateIndex
CREATE INDEX "support_tickets_workspaceId_idx" ON "support_tickets"("workspaceId");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_createdAt_idx" ON "support_tickets"("createdAt");

-- CreateIndex
CREATE INDEX "support_messages_ticketId_idx" ON "support_messages"("ticketId");

-- CreateIndex
CREATE INDEX "support_messages_senderId_idx" ON "support_messages"("senderId");

-- CreateIndex
CREATE INDEX "support_messages_createdAt_idx" ON "support_messages"("createdAt");

-- CreateIndex
CREATE INDEX "support_attachments_messageId_idx" ON "support_attachments"("messageId");

-- CreateIndex
CREATE INDEX "appointments_workspaceId_status_idx" ON "appointments"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "appointments_workspaceId_startTime_idx" ON "appointments"("workspaceId", "startTime");

-- CreateIndex
CREATE INDEX "appointments_customerId_status_idx" ON "appointments"("customerId", "status");

-- CreateIndex
CREATE INDEX "appointments_googleEventId_idx" ON "appointments"("googleEventId");

-- CreateIndex
CREATE INDEX "appointments_zoomMeetingId_idx" ON "appointments"("zoomMeetingId");

-- CreateIndex
CREATE INDEX "appointments_startTime_idx" ON "appointments"("startTime");

-- CreateIndex
CREATE UNIQUE INDEX "google_calendar_connections_workspaceId_key" ON "google_calendar_connections"("workspaceId");

-- CreateIndex
CREATE INDEX "google_calendar_connections_workspaceId_idx" ON "google_calendar_connections"("workspaceId");

-- CreateIndex
CREATE INDEX "workspace_business_hours_workspaceId_isActive_idx" ON "workspace_business_hours"("workspaceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_business_hours_workspaceId_dayOfWeek_key" ON "workspace_business_hours"("workspaceId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "blackout_periods_workspaceId_startDate_endDate_idx" ON "blackout_periods"("workspaceId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "pending_appointments_workspaceId_status_idx" ON "pending_appointments"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "pending_appointments_customerId_idx" ON "pending_appointments"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_locks_lockKey_key" ON "reminder_locks"("lockKey");

-- CreateIndex
CREATE INDEX "reminder_locks_expiresAt_idx" ON "reminder_locks"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_locks_appointmentId_reminderType_key" ON "reminder_locks"("appointmentId", "reminderType");

-- CreateIndex
CREATE INDEX "late_cancellation_attempts_workspaceId_customerId_idx" ON "late_cancellation_attempts"("workspaceId", "customerId");

-- CreateIndex
CREATE INDEX "late_cancellation_attempts_attemptedAt_idx" ON "late_cancellation_attempts"("attemptedAt");

-- CreateIndex
CREATE INDEX "appointment_gdpr_logs_workspaceId_customerId_idx" ON "appointment_gdpr_logs"("workspaceId", "customerId");

-- CreateIndex
CREATE INDEX "appointment_gdpr_logs_deletedAt_idx" ON "appointment_gdpr_logs"("deletedAt");

-- CreateIndex
CREATE INDEX "playground_todos_workspaceId_status_idx" ON "playground_todos"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "playground_todos_dialogId_idx" ON "playground_todos"("dialogId");

-- CreateIndex
CREATE INDEX "playground_comments_todoId_createdAt_idx" ON "playground_comments"("todoId", "createdAt");

-- CreateIndex
CREATE INDEX "_OfferCategories_B_index" ON "_OfferCategories"("B");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flow_node_configs" ADD CONSTRAINT "flow_node_configs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "languages" ADD CONSTRAINT "languages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCertification" ADD CONSTRAINT "ProductCertification_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCertification" ADD CONSTRAINT "ProductCertification_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Type" ADD CONSTRAINT "Type_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductType" ADD CONSTRAINT "ProductType_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductType" ADD CONSTRAINT "ProductType_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "Type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCharacteristic" ADD CONSTRAINT "ProductCharacteristic_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_queue" ADD CONSTRAINT "whatsapp_queue_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_queue" ADD CONSTRAINT "whatsapp_queue_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_queue" ADD CONSTRAINT "whatsapp_queue_conversationMessageId_fkey" FOREIGN KEY ("conversationMessageId") REFERENCES "conversation_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_queue" ADD CONSTRAINT "whatsapp_queue_pushCampaignId_fkey" FOREIGN KEY ("pushCampaignId") REFERENCES "push_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_queue" ADD CONSTRAINT "whatsapp_queue_pushCampaignRecipientId_fkey" FOREIGN KEY ("pushCampaignRecipientId") REFERENCES "push_campaign_recipients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_webhook_events" ADD CONSTRAINT "whatsapp_webhook_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_conversations" ADD CONSTRAINT "search_conversations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_reset_tokens" ADD CONSTRAINT "two_factor_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "two_factor_reset_tokens" ADD CONSTRAINT "two_factor_reset_tokens_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authentication_attempts" ADD CONSTRAINT "authentication_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWorkspace" ADD CONSTRAINT "UserWorkspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWorkspace" ADD CONSTRAINT "UserWorkspace_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_settings" ADD CONSTRAINT "whatsapp_settings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_details" ADD CONSTRAINT "payment_details_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "chat_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_conversationMessageId_fkey" FOREIGN KEY ("conversationMessageId") REFERENCES "conversation_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secure_tokens" ADD CONSTRAINT "secure_tokens_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gdpr_content" ADD CONSTRAINT "gdpr_content_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage" ADD CONSTRAINT "usage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage" ADD CONSTRAINT "usage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShortUrls" ADD CONSTRAINT "ShortUrls_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Billing" ADD CONSTRAINT "Billing_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Billing" ADD CONSTRAINT "Billing_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_conversation_logs" ADD CONSTRAINT "agent_conversation_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_conversation_logs" ADD CONSTRAINT "agent_conversation_logs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_transactions" ADD CONSTRAINT "billing_transactions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paypal_transactions" ADD CONSTRAINT "paypal_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paypal_transactions" ADD CONSTRAINT "paypal_transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "monthly_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paypal_transactions" ADD CONSTRAINT "paypal_transactions_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_invoices" ADD CONSTRAINT "monthly_invoices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_adjustments" ADD CONSTRAINT "invoice_adjustments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "monthly_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_adjustments" ADD CONSTRAINT "invoice_adjustments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_credit_notes" ADD CONSTRAINT "invoice_credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "monthly_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_credit_notes" ADD CONSTRAINT "invoice_credit_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_campaigns" ADD CONSTRAINT "push_campaigns_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_campaigns" ADD CONSTRAINT "push_campaigns_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_campaign_recipients" ADD CONSTRAINT "push_campaign_recipients_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "push_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_campaign_recipients" ADD CONSTRAINT "push_campaign_recipients_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_campaign_recipients" ADD CONSTRAINT "push_campaign_recipients_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soft_delete_audit_logs" ADD CONSTRAINT "soft_delete_audit_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_calling_functions" ADD CONSTRAINT "workspace_calling_functions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_environment_variables" ADD CONSTRAINT "workspace_environment_variables_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_attachments" ADD CONSTRAINT "support_attachments_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "support_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_business_hours" ADD CONSTRAINT "workspace_business_hours_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blackout_periods" ADD CONSTRAINT "blackout_periods_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_appointments" ADD CONSTRAINT "pending_appointments_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_appointments" ADD CONSTRAINT "pending_appointments_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_locks" ADD CONSTRAINT "reminder_locks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "late_cancellation_attempts" ADD CONSTRAINT "late_cancellation_attempts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "late_cancellation_attempts" ADD CONSTRAINT "late_cancellation_attempts_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_gdpr_logs" ADD CONSTRAINT "appointment_gdpr_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playground_comments" ADD CONSTRAINT "playground_comments_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "playground_todos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OfferCategories" ADD CONSTRAINT "_OfferCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OfferCategories" ADD CONSTRAINT "_OfferCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

