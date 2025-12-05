/**
 * Unit tests for CallingFunctionsService
 *
 * Tests cover:
 * 1. Token generation for orders, cart, and profile links
 * 2. Error handling and response formatting
 * 3. Agent delegation functions
 * 4. Response structure validation
 *
 * @see apps/backend/src/services/calling-functions.service.ts
 */

// Mock everything FIRST before any imports
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}

jest.mock("../../../src/utils/logger", () => ({
  default: mockLogger,
  __esModule: true,
}))

const mockCreateToken = jest.fn().mockResolvedValue("mock-token-123")

jest.mock("../../../src/application/services/secure-token.service", () => ({
  SecureTokenService: jest.fn().mockImplementation(() => ({
    createToken: mockCreateToken,
  })),
}))

const mockGenerateOrdersLink = jest.fn().mockResolvedValue("https://example.com/orders?token=mock-token-123")
const mockGenerateCheckoutLink = jest.fn().mockResolvedValue("https://example.com/checkout?token=mock-token-123")
const mockGenerateProfileLink = jest.fn().mockResolvedValue("https://example.com/profile?token=mock-token-123")

jest.mock("../../../src/application/services/link-generator.service", () => ({
  LinkGeneratorService: jest.fn().mockImplementation(() => ({
    generateOrdersLink: mockGenerateOrdersLink,
    generateCheckoutLink: mockGenerateCheckoutLink,
    generateProfileLink: mockGenerateProfileLink,
  })),
  linkGeneratorService: {
    generateProfileLink: mockGenerateProfileLink,
    generateCheckoutLink: mockGenerateCheckoutLink,
  },
}))

// Mock domain calling functions
jest.mock("../../../src/domain/calling-functions/ContactOperator", () => ({
  ContactOperator: jest.fn().mockResolvedValue({
    success: true,
    message: "Ticket created successfully",
    ticketId: "ticket-123",
    summaryAgentExecuted: true,
    summaryEmailSent: true,
  }),
}))

jest.mock("../../../src/domain/calling-functions/ManageNotifications", () => ({
  ManageNotifications: jest.fn().mockResolvedValue({
    success: true,
    message: "Notifications updated",
    action: "SUBSCRIBE",
    currentStatus: true,
  }),
}))

jest.mock("../../../src/application/services/link-replacement.service", () => ({
  ReplaceLinkWithToken: jest.fn().mockResolvedValue({
    success: true,
    response: "Link replaced successfully",
  }),
}))

// Mock Prisma - need to match what jest.setup.js expects
const mockPrismaInstance = {
  services: {
    findMany: jest.fn(),
  },
  orders: {
    findFirst: jest.fn(),
  },
  customers: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  products: {
    findFirst: jest.fn(),
  },
  carts: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  cartItems: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $disconnect: jest.fn(),
}

jest.mock("@echatbot/database", () => ({

  prisma: mockPrismaInstance,
}))

// NOW import the service
import { CallingFunctionsService } from "../../../src/services/calling-functions.service"

