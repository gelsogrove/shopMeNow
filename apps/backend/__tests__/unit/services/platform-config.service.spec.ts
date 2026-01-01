/**
 * 🧪 PLATFORM CONFIG SERVICE TESTS
 *
 * Unit tests for PlatformConfigService.
 *
 * Tests:
 * - Cache management (TTL, invalidation)
 * - Price retrieval with original values
 * - Flag retrieval and convenience methods
 * - Limit retrieval
 * - Public and admin config formatting
 *
 * @author Andrea Gelso - eChatbot Platform
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

import { platformConfigService } from "../../../src/services/platform-config.service"

describe("PlatformConfigService", () => {
  const mockConfigData = [
    {
      id: "1",
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
      id: "2",
      key: "PREMIUM_MONTHLY",
      type: "PRICE" as const,
      value: "39",
      originalValue: "49",
      description: "Premium plan - €39/month",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "3",
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
      id: "4",
      key: "canLogin",
      type: "FLAG" as const,
      value: "true",
      originalValue: null,
      description: "Allow users to login",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "5",
      key: "canRegister",
      type: "FLAG" as const,
      value: "false",
      originalValue: null,
      description: "Allow new user registration",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "8",
      key: "workingInProgress",
      type: "FLAG" as const,
      value: "true",
      originalValue: null,
      description: "Show Work in Progress badge",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "9",
      key: "registerFirst",
      type: "FLAG" as const,
      value: "false",
      originalValue: null,
      description: "Default to registration view",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "6",
      key: "FREE_PRODUCTS",
      type: "LIMIT" as const,
      value: "50",
      originalValue: null,
      description: "Maximum products for Free plan",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "7",
      key: "BASIC_CLIENTS",
      type: "LIMIT" as const,
      value: "50",
      originalValue: null,
      description: "Maximum clients for Basic plan",
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

  describe("getPrice", () => {
    it("should return correct price value", async () => {
      const price = await platformConfigService.getPrice("BASIC_MONTHLY")
      expect(price).toBe(19)
    })

    it("should throw for non-existent price", async () => {
      await expect(
        platformConfigService.getPrice("NON_EXISTENT")
      ).rejects.toThrow("Missing platform price config")
    })

    it("should handle decimal prices correctly", async () => {
      const price = await platformConfigService.getPrice("MESSAGE")
      expect(price).toBe(0.1)
    })
  })

  describe("getPriceWithOriginal", () => {
    it("should return current and original prices", async () => {
      const result =
        await platformConfigService.getPriceWithOriginal("BASIC_MONTHLY")
      expect(result.current).toBe(19)
      expect(result.original).toBe(29)
    })

    it("should return null original when not set", async () => {
      const result =
        await platformConfigService.getPriceWithOriginal("MESSAGE")
      expect(result.current).toBe(0.1)
      expect(result.original).toBeNull()
    })
  })

  describe("getFlag", () => {
    it("should return true for enabled flag", async () => {
      const result = await platformConfigService.getFlag("canLogin")
      expect(result).toBe(true)
    })

    it("should return false for disabled flag", async () => {
      const result = await platformConfigService.getFlag("canRegister")
      expect(result).toBe(false)
    })

    it("should throw for non-existent flag", async () => {
      await expect(
        platformConfigService.getFlag("NON_EXISTENT")
      ).rejects.toThrow("Missing platform flag config")
    })
  })

  describe("convenience flag methods", () => {
    it("canLogin should return correct value", async () => {
      const result = await platformConfigService.canLogin()
      expect(result).toBe(true)
    })

    it("canRegister should return correct value", async () => {
      const result = await platformConfigService.canRegister()
      expect(result).toBe(false)
    })
  })

  describe("getLimit", () => {
    it("should return correct limit value", async () => {
      const limit = await platformConfigService.getLimit("FREE_PRODUCTS")
      expect(limit).toBe(50)
    })

    it("should throw for non-existent limit", async () => {
      await expect(
        platformConfigService.getLimit("NON_EXISTENT")
      ).rejects.toThrow("Missing platform limit config")
    })
  })

  describe("getPublicConfig", () => {
    it("should return all config in correct format", async () => {
      const config = await platformConfigService.getPublicConfig()

      expect(config.prices.BASIC_MONTHLY).toEqual({
        current: 19,
        original: 29,
      })
      expect(config.prices.MESSAGE).toEqual({
        current: 0.1,
        original: null,
      })

      expect(config.flags.canLogin).toBe(true)
      expect(config.flags.canRegister).toBe(false)

      expect(config.limits.FREE_PRODUCTS).toBe(50)
    })
  })

  describe("getAdminConfig", () => {
    it("should return config with descriptions", async () => {
      const config = await platformConfigService.getAdminConfig()

      const basicPrice = config.prices.find((p) => p.key === "BASIC_MONTHLY")
      expect(basicPrice).toBeDefined()
      expect(basicPrice?.current).toBe(19)
      expect(basicPrice?.original).toBe(29)
      expect(basicPrice?.description).toBe("Basic plan - €19/month")

      const canLoginFlag = config.flags.find((f) => f.key === "canLogin")
      expect(canLoginFlag).toBeDefined()
      expect(canLoginFlag?.value).toBe(true)
      expect(canLoginFlag?.description).toBe("Allow users to login")

      const freeProductsLimit = config.limits.find(
        (l) => l.key === "FREE_PRODUCTS"
      )
      expect(freeProductsLimit).toBeDefined()
      expect(freeProductsLimit?.value).toBe(50)
    })
  })

  describe("updateConfig", () => {
    it("should update config and invalidate cache", async () => {
      ;(mockPlatformConfig.update as jest.Mock).mockResolvedValue({
        id: "1",
        key: "BASIC_MONTHLY",
        type: "PRICE",
        value: "25",
        originalValue: "29",
        description: "Basic plan - €25/month",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await platformConfigService.updateConfig(
        "BASIC_MONTHLY",
        "25"
      )

      expect(result).toBeDefined()
      expect(result?.key).toBe("BASIC_MONTHLY")
      expect(result?.value).toBe("25")
    })
  })

  describe("toggleFlag", () => {
    it("should toggle flag and return new value", async () => {
      ;(mockPlatformConfig.update as jest.Mock).mockResolvedValue({
        id: "4",
        key: "canLogin",
        type: "FLAG",
        value: "false",
        originalValue: null,
        description: "Allow users to login",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await platformConfigService.toggleFlag("canLogin")

      expect(typeof result).toBe("boolean")
    })
  })

  describe("cache behavior", () => {
    it("should use cache for subsequent calls", async () => {
      ;(mockPlatformConfig.findMany as jest.Mock).mockClear()

      await platformConfigService.getPrice("BASIC_MONTHLY")
      await platformConfigService.getPrice("PREMIUM_MONTHLY")

      expect(mockPlatformConfig.findMany).toHaveBeenCalledTimes(0)
    })

    it("should refresh cache after invalidation", async () => {
      ;(mockPlatformConfig.findMany as jest.Mock).mockClear()

      await platformConfigService.invalidateCache()

      expect(mockPlatformConfig.findMany).toHaveBeenCalledTimes(1)
    })
  })
})
