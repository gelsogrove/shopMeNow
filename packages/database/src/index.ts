// Load environment variables from root .env if not already loaded
// This ensures DATABASE_URL is available before PrismaPg adapter is created
import 'dotenv/config'
import path from 'path'
import dotenv from 'dotenv'

// Try to load .env from various locations (monorepo support)
// Use process.cwd() which works in both CommonJS and ES modules
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '../../../.env'),
  path.resolve(process.cwd(), '../../../../.env'),
]
for (const envPath of envPaths) {
  const result = dotenv.config({ path: envPath })
  if (result.parsed?.DATABASE_URL || process.env.DATABASE_URL) break
}

// Validate DATABASE_URL is set
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set! Tried paths:', envPaths)
  throw new Error('DATABASE_URL environment variable is required')
}

import { PrismaClient, Prisma } from './generated/prisma/index.js'
import { PrismaPg } from '@prisma/adapter-pg'

// ============================================================================
// Prisma 7 with PrismaPg adapter using connectionString (no Pool)
// ============================================================================
// This approach uses connectionString directly instead of Pool.
// PrismaPg handles connection management internally.
// Connection errors are thrown at query time, allowing retry logic in the app.

const adapter = new PrismaPg({ connectionString: DATABASE_URL })

export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' 
    ? ['error', 'warn'] 
    : ['error'],
})

// Re-export Prisma types and client
export { PrismaClient, Prisma } from './generated/prisma/index.js'

// Re-export all enums and types from generated client
export {
  // Enums
  UserStatus,
  WorkspaceStatus,
  ProductStatus,
  DocumentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  MessageDirection,
  MessageType,
  ChannelType,
  UserRole,
  InvitationStatus,
  ItemType,
  PlanType,
  TransactionType,
  BillingType,
  CampaignFrequency,
  CampaignTargetType,
  ConfigType,
  PricingType,
  AgentType,
  SearchConversationState,
  SubscriptionStatus, // Feature 197: Subscription status enum
  InvoiceStatus,      // Feature 197: Invoice status enum
  PayPalStatus,
  PayPalTransactionStatus,
  // Support Ticket Enums
  SupportIssueType,
  SupportTicketStatus,
  SupportSenderType,
  // Push Campaign Enums
  PushCampaignStatus,
  PushCampaignRecipientStatus,
} from './generated/prisma/index.js'

// Export common types
export type {
  Workspace,
  Categories,
  Products,
  Customers,
  Orders,
  OrderItems,
  User,
  ChatSession,
  Message,
  MessageArchive,
  CartItems,
  Carts,
  Certification,
  TransportType,
  CreditNote,
  Languages,
  Sales,
  ProductCertification,
  ProductTransportType,
  ProductCategory,
  WhatsAppQueue,
  SearchConversations,
  TwoFactorResetToken,
  AuthenticationAttempt,
  UserWorkspace,
  WhatsappSettings,
  PaymentDetails,
  PasswordReset,
  Campaign,
  CampaignSent,
  SoftDeleteAuditLog,
  // Additional types needed by backend
  AgentConfig,
  AgentConversationLog,
  FAQ,
  Services,
  Offers,
  Documents,
  GdprContent,
  Usage,
  RegistrationAttempts,
  WorkspaceInvitation,
  ShortUrls,
  Billing,
  ConversationMessage,
  BillingTransaction,
  PlanConfiguration,
  RegistrationToken,
  SecureToken,
  ProductSearch,
  MonthlyInvoice,     // Feature 197: Monthly invoices
  PayPalTransaction,
  // Support Ticket Types
  SupportTicket,
  SupportMessage,
  SupportAttachment,
  // Push Campaign Types
  PushCampaign,
  PushCampaignRecipient,
  CustomerFeedback,
} from './generated/prisma/index.js'

// Export prisma as default
export default prisma

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect()
}

