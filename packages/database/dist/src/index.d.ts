import 'dotenv/config';
import { PrismaClient, Prisma } from './generated/prisma/index.js';
export declare const prisma: PrismaClient<Prisma.PrismaClientOptions, Prisma.LogLevel, import("./generated/prisma/runtime/client.js").DefaultArgs>;
export { PrismaClient, Prisma } from './generated/prisma/index.js';
export { UserStatus, WorkspaceStatus, ProductStatus, DocumentStatus, OrderStatus, PaymentMethod, PaymentStatus, MessageDirection, MessageType, ChannelType, UserRole, InvitationStatus, ItemType, PlanType, TransactionType, BillingType, CampaignFrequency, CampaignTargetType, ConfigType, PricingType, AgentType, SearchConversationState, SubscriptionStatus, // Feature 197: Subscription status enum
InvoiceStatus, } from './generated/prisma/index.js';
export type { Workspace, Categories, Products, Customers, Orders, OrderItems, User, ChatSession, Message, MessageArchive, CartItems, Carts, Certification, TransportType, CreditNote, Languages, Sales, ProductCertification, ProductTransportType, ProductCategory, WhatsAppQueue, SearchConversations, TwoFactorResetToken, AuthenticationAttempt, UserWorkspace, WhatsappSettings, PaymentDetails, PasswordReset, Campaign, CampaignSent, SoftDeleteAuditLog, AgentConfig, AgentConversationLog, FAQ, Services, Offers, Documents, GdprContent, Usage, RegistrationAttempts, WorkspaceInvitation, ShortUrls, Billing, ConversationMessage, BillingTransaction, PlanConfiguration, RegistrationToken, SecureToken, ProductSearch, MonthlyInvoice, } from './generated/prisma/index.js';
export default prisma;
