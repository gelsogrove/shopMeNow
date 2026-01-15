import { describe, it, expect } from "@jest/globals"
import { SubscriptionBillingRepository } from "../../../src/repositories/subscription-billing.repository"

const buildMockPrisma = () => ({
  workspace: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  products: {
    count: jest.fn(),
  },
  customers: {
    count: jest.fn(),
  },
  userWorkspace: {
    findMany: jest.fn(),
  },
})

describe("SubscriptionBillingRepository", () => {
  it("counts customers/leads excluding deleted or blacklisted records (owner usage)", async () => {
    const mockPrisma = buildMockPrisma()
    mockPrisma.workspace.findMany.mockResolvedValue([{ id: "ws-1" }])
    mockPrisma.products.count.mockResolvedValue(2)
    mockPrisma.customers.count.mockResolvedValue(5)
    mockPrisma.userWorkspace.findMany.mockResolvedValue([
      { userId: "user-1" },
      { userId: "user-2" },
    ])

    const repository = new SubscriptionBillingRepository(mockPrisma as any)
    await repository.getOwnerUsage("owner-1")

    const customersArgs = mockPrisma.customers.count.mock.calls[0][0]
    expect(customersArgs).toEqual({
      where: {
        workspaceId: { in: ["ws-1"] },
        deletedAt: null,
        isBlacklisted: false,
        NOT: [
          { phone: "+39 999 1234567" },
          { email: "playground@test.echatbot.local" },
        ],
      },
    })
    expect("isActive" in customersArgs.where).toBe(false)
  })

  it("counts customers/leads excluding deleted or blacklisted records (workspace usage fallback)", async () => {
    const mockPrisma = buildMockPrisma()
    mockPrisma.workspace.findUnique.mockResolvedValue({ ownerId: null })
    mockPrisma.products.count.mockResolvedValue(1)
    mockPrisma.customers.count.mockResolvedValue(4)
    mockPrisma.userWorkspace.findMany.mockResolvedValue([{ userId: "user-1" }])

    const repository = new SubscriptionBillingRepository(mockPrisma as any)
    await repository.getWorkspaceUsage("ws-1")

    const customersArgs = mockPrisma.customers.count.mock.calls[0][0]
    expect(customersArgs).toEqual({
      where: {
        workspaceId: "ws-1",
        deletedAt: null,
        isBlacklisted: false,
        NOT: [
          { phone: "+39 999 1234567" },
          { email: "playground@test.echatbot.local" },
        ],
      },
    })
    expect("isActive" in customersArgs.where).toBe(false)
  })
})