describe("CallingFunctionsService", () => {
  let service: CallingFunctionsService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new CallingFunctionsService()
  })

  describe("getOrdersListLink", () => {
    const mockRequest = {
      customerId: "customer-123",
      workspaceId: "workspace-456",
    }

    it("should generate orders link successfully", async () => {
      const result = await service.getOrdersListLink(mockRequest)

      expect(result.success).toBe(true)
      expect(result.token).toBe("mock-token-123")
      expect(result.linkUrl).toContain("orders")
      expect(result.action).toBe("orders")
      expect(result.timestamp).toBeDefined()
    })

    it("should generate orders link with specific order code", async () => {
      mockPrismaInstance.orders.findFirst.mockResolvedValue({
        id: "order-1",
        orderCode: "ORD-001",
        workspaceId: "workspace-456",
      })

      const requestWithOrderCode = {
        ...mockRequest,
        orderCode: "ORD-001",
      }

      const result = await service.getOrdersListLink(requestWithOrderCode)

      expect(result.success).toBe(true)
      expect(result.token).toBe("mock-token-123")
    })

    it("should return error when order code does not exist", async () => {
      mockPrismaInstance.orders.findFirst.mockResolvedValue(null)

      const requestWithInvalidOrderCode = {
        ...mockRequest,
        orderCode: "INVALID-ORDER",
      }

      const result = await service.getOrdersListLink(requestWithInvalidOrderCode)

      expect(result.success).toBe(false)
      expect(result.error).toContain("non trovato")
    })
  })

  describe("getCartLink", () => {
    const mockRequest = {
      customerId: "customer-123",
      workspaceId: "workspace-456",
    }

    it("should generate cart link successfully", async () => {
      const result = await service.getCartLink(mockRequest)

      expect(result.success).toBe(true)
      expect(result.token).toBe("mock-token-123")
      expect(result.linkUrl).toContain("checkout")
      expect(result.action).toBe("cart")
      expect(result.timestamp).toBeDefined()
    })

    it("should include step parameter when provided", async () => {
      const requestWithStep = {
        ...mockRequest,
        step: 2,
      }

      const result = await service.getCartLink(requestWithStep)

      expect(result.success).toBe(true)
      expect(result.action).toBe("cart")
    })
  })

  describe("getServices", () => {
    const mockRequest = {
      workspaceId: "workspace-456",
      customerId: "customer-123",
    }

    it("should return services list successfully", async () => {
      const mockServices = [
        {
          code: "SRV001",
          name: "Gift Wrapping",
          description: "Premium gift wrapping",
          price: 5.0,
          unit: "per item",
        },
        {
          code: "SRV002",
          name: "Express Delivery",
          description: "Next day delivery",
          price: 15.0,
          unit: "per order",
        },
      ]

      mockPrismaInstance.services.findMany.mockResolvedValue(mockServices)

      const result = await service.getServices(mockRequest)

      expect(result.success).toBe(true)
      expect(result.data?.services).toHaveLength(2)
      expect(result.data?.totalServices).toBe(2)
    })

    it("should return error when no services available", async () => {
      mockPrismaInstance.services.findMany.mockResolvedValue([])

      const result = await service.getServices(mockRequest)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Nessun servizio")
    })
  })

  describe("Agent Delegation Functions", () => {
    const mockRequest = {
      query: "search for mozzarella",
      customerId: "customer-123",
      workspaceId: "workspace-456",
    }

    it("productSearchAgent should return delegation message", async () => {
      const result = await service.productSearchAgent(mockRequest)

      expect(result.success).toBe(true)
      expect(result.message).toContain("DELEGATE_TO_AGENT:PRODUCT_SEARCH")
      expect(result.data?.agentType).toBe("PRODUCT_SEARCH")
      expect(result.data?.query).toBe(mockRequest.query)
    })

    it("cartManagementAgent should return delegation message", async () => {
      const result = await service.cartManagementAgent(mockRequest)

      expect(result.success).toBe(true)
      expect(result.message).toContain("DELEGATE_TO_AGENT:CART_MANAGEMENT")
      expect(result.data?.agentType).toBe("CART_MANAGEMENT")
    })

    it("orderTrackingAgent should return delegation message", async () => {
      const result = await service.orderTrackingAgent(mockRequest)

      expect(result.success).toBe(true)
      expect(result.message).toContain("DELEGATE_TO_AGENT:ORDER_TRACKING")
      expect(result.data?.agentType).toBe("ORDER_TRACKING")
    })

    it("customerSupportAgent should return delegation message", async () => {
      const result = await service.customerSupportAgent(mockRequest)

      expect(result.success).toBe(true)
      expect(result.message).toContain("DELEGATE_TO_AGENT:CUSTOMER_SUPPORT")
      expect(result.data?.agentType).toBe("CUSTOMER_SUPPORT")
    })
  })

  describe("Response Formatting", () => {
    it("should include timestamp in all responses", async () => {
      const result = await service.getCartLink({
        customerId: "customer-123",
        workspaceId: "workspace-456",
      })

      expect(result.timestamp).toBeDefined()
      expect(new Date(result.timestamp!).getTime()).toBeGreaterThan(0)
    })

    it("should include expiration time for token responses", async () => {
      const result = await service.getCartLink({
        customerId: "customer-123",
        workspaceId: "workspace-456",
      })

      expect(result.expiresAt).toBeDefined()
      // Check expiration is in the future (within 1 hour)
      const expirationTime = new Date(result.expiresAt!).getTime()
      const now = Date.now()
      expect(expirationTime).toBeGreaterThan(now)
      expect(expirationTime).toBeLessThanOrEqual(now + 60 * 60 * 1000 + 1000)
    })
  })

  describe("Contact Operator", () => {
    it("should return success response when ticket created", async () => {
      const result = await service.contactOperator({
        customerId: "customer-123",
        workspaceId: "workspace-456",
        phoneNumber: "+39123456789",
      })

      expect(result.success).toBe(true)
      expect(result.timestamp).toBeDefined()
    })
  })

  describe("Manage Notifications", () => {
    it("should handle SUBSCRIBE action", async () => {
      const result = await service.manageNotifications({
        action: "SUBSCRIBE",
        customerId: "customer-123",
        workspaceId: "workspace-456",
      })

      expect(result.success).toBe(true)
      expect(result.timestamp).toBeDefined()
    })

    it("should handle UNSUBSCRIBE action", async () => {
      const result = await service.manageNotifications({
        action: "UNSUBSCRIBE",
        customerId: "customer-123",
        workspaceId: "workspace-456",
      })

      expect(result.success).toBe(true)
      expect(result.timestamp).toBeDefined()
    })
  })
})

