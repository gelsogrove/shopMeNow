-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."WorkspaceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "public"."ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT', 'OUT_OF_STOCK');

-- CreateEnum
CREATE TYPE "public"."DocumentStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'PROCESSED', 'ERROR');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'PAYPAL', 'CASH_ON_DELIVERY', 'CRYPTO');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_PAID');

-- CreateEnum
CREATE TYPE "public"."MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "public"."MessageType" AS ENUM ('TEXT', 'IMAGE', 'DOCUMENT', 'LOCATION', 'CONTACT');

-- CreateEnum
CREATE TYPE "public"."ChannelType" AS ENUM ('WHATSAPP', 'TELEGRAM', 'MESSENGER', 'LINE');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "public"."BusinessType" AS ENUM ('ECOMMERCE', 'RESTAURANT', 'CLINIC', 'RETAIL', 'SERVICES', 'GENERIC');

-- CreateEnum
CREATE TYPE "public"."ItemType" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "public"."BillingType" AS ENUM ('MONTHLY_CHANNEL', 'MESSAGE', 'NEW_CUSTOMER', 'NEW_ORDER', 'HUMAN_SUPPORT', 'PUSH_MESSAGE', 'NEW_FAQ', 'ACTIVE_OFFER', 'FEEDBACK', 'ORDER_REVIEW', 'CAMPAIGN_LINK');

-- CreateEnum
CREATE TYPE "public"."CampaignFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "public"."CampaignTargetType" AS ENUM ('ALL', 'SELECTED');

