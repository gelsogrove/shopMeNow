import { prisma } from '../config/database'
import { Prisma } from '@echatbot/database'
import logger from '../utils/logger'

/**
 * Soft Delete Cleanup Job (Hard-Delete Expired Records)
 * 
 * Feature 196 - Soft Delete System
 * 
 * Runs daily at 23:20
 * Hard-deletes records where deletedAt < (now - SOFT_DELETE_RETENTION_DAYS)
 * 
 * SAFETY:
 * - Uses SchedulerJobStatus to prevent duplicate runs
 * - Explicitly checks deletedAt is NOT null before deleting
 * - Deletes in correct order due to foreign key constraints
 * - Creates audit log entry for compliance
 * 
 * DELETE ORDER (leaf → parent):
 * 1. User-related: TwoFactorResetToken, AuthenticationAttempt, PasswordReset, RegistrationToken
 * 2. Messages, MessageArchive, ConversationMessage, AgentConversationLog
 * 3. ChatSession
 * 4. Campaign-related: CampaignSent, Campaign
 * 5. Product-related: ProductCertification, ProductTransportType, ProductCategory
 * 6. Cart-related: CartItems, Carts
 * 7. Order-related: CreditNote, OrderItems, Orders
 * 8. Customer-related: CustomerFeedback, SearchConversations, Customers
 * 9. Workspace content: Categories, Products, Offers, Services, FAQ, Documents, etc.
 * 10. Workspace config: AgentConfig, WhatsappSettings, GdprContent, etc.
 * 11. UserWorkspace (relation table)
 * 12. Workspaces
 * 13. Users
 * 
 * ⚠️ NOT DELETED (for statistics):
 * - Billing (anonymized to unknownUser)
 * - BillingTransaction (anonymized to unknownUser)
 * 
 * ⚠️ NOT DELETED (for statistics):
 * - Billing (anonymized to unknownUser)
 * - BillingTransaction (anonymized to unknownUser)
 */

const DEFAULT_RETENTION_DAYS = 90

function getRetentionDays(): number {
  const envValue = process.env.SOFT_DELETE_RETENTION_DAYS
  if (!envValue) return DEFAULT_RETENTION_DAYS
  
  const parsed = parseInt(envValue, 10)
  if (isNaN(parsed) || parsed < 1) {
    logger.warn(`Invalid SOFT_DELETE_RETENTION_DAYS value "${envValue}", using default ${DEFAULT_RETENTION_DAYS}`)
    return DEFAULT_RETENTION_DAYS
  }
  return parsed
}

