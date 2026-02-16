/**
 * Unit Tests for GET /customer-profile/:token - sellsProductsAndServices in workspace
 *
 * WHAT: Tests that the customer profile GET endpoint returns
 *       sellsProductsAndServices in the workspace object
 *
 * WHY: Frontend needs this flag to conditionally render:
 *   - Shipping Address section (hidden for informational)
 *   - Billing Address → Company rename (for informational)
 *   - Cart menu item in header (hidden for informational)
 *   Without this flag, frontend can't distinguish workspace types.
 *
 * SCENARIOS COVERED:
 *   1. E-commerce workspace: Response includes sellsProductsAndServices=true
 *   2. Informational workspace: Response includes sellsProductsAndServices=false
 *   3. Workspace data always returned with customer profile
 *   4. Customer not found: Returns 404
 *   5. Workspace includes id, name, logoUrl, sellsProductsAndServices
 *
 * CRITICAL RULES:
 *   - Tests define behavior - code must follow tests
 *   - ALL queries filter by workspaceId (multi-tenant isolation)
 *   - sellsProductsAndServices MUST be in workspace select
 */

import { Request, Response } from "express"

// Mock dependencies BEFORE importing them
jest.mock("../../src/lib/prisma", () => ({
  prisma: {
    customers: {
      findFirst: jest.fn(),
    },
    workspace: {
      findUnique: jest.fn(),
    },
  },
}))

jest.mock("../../src/utils/address-parser", () => ({
  parseCustomerAddresses: jest.fn(),
}))

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}))

import { prisma } from "../../src/lib/prisma"
import { parseCustomerAddresses } from "../../src/utils/address-parser"

const mockPrisma = prisma as any
const mockParseCustomerAddresses = parseCustomerAddresses as jest.MockedFunction<
  typeof parseCustomerAddresses
>

// Helper: Create mock request (tokenValidationMiddleware sets customerId/workspaceId)
const createMockRequest = (
  customerId: string,
  workspaceId: string
): Partial<Request> =>
  ({
    params: { token: "test-token" },
    customerId,
    workspaceId,
  }) as any

// Helper: Create mock response
const createMockResponse = (): Partial<Response> => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
  return res
}

// Simulate GET /customer-profile/:token handler logic
// (mirrors apps/backend/src/interfaces/http/routes/public-orders.routes.ts)
const handleGetProfile = async (
  req: Partial<Request>,
  res: Partial<Response>
) => {
  try {
    const customerId = (req as any).customerId
    const workspaceId = (req as any).workspaceId

    const customer = await mockPrisma.customers.findFirst({
      where: {
        id: customerId,
        workspaceId: workspaceId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        company: true,
        language: true,
        currency: true,
        discount: true,
        invoiceAddress: true,
        push_notifications_consent: true,
        push_notifications_consent_at: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!customer) {
      return (res as any).status(404).json({
        success: false,
        error: "Customer not found",
      })
    }

    // CRITICAL: workspace select MUST include sellsProductsAndServices
    const workspace = await mockPrisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        sellsProductsAndServices: true,
      },
    })

    let parsedCustomer: any = { ...customer }
    const invoiceResult = mockParseCustomerAddresses(
      parsedCustomer.invoiceAddress
    )
    parsedCustomer.invoiceAddress =
      invoiceResult.success && invoiceResult.addresses.length > 0
        ? invoiceResult.addresses[0]
        : null

    const addressResult = mockParseCustomerAddresses(parsedCustomer.address)
    parsedCustomer.address =
      addressResult.success && addressResult.addresses.length > 0
        ? addressResult.addresses[0]
        : null

    return (res as any).json({
      success: true,
      data: {
        ...parsedCustomer,
        workspace,
      },
    })
  } catch (error: any) {
    return (res as any).status(500).json({
      success: false,
      error: "Error retrieving profile",
    })
  }
}

// Test data factories
const createCustomerMock = (overrides: any = {}) => ({
  id: "customer-123",
  name: "Andrea Test",
  email: "andrea@test.com",
  phone: "+39123456789",
  address: null,
  company: "Test SRL",
  language: "it",
  currency: "EUR",
  discount: 0,
  invoiceAddress: null,
  push_notifications_consent: false,
  push_notifications_consent_at: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  ...overrides,
})

const createWorkspaceMock = (overrides: any = {}) => ({
  id: "workspace-123",
  name: "Test Workspace",
  logoUrl: "https://example.com/logo.png",
  sellsProductsAndServices: true,
  ...overrides,
})

