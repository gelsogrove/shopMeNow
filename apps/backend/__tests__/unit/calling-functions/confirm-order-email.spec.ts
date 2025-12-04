/**
 * Test Suite: Order Email Notifications
 *
 * Verifies that ConfirmOrder function sends email notifications:
 * 1. Email to sales agent when order is created
 * 2. Email includes order details (code, total, items)
 * 3. Handles missing salesAgent gracefully
 *
 * @requirement Feature 176: Email notification system
 */

// Mock dependencies BEFORE imports
const mockEmailService = {
  sendOperatorNotificationEmail: jest.fn().mockResolvedValue(true),
}

jest.mock("../../../src/application/services/email.service", () => ({
  EmailService: jest.fn().mockImplementation(() => mockEmailService),
}))

jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

// Mock PrismaClient
const mockPrisma = {
  customers: {
    findFirst: jest.fn(),
  },
  carts: {
    findFirst: jest.fn(),
  },
  orders: {
    create: jest.fn(),
    count: jest.fn(),
  },
  cartItems: {
    deleteMany: jest.fn(),
  },
  sales: {
    findUnique: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
  },
  products: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  customerSegments: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  offers: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  $disconnect: jest.fn(),
}

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}))

// Import after mocks
import { ConfirmOrder, ConfirmOrderRequest } from "../../../src/domain/calling-functions/ConfirmOrder"
import { EmailService } from "../../../src/application/services/email.service"
import logger from "../../../src/utils/logger"

