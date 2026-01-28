-- AlterTable
ALTER TABLE "Workspace" ALTER COLUMN "welcomeMessage" SET DEFAULT 'Welcome! I''m {{chatbotName}}, your digital assistant. I can help you discover Italian gourmet products, answer questions, and manage orders. How can I help you today?',
ALTER COLUMN "wipMessage" SET DEFAULT 'Work in progress. Please contact us later.',
ALTER COLUMN "afterRegistrationMessages" SET DEFAULT 'Thank you for registering, {{customerName}}! How can I help you today? Would you like to see your orders? The offers? Or do you need other information?';

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "language" SET DEFAULT 'it';

-- AlterTable
ALTER TABLE "whatsapp_settings" ALTER COLUMN "webhookId" SET DATA TYPE TEXT,
ALTER COLUMN "webhookToken" SET DATA TYPE TEXT;

-- RenameIndex
ALTER INDEX "whatsapp_webhook_events_workspaceId_channel_externalMessageId_k" RENAME TO "whatsapp_webhook_events_workspaceId_channel_externalMessage_key";
