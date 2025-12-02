import { prisma } from '../src/config/database'
import { whatsappQueueCleanupJob } from '../src/jobs/whatsapp-queue-cleanup.job'

describe('WhatsApp Queue Cleanup Job', () => {
  const workspaceId = 'test-workspace-cleanup-id'
  const customerId = 'test-customer-cleanup-id'
  const ownerId = 'test-owner-cleanup-id'

  beforeAll(async () => {
    // Create test owner
    await prisma.user.upsert({
      where: { id: ownerId },
      update: {},
      create: {
        id: ownerId,
        email: 'owner-cleanup@test.com',
        passwordHash: 'hashedpassword',
        firstName: 'Test',
        lastName: 'Owner',
        role: 'OWNER',
      },
    })

    // Create test workspace
    await prisma.workspace.upsert({
      where: { id: workspaceId },
      update: {},
      create: {
        id: workspaceId,
        name: 'Test Workspace Cleanup',
        slug: 'test-workspace-cleanup',
        businessType: 'ECOMMERCE',
        ownerId: ownerId,
      },
    })

    // Create test customer
    await prisma.customers.upsert({
      where: { id: customerId },
      update: {},
      create: {
        id: customerId,
        name: 'Test Customer',
        email: 'test-cleanup@example.com',
        phone: '+1234567890999',
        workspaceId,
      },
    })
  })

  afterAll(async () => {
    // Clean up in correct order (foreign keys)
    await prisma.whatsAppQueue.deleteMany({
      where: { workspaceId },
    })
    await prisma.customers.deleteMany({
      where: { workspaceId },
    })
    await prisma.workspace.deleteMany({
      where: { id: workspaceId },
    })
    await prisma.user.deleteMany({
      where: { id: ownerId },
    })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clear queue before each test
    await prisma.whatsAppQueue.deleteMany({
      where: { workspaceId },
    })
  })

  it('should delete error messages older than 7 days', async () => {
    const tenDaysAgo = new Date()
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)

    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    // Create old error message (should be deleted)
    await prisma.whatsAppQueue.create({
      data: {
        workspaceId,
        customerId,
        phoneNumber: '+1234567890',
        messageContent: 'Old error message',
        status: 'error',
        errorMessage: 'Test error',
        createdAt: tenDaysAgo,
      },
    })

    // Create recent error message (should NOT be deleted)
    await prisma.whatsAppQueue.create({
      data: {
        workspaceId,
        customerId,
        phoneNumber: '+1234567890',
        messageContent: 'Recent error message',
        status: 'error',
        errorMessage: 'Test error',
        createdAt: threeDaysAgo,
      },
    })

    // Run the job
    await whatsappQueueCleanupJob()

    // Check results
    const remaining = await prisma.whatsAppQueue.findMany({
      where: { workspaceId },
    })

    expect(remaining).toHaveLength(1)
    expect(remaining[0].messageContent).toBe('Recent error message')
  })

  it('should delete sent messages older than 7 days', async () => {
    const tenDaysAgo = new Date()
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)

    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    // Create old sent message (should be deleted)
    await prisma.whatsAppQueue.create({
      data: {
        workspaceId,
        customerId,
        phoneNumber: '+1234567890',
        messageContent: 'Old sent message',
        status: 'sent',
        deliveredAt: tenDaysAgo,
        createdAt: tenDaysAgo,
      },
    })

    // Create recent sent message (should NOT be deleted)
    await prisma.whatsAppQueue.create({
      data: {
        workspaceId,
        customerId,
        phoneNumber: '+1234567890',
        messageContent: 'Recent sent message',
        status: 'sent',
        deliveredAt: twoDaysAgo,
        createdAt: twoDaysAgo,
      },
    })

    // Run the job
    await whatsappQueueCleanupJob()

    // Check results
    const remaining = await prisma.whatsAppQueue.findMany({
      where: { workspaceId },
    })

    expect(remaining).toHaveLength(1)
    expect(remaining[0].messageContent).toBe('Recent sent message')
  })

  it('should NOT delete pending messages regardless of age', async () => {
    const tenDaysAgo = new Date()
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10)

    // Create old pending message (should NOT be deleted - pending messages are important)
    await prisma.whatsAppQueue.create({
      data: {
        workspaceId,
        customerId,
        phoneNumber: '+1234567890',
        messageContent: 'Old pending message',
        status: 'pending',
        createdAt: tenDaysAgo,
      },
    })

    // Run the job
    await whatsappQueueCleanupJob()

    // Check results - pending message should still exist
    const remaining = await prisma.whatsAppQueue.findMany({
      where: { workspaceId },
    })

    expect(remaining).toHaveLength(1)
    expect(remaining[0].status).toBe('pending')
  })

  it('should handle empty queue gracefully', async () => {
    // No messages in queue
    await expect(whatsappQueueCleanupJob()).resolves.not.toThrow()
  })
})
