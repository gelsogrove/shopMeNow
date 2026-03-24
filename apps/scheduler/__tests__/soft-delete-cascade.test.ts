import { prisma } from '../src/config/database'
import { softDeleteCleanupJob } from '../src/jobs/soft-delete-cleanup.job'

const createDeleteMany = () => jest.fn().mockResolvedValue({ count: 1 })

describe('Soft Delete - Complete Cascade Test', () => {
  it('should delete workspace data while preserving billing records', async () => {
    ;(prisma as any).schedulerJobStatus = {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
    }

    ;(prisma as any).monthlyInvoice = {
      findMany: jest.fn().mockResolvedValue([]),
    }

    ;(prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'user-1' }])
    ;(prisma.workspace.findMany as jest.Mock).mockResolvedValue([{ id: 'ws-1' }])

    const tx = {
      invoiceCreditNote: { deleteMany: createDeleteMany() },
      invoiceAdjustment: { deleteMany: createDeleteMany() },
      payPalTransaction: { deleteMany: createDeleteMany() },
      monthlyInvoice: { deleteMany: createDeleteMany() },
      twoFactorResetToken: { deleteMany: createDeleteMany() },
      authenticationAttempt: { deleteMany: createDeleteMany() },
      passwordReset: { deleteMany: createDeleteMany() },
      registrationToken: { deleteMany: createDeleteMany() },
      message: { deleteMany: createDeleteMany() },
      messageArchive: { deleteMany: createDeleteMany() },
      conversationMessage: { deleteMany: createDeleteMany() },
      agentConversationLog: { deleteMany: createDeleteMany() },
      chatSession: { deleteMany: createDeleteMany() },
      campaignSent: { deleteMany: createDeleteMany() },
      campaign: { deleteMany: createDeleteMany() },
      productCertification: { deleteMany: createDeleteMany() },
      productType: { deleteMany: createDeleteMany() },
      productCategory: { deleteMany: createDeleteMany() },
      cartItems: { deleteMany: createDeleteMany() },
      carts: { deleteMany: createDeleteMany() },
      creditNote: { deleteMany: createDeleteMany() },
      orderItems: { deleteMany: createDeleteMany() },
      orders: { deleteMany: createDeleteMany() },
      customerFeedback: { deleteMany: createDeleteMany() },
      searchConversations: { deleteMany: createDeleteMany() },
      customers: { deleteMany: createDeleteMany() },
      supportTicket: { findMany: jest.fn().mockResolvedValue([]), deleteMany: createDeleteMany() },
      supportMessage: { deleteMany: createDeleteMany() },
      supportAttachment: { deleteMany: createDeleteMany() },
      certification: { deleteMany: createDeleteMany() },
      type: { deleteMany: createDeleteMany() },
      products: { deleteMany: createDeleteMany() },
      categories: { deleteMany: createDeleteMany() },
      offers: { deleteMany: createDeleteMany() },
      services: { deleteMany: createDeleteMany() },
      fAQ: { deleteMany: createDeleteMany() },
      documents: { deleteMany: createDeleteMany() },
      suppliers: { deleteMany: createDeleteMany() },
      sales: { deleteMany: createDeleteMany() },
      languages: { deleteMany: createDeleteMany() },
      agentConfig: { deleteMany: createDeleteMany() },
      whatsappSettings: { deleteMany: createDeleteMany() },
      gdprContent: { deleteMany: createDeleteMany() },
      whatsAppQueue: { deleteMany: createDeleteMany() },
      // productSearch: REMOVED - table dropped
      secureToken: { deleteMany: createDeleteMany() },
      shortUrls: { deleteMany: createDeleteMany() },
      usage: { deleteMany: createDeleteMany() },
      adminSession: { deleteMany: createDeleteMany() },
      workspaceInvitation: { deleteMany: createDeleteMany() },
      registrationAttempts: { deleteMany: createDeleteMany() },
      softDeleteAuditLog: { create: jest.fn().mockResolvedValue({}), deleteMany: createDeleteMany() },
      userWorkspace: { deleteMany: createDeleteMany() },
      workspace: { deleteMany: createDeleteMany(), findFirst: jest.fn().mockResolvedValue({ id: 'ws-1' }) },
      user: { deleteMany: createDeleteMany() },
      billing: { deleteMany: createDeleteMany() },
      billingTransaction: { deleteMany: createDeleteMany() },
    }

    ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback: (client: typeof tx) => Promise<void>) => {
      await callback(tx)
    })

    await softDeleteCleanupJob()

    expect(tx.messageArchive.deleteMany).toHaveBeenCalled()
    expect(tx.customers.deleteMany).toHaveBeenCalled()
    expect(tx.products.deleteMany).toHaveBeenCalled()
    expect(tx.orders.deleteMany).toHaveBeenCalled()
    expect(tx.workspace.deleteMany).toHaveBeenCalled()
    expect(tx.user.deleteMany).toHaveBeenCalled()
    expect(tx.billing.deleteMany).not.toHaveBeenCalled()
    expect(tx.billingTransaction.deleteMany).not.toHaveBeenCalled()
  })
})
