import { PrismaClient } from '@echatbot/database'
import { BillingService } from '../../src/application/services/billing.service'

describe('BillingService - trackMessage', () => {
  let prisma: PrismaClient
  let billingService: BillingService
  let testWorkspace: any
  let testOwner: any
  let testCustomer: any

  beforeAll(async () => {
    prisma = new PrismaClient()
    billingService = new BillingService(prisma)
  })

  beforeEach(async () => {
    // Clean up test data
    await prisma.billingTransaction.deleteMany({
      where: { userId: { contains: 'test-billing-' } }
    })
    await prisma.billing.deleteMany({
      where: { workspaceId: { contains: 'test-billing-' } }
    })
    await prisma.workspace.deleteMany({
      where: { id: { contains: 'test-billing-' } }
    })
    await prisma.customer.deleteMany({
      where: { id: { contains: 'test-billing-' } }
    })
    await prisma.user.deleteMany({
      where: { id: { contains: 'test-billing-' } }
    })

    // Create test owner
    testOwner = await prisma.user.create({
      data: {
        id: 'test-billing-owner-1',
        email: 'test-billing@example.com',
        password: 'hashed',
        firstName: 'Test',
        lastName: 'Owner',
        creditBalance: 100.0, // Start with 100€
        planType: 'PREMIUM',
      }
    })

    // Create test workspace
    testWorkspace = await prisma.workspace.create({
      data: {
        id: 'test-billing-workspace-1',
        name: 'Test Workspace',
        ownerId: testOwner.id,
        creditBalance: 100.0, // Legacy field (should not be used)
      }
    })

    // Create test customer
    testCustomer = await prisma.customer.create({
      data: {
        id: 'test-billing-customer-1',
        workspaceId: testWorkspace.id,
        phone: '+393331234567',
        name: 'Test Customer',
      }
    })
  })

  afterEach(async () => {
    // Clean up
    await prisma.billingTransaction.deleteMany({
      where: { userId: testOwner.id }
    })
    await prisma.billing.deleteMany({
      where: { workspaceId: testWorkspace.id }
    })
    await prisma.customer.delete({ where: { id: testCustomer.id } })
    await prisma.workspace.delete({ where: { id: testWorkspace.id } })
    await prisma.user.delete({ where: { id: testOwner.id } })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  describe('✅ Correct Behavior Tests', () => {
    it('should deduct credit correctly for a single message', async () => {
      const initialBalance = 100.0
      const messageCost = 0.10

      await billingService.trackMessage(
        testWorkspace.id,
        testCustomer.id,
        'Test message'
      )

      // Check user balance
      const user = await prisma.user.findUnique({ where: { id: testOwner.id } })
      expect(Number(user!.creditBalance)).toBe(initialBalance - messageCost)

      // Check transaction record
      const transaction = await prisma.billingTransaction.findFirst({
        where: { userId: testOwner.id }
      })
      expect(transaction).toBeDefined()
      expect(Number(transaction!.amount)).toBe(-messageCost) // ✅ NEGATIVE for deduction
      expect(Number(transaction!.balanceAfter)).toBe(initialBalance - messageCost)
      expect(transaction!.type).toBe('MESSAGE')
    })

    it('should handle multiple sequential messages correctly', async () => {
      const initialBalance = 100.0
      const messageCost = 0.10

      // Send 3 messages
      await billingService.trackMessage(testWorkspace.id, testCustomer.id, 'Message 1')
      await billingService.trackMessage(testWorkspace.id, testCustomer.id, 'Message 2')
      await billingService.trackMessage(testWorkspace.id, testCustomer.id, 'Message 3')

      const user = await prisma.user.findUnique({ where: { id: testOwner.id } })
      const expectedBalance = initialBalance - (messageCost * 3)
      expect(Number(user!.creditBalance)).toBeCloseTo(expectedBalance, 2)

      // Check transaction history
      const transactions = await prisma.billingTransaction.findMany({
        where: { userId: testOwner.id },
        orderBy: { createdAt: 'asc' }
      })

      expect(transactions).toHaveLength(3)
      expect(Number(transactions[0].balanceAfter)).toBeCloseTo(99.9, 2)
      expect(Number(transactions[1].balanceAfter)).toBeCloseTo(99.8, 2)
      expect(Number(transactions[2].balanceAfter)).toBeCloseTo(99.7, 2)
    })
  })

  describe('🔒 Race Condition Prevention Tests', () => {
    it('should handle concurrent messages without race conditions', async () => {
      const initialBalance = 100.0
      const messageCost = 0.10
      const concurrentMessages = 10

      // Send 10 messages concurrently
      const promises = Array.from({ length: concurrentMessages }, (_, i) =>
        billingService.trackMessage(testWorkspace.id, testCustomer.id, `Concurrent message ${i}`)
      )

      await Promise.all(promises)

      // Final balance should be exactly initial - (cost * messages)
      const user = await prisma.user.findUnique({ where: { id: testOwner.id } })
      const expectedBalance = initialBalance - (messageCost * concurrentMessages)
      expect(Number(user!.creditBalance)).toBeCloseTo(expectedBalance, 2)

      // All transactions should have correct balanceAfter
      const transactions = await prisma.billingTransaction.findMany({
        where: { userId: testOwner.id },
        orderBy: { createdAt: 'asc' }
      })

      expect(transactions).toHaveLength(concurrentMessages)

      // Verify no duplicate balances (sign of race condition)
      const balances = transactions.map(t => Number(t.balanceAfter))
      const uniqueBalances = new Set(balances)
      expect(uniqueBalances.size).toBe(concurrentMessages) // All different
    })

    it('should never show positive amount for MESSAGE deductions', async () => {
      await billingService.trackMessage(testWorkspace.id, testCustomer.id, 'Test')

      const transaction = await prisma.billingTransaction.findFirst({
        where: { userId: testOwner.id, type: 'MESSAGE' }
      })

      expect(Number(transaction!.amount)).toBeLessThan(0) // ✅ Must be negative
    })
  })

  describe('💰 Balance Calculation Tests', () => {
    it('should calculate balance correctly across multiple deductions', async () => {
      let currentBalance = 100.0

      for (let i = 0; i < 5; i++) {
        await billingService.trackMessage(testWorkspace.id, testCustomer.id, `Message ${i}`)
        currentBalance -= 0.10

        const user = await prisma.user.findUnique({ where: { id: testOwner.id } })
        expect(Number(user!.creditBalance)).toBeCloseTo(currentBalance, 2)
      }
    })

    it('should maintain consistency between user balance and transaction history', async () => {
      const messageCost = 0.10

      await billingService.trackMessage(testWorkspace.id, testCustomer.id, 'Test')

      const user = await prisma.user.findUnique({ where: { id: testOwner.id } })
      const transaction = await prisma.billingTransaction.findFirst({
        where: { userId: testOwner.id }
      })

      // User balance must match last transaction balanceAfter
      expect(Number(user!.creditBalance)).toBe(Number(transaction!.balanceAfter))
    })
  })

  describe('📊 Transaction History Tests', () => {
    it('should record all transaction fields correctly', async () => {
      const description = 'WhatsApp message test'
      
      await billingService.trackMessage(testWorkspace.id, testCustomer.id, description)

      const transaction = await prisma.billingTransaction.findFirst({
        where: { userId: testOwner.id }
      })

      expect(transaction).toBeDefined()
      expect(transaction!.userId).toBe(testOwner.id)
      expect(transaction!.workspaceId).toBe(testWorkspace.id)
      expect(transaction!.type).toBe('MESSAGE')
      expect(transaction!.description).toContain('WhatsApp message')
      expect(transaction!.description).toContain('Test Workspace')
      expect(Number(transaction!.amount)).toBe(-0.10)
      expect(transaction!.createdAt).toBeDefined()
    })

    it('should create legacy billing record for analytics', async () => {
      await billingService.trackMessage(testWorkspace.id, testCustomer.id, 'Test')

      const billingRecord = await prisma.billing.findFirst({
        where: { workspaceId: testWorkspace.id }
      })

      expect(billingRecord).toBeDefined()
      expect(billingRecord!.type).toBe('MESSAGE')
      expect(Number(billingRecord!.amount)).toBe(0.10) // Legacy uses positive
    })
  })

  describe('❌ Edge Cases & Error Handling', () => {
    it('should handle workspace without owner gracefully', async () => {
      // Create workspace without owner
      const orphanWorkspace = await prisma.workspace.create({
        data: {
          id: 'test-billing-orphan',
          name: 'Orphan Workspace',
          ownerId: null,
        }
      })

      await expect(
        billingService.trackMessage(orphanWorkspace.id, testCustomer.id, 'Test')
      ).resolves.not.toThrow()

      // Should NOT create billingTransaction (only legacy billing)
      const transactions = await prisma.billingTransaction.findMany({
        where: { workspaceId: orphanWorkspace.id }
      })
      expect(transactions).toHaveLength(0)

      await prisma.workspace.delete({ where: { id: orphanWorkspace.id } })
    })

    it('should handle near-zero balance correctly', async () => {
      // Set balance to exactly messageCost
      await prisma.user.update({
        where: { id: testOwner.id },
        data: { creditBalance: 0.10 }
      })

      await billingService.trackMessage(testWorkspace.id, testCustomer.id, 'Final message')

      const user = await prisma.user.findUnique({ where: { id: testOwner.id } })
      expect(Number(user!.creditBalance)).toBeCloseTo(0.0, 2)
    })

    it('should allow negative balance (debt)', async () => {
      // Set balance to low value
      await prisma.user.update({
        where: { id: testOwner.id },
        data: { creditBalance: 0.05 }
      })

      await billingService.trackMessage(testWorkspace.id, testCustomer.id, 'Debt message')

      const user = await prisma.user.findUnique({ where: { id: testOwner.id } })
      expect(Number(user!.creditBalance)).toBeCloseTo(-0.05, 2) // ✅ Can go negative
    })
  })
})