describe("CallingFunctionsService - Cart Operations", () => {
  let service: CallingFunctionsService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new CallingFunctionsService()
  })

  describe("addProductToCart", () => {
    const mockRequest = {
      customerId: "customer-123",
      workspaceId: "workspace-456",
      productCode: "MOZZ001",
      quantity: 2,
    }

    it("should return error when customer not found", async () => {
      mockPrismaInstance.customers.findFirst.mockResolvedValue(null)

      const result = await service.addProductToCart(mockRequest)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Cliente non trovato")
    })

    it("should return error when product not found", async () => {
      mockPrismaInstance.customers.findFirst.mockResolvedValue({
        id: "customer-123",
        name: "Mario Rossi",
      })
      mockPrismaInstance.products.findFirst.mockResolvedValue(null)

      const result = await service.addProductToCart(mockRequest)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Prodotto non trovato")
    })

    it("should return error when insufficient stock", async () => {
      mockPrismaInstance.customers.findFirst.mockResolvedValue({
        id: "customer-123",
        name: "Mario Rossi",
      })
      mockPrismaInstance.products.findFirst.mockResolvedValue({
        id: "product-1",
        name: "Mozzarella",
        productCode: "MOZZ001",
        stock: 1, // Only 1 available
      })

      const result = await service.addProductToCart({
        ...mockRequest,
        quantity: 5, // Request 5
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain("Stock insufficiente")
    })

    it("should add product to existing cart", async () => {
      mockPrismaInstance.customers.findFirst.mockResolvedValue({
        id: "customer-123",
        name: "Mario Rossi",
      })
      mockPrismaInstance.products.findFirst.mockResolvedValue({
        id: "product-1",
        name: "Mozzarella",
        productCode: "MOZZ001",
        stock: 100,
      })
      mockPrismaInstance.carts.findFirst.mockResolvedValue({
        id: "cart-1",
        customerId: "customer-123",
      })
      mockPrismaInstance.cartItems.findFirst.mockResolvedValue(null)
      mockPrismaInstance.cartItems.create.mockResolvedValue({
        id: "cart-item-1",
        quantity: 2,
      })

      const result = await service.addProductToCart(mockRequest)

      expect(result.success).toBe(true)
      expect(result.productName).toBe("Mozzarella")
      expect(result.quantity).toBe(2)
      expect(result.cartUrl).toBeDefined()
    })

    it("should create new cart if not exists", async () => {
      mockPrismaInstance.customers.findFirst.mockResolvedValue({
        id: "customer-123",
        name: "Mario Rossi",
      })
      mockPrismaInstance.products.findFirst.mockResolvedValue({
        id: "product-1",
        name: "Mozzarella",
        productCode: "MOZZ001",
        stock: 100,
      })
      mockPrismaInstance.carts.findFirst.mockResolvedValue(null)
      mockPrismaInstance.carts.create.mockResolvedValue({
        id: "cart-new",
        customerId: "customer-123",
      })
      mockPrismaInstance.cartItems.findFirst.mockResolvedValue(null)
      mockPrismaInstance.cartItems.create.mockResolvedValue({
        id: "cart-item-1",
        quantity: 2,
      })

      const result = await service.addProductToCart(mockRequest)

      expect(result.success).toBe(true)
      expect(mockPrismaInstance.carts.create).toHaveBeenCalled()
    })

    it("should update quantity if product already in cart", async () => {
      mockPrismaInstance.customers.findFirst.mockResolvedValue({
        id: "customer-123",
        name: "Mario Rossi",
      })
      mockPrismaInstance.products.findFirst.mockResolvedValue({
        id: "product-1",
        name: "Mozzarella",
        productCode: "MOZZ001",
        stock: 100,
      })
      mockPrismaInstance.carts.findFirst.mockResolvedValue({
        id: "cart-1",
        customerId: "customer-123",
      })
      mockPrismaInstance.cartItems.findFirst.mockResolvedValue({
        id: "cart-item-1",
        quantity: 3,
      })
      mockPrismaInstance.cartItems.update.mockResolvedValue({
        id: "cart-item-1",
        quantity: 5,
      })

      const result = await service.addProductToCart(mockRequest)

      expect(result.success).toBe(true)
      expect(mockPrismaInstance.cartItems.update).toHaveBeenCalled()
    })
  })

  describe("addServiceToCart", () => {
    const mockRequest = {
      customerId: "customer-123",
      workspaceId: "workspace-456",
      serviceCode: "GIFT001",
      quantity: 1,
    }

    it("should return error when customer not found", async () => {
      mockPrismaInstance.customers.findFirst.mockResolvedValue(null)

      const result = await service.addServiceToCart(mockRequest)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Cliente non trovato")
    })
  })
})
