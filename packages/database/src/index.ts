import { PrismaClient } from './generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Initialize the PostgreSQL adapter
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})

// Singleton Prisma client instance
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' 
      ? ['error', 'warn'] 
      : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Re-export Prisma types and enums
export { PrismaClient, Prisma } from './generated/prisma/client'

// Re-export enums
export * from './generated/prisma/enums'

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
  Suppliers,
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
  CampaignSent
} from './generated/prisma/client'

// Export prisma as default
export default prisma
