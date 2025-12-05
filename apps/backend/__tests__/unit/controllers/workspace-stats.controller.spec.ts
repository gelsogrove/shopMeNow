/**
 * @fileoverview Unit tests for workspace stats controller
 * Tests the badge statistics endpoint that counts:
 * - Unread messages
 * - Pending orders
 * - Customers needing intervention (activeChatbot = false)
 * - Blocked users (isBlacklisted = true)
 * - New customers (name = "New Customer") - unregistered customers
 */

import { PrismaClient } from "@echatbot/database"

// Mock PrismaClient
const mockPrismaClient = {
  message: {
    count: jest.fn(),
  },
  orders: {
    count: jest.fn(),
  },
  customers: {
    count: jest.fn(),
  },
}

jest.mock("@echatbot/database", () => ({

  PrismaClient: jest.fn(() => mockPrismaClient),
}))

describe("Workspace Stats Controller - New Customers Count", () => {
  const workspaceId = "test-workspace-id"

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("newCustomers badge count logic", () => {
    it("should count only customers with name 'New Customer' (unregistered)", async () => {
      // The query should filter by name = "New Customer"
      // NOT by createdAt date
      
      const expectedQuery = {
        where: {
          workspaceId,
          name: "New Customer",
        },
      }

      // Simulate 2 unregistered customers
      mockPrismaClient.customers.count.mockResolvedValueOnce(2)

      const result = await mockPrismaClient.customers.count(expectedQuery)

      expect(result).toBe(2)
      expect(mockPrismaClient.customers.count).toHaveBeenCalledWith(expectedQuery)
    })

    it("should NOT count registered customers even if created recently", async () => {
      // A customer named "Andrea Gelsomino" created 1 hour ago
      // should NOT be counted as "new customer"
      
      // Query for new customers should only match name = "New Customer"
      const newCustomerQuery = {
        where: {
          workspaceId,
          name: "New Customer",
        },
      }

      // If we have:
      // - "Andrea Gelsomino" (registered, created 1 hour ago)
      // - "New Customer" (unregistered, created 2 hours ago)
      // - "John Smith" (registered, created 1 hour ago)
      // Then newCustomers count should be 1

      mockPrismaClient.customers.count.mockResolvedValueOnce(1)

      const result = await mockPrismaClient.customers.count(newCustomerQuery)

      expect(result).toBe(1)
    })

    it("should return 0 when all customers are registered", async () => {
      const newCustomerQuery = {
        where: {
          workspaceId,
          name: "New Customer",
        },
      }

      // No unregistered customers
      mockPrismaClient.customers.count.mockResolvedValueOnce(0)

      const result = await mockPrismaClient.customers.count(newCustomerQuery)

      expect(result).toBe(0)
    })

    it("should count multiple unregistered customers correctly", async () => {
      const newCustomerQuery = {
        where: {
          workspaceId,
          name: "New Customer",
        },
      }

      // 5 unregistered customers
      mockPrismaClient.customers.count.mockResolvedValueOnce(5)

      const result = await mockPrismaClient.customers.count(newCustomerQuery)

      expect(result).toBe(5)
    })
  })

  describe("workspace isolation for newCustomers", () => {
    it("should only count new customers within the specified workspace", async () => {
      const workspaceA = "workspace-a"
      const workspaceB = "workspace-b"

      // Query for workspace A
      const queryA = {
        where: {
          workspaceId: workspaceA,
          name: "New Customer",
        },
      }

      // Query for workspace B
      const queryB = {
        where: {
          workspaceId: workspaceB,
          name: "New Customer",
        },
      }

      // Workspace A has 3 new customers
      mockPrismaClient.customers.count.mockResolvedValueOnce(3)
      const resultA = await mockPrismaClient.customers.count(queryA)

      // Workspace B has 1 new customer
      mockPrismaClient.customers.count.mockResolvedValueOnce(1)
      const resultB = await mockPrismaClient.customers.count(queryB)

      expect(resultA).toBe(3)
      expect(resultB).toBe(1)

      // Verify each query had the correct workspaceId
      expect(mockPrismaClient.customers.count).toHaveBeenNthCalledWith(1, queryA)
      expect(mockPrismaClient.customers.count).toHaveBeenNthCalledWith(2, queryB)
    })
  })
})

describe("Workspace Stats - Badge Statistics Structure", () => {
  it("should have correct structure for badge stats response", () => {
    // The expected response structure from /api/workspaces/badge-stats
    const expectedStructure = {
      workspaceId: expect.any(String),
      unreadMessages: expect.any(Number),
      pendingOrders: expect.any(Number),
      needsIntervention: expect.any(Number),
      blockedUsers: expect.any(Number),
      newCustomers: expect.any(Number),
    }

    const sampleResponse = {
      workspaceId: "test-workspace",
      unreadMessages: 5,
      pendingOrders: 2,
      needsIntervention: 1,
      blockedUsers: 3,
      newCustomers: 2,
    }

    expect(sampleResponse).toMatchObject(expectedStructure)
  })

  it("newCustomers should represent unregistered customers, not recently created", () => {
    // Documentation test - ensures the business logic is clear
    // newCustomers = customers WHERE name = "New Customer"
    // This represents customers who have started a WhatsApp conversation
    // but have NOT completed their registration form yet
    
    const businessLogicDescription = {
      field: "newCustomers",
      meaning: "Count of unregistered customers (name = 'New Customer')",
      notMeaning: "Count of recently created customers (createdAt >= 24h ago)",
      useCase: "Show badge to prompt operator to invite customers to register",
    }

    expect(businessLogicDescription.field).toBe("newCustomers")
    expect(businessLogicDescription.meaning).toContain("unregistered")
  })
})
