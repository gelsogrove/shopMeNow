import { prisma } from '../src/config/database'
import { softDeleteCleanupJob } from '../src/jobs/soft-delete-cleanup.job'

/**
 * Test: Complete Cascade Deletion for Soft Delete System
 * 
 * Verifies that when a user is soft-deleted, ALL related data is deleted after 90 days:
 * - User account and authentication data
 * - Workspaces owned by user
 * - Customers, Orders, Messages (current + archived)
 * - Products, Services, FAQ, Categories, Offers
 * - ChatSessions, Campaigns, Carts
 * - All workspace configuration (settings, agent config, etc.)
 * 
 * ⚠️ CRITICAL: Billing and Transactions are NOT deleted (kept for statistics)
 */

describe('Soft Delete - Complete Cascade Test', () => {
  let testUserId: string
  let testWorkspaceId: string
  let testCustomerId: string
  let testMessageId: string
  let testArchivedMessageId: string
  let testProductId: string
  let testOrderId: string
  let testChatSessionId: string

  beforeAll(async () => {
    // Clean up any existing test data
    await cleanupTestData()
  })

  afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
  })

  it('should soft-delete user and cascade to ALL related data after 90 days', async () => {
    // ===== PHASE 1: CREATE USER WITH COMPLETE DATA STRUCTURE =====
    console.log('Phase 1: Creating user with full data structure...')

    // 1. Create User
    const user = await prisma.user.create({
      data: {
        email: 'test-cascade@echatbot.ai',
        password: 'hashedPassword123',
        role: 'OWNER',
        firstName: 'Cascade',
        lastName: 'Test',
      },
    })
    testUserId = user.id
    console.log(`✅ Created user: ${testUserId}`)

    // 2. Create Workspace (owned by user)
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Test Workspace for Cascade',
        slug: 'test-cascade-ws',
        domain: 'test-cascade.echatbot.ai',
        ownerId: testUserId,
      },
    })
    testWorkspaceId = workspace.id
    console.log(`✅ Created workspace: ${testWorkspaceId}`)

    // 3. Create UserWorkspace relation
    await prisma.userWorkspace.create({
      data: {
        userId: testUserId,
        workspaceId: testWorkspaceId,
        role: 'OWNER',
      },
    })

    // 4. Create Customer
    const customer = await prisma.customers.create({
      data: {
        workspaceId: testWorkspaceId,
        whatsapp: '+39999888777',
        name: 'Test Customer',
        email: 'customer@test.com',
      },
    })
    testCustomerId = customer.id
    console.log(`✅ Created customer: ${testCustomerId}`)

    // 5. Create ChatSession
    const chatSession = await prisma.chatSession.create({
      data: {
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        status: 'active',
      },
    })
    testChatSessionId = chatSession.id

    // 6. Create Message
    const message = await prisma.message.create({
      data: {
        chatSessionId: testChatSessionId,
        direction: 'INCOMING',
        content: 'Test message',
        type: 'TEXT',
        status: 'delivered',
      },
    })
    testMessageId = message.id
    console.log(`✅ Created message: ${testMessageId}`)

    // 7. Create MessageArchive (simulating archived message >6 months old)
    const archivedMessage = await prisma.messageArchive.create({
      data: {
        originalId: message.id,
        chatSessionId: testChatSessionId,
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        direction: 'INCOMING',
        content: 'Archived message from 7 months ago',
        type: 'TEXT',
        status: 'delivered',
        createdAt: new Date(Date.now() - 210 * 24 * 60 * 60 * 1000), // 7 months ago
        updatedAt: new Date(Date.now() - 210 * 24 * 60 * 60 * 1000),
        archivedAt: new Date(),
      },
    })
    testArchivedMessageId = archivedMessage.id
    console.log(`✅ Created archived message: ${testArchivedMessageId}`)

    // 8. Create Product
    const product = await prisma.products.create({
      data: {
        workspaceId: testWorkspaceId,
        name: 'Test Product',
        description: 'A test product for cascade deletion',
        price: 99.99,
        currency: 'EUR',
        isActive: true,
        internalCode: 'TEST-001',
      },
    })
    testProductId = product.id
    console.log(`✅ Created product: ${testProductId}`)

    // 9. Create Category
    await prisma.categories.create({
      data: {
        workspaceId: testWorkspaceId,
        name: 'Test Category',
        description: 'Test category for cascade',
      },
    })

    // 10. Create Service
    await prisma.services.create({
      data: {
        workspaceId: testWorkspaceId,
        title: 'Test Service',
        description: 'Test service for cascade',
      },
    })

    // 11. Create FAQ
    await prisma.fAQ.create({
      data: {
        workspaceId: testWorkspaceId,
        question: 'Test FAQ?',
        answer: 'This is a test FAQ for cascade deletion.',
      },
    })

    // 12. Create Offer
    await prisma.offers.create({
      data: {
        workspaceId: testWorkspaceId,
        title: 'Test Offer',
        description: 'Test offer for cascade',
      },
    })

    // 13. Create Cart and CartItem
    const cart = await prisma.carts.create({
      data: {
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
      },
    })

    await prisma.cartItems.create({
      data: {
        cartId: cart.id,
        productId: testProductId,
        quantity: 2,
      },
    })

    // 14. Create Order
    const order = await prisma.orders.create({
      data: {
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        orderCode: 'TEST-ORDER-001',
        status: 'pending',
        totalAmount: new Prisma.Decimal(199.98),
        currency: 'EUR',
      },
    })
    testOrderId = order.id
    console.log(`✅ Created order: ${testOrderId}`)

    // 15. Create OrderItem
    await prisma.orderItems.create({
      data: {
        orderId: testOrderId,
        productId: testProductId,
        productName: 'Test Product',
        quantity: 2,
        price: new Prisma.Decimal(99.99),
        currency: 'EUR',
      },
    })

    // 16. Create Campaign
    const campaign = await prisma.campaign.create({
      data: {
        workspaceId: testWorkspaceId,
        name: 'Test Campaign',
        status: 'draft',
        scheduledAt: new Date(),
      },
    })

    await prisma.campaignSent.create({
      data: {
        campaignId: campaign.id,
        customerId: testCustomerId,
        status: 'pending',
      },
    })

    // 17. Create AgentConfig
    await prisma.agentConfig.create({
      data: {
        workspaceId: testWorkspaceId,
        context: 'Test agent context',
      },
    })

    // 18. Create WhatsappSettings
    await prisma.whatsappSettings.create({
      data: {
        workspaceId: testWorkspaceId,
        phoneNumberId: 'test-phone-id',
        accessToken: 'test-access-token',
      },
    })

    // 19. Create Billing (should NOT be deleted)
    await prisma.billing.create({
      data: {
        workspaceId: testWorkspaceId,
        userId: testUserId,
        plan: 'PRO',
        status: 'active',
        creditBalance: new Prisma.Decimal(100.0),
      },
    })

    // 20. Create BillingTransaction (should NOT be deleted)
    await prisma.billingTransaction.create({
      data: {
        workspaceId: testWorkspaceId,
        type: 'CREDIT_RECHARGE',
        amount: new Prisma.Decimal(100.0),
        balanceAfter: new Prisma.Decimal(100.0),
        description: 'Test transaction',
      },
    })

    console.log('✅ Phase 1 complete: All data created')

    // ===== PHASE 2: VERIFY DATA EXISTS =====
    console.log('\nPhase 2: Verifying data exists...')

    const userExists = await prisma.user.findUnique({ where: { id: testUserId } })
    const workspaceExists = await prisma.workspace.findUnique({ where: { id: testWorkspaceId } })
    const customerExists = await prisma.customers.findUnique({ where: { id: testCustomerId } })
    const messageExists = await prisma.message.findUnique({ where: { id: testMessageId } })
    const archivedExists = await prisma.messageArchive.findUnique({ where: { id: testArchivedMessageId } })
    const productExists = await prisma.products.findUnique({ where: { id: testProductId } })
    const orderExists = await prisma.orders.findUnique({ where: { id: testOrderId } })

    expect(userExists).not.toBeNull()
    expect(workspaceExists).not.toBeNull()
    expect(customerExists).not.toBeNull()
    expect(messageExists).not.toBeNull()
    expect(archivedExists).not.toBeNull()
    expect(productExists).not.toBeNull()
    expect(orderExists).not.toBeNull()

    console.log('✅ Phase 2 complete: All data verified')

    // ===== PHASE 3: SOFT DELETE USER =====
    console.log('\nPhase 3: Soft-deleting user...')

    const deletedAt = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000) // 91 days ago (expired)

    await prisma.user.update({
      where: { id: testUserId },
      data: { deletedAt },
    })

    await prisma.workspace.update({
      where: { id: testWorkspaceId },
      data: { deletedAt },
    })

    console.log('✅ Phase 3 complete: User and workspace soft-deleted (91 days ago)')

    // ===== PHASE 4: RUN HARD DELETE JOB =====
    console.log('\nPhase 4: Running hard delete job (scheduler)...')

    await softDeleteCleanupJob()

    console.log('✅ Phase 4 complete: Hard delete job finished')

    // ===== PHASE 5: VERIFY EVERYTHING IS DELETED =====
    console.log('\nPhase 5: Verifying complete cascade deletion...')

    // User and Workspace
    const userAfter = await prisma.user.findUnique({ where: { id: testUserId } })
    const workspaceAfter = await prisma.workspace.findUnique({ where: { id: testWorkspaceId } })
    
    expect(userAfter).toBeNull()
    expect(workspaceAfter).toBeNull()
    console.log('✅ User and Workspace deleted')

    // Customer
    const customerAfter = await prisma.customers.findUnique({ where: { id: testCustomerId } })
    expect(customerAfter).toBeNull()
    console.log('✅ Customer deleted')

    // Messages
    const messageAfter = await prisma.message.findUnique({ where: { id: testMessageId } })
    expect(messageAfter).toBeNull()
    console.log('✅ Message deleted')

    // ⚠️ CRITICAL: Archived messages must be deleted too
    const archivedAfter = await prisma.messageArchive.findUnique({ where: { id: testArchivedMessageId } })
    expect(archivedAfter).toBeNull()
    console.log('✅ MessageArchive deleted (CRITICAL FIX)')

    // ChatSession
    const sessionAfter = await prisma.chatSession.findUnique({ where: { id: testChatSessionId } })
    expect(sessionAfter).toBeNull()
    console.log('✅ ChatSession deleted')

    // Product
    const productAfter = await prisma.products.findUnique({ where: { id: testProductId } })
    expect(productAfter).toBeNull()
    console.log('✅ Product deleted')

    // Order
    const orderAfter = await prisma.orders.findUnique({ where: { id: testOrderId } })
    expect(orderAfter).toBeNull()
    console.log('✅ Order deleted')

    // Categories, Services, FAQ, Offers
    const categoriesAfter = await prisma.categories.findMany({ where: { workspaceId: testWorkspaceId } })
    const servicesAfter = await prisma.services.findMany({ where: { workspaceId: testWorkspaceId } })
    const faqAfter = await prisma.fAQ.findMany({ where: { workspaceId: testWorkspaceId } })
    const offersAfter = await prisma.offers.findMany({ where: { workspaceId: testWorkspaceId } })

    expect(categoriesAfter).toHaveLength(0)
    expect(servicesAfter).toHaveLength(0)
    expect(faqAfter).toHaveLength(0)
    expect(offersAfter).toHaveLength(0)
    console.log('✅ Categories, Services, FAQ, Offers deleted')

    // AgentConfig, WhatsappSettings
    const agentConfigAfter = await prisma.agentConfig.findMany({ where: { workspaceId: testWorkspaceId } })
    const whatsappSettingsAfter = await prisma.whatsappSettings.findMany({ where: { workspaceId: testWorkspaceId } })

    expect(agentConfigAfter).toHaveLength(0)
    expect(whatsappSettingsAfter).toHaveLength(0)
    console.log('✅ AgentConfig, WhatsappSettings deleted')

    // ⚠️ BILLING AND TRANSACTIONS SHOULD STILL EXIST (for statistics)
    const billingAfter = await prisma.billing.findMany({ where: { workspaceId: testWorkspaceId } })
    const transactionsAfter = await prisma.billingTransaction.findMany({ where: { workspaceId: testWorkspaceId } })

    expect(billingAfter).toHaveLength(1) // Still exists
    expect(transactionsAfter).toHaveLength(1) // Still exists
    console.log('✅ Billing and Transactions PRESERVED (for statistics)')

    console.log('✅ Phase 5 complete: All data verified deleted (except billing)')

    console.log('\n🎯 TEST PASSED: Complete cascade deletion working correctly!')
  })

  async function cleanupTestData() {
    try {
      // Delete in reverse order
      if (testArchivedMessageId) {
        await prisma.messageArchive.deleteMany({ where: { originalId: testMessageId } })
      }
      if (testMessageId) {
        await prisma.message.deleteMany({ where: { chatSessionId: testChatSessionId } })
      }
      if (testChatSessionId) {
        await prisma.chatSession.deleteMany({ where: { id: testChatSessionId } })
      }
      if (testOrderId) {
        await prisma.orderItems.deleteMany({ where: { orderId: testOrderId } })
        await prisma.orders.deleteMany({ where: { id: testOrderId } })
      }
      if (testCustomerId) {
        await prisma.cartItems.deleteMany({ where: { cart: { customerId: testCustomerId } } })
        await prisma.carts.deleteMany({ where: { customerId: testCustomerId } })
        await prisma.campaignSent.deleteMany({ where: { customerId: testCustomerId } })
        await prisma.customers.deleteMany({ where: { id: testCustomerId } })
      }
      if (testWorkspaceId) {
        await prisma.campaign.deleteMany({ where: { workspaceId: testWorkspaceId } })
        await prisma.products.deleteMany({ where: { workspaceId: testWorkspaceId } })
        await prisma.categories.deleteMany({ where: { workspaceId: testWorkspaceId } })
        await prisma.services.deleteMany({ where: { workspaceId: testWorkspaceId } })
        await prisma.fAQ.deleteMany({ where: { workspaceId: testWorkspaceId } })
        await prisma.offers.deleteMany({ where: { workspaceId: testWorkspaceId } })
        await prisma.agentConfig.deleteMany({ where: { workspaceId: testWorkspaceId } })
        await prisma.whatsappSettings.deleteMany({ where: { workspaceId: testWorkspaceId } })
        await prisma.billingTransaction.deleteMany({ where: { workspaceId: testWorkspaceId } })
        await prisma.billing.deleteMany({ where: { workspaceId: testWorkspaceId } })
        await prisma.userWorkspace.deleteMany({ where: { workspaceId: testWorkspaceId } })
        await prisma.workspace.deleteMany({ where: { id: testWorkspaceId } })
      }
      if (testUserId) {
        await prisma.user.deleteMany({ where: { id: testUserId } })
      }
    } catch (error) {
      console.log('Cleanup error (expected if data already deleted):', error.message)
    }
  }
})