describe("Order Email Notifications", () => {
  const workspaceId = "ws-test-123"
  const customerId = "cust-test-123"
  const salesId = "sales-test-123"

  const mockCustomer = {
    id: customerId,
    name: "Mario Rossi",
    email: "mario@example.com",
    phone: "+393331234567",
    workspaceId,
    salesId,
    discount: 10,
    address: "Via Roma 1, Milano",
  }

  const mockSalesAgent = {
    id: salesId,
    firstName: "Giovanni",
    lastName: "Bianchi",
    email: "giovanni.bianchi@bellitalia.com",
  }

  const mockCart = {
    id: "cart-123",
    customerId,
    workspaceId,
    items: [
      {
        id: "item-1",
        quantity: 2,
        product: {
          id: "prod-1",
          name: "Parmigiano Reggiano 500g",
          price: 25.00,
        },
        service: null,
        notes: null,
      },
    ],
  }

  const mockOrder = {
    id: "order-123",
    orderCode: "ORD-001-2024-1",
    totalAmount: 45.00,
    items: mockCart.items,
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup default mocks
    mockPrisma.customers.findFirst.mockResolvedValue(mockCustomer)
    mockPrisma.carts.findFirst.mockResolvedValue(mockCart)
    mockPrisma.orders.count.mockResolvedValue(0)
    mockPrisma.orders.create.mockResolvedValue(mockOrder)
    mockPrisma.cartItems.deleteMany.mockResolvedValue({ count: 1 })
    mockPrisma.sales.findUnique.mockResolvedValue(mockSalesAgent)
    mockPrisma.workspace.findUnique.mockResolvedValue({
      id: workspaceId,
      name: "Bell'Italia Foods",
    })
    mockPrisma.products.findMany.mockResolvedValue([
      {
        id: "prod-1",
        name: "Parmigiano Reggiano 500g",
        price: 25.00,
        categoryId: "cat-1",
      },
    ])
    mockPrisma.products.findFirst.mockResolvedValue(null) // No active offers
    mockEmailService.sendOperatorNotificationEmail.mockResolvedValue(true)
  })

  describe("Email sent on order creation", () => {
    it("should send email to sales agent when order is created", async () => {
      const request: ConfirmOrderRequest = {
        customerId,
        workspaceId,
      }

      const result = await ConfirmOrder(request)

      expect(result.success).toBe(true)
      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledTimes(1)
    })

    it("should include correct recipient email (sales agent)", async () => {
      const request: ConfirmOrderRequest = {
        customerId,
        workspaceId,
      }

      await ConfirmOrder(request)

      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockSalesAgent.email,
        })
      )
    })

    it("should include customer name in email", async () => {
      const request: ConfirmOrderRequest = {
        customerId,
        workspaceId,
      }

      await ConfirmOrder(request)

      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          customerName: mockCustomer.name,
        })
      )
    })

    it("should include order code in email subject", async () => {
      const request: ConfirmOrderRequest = {
        customerId,
        workspaceId,
      }

      await ConfirmOrder(request)

      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining(mockOrder.orderCode),
        })
      )
    })

    it("should include workspace name in email", async () => {
      const request: ConfirmOrderRequest = {
        customerId,
        workspaceId,
      }

      await ConfirmOrder(request)

      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceName: "Bell'Italia Foods",
        })
      )
    })

    it("should include order total in email body", async () => {
      const request: ConfirmOrderRequest = {
        customerId,
        workspaceId,
      }

      await ConfirmOrder(request)

      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          chatSummary: expect.stringContaining("€"),
        })
      )
    })

    it("should log success when email is sent", async () => {
      mockEmailService.sendOperatorNotificationEmail.mockResolvedValue(true)

      const request: ConfirmOrderRequest = {
        customerId,
        workspaceId,
      }

      await ConfirmOrder(request)

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("New order notification email sent"),
        // Don't be strict about what exactly is logged
      )
    })
  })

  describe("Email handling when sales agent has no email", () => {
    it("should NOT send email when sales agent has no email", async () => {
      mockPrisma.sales.findUnique.mockResolvedValue({
        id: salesId,
        firstName: "Giovanni",
        lastName: "Bianchi",
        email: null, // No email
      })

      const request: ConfirmOrderRequest = {
        customerId,
        workspaceId,
      }

      const result = await ConfirmOrder(request)

      expect(result.success).toBe(true)
      expect(mockEmailService.sendOperatorNotificationEmail).not.toHaveBeenCalled()
    })

    it("should log info when skipping email due to missing sales email", async () => {
      mockPrisma.sales.findUnique.mockResolvedValue({
        id: salesId,
        firstName: "Giovanni",
        lastName: "Bianchi",
        email: null,
      })

      const request: ConfirmOrderRequest = {
        customerId,
        workspaceId,
      }

      await ConfirmOrder(request)

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Sales agent has no email")
      )
    })
  })

  describe("Email handling when customer has no assigned sales agent", () => {
    it("should NOT send email when customer has no salesId", async () => {
      mockPrisma.customers.findFirst.mockResolvedValue({
        ...mockCustomer,
        salesId: null, // No sales agent assigned
      })

      const request: ConfirmOrderRequest = {
        customerId,
        workspaceId,
      }

      const result = await ConfirmOrder(request)

      expect(result.success).toBe(true)
      expect(mockPrisma.sales.findUnique).not.toHaveBeenCalled()
      expect(mockEmailService.sendOperatorNotificationEmail).not.toHaveBeenCalled()
    })
  })

  describe("Email failure does NOT break order creation", () => {
    it("should still create order even if email fails", async () => {
      mockEmailService.sendOperatorNotificationEmail.mockRejectedValue(
        new Error("SMTP connection failed")
      )

      const request: ConfirmOrderRequest = {
        customerId,
        workspaceId,
      }

      const result = await ConfirmOrder(request)

      // Order should still be successful
      expect(result.success).toBe(true)
      expect(result.orderCode).toBeDefined()
    })

    it("should log warning when email fails", async () => {
      mockEmailService.sendOperatorNotificationEmail.mockResolvedValue(false)

      const request: ConfirmOrderRequest = {
        customerId,
        workspaceId,
      }

      await ConfirmOrder(request)

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send new order notification email")
      )
    })

    it("should log warning when email throws exception", async () => {
      mockEmailService.sendOperatorNotificationEmail.mockRejectedValue(
        new Error("Network error")
      )

      const request: ConfirmOrderRequest = {
        customerId,
        workspaceId,
      }

      await ConfirmOrder(request)

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send new order notification"),
        expect.any(Error)
      )
    })
  })

  describe("WorkspaceId filter in order operations", () => {
    it("should filter customer by workspaceId", async () => {
      const request: ConfirmOrderRequest = {
        customerId,
        workspaceId,
      }

      await ConfirmOrder(request)

      expect(mockPrisma.customers.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: customerId,
            workspaceId, // 🔒 Workspace isolation
          },
        })
      )
    })

    it("should filter cart by workspaceId", async () => {
      const request: ConfirmOrderRequest = {
        customerId,
        workspaceId,
      }

      await ConfirmOrder(request)

      expect(mockPrisma.carts.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId,
            workspaceId, // 🔒 Workspace isolation
          }),
        })
      )
    })

    it("should create order with workspaceId", async () => {
      const request: ConfirmOrderRequest = {
        customerId,
        workspaceId,
      }

      await ConfirmOrder(request)

      expect(mockPrisma.orders.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceId, // 🔒 Workspace isolation
          }),
        })
      )
    })
  })
})
