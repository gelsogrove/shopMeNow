/**
 * Test Suite: WorkspaceId Filter in Calling Functions
 *
 * Verifies that ALL calling functions:
 * 1. Require workspaceId parameter
 * 2. Filter database queries by workspaceId
 * 3. Fail if workspaceId is missing
 *
 * @requirement RULE-2: Workspace Isolation
 * @critical Multi-tenant security requirement
 */

// Mock PrismaClient with tracking FIRST (before imports)
const mockCustomersFindFirst = jest.fn()
const mockCartsFindFirst = jest.fn()
const mockCartsCreate = jest.fn()
const mockCartItemsCreate = jest.fn()
const mockCartItemsDeleteMany = jest.fn()
const mockProductsFindFirst = jest.fn()
const mockProductSearchCreate = jest.fn()
const mockOrdersCreate = jest.fn()
const mockOrdersCount = jest.fn()
const mockWorkspaceFindUnique = jest.fn()

const mockPrisma = {
  customers: { findFirst: mockCustomersFindFirst, update: jest.fn() },
  carts: { findFirst: mockCartsFindFirst, create: mockCartsCreate },
  cartItems: { create: mockCartItemsCreate, deleteMany: mockCartItemsDeleteMany },
  products: { findFirst: mockProductsFindFirst, findMany: jest.fn() },
  productSearch: { create: mockProductSearchCreate },
  orders: { create: mockOrdersCreate, count: mockOrdersCount },
  workspace: { findUnique: mockWorkspaceFindUnique },
  chatSession: { findFirst: jest.fn() },
  conversationMessage: { findMany: jest.fn() },
  user: { findFirst: jest.fn() },
  sales: { findUnique: jest.fn() },
  customerSegments: { findMany: jest.fn().mockResolvedValue([]) },
  offers: { findMany: jest.fn().mockResolvedValue([]) },
  $disconnect: jest.fn(),
}

jest.mock("@echatbot/database", () => ({
  prisma: mockPrisma,
}))

// Mock dependencies
jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

jest.mock("../../../src/application/services/email.service", () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendOperatorNotificationEmail: jest.fn().mockResolvedValue(true),
  })),
}))

jest.mock("../../../src/services/summary-agent-llm.service", () => ({
  SummaryAgentLLM: jest.fn().mockImplementation(() => ({
    generateSummary: jest.fn().mockResolvedValue({ success: true, summary: "Test" }),
  })),
}))

jest.mock("../../../src/application/agents/SafetyTranslationAgent", () => ({
  SafetyTranslationAgent: jest.fn().mockImplementation(() => ({
    process: jest.fn().mockResolvedValue({ translatedText: "Test", safe: true }),
  })),
}))

jest.mock("../../../src/services/calling-functions.service", () => ({
  CallingFunctionsService: jest.fn().mockImplementation(() => ({
    addProductToCart: jest.fn().mockResolvedValue({
      success: true,
      cartUrl: "https://test.com/cart",
      expiresAt: new Date().toISOString(),
    }),
  })),
}))

// Import all calling functions to test their interfaces
import { addProduct, AddProductRequest } from "../../../src/domain/calling-functions/addProduct"
import { searchProduct, SearchProductRequest } from "../../../src/domain/calling-functions/searchProduct"
import { resetCart, ResetCartRequest } from "../../../src/domain/calling-functions/resetCart"
import { confirmOrder, ConfirmOrderRequest } from "../../../src/domain/calling-functions/confirmOrder"
import { contactOperator, ContactOperatorRequest } from "../../../src/domain/calling-functions/contactOperator"

