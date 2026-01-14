-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

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
CREATE TYPE "ChannelType" AS ENUM ('WHATSAPP', 'TELEGRAM', 'MESSENGER', 'LINE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE_TRIAL', 'BASIC', 'PREMIUM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSE_PENDING', 'PAUSED', 'PAYMENT_FAILED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('MESSAGE', 'NEW_ORDER', 'PUSH_NOTIFICATION', 'RECHARGE', 'MONTHLY_FEE', 'UPGRADE_FEE', 'ADJUSTMENT', 'INITIAL_CREDIT', 'BONUS', 'INVOICE_PAID');

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
CREATE TYPE "CampaignTargetType" AS ENUM ('ALL', 'SELECTED');

-- CreateEnum
CREATE TYPE "ConfigType" AS ENUM ('PRICE', 'FLAG', 'LIMIT');

-- CreateEnum
CREATE TYPE "PricingType" AS ENUM ('PLAN', 'USAGE', 'THRESHOLD');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('ROUTER', 'OPERATOR', 'PRODUCT_SEARCH', 'CART_MANAGEMENT', 'ORDER_TRACKING', 'CUSTOMER_SUPPORT', 'SUMMARY_AGENT', 'PROFILE_MANAGEMENT', 'NOTIFICATIONS', 'CONVERSATION_HISTORY', 'SAFETY_TRANSLATION', 'SECURITY', 'TRANSLATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "SearchConversationState" AS ENUM ('ACTIVE', 'COMPLETED', 'ABANDONED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "whatsappPhoneNumber" TEXT,
    "whatsappApiKey" TEXT,
    "notificationEmail" TEXT,
    "webhookUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'ENG',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "isDelete" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "channelStatus" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "messageLimit" INTEGER NOT NULL DEFAULT 50,
    "url" TEXT,
    "welcomeMessage" JSONB DEFAULT '{"en": "Welcome! I''m SofiA, your digital assistant. I can help you discover Italian gourmet products, answer questions, and manage orders. How can I help you today?", "es": "¡Bienvenido! Soy SofiA, tu asistente digital. Puedo ayudarte a descubrir productos gourmet italianos, responder preguntas y gestionar pedidos. ¿Cómo puedo ayudarte hoy?", "it": "Benvenuto! Sono SofiA, il tuo assistente digitale. Posso aiutarti a scoprire prodotti gourmet italiani, rispondere alle tue domande e gestire ordini. Come posso aiutarti oggi?", "pt": "Bem-vindo! Sou a SofiA, a sua assistente digital. Posso ajudá-lo a descobrir produtos gourmet italianos, responder perguntas e gerir encomendas. Como posso ajudá-lo hoje?"}',
    "wipMessage" JSONB DEFAULT '{"en": "Work in progress. Please contact us later.", "es": "Trabajos en curso. Por favor, contáctenos más tarde.", "it": "Lavori in corso. Contattaci più tardi.", "pt": "Em manutenção. Por favor, contacte-nos mais tarde."}',
    "afterRegistrationMessages" JSONB DEFAULT '{"de": "Danke für Ihre Registrierung, [nome]! Wie kann ich Ihnen heute helfen? Möchten Sie Ihre Bestellungen sehen? Die Angebote? Oder benötigen Sie andere Informationen?", "en": "Thank you for registering, [nome]! How can I help you today? Would you like to see your orders? The offers? Or do you need other information?", "es": "¡Gracias por registrarte, [nome]! ¿Cómo puedo ayudarte hoy? ¿Quieres ver tus pedidos? ¿Las ofertas? ¿O necesitas otra información?", "fr": "Merci de vous être inscrit, [nome] ! Comment puis-je vous aider aujourd''hui ? Voulez-vous voir vos commandes ? Les offres ? Ou avez-vous besoin d''autres informations ?", "it": "Grazie per esserti registrato, [nome]! Come ti posso aiutare oggi? Vuoi vedere i tuoi ordini? Le offerte? O hai bisogno di altre informazioni?", "pt": "Obrigado por se registrar, [nome]! Como posso ajudá-lo hoje? Quer ver seus pedidos? As ofertas? Ou precisa de outras informações?"}',
    "debugMode" BOOLEAN NOT NULL DEFAULT true,
    "apiKey" TEXT,
    "metadata" JSONB,
    "allowedExternalLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logoUrl" TEXT,
    "logoKey" TEXT,
    "websiteUrl" TEXT,
    "widgetLogoUrl" TEXT,
    "widgetLogoKey" TEXT,
    "widgetTitle" TEXT,
    "widgetLanguage" TEXT DEFAULT 'it',
    "widgetPrimaryColor" TEXT DEFAULT '#22c55e',
    "sellsProductsAndServices" BOOLEAN NOT NULL DEFAULT true,
    "hasSalesAgents" BOOLEAN NOT NULL DEFAULT false,
    "hasHumanSupport" BOOLEAN NOT NULL DEFAULT true,
    "humanSupportInstructions" TEXT,
    "frustrationEscalationInstructions" TEXT,
    "operatorContactMethod" TEXT DEFAULT 'email',
    "operatorWhatsappNumber" TEXT,
    "toneOfVoice" TEXT DEFAULT 'friendly',
    "botIdentityResponse" TEXT,
    "customAiRules" TEXT,
    "address" TEXT,
    "chatbotName" TEXT DEFAULT 'Assistente',
    "businessType" TEXT DEFAULT 'other',
    "translateProductNames" BOOLEAN NOT NULL DEFAULT false,
    "translateCategoryNames" BOOLEAN NOT NULL DEFAULT false,
    "translateServiceNames" BOOLEAN NOT NULL DEFAULT true,
    "catalogBaseLanguage" TEXT NOT NULL DEFAULT 'it',
    "ownerId" TEXT,
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

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
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
    "price" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "workspaceId" TEXT NOT NULL,
    "categoryId" TEXT,
    "slug" TEXT NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "imageUrl" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageKey" TEXT,
    "transportType" TEXT NOT NULL DEFAULT 'Temperatura ambiente',
    "region" TEXT,
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],

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
CREATE TABLE "TransportType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTransportType" (
    "productId" TEXT NOT NULL,
    "transportTypeId" TEXT NOT NULL,

    CONSTRAINT "ProductTransportType_pkey" PRIMARY KEY ("productId","transportTypeId")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "productId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("productId","categoryId")
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
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "visitorId" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "responsePayload" JSONB,
    "pollingAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastPolledAt" TIMESTAMP(3),

    CONSTRAINT "whatsapp_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "customId" TEXT,
    "address" TEXT,
    "company" TEXT,
    "discount" DOUBLE PRECISION DEFAULT 0,
    "language" TEXT DEFAULT 'ENG',
    "currency" TEXT DEFAULT 'USD',
    "notes" TEXT,
    "serviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "workspaceId" TEXT NOT NULL,
    "last_privacy_version_accepted" TEXT,
    "privacy_accepted_at" TIMESTAMP(3),
    "push_notifications_consent" BOOLEAN NOT NULL DEFAULT false,
    "push_notifications_consent_at" TIMESTAMP(3),
    "activeChatbot" BOOLEAN NOT NULL DEFAULT true,
    "invoiceAddress" JSONB,
    "salesId" TEXT,

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
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "shippingAmount" DOUBLE PRECISION DEFAULT 0,
    "taxAmount" DOUBLE PRECISION DEFAULT 0,
    "shippingAddress" JSONB,
    "billingAddress" JSONB,
    "notes" TEXT,
    "discountCode" TEXT,
    "discountAmount" DOUBLE PRECISION DEFAULT 0,
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
    "amount" DOUBLE PRECISION NOT NULL,
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
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
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
    "paypalClientId" TEXT,
    "paypalMerchantId" TEXT,
    "paypalEmail" TEXT,
    "paypalEnvironment" TEXT,
    "paypalConnectedAt" TIMESTAMP(3),

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
    "webhookUrl" TEXT,
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
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "visitorId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',

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
CREATE TABLE "product_searches" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 60,
    "imageUrl" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageKey" TEXT,

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
    "isActive" BOOLEAN NOT NULL DEFAULT true,
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
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0.005,
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
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "BillingType" NOT NULL,
    "description" TEXT NOT NULL,
    "userQuery" TEXT,
    "previousTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "newTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
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
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "messagePreview" TEXT NOT NULL,
    "frequency" "CampaignFrequency" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "targetType" "CampaignTargetType" NOT NULL DEFAULT 'ALL',
    "customerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "templateName" TEXT,
    "templateParams" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignSent" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokenUsed" TEXT,
    "clickedAt" TIMESTAMP(3),

    CONSTRAINT "CampaignSent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerFeedback" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "campaignId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerFeedback_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "pricing_config" (
    "id" TEXT NOT NULL,
    "type" "PricingType" NOT NULL,
    "key" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_config_pkey" PRIMARY KEY ("id")
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
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_calling_functions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "titleIt" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "titleEs" TEXT NOT NULL,
    "titlePt" TEXT NOT NULL,
    "contentIt" TEXT NOT NULL,
    "contentEn" TEXT NOT NULL,
    "contentEs" TEXT NOT NULL,
    "contentPt" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "Workspace_planType_idx" ON "Workspace"("planType");

-- CreateIndex
CREATE INDEX "Workspace_deletedAt_idx" ON "Workspace"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_workspaceId_key" ON "categories"("slug", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_workspaceId_idx" ON "products"("workspaceId");

-- CreateIndex
CREATE INDEX "products_allergens_idx" ON "products"("allergens");

-- CreateIndex
CREATE INDEX "products_certifications_idx" ON "products"("certifications");

-- CreateIndex
CREATE INDEX "products_imageKey_idx" ON "products"("imageKey");

-- CreateIndex
CREATE INDEX "Certification_workspaceId_idx" ON "Certification"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Certification_workspaceId_name_key" ON "Certification"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "ProductCertification_certificationId_idx" ON "ProductCertification"("certificationId");

-- CreateIndex
CREATE INDEX "TransportType_workspaceId_idx" ON "TransportType"("workspaceId");

-- CreateIndex
CREATE INDEX "TransportType_name_idx" ON "TransportType"("name");

-- CreateIndex
CREATE INDEX "TransportType_isActive_idx" ON "TransportType"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TransportType_workspaceId_name_key" ON "TransportType"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "ProductTransportType_productId_idx" ON "ProductTransportType"("productId");

-- CreateIndex
CREATE INDEX "ProductTransportType_transportTypeId_idx" ON "ProductTransportType"("transportTypeId");

-- CreateIndex
CREATE INDEX "ProductCategory_productId_idx" ON "ProductCategory"("productId");

-- CreateIndex
CREATE INDEX "ProductCategory_categoryId_idx" ON "ProductCategory"("categoryId");

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
CREATE UNIQUE INDEX "customers_customId_key" ON "customers"("customId");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_deletedAt_idx" ON "customers"("deletedAt");

-- CreateIndex
CREATE INDEX "customers_workspaceId_deletedAt_idx" ON "customers"("workspaceId", "deletedAt");

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
CREATE INDEX "order_items_deletedAt_idx" ON "order_items"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "carts_customerId_key" ON "carts"("customerId");

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
CREATE INDEX "product_searches_workspaceId_idx" ON "product_searches"("workspaceId");

-- CreateIndex
CREATE INDEX "product_searches_customerId_idx" ON "product_searches"("customerId");

-- CreateIndex
CREATE INDEX "product_searches_createdAt_idx" ON "product_searches"("createdAt");

-- CreateIndex
CREATE INDEX "product_searches_query_idx" ON "product_searches"("query");

-- CreateIndex
CREATE UNIQUE INDEX "services_code_key" ON "services"("code");

-- CreateIndex
CREATE INDEX "services_imageKey_idx" ON "services"("imageKey");

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
CREATE INDEX "agent_configs_workspaceId_isActive_idx" ON "agent_configs"("workspaceId", "isActive");

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
CREATE INDEX "Campaign_workspaceId_idx" ON "Campaign"("workspaceId");

-- CreateIndex
CREATE INDEX "Campaign_isActive_idx" ON "Campaign"("isActive");

-- CreateIndex
CREATE INDEX "Campaign_frequency_idx" ON "Campaign"("frequency");

-- CreateIndex
CREATE INDEX "CampaignSent_campaignId_idx" ON "CampaignSent"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignSent_customerId_idx" ON "CampaignSent"("customerId");

-- CreateIndex
CREATE INDEX "CampaignSent_workspaceId_idx" ON "CampaignSent"("workspaceId");

-- CreateIndex
CREATE INDEX "CampaignSent_sentAt_idx" ON "CampaignSent"("sentAt");

-- CreateIndex
CREATE INDEX "CustomerFeedback_customerId_idx" ON "CustomerFeedback"("customerId");

-- CreateIndex
CREATE INDEX "CustomerFeedback_workspaceId_idx" ON "CustomerFeedback"("workspaceId");

-- CreateIndex
CREATE INDEX "CustomerFeedback_campaignId_idx" ON "CustomerFeedback"("campaignId");

-- CreateIndex
CREATE INDEX "CustomerFeedback_createdAt_idx" ON "CustomerFeedback"("createdAt");

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
CREATE UNIQUE INDEX "pricing_config_key_key" ON "pricing_config"("key");

-- CreateIndex
CREATE INDEX "pricing_config_type_idx" ON "pricing_config"("type");

-- CreateIndex
CREATE INDEX "pricing_config_key_idx" ON "pricing_config"("key");

-- CreateIndex
CREATE INDEX "pricing_config_isActive_idx" ON "pricing_config"("isActive");

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
CREATE UNIQUE INDEX "legal_documents_type_key" ON "legal_documents"("type");

-- CreateIndex
CREATE INDEX "_OfferCategories_B_index" ON "_OfferCategories"("B");

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "languages" ADD CONSTRAINT "languages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCertification" ADD CONSTRAINT "ProductCertification_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCertification" ADD CONSTRAINT "ProductCertification_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportType" ADD CONSTRAINT "TransportType_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTransportType" ADD CONSTRAINT "ProductTransportType_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductTransportType" ADD CONSTRAINT "ProductTransportType_transportTypeId_fkey" FOREIGN KEY ("transportTypeId") REFERENCES "TransportType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_queue" ADD CONSTRAINT "whatsapp_queue_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_queue" ADD CONSTRAINT "whatsapp_queue_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_queue" ADD CONSTRAINT "whatsapp_queue_conversationMessageId_fkey" FOREIGN KEY ("conversationMessageId") REFERENCES "conversation_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "secure_tokens" ADD CONSTRAINT "secure_tokens_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_searches" ADD CONSTRAINT "product_searches_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_searches" ADD CONSTRAINT "product_searches_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSent" ADD CONSTRAINT "CampaignSent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignSent" ADD CONSTRAINT "CampaignSent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFeedback" ADD CONSTRAINT "CustomerFeedback_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFeedback" ADD CONSTRAINT "CustomerFeedback_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soft_delete_audit_logs" ADD CONSTRAINT "soft_delete_audit_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_calling_functions" ADD CONSTRAINT "workspace_calling_functions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OfferCategories" ADD CONSTRAINT "_OfferCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_OfferCategories" ADD CONSTRAINT "_OfferCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