-- CreateTable
CREATE TABLE "public"."Workspace" (
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
    "isDelete" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "channelStatus" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "messageLimit" INTEGER NOT NULL DEFAULT 50,
    "blocklist" TEXT DEFAULT '',
    "url" TEXT,
    "businessType" "public"."BusinessType" NOT NULL DEFAULT 'ECOMMERCE',
    "welcomeMessages" JSONB DEFAULT '{"en": "Welcome!", "es": "¡Bienvenido!", "it": "Benvenuto!"}',
    "wipMessages" JSONB DEFAULT '{"en": "Work in progress. Please contact us later.", "es": "Trabajos en curso. Por favor, contáctenos más tarde.", "it": "Lavori in corso. Contattaci più tardi.", "pt": "Em manutenção. Por favor, contacte-nos mais tarde."}',
    "afterRegistrationMessages" JSONB DEFAULT '{"de": "Danke für Ihre Registrierung, [nome]! Wie kann ich Ihnen heute helfen? Möchten Sie Ihre Bestellungen sehen? Die Angebote? Oder benötigen Sie andere Informationen?", "en": "Thank you for registering, [nome]! How can I help you today? Would you like to see your orders? The offers? Or do you need other information?", "es": "¡Gracias por registrarte, [nome]! ¿Cómo puedo ayudarte hoy? ¿Quieres ver tus pedidos? ¿Las ofertas? ¿O necesitas otra información?", "fr": "Merci de vous être inscrit, [nome] ! Comment puis-je vous aider aujourd''hui ? Voulez-vous voir vos commandes ? Les offres ? Ou avez-vous besoin d''autres informations ?", "it": "Grazie per esserti registrato, [nome]! Come ti posso aiutare oggi? Vuoi vedere i tuoi ordini? Le offerte? O hai bisogno di altre informazioni?", "pt": "Obrigado por se registrar, [nome]! Como posso ajudá-lo hoje? Quer ver seus pedidos? As ofertas? Ou precisa de outras informações?"}',
    "debugMode" BOOLEAN NOT NULL DEFAULT true,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "metadata" JSONB,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."categories" (
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
CREATE TABLE "public"."sales" (
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
CREATE TABLE "public"."languages" (
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
CREATE TABLE "public"."products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ProductCode" TEXT,
    "description" TEXT,
    "formato" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "sku" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "workspaceId" TEXT NOT NULL,
    "categoryId" TEXT,
    "slug" TEXT NOT NULL,
    "status" "public"."ProductStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "company" TEXT,
    "discount" DOUBLE PRECISION DEFAULT 0,
    "language" TEXT DEFAULT 'ENG',
    "currency" TEXT DEFAULT 'EUR',
    "notes" TEXT,
    "serviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
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
CREATE TABLE "public"."orders" (
    "id" TEXT NOT NULL,
    "orderCode" TEXT NOT NULL,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "public"."PaymentMethod",
    "paymentStatus" "public"."PaymentStatus" DEFAULT 'PENDING',
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
    "customerId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "trackingNumber" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order_items" (
    "id" TEXT NOT NULL,
    "itemType" "public"."ItemType" NOT NULL DEFAULT 'PRODUCT',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "productVariant" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "serviceId" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."carts" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cart_items" (
    "id" TEXT NOT NULL,
    "itemType" "public"."ItemType" NOT NULL DEFAULT 'PRODUCT',
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
CREATE TABLE "public"."Prompts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "isRouter" BOOLEAN NOT NULL DEFAULT false,
    "department" TEXT,
    "temperature" DOUBLE PRECISION DEFAULT 0.7,
    "top_p" DOUBLE PRECISION DEFAULT 0.9,
    "top_k" INTEGER DEFAULT 40,
    "model" TEXT DEFAULT 'GPT-4.1-mini',
    "max_tokens" INTEGER DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "status" "public"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'MEMBER',
    "twoFactorSecret" TEXT,
    "gdprAccepted" TIMESTAMP(3),
    "phoneNumber" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserWorkspace" (
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "UserWorkspace_pkey" PRIMARY KEY ("userId","workspaceId")
);

-- CreateTable
CREATE TABLE "public"."whatsapp_settings" (
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
CREATE TABLE "public"."payment_details" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "providerResponse" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT NOT NULL,

    CONSTRAINT "payment_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."chat_sessions" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "context" JSONB DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" TEXT NOT NULL,
    "direction" "public"."MessageDirection" NOT NULL,
    "content" TEXT NOT NULL,
    "type" "public"."MessageType" NOT NULL DEFAULT 'TEXT',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB DEFAULT '{}',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "chatSessionId" TEXT NOT NULL,
    "promptId" TEXT,
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
CREATE TABLE "public"."password_resets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."otp_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."registration_tokens" (
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
CREATE TABLE "public"."secure_tokens" (
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
CREATE TABLE "public"."Language" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."services" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 60,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."faqs" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."offers" (
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
CREATE TABLE "public"."documents" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "status" "public"."DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "embedding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."faq_chunks" (
    "id" TEXT NOT NULL,
    "faqId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "embedding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faq_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."service_chunks" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "embedding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product_chunks" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "embedding" JSONB,
    "workspaceId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."agent_configs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL DEFAULT 'You are a helpful assistant.',
    "model" TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 1000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."gdpr_content" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gdpr_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."usage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0.005,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."registration_attempts" (
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
CREATE TABLE "public"."ShortUrls" (
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
CREATE TABLE "public"."Billing" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "customerId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "public"."BillingType" NOT NULL,
    "description" TEXT NOT NULL,
    "userQuery" TEXT,
    "previousTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "newTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Billing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Campaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "messagePreview" TEXT NOT NULL,
    "frequency" "public"."CampaignFrequency" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "targetType" "public"."CampaignTargetType" NOT NULL DEFAULT 'ALL',
    "customerIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "templateName" TEXT,
    "templateParams" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CampaignSent" (
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
CREATE TABLE "public"."CustomerFeedback" (
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
CREATE TABLE "public"."admin_sessions" (
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
CREATE TABLE "public"."_OfferCategories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_OfferCategories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "public"."Workspace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_workspaceId_key" ON "public"."categories"("slug", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "public"."products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderCode_key" ON "public"."orders"("orderCode");

-- CreateIndex
CREATE UNIQUE INDEX "carts_customerId_key" ON "public"."carts"("customerId");

-- CreateIndex
CREATE INDEX "Prompts_workspaceId_idx" ON "public"."Prompts"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_settings_phoneNumber_key" ON "public"."whatsapp_settings"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_settings_workspaceId_key" ON "public"."whatsapp_settings"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_details_orderId_key" ON "public"."payment_details"("orderId");

-- CreateIndex
CREATE INDEX "messages_whatsappStatus_idx" ON "public"."messages"("whatsappStatus");

-- CreateIndex
CREATE INDEX "messages_whatsappMessageId_idx" ON "public"."messages"("whatsappMessageId");

-- CreateIndex
CREATE INDEX "messages_sentBy_idx" ON "public"."messages"("sentBy");

-- CreateIndex
CREATE UNIQUE INDEX "password_resets_token_key" ON "public"."password_resets"("token");

-- CreateIndex
CREATE UNIQUE INDEX "registration_tokens_token_key" ON "public"."registration_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "secure_tokens_token_key" ON "public"."secure_tokens"("token");

-- CreateIndex
CREATE INDEX "secure_tokens_token_idx" ON "public"."secure_tokens"("token");

-- CreateIndex
CREATE INDEX "secure_tokens_expiresAt_idx" ON "public"."secure_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "secure_tokens_workspaceId_idx" ON "public"."secure_tokens"("workspaceId");

-- CreateIndex
CREATE INDEX "secure_tokens_customerId_idx" ON "public"."secure_tokens"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "unique_customer_token_non_null" ON "public"."secure_tokens"("customerId", "type", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Language_code_key" ON "public"."Language"("code");

-- CreateIndex
CREATE UNIQUE INDEX "services_code_key" ON "public"."services"("code");

-- CreateIndex
CREATE INDEX "documents_workspaceId_idx" ON "public"."documents"("workspaceId");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "public"."documents"("status");

-- CreateIndex
CREATE INDEX "documents_isActive_idx" ON "public"."documents"("isActive");

-- CreateIndex
CREATE INDEX "document_chunks_documentId_idx" ON "public"."document_chunks"("documentId");

-- CreateIndex
CREATE INDEX "document_chunks_chunkIndex_idx" ON "public"."document_chunks"("chunkIndex");

-- CreateIndex
CREATE INDEX "faq_chunks_faqId_idx" ON "public"."faq_chunks"("faqId");

-- CreateIndex
CREATE INDEX "faq_chunks_chunkIndex_idx" ON "public"."faq_chunks"("chunkIndex");

-- CreateIndex
CREATE INDEX "service_chunks_serviceId_idx" ON "public"."service_chunks"("serviceId");

-- CreateIndex
CREATE INDEX "service_chunks_chunkIndex_idx" ON "public"."service_chunks"("chunkIndex");

-- CreateIndex
CREATE INDEX "product_chunks_productId_idx" ON "public"."product_chunks"("productId");

-- CreateIndex
CREATE INDEX "product_chunks_chunkIndex_idx" ON "public"."product_chunks"("chunkIndex");

-- CreateIndex
CREATE INDEX "product_chunks_workspaceId_idx" ON "public"."product_chunks"("workspaceId");

-- CreateIndex
CREATE INDEX "product_chunks_language_idx" ON "public"."product_chunks"("language");

-- CreateIndex
CREATE UNIQUE INDEX "gdpr_content_workspaceId_key" ON "public"."gdpr_content"("workspaceId");

-- CreateIndex
CREATE INDEX "usage_workspaceId_idx" ON "public"."usage"("workspaceId");

-- CreateIndex
CREATE INDEX "usage_clientId_idx" ON "public"."usage"("clientId");

-- CreateIndex
CREATE INDEX "usage_createdAt_idx" ON "public"."usage"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "registration_attempts_phoneNumber_workspaceId_key" ON "public"."registration_attempts"("phoneNumber", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ShortUrls_shortCode_key" ON "public"."ShortUrls"("shortCode");

-- CreateIndex
CREATE INDEX "ShortUrls_shortCode_idx" ON "public"."ShortUrls"("shortCode");

-- CreateIndex
CREATE INDEX "ShortUrls_workspaceId_idx" ON "public"."ShortUrls"("workspaceId");

-- CreateIndex
CREATE INDEX "ShortUrls_expiresAt_idx" ON "public"."ShortUrls"("expiresAt");

-- CreateIndex
CREATE INDEX "Billing_workspaceId_idx" ON "public"."Billing"("workspaceId");

-- CreateIndex
CREATE INDEX "Billing_customerId_idx" ON "public"."Billing"("customerId");

-- CreateIndex
CREATE INDEX "Billing_type_idx" ON "public"."Billing"("type");

-- CreateIndex
CREATE INDEX "Billing_createdAt_idx" ON "public"."Billing"("createdAt");

-- CreateIndex
CREATE INDEX "Campaign_workspaceId_idx" ON "public"."Campaign"("workspaceId");

-- CreateIndex
CREATE INDEX "Campaign_isActive_idx" ON "public"."Campaign"("isActive");

-- CreateIndex
CREATE INDEX "Campaign_frequency_idx" ON "public"."Campaign"("frequency");

-- CreateIndex
CREATE INDEX "CampaignSent_campaignId_idx" ON "public"."CampaignSent"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignSent_customerId_idx" ON "public"."CampaignSent"("customerId");

-- CreateIndex
CREATE INDEX "CampaignSent_workspaceId_idx" ON "public"."CampaignSent"("workspaceId");

-- CreateIndex
CREATE INDEX "CampaignSent_sentAt_idx" ON "public"."CampaignSent"("sentAt");

-- CreateIndex
CREATE INDEX "CustomerFeedback_customerId_idx" ON "public"."CustomerFeedback"("customerId");

-- CreateIndex
CREATE INDEX "CustomerFeedback_workspaceId_idx" ON "public"."CustomerFeedback"("workspaceId");

-- CreateIndex
CREATE INDEX "CustomerFeedback_campaignId_idx" ON "public"."CustomerFeedback"("campaignId");

-- CreateIndex
CREATE INDEX "CustomerFeedback_createdAt_idx" ON "public"."CustomerFeedback"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_sessionId_key" ON "public"."admin_sessions"("sessionId");

-- CreateIndex
CREATE INDEX "admin_sessions_sessionId_idx" ON "public"."admin_sessions"("sessionId");

-- CreateIndex
CREATE INDEX "admin_sessions_userId_idx" ON "public"."admin_sessions"("userId");

-- CreateIndex
CREATE INDEX "admin_sessions_expiresAt_idx" ON "public"."admin_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "admin_sessions_isActive_idx" ON "public"."admin_sessions"("isActive");

-- CreateIndex
CREATE INDEX "_OfferCategories_B_index" ON "public"."_OfferCategories"("B");

-- AddForeignKey
ALTER TABLE "public"."categories" ADD CONSTRAINT "categories_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales" ADD CONSTRAINT "sales_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."languages" ADD CONSTRAINT "languages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."products" ADD CONSTRAINT "products_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "public"."sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."orders" ADD CONSTRAINT "orders_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order_items" ADD CONSTRAINT "order_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."carts" ADD CONSTRAINT "carts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."carts" ADD CONSTRAINT "carts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "public"."carts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cart_items" ADD CONSTRAINT "cart_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cart_items" ADD CONSTRAINT "cart_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Prompts" ADD CONSTRAINT "Prompts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserWorkspace" ADD CONSTRAINT "UserWorkspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserWorkspace" ADD CONSTRAINT "UserWorkspace_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."whatsapp_settings" ADD CONSTRAINT "whatsapp_settings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payment_details" ADD CONSTRAINT "payment_details_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chat_sessions" ADD CONSTRAINT "chat_sessions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."chat_sessions" ADD CONSTRAINT "chat_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "public"."chat_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "public"."Prompts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."password_resets" ADD CONSTRAINT "password_resets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."otp_tokens" ADD CONSTRAINT "otp_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."secure_tokens" ADD CONSTRAINT "secure_tokens_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."services" ADD CONSTRAINT "services_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."faqs" ADD CONSTRAINT "faqs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."offers" ADD CONSTRAINT "offers_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."offers" ADD CONSTRAINT "offers_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_chunks" ADD CONSTRAINT "document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."faq_chunks" ADD CONSTRAINT "faq_chunks_faqId_fkey" FOREIGN KEY ("faqId") REFERENCES "public"."faqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."service_chunks" ADD CONSTRAINT "service_chunks_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."product_chunks" ADD CONSTRAINT "product_chunks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agent_configs" ADD CONSTRAINT "agent_configs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gdpr_content" ADD CONSTRAINT "gdpr_content_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usage" ADD CONSTRAINT "usage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."usage" ADD CONSTRAINT "usage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ShortUrls" ADD CONSTRAINT "ShortUrls_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Billing" ADD CONSTRAINT "Billing_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Billing" ADD CONSTRAINT "Billing_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Campaign" ADD CONSTRAINT "Campaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CampaignSent" ADD CONSTRAINT "CampaignSent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CampaignSent" ADD CONSTRAINT "CampaignSent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerFeedback" ADD CONSTRAINT "CustomerFeedback_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerFeedback" ADD CONSTRAINT "CustomerFeedback_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_sessions" ADD CONSTRAINT "admin_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_sessions" ADD CONSTRAINT "admin_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_OfferCategories" ADD CONSTRAINT "_OfferCategories_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_OfferCategories" ADD CONSTRAINT "_OfferCategories_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