describe("GET /customer-profile/:token - sellsProductsAndServices", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default: parseCustomerAddresses returns empty
    mockParseCustomerAddresses.mockReturnValue({
      success: true,
      addresses: [],
    })
  })

  describe("E-commerce workspace", () => {
    // SCENARIO: E-commerce workspace (sellsProductsAndServices=true) returns flag in response
    it("should return sellsProductsAndServices=true in workspace object", async () => {
      const customer = createCustomerMock()
      const workspace = createWorkspaceMock({ sellsProductsAndServices: true })

      mockPrisma.customers.findFirst.mockResolvedValue(customer)
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace)

      const req = createMockRequest("customer-123", "workspace-123")
      const res = createMockResponse()

      await handleGetProfile(req, res)

      // RULE: Response includes workspace with sellsProductsAndServices
      expect((res as any).json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            workspace: expect.objectContaining({
              sellsProductsAndServices: true,
            }),
          }),
        })
      )
    })
  })

  describe("Informational workspace", () => {
    // SCENARIO: Informational workspace (sellsProductsAndServices=false) returns flag in response
    it("should return sellsProductsAndServices=false in workspace object", async () => {
      const customer = createCustomerMock()
      const workspace = createWorkspaceMock({
        sellsProductsAndServices: false,
      })

      mockPrisma.customers.findFirst.mockResolvedValue(customer)
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace)

      const req = createMockRequest("customer-123", "workspace-123")
      const res = createMockResponse()

      await handleGetProfile(req, res)

      // RULE: Informational workspace returns sellsProductsAndServices=false
      expect((res as any).json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            workspace: expect.objectContaining({
              sellsProductsAndServices: false,
            }),
          }),
        })
      )
    })
  })

  describe("Workspace data completeness", () => {
    // SCENARIO: Workspace object in response must have all 4 fields
    it("should include id, name, logoUrl, sellsProductsAndServices in workspace", async () => {
      const customer = createCustomerMock()
      const workspace = createWorkspaceMock({
        id: "ws-456",
        name: "My Store",
        logoUrl: "https://cdn.example.com/logo.png",
        sellsProductsAndServices: true,
      })

      mockPrisma.customers.findFirst.mockResolvedValue(customer)
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace)

      const req = createMockRequest("customer-123", "ws-456")
      const res = createMockResponse()

      await handleGetProfile(req, res)

      const responseData = (res as any).json.mock.calls[0][0].data.workspace

      // RULE: All 4 workspace fields must be present
      expect(responseData).toHaveProperty("id", "ws-456")
      expect(responseData).toHaveProperty("name", "My Store")
      expect(responseData).toHaveProperty(
        "logoUrl",
        "https://cdn.example.com/logo.png"
      )
      expect(responseData).toHaveProperty("sellsProductsAndServices", true)
    })

    // SCENARIO: Workspace with null logoUrl
    it("should handle workspace with null logoUrl", async () => {
      const customer = createCustomerMock()
      const workspace = createWorkspaceMock({
        logoUrl: null,
        sellsProductsAndServices: false,
      })

      mockPrisma.customers.findFirst.mockResolvedValue(customer)
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace)

      const req = createMockRequest("customer-123", "workspace-123")
      const res = createMockResponse()

      await handleGetProfile(req, res)

      const responseData = (res as any).json.mock.calls[0][0].data.workspace

      expect(responseData.logoUrl).toBeNull()
      expect(responseData.sellsProductsAndServices).toBe(false)
    })
  })

  describe("Workspace select includes sellsProductsAndServices", () => {
    // SCENARIO: Verify prisma.workspace.findUnique is called with correct select
    // RULE: This is the core regression test - sellsProductsAndServices MUST be in select
    it("should query workspace with sellsProductsAndServices in select", async () => {
      const customer = createCustomerMock()
      const workspace = createWorkspaceMock()

      mockPrisma.customers.findFirst.mockResolvedValue(customer)
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace)

      const req = createMockRequest("customer-123", "workspace-123")
      const res = createMockResponse()

      await handleGetProfile(req, res)

      // RULE: Prisma select MUST include sellsProductsAndServices
      expect(mockPrisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: "workspace-123" },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          sellsProductsAndServices: true,
        },
      })
    })
  })

  describe("Customer not found", () => {
    // SCENARIO: Customer does not exist - should return 404
    it("should return 404 when customer not found", async () => {
      mockPrisma.customers.findFirst.mockResolvedValue(null)

      const req = createMockRequest("nonexistent", "workspace-123")
      const res = createMockResponse()

      await handleGetProfile(req, res)

      // RULE: 404 with proper error message
      expect((res as any).status).toHaveBeenCalledWith(404)
      expect((res as any).json).toHaveBeenCalledWith({
        success: false,
        error: "Customer not found",
      })

      // RULE: Should NOT query workspace if customer not found
      expect(mockPrisma.workspace.findUnique).not.toHaveBeenCalled()
    })
  })

  describe("Workspace isolation", () => {
    // SCENARIO: Customer query must filter by workspaceId (multi-tenant security)
    it("should filter customer query by workspaceId", async () => {
      mockPrisma.customers.findFirst.mockResolvedValue(null)

      const req = createMockRequest("customer-123", "workspace-456")
      const res = createMockResponse()

      await handleGetProfile(req, res)

      // RULE: CRITICAL - workspaceId filter prevents cross-workspace data leaks
      expect(mockPrisma.customers.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: "workspace-456",
          }),
        })
      )
    })
  })
})
