/**
 * Unit Tests for Invoice Service
 * Feature 197: Monthly Invoice Management
 *
 * Tests for:
 * - Create/retrieve draft invoices for current month
 * - Calculate consumption breakdown from transactions
 * - Finalize invoices at month end
 * - Mark invoices as paid/failed
 * - Security: owner can only access own invoices
 */

// Mock logger BEFORE the service import
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

// Mock Prisma
const mockPrisma = {
  monthlyInvoice: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  billingTransaction: {
    findMany: jest.fn(),
  },
  planConfiguration: {
    findUnique: jest.fn(),
  },
  invoiceCreditNote: {
    aggregate: jest.fn(),
    findMany: jest.fn(),
  },
}

// Mock modules BEFORE imports
jest.mock('@echatbot/database', () => ({
  prisma: mockPrisma,
  InvoiceStatus: {
    DRAFT: 'DRAFT',
    PENDING: 'PENDING',
    PAID: 'PAID',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
  },
  PlanType: {
    FREE_TRIAL: 'FREE_TRIAL',
    BASIC: 'BASIC',
    PREMIUM: 'PREMIUM',
    ENTERPRISE: 'ENTERPRISE',
  },
  TransactionType: {
    MESSAGE: 'MESSAGE',
    NEW_ORDER: 'NEW_ORDER',
    PUSH_NOTIFICATION: 'PUSH_NOTIFICATION',
    ADJUSTMENT: 'ADJUSTMENT',
    RECHARGE: 'RECHARGE',
    MONTHLY_FEE: 'MONTHLY_FEE',
  },
}))

import { InvoiceService } from '../../src/application/services/invoice.service'