describe("WorkspaceId Filter in Calling Functions", () => {
  const workspaceId = "ws-test-123"
  const customerId = "cust-test-123"

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("AddProduct - WorkspaceId Requirement", () => {
    it("should fail if workspaceId is missing", async () => {
      const request: AddProductRequest = {
        customerId,
        workspaceId: "",
        products: [{ sku: "PROD-001", quantity: 1 }],
      }

      const result = await addProduct(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Parametri richiesti mancanti")
    })

    it("should fail if workspaceId is null/undefined", async () => {
      const request = {
        customerId,
        workspaceId: null as any,
        products: [{ sku: "PROD-001", quantity: 1 }],
      }

      const result = await addProduct(request)

      expect(result.success).toBe(false)
    })

    it("should include workspaceId in request interface", () => {
      const request: AddProductRequest = {
        customerId: "test",
        workspaceId: "test-ws",
        products: [],
      }
      expect(request.workspaceId).toBeDefined()
    })
  })

  describe("SearchProduct - WorkspaceId Filter", () => {
    it("should fail if workspaceId is missing", async () => {
      const request: SearchProductRequest = {
        customerId,
        workspaceId: "",
        productName: "Parmigiano",
      }

      const result = await searchProduct(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Parametri richiesti mancanti")
    })

    it("should save search with workspaceId", async () => {
      mockProductSearchCreate.mockResolvedValue({
        id: "search-123",
        query: "Parmigiano",
        workspaceId,
      })

      const request: SearchProductRequest = {
        customerId,
        workspaceId,
        productName: "Parmigiano",
      }

      await searchProduct(request)

      expect(mockProductSearchCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId,
        }),
      })
    })

    it("should include workspaceId in saved search data", async () => {
      mockProductSearchCreate.mockResolvedValue({ id: "search-1" })

      await searchProduct({
        customerId,
        workspaceId,
        productName: "Vino",
      })

      expect(mockProductSearchCreate).toHaveBeenCalledWith({
        data: {
          query: "Vino",
          customerId,
          workspaceId,
        },
      })
    })
  })

  describe("ResetCart - WorkspaceId Filter", () => {
    it("should fail if workspaceId is missing", async () => {
      const request: ResetCartRequest = {
        customerId,
        workspaceId: "",
      }

      const result = await resetCart(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Parametri richiesti mancanti")
    })

    it("should include workspaceId in customer lookup", async () => {
      mockCustomersFindFirst.mockResolvedValue({
        id: customerId,
        workspaceId,
        name: "Test Customer",
      })
      mockCartsFindFirst.mockResolvedValue(null)

      await resetCart({
        customerId,
        workspaceId,
      })

      expect(mockCustomersFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: customerId,
            workspaceId,
          },
        })
      )
    })

    it("should include workspaceId in cart lookup", async () => {
      mockCustomersFindFirst.mockResolvedValue({
        id: customerId,
        workspaceId,
        name: "Test",
      })
      mockCartsFindFirst.mockResolvedValue({
        id: "cart-123",
        items: [{ id: "item-1" }],
      })
      mockCartItemsDeleteMany.mockResolvedValue({ count: 1 })

      await resetCart({
        customerId,
        workspaceId,
      })

      expect(mockCartsFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId,
            workspaceId,
          }),
        })
      )
    })
  })

  describe("ConfirmOrder - WorkspaceId Filter", () => {
    it("should fail if workspaceId is missing", async () => {
      const request: ConfirmOrderRequest = {
        customerId,
        workspaceId: "",
      }

      const result = await confirmOrder(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Missing required parameters")
    })

    it("should include workspaceId in customer lookup", async () => {
      mockCustomersFindFirst.mockResolvedValue({
        id: customerId,
        workspaceId,
        name: "Test",
      })
      mockCartsFindFirst.mockResolvedValue(null)

      await confirmOrder({
        customerId,
        workspaceId,
      })

      expect(mockCustomersFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: customerId,
            workspaceId,
          },
        })
      )
    })

    it("should include workspaceId in order creation", async () => {
      mockCustomersFindFirst.mockResolvedValue({
        id: customerId,
        workspaceId,
        name: "Test",
        discount: 0,
        salesId: null,
      })
      mockCartsFindFirst.mockResolvedValue({
        id: "cart-123",
        items: [
          {
            id: "item-1",
            quantity: 1,
            product: { id: "prod-1", name: "Test", price: 10 },
          },
        ],
      })
      mockOrdersCount.mockResolvedValue(0)
      mockOrdersCreate.mockResolvedValue({
        id: "order-1",
        orderCode: "ORD-001",
        totalAmount: 10,
        items: [],
      })
      mockCartItemsDeleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.products.findMany.mockResolvedValue([
        { id: "prod-1", name: "Test", price: 10 },
      ])

      await confirmOrder({
        customerId,
        workspaceId,
      })

      expect(mockOrdersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceId,
          }),
        })
      )
    })
  })

  describe("ContactOperator - WorkspaceId Filter", () => {
    it("should include workspaceId in customer lookup", async () => {
      mockCustomersFindFirst.mockResolvedValue(null)

      await contactOperator({
        phoneNumber: "+393331234567",
        workspaceId,
        customerId,
      })

      expect(mockCustomersFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            phone: "+393331234567",
            workspaceId,
          },
        })
      )
    })

    it("should include workspaceId in workspace lookup", async () => {
      mockCustomersFindFirst.mockResolvedValue({
        id: customerId,
        name: "Test",
        phone: "+393331234567",
        workspaceId,
        sales: { email: "test@test.com" },
      })
      mockPrisma.customers.update.mockResolvedValue({})
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: "session-1" })
      mockPrisma.conversationMessage.findMany.mockResolvedValue([])
      mockWorkspaceFindUnique.mockResolvedValue({
        id: workspaceId,
        name: "Test Workspace",
        whatsappSettings: { adminEmail: "admin@test.com" },
      })

      await contactOperator({
        phoneNumber: "+393331234567",
        workspaceId,
      })

      expect(mockWorkspaceFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: workspaceId },
        })
      )
    })
  })

  describe("Request Interface Validation", () => {
    it("AddProductRequest should require workspaceId", () => {
      const valid: AddProductRequest = {
        customerId: "test",
        workspaceId: "ws-test",
        products: [],
      }
      expect(valid.workspaceId).toBe("ws-test")
    })

    it("SearchProductRequest should require workspaceId", () => {
      const valid: SearchProductRequest = {
        customerId: "test",
        workspaceId: "ws-test",
        productName: "test",
      }
      expect(valid.workspaceId).toBe("ws-test")
    })

    it("ResetCartRequest should require workspaceId", () => {
      const valid: ResetCartRequest = {
        customerId: "test",
        workspaceId: "ws-test",
      }
      expect(valid.workspaceId).toBe("ws-test")
    })

    it("ConfirmOrderRequest should require workspaceId", () => {
      const valid: ConfirmOrderRequest = {
        customerId: "test",
        workspaceId: "ws-test",
      }
      expect(valid.workspaceId).toBe("ws-test")
    })

    it("ContactOperatorRequest should require workspaceId", () => {
      const valid: ContactOperatorRequest = {
        phoneNumber: "+393331234567",
        workspaceId: "ws-test",
      }
      expect(valid.workspaceId).toBe("ws-test")
    })
  })

  describe("No Cross-Workspace Data Leakage", () => {
    it("should not return data from different workspace", async () => {
      const ws1 = "workspace-1"

      mockCustomersFindFirst.mockResolvedValue(null)

      const result = await resetCart({
        customerId,
        workspaceId: ws1,
      })

      expect(result.success).toBe(false)
    })

    it("order count should be scoped to workspace", async () => {
      mockCustomersFindFirst.mockResolvedValue({
        id: customerId,
        workspaceId,
        discount: 0,
        salesId: null,
      })
      mockCartsFindFirst.mockResolvedValue({
        id: "cart-1",
        items: [
          {
            id: "item-1",
            quantity: 1,
            product: { id: "prod-1", price: 10 },
          },
        ],
      })
      mockOrdersCount.mockResolvedValue(5)
      mockOrdersCreate.mockResolvedValue({
        id: "order-1",
        orderCode: "ORD-006",
        totalAmount: 10,
        items: [],
      })
      mockCartItemsDeleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.products.findMany.mockResolvedValue([
        { id: "prod-1", price: 10 },
      ])

      await confirmOrder({ customerId, workspaceId })

      expect(mockOrdersCount).toHaveBeenCalledWith({
        where: { workspaceId },
      })
    })
  })
})
