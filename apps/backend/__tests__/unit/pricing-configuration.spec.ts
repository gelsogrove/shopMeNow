/**
 * Unit tests for Pricing Configuration (Platform Config)
 *
 * Tests cover:
 * 1. Basic plan monthly fee is €19 (not €29)
 * 2. Premium and Enterprise fees are correct
 * 3. Message and push costs are correct
 */

const mockPlatformConfig = {
  findMany: jest.fn(),
  update: jest.fn(),
}

const mockPrisma = {
  platformConfig: mockPlatformConfig,
}

jest.mock("@echatbot/database", () => ({
  prisma: mockPrisma,
  PrismaClient: jest.fn(),
}))

// Make prisma available globally for the service
;(global as any).prisma = mockPrisma

import { platformConfigService } from "../../src/services/platform-config.service"

describe("Pricing Configuration", () => {
  const mockConfigData = [
    {
      id: "1",
      key: "FREE_MONTHLY",
      type: "PRICE" as const,
      value: "0",
      originalValue: null,
      description: "Free plan - €0",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "2",
      key: "BASIC_MONTHLY",
      type: "PRICE" as const,
      value: "19",
      originalValue: "29",
      description: "Basic plan - €19/month",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "3",
      key: "PREMIUM_MONTHLY",
      type: "PRICE" as const,
      value: "49",
      originalValue: null,
      description: "Premium plan - €49/month",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "4",
      key: "ENTERPRISE_MONTHLY",
      type: "PRICE" as const,
      value: "129",
      originalValue: null,
      description: "Enterprise plan - €129/month",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "5",
      key: "MESSAGE",
      type: "PRICE" as const,
      value: "0.10",
      originalValue: null,
      description: "Cost per message",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "6",
      key: "PUSH_CAMPAIGN",
      type: "PRICE" as const,
      value: "1.00",
      originalValue: null,
      description: "Push campaign message",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  beforeEach(async () => {
    jest.clearAllMocks()
    ;(mockPlatformConfig.findMany as jest.Mock).mockResolvedValue(
      mockConfigData
    )
    await platformConfigService.invalidateCache()
  })

  describe("Basic Plan Pricing", () => {
    it("should have Basic monthly fee of €19", async () => {
      await expect(platformConfigService.getPrice("BASIC_MONTHLY")).resolves.toBe(
        19.0
      )
    })

    it("should NOT be €29 (old value)", async () => {
      const price = await platformConfigService.getPrice("BASIC_MONTHLY")
      expect(price).not.toBe(29.0)
    })
  })

  describe("Premium Plan Pricing", () => {
    it("should have Premium monthly fee of €49", async () => {
      await expect(platformConfigService.getPrice("PREMIUM_MONTHLY")).resolves.toBe(
        49.0
      )
    })
  })

  describe("Enterprise Plan Pricing", () => {
    it("should have Enterprise monthly fee of €129", async () => {
      await expect(
        platformConfigService.getPrice("ENTERPRISE_MONTHLY")
      ).resolves.toBe(129.0)
    })
  })

  describe("Message Costs", () => {
    it("should have message cost of €0.10", async () => {
      await expect(platformConfigService.getPrice("MESSAGE")).resolves.toBe(0.1)
    })

    it("should have push campaign cost of €1.00", async () => {
      await expect(
        platformConfigService.getPrice("PUSH_CAMPAIGN")
      ).resolves.toBe(1.0)
    })
  })
})
