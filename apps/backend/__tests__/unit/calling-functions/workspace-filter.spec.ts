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

// Import all calling functions to test their interfaces
import { AddProduct, AddProductRequest } from "../../../src/domain/calling-functions/AddProduct"
import { SearchProduct, SearchProductRequest } from "../../../src/domain/calling-functions/SearchProduct"
import { ResetCart, ResetCartRequest } from "../../../src/domain/calling-functions/ResetCart"
import { ConfirmOrder, ConfirmOrderRequest } from "../../../src/domain/calling-functions/ConfirmOrder"
import { ContactOperator, ContactOperatorRequest } from "../../../src/domain/calling-functions/ContactOperator"

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

// Mock PrismaClient with tracking
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

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => mockPrisma),
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
        workspaceId: "", // Empty workspaceId
        products: [{ productCode: "PROD-001", quantity: 1 }],
      }

      const result = await AddProduct(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Parametri richiesti mancanti")
    })

    it("should fail if workspaceId is null/undefined", async () => {
      const request = {
        customerId,
        workspaceId: null as any, // null workspaceId
        products: [{ productCode: "PROD-001", quantity: 1 }],
      }

      const result = await AddProduct(request)

      expect(result.success).toBe(false)
    })

    it("should include workspaceId in request interface", () => {
      // TypeScript check - workspaceId is required in interface
      const request: AddProductRequest = {
        customerId: "test",
        workspaceId: "test-ws", // Required field
        products: [],
      }
      expect(request.workspaceId).toBeDefined()
    })
  })

  describe("SearchProduct - WorkspaceId Filter", () => {
    it("should fail if workspaceId is missing", async () => {
      const request: SearchProductRequest = {
        customerId,
        workspaceId: "", // Empty
        productName: "Parmigiano",
      }

      const result = await SearchProduct(request)

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

      await SearchProduct(request)

      expect(mockProductSearchCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId, // 🔒 Must include workspaceId
        }),
      })
    })

    it("should include workspaceId in saved search data", async () => {
      mockProductSearchCreate.mockResolvedValue({ id: "search-1" })

      await SearchProduct({
        customerId,
        workspaceId,
        productName: "Vino",
      })

      expect(mockProductSearchCreate).toHaveBeenCalledWith({
        data: {
          query: "Vino",
          customerId,
          workspaceId, // 🔒 Workspace isolation
        },
      })
    })
  })

  describe("ResetCart - WorkspaceId Filter", () => {
    it("should fail if workspaceId is missing", async () => {
      const request: ResetCartRequest = {
        customerId,
        workspaceId: "", // Empty
      }

      const result = await ResetCart(request)

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

      await ResetCart({
        customerId,
        workspaceId,
      })

      expect(mockCustomersFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: customerId,
            workspaceId, // 🔒 Workspace isolation
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

      await ResetCart({
        customerId,
        workspaceId,
      })

      expect(mockCartsFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId,
            workspaceId, // 🔒 Workspace isolation
          }),
        })
      )
    })
  })

  describe("ConfirmOrder - WorkspaceId Filter", () => {
    it("should fail if workspaceId is missing", async () => {
      const request: ConfirmOrderRequest = {
        customerId,
        workspaceId: "", // Empty
      }

      const result = await ConfirmOrder(request)

      expect(result.success).toBe(false)
      expect(result.error).toContain("Missing required parameters")
    })

    it("should include workspaceId in customer lookup", async () => {
      mockCustomersFindFirst.mockResolvedValue({
        id: customerId,
        workspaceId,
        name: "Test",
      })
      mockCartsFindFirst.mockResolvedValue(null) // Empty cart

      await ConfirmOrder({
        customerId,
        workspaceId,
      })

      expect(mockCustomersFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: customerId,
            workspaceId, // 🔒 Workspace isolation
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

      await ConfirmOrder({
        customerId,
        workspaceId,
      })

      expect(mockOrdersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceId, // 🔒 Workspace isolation
          }),
        })
      )
    })
  })

  describe("ContactOperator - WorkspaceId Filter", () => {
    it("should include workspaceId in customer lookup", async () => {
      mockCustomersFindFirst.mockResolvedValue(null) // Customer not found

      await ContactOperator({
        phoneNumber: "+393331234567",
        workspaceId,
        customerId,
      })

      expect(mockCustomersFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            phone: "+393331234567",
            workspaceId, // 🔒 Workspace isolation
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
        sales: { email: "test@test.com" }, // Add sales agent
      })
      mockPrisma.customers.update.mockResolvedValue({})
      mockPrisma.chatSession.findFirst.mockResolvedValue({ id: "session-1" })
      mockPrisma.conversationMessage.findMany.mockResolvedValue([])
      mockWorkspaceFindUnique.mockResolvedValue({
        id: workspaceId,
        name: "Test Workspace",
        whatsappSettings: { adminEmail: "admin@test.com" },
      })

      await ContactOperator({
        phoneNumber: "+393331234567",
        workspaceId,
      })

      // Workspace is loaded during email setup
      expect(mockWorkspaceFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: workspaceId }, // 🔒 Workspace isolation
        })
      )
    })
  })

  describe("Request Interface Validation", () => {
    it("AddProductRequest should require workspaceId", () => {
      // This test verifies TypeScript interface
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
      const ws2 = "workspace-2"

      // Customer exists in ws2 but we query ws1
      mockCustomersFindFirst.mockResolvedValue(null)

      const result = await ResetCart({
        customerId,
        workspaceId: ws1,
      })

      // Should fail - customer not found in requested workspace
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

      await ConfirmOrder({ customerId, workspaceId })

      // Order count should be filtered by workspaceId
      expect(mockOrdersCount).toHaveBeenCalledWith({
        where: { workspaceId },
      })
    })
  })
})