export async function softDeleteCleanupJob(): Promise<void> {
  const startTime = Date.now()
  
  // 1. Prevent duplicate runs (check if already ran today)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const jobStatus = await prisma.schedulerJobStatus.findUnique({
    where: { jobName: 'soft-delete-cleanup' }
  })
  
  if (jobStatus?.lastRunAt && jobStatus.lastRunAt > today) {
    return // Already ran today, skip
  }

  // 2. Calculate expiry date based on retention period
  const retentionDays = getRetentionDays()
  const expiryDate = new Date()
  expiryDate.setDate(expiryDate.getDate() - retentionDays)

  // 3. Find expired Users and Workspaces (main entities with deletedAt)
  const [expiredUsers, expiredWorkspaces, expiredCancelledInvoices] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: { not: null, lt: expiryDate } },
      select: { id: true },
    }),
    prisma.workspace.findMany({
      where: { deletedAt: { not: null, lt: expiryDate } },
      select: { id: true },
    }),
    prisma.monthlyInvoice.findMany({
      where: {
        status: 'CANCELLED',
        updatedAt: { lt: expiryDate },
      },
      select: { id: true },
    }),
  ])

  const userIds = expiredUsers.map((u: { id: string }) => u.id)
  const workspaceIds = expiredWorkspaces.map((w: { id: string }) => w.id)
  const cancelledInvoiceIds = expiredCancelledInvoices.map((inv: { id: string }) => inv.id)

  if (userIds.length === 0 && workspaceIds.length === 0 && cancelledInvoiceIds.length === 0) {
    logger.info(`No expired soft-deleted records to hard-delete`)
    return
  }

  logger.info(
    `Starting hard-delete: ${userIds.length} users, ${workspaceIds.length} workspaces, ${cancelledInvoiceIds.length} cancelled invoices`
  )

  // 4. Hard-delete in transaction (order matters for FK constraints)
  const deletedCounts: Record<string, number> = {}

  await prisma.$transaction(async (tx) => {
    // ===== INVOICE CLEANUP (CANCELLED ONLY) =====
    if (cancelledInvoiceIds.length > 0) {
      deletedCounts.invoiceCreditNote = (await tx.invoiceCreditNote.deleteMany({
        where: { invoiceId: { in: cancelledInvoiceIds } },
      })).count

      try {
        deletedCounts.invoiceAdjustment = (await tx.invoiceAdjustment.deleteMany({
          where: { invoiceId: { in: cancelledInvoiceIds } },
        })).count
      } catch (error: any) {
        if (error?.code === 'P2021') {
          deletedCounts.invoiceAdjustment = 0
        } else {
          throw error
        }
      }

      deletedCounts.paypalTransaction = (await tx.payPalTransaction.deleteMany({
        where: { invoiceId: { in: cancelledInvoiceIds } },
      })).count

      deletedCounts.monthlyInvoice = (await tx.monthlyInvoice.deleteMany({
        where: { id: { in: cancelledInvoiceIds } },
      })).count
    }

    // ===== USER-RELATED TABLES =====
    // Delete user auth/token tables first (FK to User)
    if (userIds.length > 0) {
      deletedCounts.twoFactorResetToken = (await tx.twoFactorResetToken.deleteMany({
        where: { userId: { in: userIds } }
      })).count

      deletedCounts.authenticationAttempt = (await tx.authenticationAttempt.deleteMany({
        where: { userId: { in: userIds } }
      })).count

      deletedCounts.passwordReset = (await tx.passwordReset.deleteMany({
        where: { userId: { in: userIds } }
      })).count
    }

    // RegistrationToken is linked to Workspace, not User - delete with workspaces
    if (workspaceIds.length > 0) {
      deletedCounts.registrationToken = (await tx.registrationToken.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count
    }

    // ===== WORKSPACE-RELATED TABLES (in dependency order) =====
    if (workspaceIds.length > 0) {
      // --- Leaf tables (no FK pointing to them from workspace tables) ---
      
      // Messages
      deletedCounts.message = (await tx.message.deleteMany({
        where: { chatSession: { workspaceId: { in: workspaceIds } } }
      })).count

      // ⚠️ CRITICAL: Delete archived messages (>6 months old)
      // MessageArchive has denormalized workspaceId for cleanup
      deletedCounts.messageArchive = (await tx.messageArchive.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      // ConversationMessage (AgentConversationLog child)
      deletedCounts.conversationMessage = (await tx.conversationMessage.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      // AgentConversationLog
      deletedCounts.agentConversationLog = (await tx.agentConversationLog.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      // ChatSession
      deletedCounts.chatSession = (await tx.chatSession.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      // --- Campaign tables ---
      deletedCounts.campaignSent = (await tx.campaignSent.deleteMany({
        where: { campaign: { workspaceId: { in: workspaceIds } } }
      })).count

      deletedCounts.campaign = (await tx.campaign.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      // --- Product relation tables (many-to-many) ---
      deletedCounts.productCertification = (await tx.productCertification.deleteMany({
        where: { product: { workspaceId: { in: workspaceIds } } }
      })).count

      deletedCounts.productTransportType = (await tx.productTransportType.deleteMany({
        where: { product: { workspaceId: { in: workspaceIds } } }
      })).count

      deletedCounts.productCategory = (await tx.productCategory.deleteMany({
        where: { product: { workspaceId: { in: workspaceIds } } }
      })).count

      // --- Cart tables ---
      deletedCounts.cartItems = (await tx.cartItems.deleteMany({
        where: { cart: { workspaceId: { in: workspaceIds } } }
      })).count

      deletedCounts.carts = (await tx.carts.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      // --- Order tables ---
      deletedCounts.creditNote = (await tx.creditNote.deleteMany({
        where: { order: { workspaceId: { in: workspaceIds } } }
      })).count

      deletedCounts.orderItems = (await tx.orderItems.deleteMany({
        where: { order: { workspaceId: { in: workspaceIds } } }
      })).count

      deletedCounts.orders = (await tx.orders.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      // --- Customer-related ---
      deletedCounts.customerFeedback = (await tx.customerFeedback.deleteMany({
        where: { customer: { workspaceId: { in: workspaceIds } } }
      })).count

      deletedCounts.searchConversations = (await tx.searchConversations.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      deletedCounts.customers = (await tx.customers.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      // --- Workspace content tables ---
      deletedCounts.certifications = (await tx.certification.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      deletedCounts.transportTypes = (await tx.transportType.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      deletedCounts.products = (await tx.products.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      deletedCounts.categories = (await tx.categories.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      deletedCounts.offers = (await tx.offers.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      deletedCounts.services = (await tx.services.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      deletedCounts.faq = (await tx.fAQ.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      deletedCounts.documents = (await tx.documents.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      deletedCounts.sales = (await tx.sales.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      deletedCounts.languages = (await tx.languages.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      // --- Workspace config tables ---
      deletedCounts.agentConfig = (await tx.agentConfig.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      deletedCounts.whatsappSettings = (await tx.whatsappSettings.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      deletedCounts.gdprContent = (await tx.gdprContent.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      // --- Workspace operational tables ---
      deletedCounts.whatsAppQueue = (await tx.whatsAppQueue.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      deletedCounts.productSearch = (await tx.productSearch.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      deletedCounts.secureToken = (await tx.secureToken.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      deletedCounts.shortUrls = (await tx.shortUrls.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      deletedCounts.usage = (await tx.usage.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      // ⚠️ BILLING & TRANSACTIONS NOT DELETED
      // Keep for statistics - will be anonymized to "unknownUser" in queries
      // deletedCounts.billing = (await tx.billing.deleteMany(...))
      // deletedCounts.billingTransaction = (await tx.billingTransaction.deleteMany(...))

      deletedCounts.adminSession = (await tx.adminSession.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      deletedCounts.workspaceInvitation = (await tx.workspaceInvitation.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      deletedCounts.registrationAttempts = (await tx.registrationAttempts.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count

      // SoftDeleteAuditLog - delete last before workspace (self-referential)
      deletedCounts.softDeleteAuditLog = (await tx.softDeleteAuditLog.deleteMany({
        where: { workspaceId: { in: workspaceIds } }
      })).count
    }

    // ===== USER-WORKSPACE RELATION =====
    // Delete UserWorkspace for both expired users AND expired workspaces
    if (userIds.length > 0 || workspaceIds.length > 0) {
      deletedCounts.userWorkspace = (await tx.userWorkspace.deleteMany({
        where: {
          OR: [
            { userId: { in: userIds } },
            { workspaceId: { in: workspaceIds } }
          ]
        }
      })).count
    }

    // ===== WORKSPACES =====
    if (workspaceIds.length > 0) {
      deletedCounts.workspace = (await tx.workspace.deleteMany({
        where: { id: { in: workspaceIds } }
      })).count
    }

    // ===== USERS (last - may own workspaces) =====
    if (userIds.length > 0) {
      deletedCounts.user = (await tx.user.deleteMany({
        where: { id: { in: userIds } }
      })).count
    }

    // Create audit log entry for compliance
    const totalDeleted = Object.values(deletedCounts).reduce((sum, count) => sum + count, 0)
    
    if (totalDeleted > 0) {
      // Find any active workspace for logging
      const anyWorkspace = await tx.workspace.findFirst({
        where: { deletedAt: null },
        select: { id: true },
      })

      if (anyWorkspace) {
        await tx.softDeleteAuditLog.create({
          data: {
            workspaceId: anyWorkspace.id,
            entityType: 'SCHEDULER_HARD_DELETE',
            deletedIds: [...userIds, ...workspaceIds],
            deletedIdCount: totalDeleted,
            reason: `SCHEDULED_CLEANUP_${retentionDays}_DAYS`,
            deletedByUserId: null, // Scheduler-initiated (no user)
          },
        })
      }
    }
  }, {
    timeout: 60000, // 60 seconds for large deletes
  })

  const duration = Date.now() - startTime
  const totalDeleted = Object.values(deletedCounts).reduce((sum, count) => sum + count, 0)

  logger.info(`Hard-deleted ${totalDeleted} expired soft-deleted records (retention: ${retentionDays} days, took ${duration}ms)`, {
    deletedByType: deletedCounts
  })

  // 5. Update job status to prevent re-runs
  await prisma.schedulerJobStatus.upsert({
    where: { jobName: 'soft-delete-cleanup' },
    update: { lastRunAt: new Date() },
    create: { jobName: 'soft-delete-cleanup', lastRunAt: new Date() },
  })
}