describe('InvoiceService - Feature 197 Monthly Invoice Management', () => {
  let service: InvoiceService

  const mockUserId = 'test-user-id'
  const now = new Date()
  const periodMonth = now.getMonth() + 1
  const periodYear = now.getFullYear()

  const mockUser = {
    id: mockUserId,
    planType: 'BASIC',
    creditBalance: 50.0,
    subscriptionStatus: 'ACTIVE',
    pausedAt: null,
  }

  const mockInvoice = {
    id: 'invoice-123',
    userId: mockUserId,
    periodStart: new Date(periodYear, periodMonth - 1, 1),
    periodEnd: new Date(periodYear, periodMonth, 0, 23, 59, 59),
    periodMonth,
    periodYear,
    subscriptionAmount: 29,
    creditUsage: 0,
    creditDebt: 0,
    totalAmount: 29,
    status: 'DRAFT',
    paidAt: null,
    planType: 'BASIC',
    itemsBreakdown: {
      messages: { count: 0, amount: 0 },
      orders: { count: 0, amount: 0 },
      pushNotifications: { count: 0, amount: 0 },
      adjustments: { count: 0, amount: 0 },
      totalConsumption: 0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    service = new InvoiceService()
    // Default mock for planConfiguration
    mockPrisma.planConfiguration.findUnique.mockResolvedValue({ monthlyFee: 19.0 })
    mockPrisma.user.findUnique.mockResolvedValue(mockUser)
    mockPrisma.invoiceCreditNote.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
    mockPrisma.invoiceCreditNote.findMany.mockResolvedValue([])
  })

  describe('getOrCreateCurrentInvoice', () => {
    it('should return existing invoice for current month', async () => {
      mockPrisma.monthlyInvoice.findUnique.mockResolvedValue(mockInvoice)
      mockPrisma.billingTransaction.findMany.mockResolvedValue([])
      mockPrisma.monthlyInvoice.update.mockResolvedValue(mockInvoice)

      const result = await service.getOrCreateCurrentInvoice(mockUserId)

      expect(result.id).toBe('invoice-123')
      expect(result.userId).toBe(mockUserId)
      expect(result.status).toBe('DRAFT')
      expect(mockPrisma.monthlyInvoice.findUnique).toHaveBeenCalledWith({
        where: {
          userId_periodYear_periodMonth: {
            userId: mockUserId,
            periodYear,
            periodMonth,
          },
        },
      })
    })

    it('should create new draft invoice if none exists', async () => {
      mockPrisma.monthlyInvoice.findUnique.mockResolvedValueOnce(null)
      mockPrisma.monthlyInvoice.create.mockResolvedValue(mockInvoice)
      mockPrisma.billingTransaction.findMany.mockResolvedValue([])
      mockPrisma.monthlyInvoice.findUnique.mockResolvedValueOnce(mockInvoice)
      mockPrisma.monthlyInvoice.update.mockResolvedValue(mockInvoice)

      const result = await service.getOrCreateCurrentInvoice(mockUserId)

      expect(mockPrisma.monthlyInvoice.create).toHaveBeenCalled()
      expect(result.status).toBe('DRAFT')
      expect(result.planType).toBe('BASIC')
    })

    it('should throw error if user not found', async () => {
      mockPrisma.monthlyInvoice.findUnique.mockResolvedValue(null)
      mockPrisma.user.findUnique.mockResolvedValue(null)

      await expect(service.getOrCreateCurrentInvoice(mockUserId)).rejects.toThrow(
        'User not found'
      )
    })

    it('should calculate and update consumption', async () => {
      const invoiceWithConsumption = {
        ...mockInvoice,
        creditUsage: 5.5,
        totalAmount: 34.5,
        itemsBreakdown: {
          messages: { count: 50, amount: 5 },
          orders: { count: 1, amount: 0.5 },
          pushNotifications: { count: 0, amount: 0 },
          adjustments: { count: 0, amount: 0 },
          totalConsumption: 5.5,
        },
      }

      mockPrisma.monthlyInvoice.findUnique.mockResolvedValue(mockInvoice)
      mockPrisma.billingTransaction.findMany.mockResolvedValue([
        { type: 'MESSAGE', amount: -0.1 },
        { type: 'MESSAGE', amount: -0.1 },
        { type: 'NEW_ORDER', amount: -0.5 },
      ])
      mockPrisma.monthlyInvoice.update.mockResolvedValue(invoiceWithConsumption)

      const result = await service.getOrCreateCurrentInvoice(mockUserId)

      expect(mockPrisma.monthlyInvoice.update).toHaveBeenCalled()
      expect(result.creditUsage).toBe(5.5)
    })

    it('should set subscriptionAmount to 0 when paused before period starts', async () => {
      const pausedUser = {
        ...mockUser,
        subscriptionStatus: 'PAUSED',
        pausedAt: new Date(periodYear, periodMonth - 2, 15),
      }
      mockPrisma.monthlyInvoice.findUnique.mockResolvedValue(mockInvoice)
      mockPrisma.user.findUnique.mockResolvedValue(pausedUser)
      mockPrisma.billingTransaction.findMany.mockResolvedValue([])
      mockPrisma.monthlyInvoice.update.mockResolvedValue({
        ...mockInvoice,
        subscriptionAmount: 0,
        totalAmount: 0,
      })

      await service.getOrCreateCurrentInvoice(mockUserId)

      expect(mockPrisma.monthlyInvoice.update).toHaveBeenCalledWith({
        where: { id: mockInvoice.id },
        data: expect.objectContaining({
          subscriptionAmount: 0,
          totalAmount: 0,
        }),
      })
    })

    it('should cap consumption at pausedAt when paused within period', async () => {
      const pausedAt = new Date(periodYear, periodMonth - 1, 10, 12, 0, 0)
      const pausedUser = {
        ...mockUser,
        subscriptionStatus: 'PAUSED',
        pausedAt,
      }
      mockPrisma.monthlyInvoice.findUnique.mockResolvedValue(mockInvoice)
      mockPrisma.user.findUnique.mockResolvedValue(pausedUser)
      mockPrisma.billingTransaction.findMany.mockResolvedValue([])
      mockPrisma.monthlyInvoice.update.mockResolvedValue(mockInvoice)

      await service.getOrCreateCurrentInvoice(mockUserId)

      expect(mockPrisma.billingTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              lte: pausedAt,
            }),
          }),
        })
      )
    })
  })

  describe('calculateConsumption', () => {
    it('should correctly categorize transaction types', async () => {
      mockPrisma.billingTransaction.findMany.mockResolvedValue([
        { type: 'MESSAGE', amount: -0.1 },
        { type: 'MESSAGE', amount: -0.1 },
        { type: 'MESSAGE', amount: -0.1 },
        { type: 'NEW_ORDER', amount: -1.0 },
        { type: 'PUSH_NOTIFICATION', amount: -0.5 },
        { type: 'ADJUSTMENT', amount: -2.0 },
      ])

      const periodStart = new Date(periodYear, periodMonth - 1, 1)
      const periodEnd = new Date(periodYear, periodMonth, 0, 23, 59, 59)

      const result = await service.calculateConsumption(mockUserId, periodStart, periodEnd)

      expect(result.messages.count).toBe(3)
      expect(result.messages.amount).toBeCloseTo(0.3)
      expect(result.orders.count).toBe(1)
      expect(result.orders.amount).toBe(1.0)
      expect(result.pushNotifications.count).toBe(1)
      expect(result.pushNotifications.amount).toBe(0.5)
      expect(result.adjustments.count).toBe(1)
      expect(result.adjustments.amount).toBe(2.0)
      expect(result.totalConsumption).toBeCloseTo(3.8)
    })

    it('should ignore non-debit transactions', async () => {
      mockPrisma.billingTransaction.findMany.mockResolvedValue([])

      const periodStart = new Date()
      const periodEnd = new Date()

      const result = await service.calculateConsumption(mockUserId, periodStart, periodEnd)

      expect(result.totalConsumption).toBe(0)
      // Verify query filtered by amount < 0
      expect(mockPrisma.billingTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            amount: { lt: 0 },
          }),
        })
      )
    })

    it('should return zero breakdown for no transactions', async () => {
      mockPrisma.billingTransaction.findMany.mockResolvedValue([])

      const periodStart = new Date()
      const periodEnd = new Date()

      const result = await service.calculateConsumption(mockUserId, periodStart, periodEnd)

      expect(result.messages).toEqual({ count: 0, amount: 0 })
      expect(result.orders).toEqual({ count: 0, amount: 0 })
      expect(result.pushNotifications).toEqual({ count: 0, amount: 0 })
      expect(result.adjustments).toEqual({ count: 0, amount: 0 })
      expect(result.totalConsumption).toBe(0)
    })

    it('should not count bonus or recharge credits as consumption', async () => {
      mockPrisma.billingTransaction.findMany.mockResolvedValue([
        { type: 'MESSAGE', amount: -0.1 },
        { type: 'BONUS', amount: 10.0 },
        { type: 'RECHARGE', amount: 5.0 },
      ])

      const periodStart = new Date(periodYear, periodMonth - 1, 1)
      const periodEnd = new Date(periodYear, periodMonth, 0, 23, 59, 59)

      const result = await service.calculateConsumption(mockUserId, periodStart, periodEnd)

      expect(result.messages.count).toBe(1)
      expect(result.messages.amount).toBeCloseTo(0.1)
      expect(result.totalConsumption).toBeCloseTo(0.1)
    })
  })

  describe('getInvoicesForOwner', () => {
    it('should return paginated invoices ordered by date desc', async () => {
      const invoices = [
        { ...mockInvoice, periodMonth: 12, periodYear: 2025 },
        { ...mockInvoice, periodMonth: 11, periodYear: 2025, id: 'invoice-456' },
      ]

      mockPrisma.monthlyInvoice.findMany.mockResolvedValue(invoices)
      mockPrisma.monthlyInvoice.count.mockResolvedValue(5)

      const result = await service.getInvoicesForOwner(mockUserId, 1, 10)

      expect(result.invoices).toHaveLength(2)
      expect(result.total).toBe(5)
      expect(mockPrisma.monthlyInvoice.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        skip: 0,
        take: 10,
      })
    })

    it('should apply correct pagination skip', async () => {
      mockPrisma.monthlyInvoice.findMany.mockResolvedValue([])
      mockPrisma.monthlyInvoice.count.mockResolvedValue(0)

      await service.getInvoicesForOwner(mockUserId, 3, 10)

      expect(mockPrisma.monthlyInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3-1) * 10
          take: 10,
        })
      )
    })
  })

  describe('getInvoiceById', () => {
    it('should return invoice if owned by user', async () => {
      mockPrisma.monthlyInvoice.findFirst.mockResolvedValue(mockInvoice)

      const result = await service.getInvoiceById('invoice-123', mockUserId)

      expect(result).not.toBeNull()
      expect(result?.id).toBe('invoice-123')
      expect(mockPrisma.monthlyInvoice.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'invoice-123',
          userId: mockUserId,
        },
      })
    })

    it('should return null if invoice not found', async () => {
      mockPrisma.monthlyInvoice.findFirst.mockResolvedValue(null)

      const result = await service.getInvoiceById('non-existent', mockUserId)

      expect(result).toBeNull()
    })

    it('should NOT return invoice owned by different user (security)', async () => {
      mockPrisma.monthlyInvoice.findFirst.mockResolvedValue(null)

      const result = await service.getInvoiceById('invoice-123', 'different-user')

      expect(result).toBeNull()
      // Verify the query includes userId filter for security
      expect(mockPrisma.monthlyInvoice.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'invoice-123',
          userId: 'different-user',
        },
      })
    })
  })

  describe('finalizeInvoice', () => {
    it('should change status from DRAFT to PENDING', async () => {
      mockPrisma.monthlyInvoice.findUnique.mockResolvedValue(mockInvoice)
      mockPrisma.billingTransaction.findMany.mockResolvedValue([])
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      mockPrisma.monthlyInvoice.update.mockResolvedValue({ ...mockInvoice, status: 'PENDING' })

      await service.finalizeInvoice('invoice-123')

      expect(mockPrisma.monthlyInvoice.update).toHaveBeenCalledWith({
        where: { id: 'invoice-123' },
        data: expect.objectContaining({
          status: 'PENDING',
        }),
      })
    })

    it('should throw error if invoice not found', async () => {
      mockPrisma.monthlyInvoice.findUnique.mockResolvedValue(null)

      await expect(service.finalizeInvoice('non-existent')).rejects.toThrow(
        'Invoice not found'
      )
    })

    it('should skip if invoice is not in DRAFT status', async () => {
      mockPrisma.monthlyInvoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        status: 'PAID',
      })

      await service.finalizeInvoice('invoice-123')

      expect(mockPrisma.monthlyInvoice.update).not.toHaveBeenCalled()
    })

    it('should include credit debt if user has negative balance', async () => {
      mockPrisma.monthlyInvoice.findUnique.mockResolvedValue(mockInvoice)
      mockPrisma.billingTransaction.findMany.mockResolvedValue([])
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        creditBalance: -15,
      })
      mockPrisma.monthlyInvoice.update.mockResolvedValue(mockInvoice)

      await service.finalizeInvoice('invoice-123')

      expect(mockPrisma.monthlyInvoice.update).toHaveBeenCalledWith({
        where: { id: 'invoice-123' },
        data: expect.objectContaining({
          creditDebt: 15, // Absolute value of negative balance
        }),
      })
    })
  })

  describe('recalculateInvoiceTotals', () => {
    it('should include credit notes and tax in totals', async () => {
      const invoice = {
        ...mockInvoice,
        subscriptionAmount: 0,
        creditUsage: 0,
        creditDebt: 0,
        totalAmount: 0,
      }

      mockPrisma.monthlyInvoice.findUnique.mockResolvedValue(invoice)
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        creditBalance: -15,
      })
      mockPrisma.planConfiguration.findUnique.mockResolvedValue({ monthlyFee: 20 })
      mockPrisma.invoiceCreditNote.aggregate.mockResolvedValue({ _sum: { amount: 5 } })

      jest.spyOn(service, 'calculateConsumption').mockResolvedValue({
        messages: { count: 10, amount: 4 },
        orders: { count: 2, amount: 6 },
        pushNotifications: { count: 0, amount: 0 },
        adjustments: { count: 0, amount: 0 },
        totalConsumption: 10,
      })

      mockPrisma.monthlyInvoice.update.mockResolvedValue(invoice)

      await service.recalculateInvoiceTotals('invoice-123')

      const updateArgs = mockPrisma.monthlyInvoice.update.mock.calls[0][0]
      expect(updateArgs).toEqual(
        expect.objectContaining({
          where: { id: 'invoice-123' },
          data: expect.objectContaining({
            subscriptionAmount: 20,
            creditUsage: 10,
            creditDebt: 15,
            creditNotesTotal: 5,
            subtotalAmount: 40,
            taxRate: 0.22,
          }),
        })
      )
      expect(updateArgs.data.taxAmount).toBeCloseTo(8.8, 5)
      expect(updateArgs.data.totalAmount).toBeCloseTo(48.8, 5)
    })
  })

  describe('markInvoicePaid', () => {
    it('should update status to PAID with paidAt timestamp', async () => {
      mockPrisma.monthlyInvoice.update.mockResolvedValue({
        ...mockInvoice,
        status: 'PAID',
        paidAt: new Date(),
      })

      await service.markInvoicePaid('invoice-123', 'paypal-tx-123')

      expect(mockPrisma.monthlyInvoice.update).toHaveBeenCalledWith({
        where: { id: 'invoice-123' },
        data: {
          status: 'PAID',
          paidAt: expect.any(Date),
          paypalTransactionId: 'paypal-tx-123',
        },
      })
    })

    it('should work without PayPal transaction ID', async () => {
      mockPrisma.monthlyInvoice.update.mockResolvedValue(mockInvoice)

      await service.markInvoicePaid('invoice-123')

      expect(mockPrisma.monthlyInvoice.update).toHaveBeenCalledWith({
        where: { id: 'invoice-123' },
        data: {
          status: 'PAID',
          paidAt: expect.any(Date),
          paypalTransactionId: undefined,
        },
      })
    })
  })

  describe('markInvoiceFailed', () => {
    it('should update status to FAILED', async () => {
      mockPrisma.monthlyInvoice.update.mockResolvedValue({
        ...mockInvoice,
        status: 'FAILED',
      })

      await service.markInvoiceFailed('invoice-123')

      expect(mockPrisma.monthlyInvoice.update).toHaveBeenCalledWith({
        where: { id: 'invoice-123' },
        data: {
          status: 'FAILED',
        },
      })
    })
  })
})
