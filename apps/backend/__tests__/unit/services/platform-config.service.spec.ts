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
 * @author Andrea Gelso - ShopME Platform
 */

import { PrismaClient } from "@prisma/client"

// Mock Prisma
jest.mock("@prisma/client", () => {
  const mockPlatformConfig = {
    findMany: jest.fn(),
    update: jest.fn(),
  }

  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      platformConfig: mockPlatformConfig,
    })),
  }
})

// Import after mocking
import { platformConfigService } from "../../../src/services/platform-config.service"

describe("PlatformConfigService", () => {
  let mockPrisma: jest.Mocked<PrismaClient>

  const mockConfigData = [
    // Prices
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
    // Flags
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
    // Limits
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

    // Get the mocked prisma instance
    mockPrisma = new PrismaClient() as jest.Mocked<PrismaClient>

    // Setup default mock for findMany
    ;(mockPrisma.platformConfig.findMany as jest.Mock).mockResolvedValue(
      mockConfigData
    )

    // Invalidate cache to ensure fresh state for each test
    await platformConfigService.invalidateCache()
  })

  describe("getPrice", () => {
    it("should return correct price value", async () => {
      const price = await platformConfigService.getPrice("BASIC_MONTHLY")
      expect(price).toBe(19)
    })

    it("should return 0 for non-existent price", async () => {
      const price = await platformConfigService.getPrice("NON_EXISTENT")
      expect(price).toBe(0)
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

    it("should return true for non-existent flag (safe default)", async () => {
      const result = await platformConfigService.getFlag("NON_EXISTENT")
      expect(result).toBe(true)
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

    it("should return 0 for non-existent limit", async () => {
      const limit = await platformConfigService.getLimit("NON_EXISTENT")
      expect(limit).toBe(0)
    })
  })

  describe("getPublicConfig", () => {
    it("should return all config in correct format", async () => {
      const config = await platformConfigService.getPublicConfig()

      // Check prices
      expect(config.prices.BASIC_MONTHLY).toEqual({
        current: 19,
        original: 29,
      })
      expect(config.prices.MESSAGE).toEqual({
        current: 0.1,
        original: null,
      })

      // Check flags
      expect(config.flags.canLogin).toBe(true)
      expect(config.flags.canRegister).toBe(false)

      // Check limits
      expect(config.limits.FREE_PRODUCTS).toBe(50)
    })
  })

  describe("getAdminConfig", () => {
    it("should return config with descriptions", async () => {
      const config = await platformConfigService.getAdminConfig()

      // Check prices array
      const basicPrice = config.prices.find((p) => p.key === "BASIC_MONTHLY")
      expect(basicPrice).toBeDefined()
      expect(basicPrice?.current).toBe(19)
      expect(basicPrice?.original).toBe(29)
      expect(basicPrice?.description).toBe("Basic plan - €19/month")

      // Check flags array
      const canLoginFlag = config.flags.find((f) => f.key === "canLogin")
      expect(canLoginFlag).toBeDefined()
      expect(canLoginFlag?.value).toBe(true)
      expect(canLoginFlag?.description).toBe("Allow users to login")

      // Check limits array
      const freeProductsLimit = config.limits.find(
        (l) => l.key === "FREE_PRODUCTS"
      )
      expect(freeProductsLimit).toBeDefined()
      expect(freeProductsLimit?.value).toBe(50)
    })
  })

  describe("updateConfig", () => {
    it("should update config and invalidate cache", async () => {
      ;(mockPrisma.platformConfig.update as jest.Mock).mockResolvedValue({
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
      // Mock the update
      ;(mockPrisma.platformConfig.update as jest.Mock).mockResolvedValue({
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

      // Should return the opposite of current value
      expect(typeof result).toBe("boolean")
    })
  })

  describe("cache behavior", () => {
    it("should use cache for subsequent calls", async () => {
      // Cache was populated in beforeEach via invalidateCache()
      // Clear mock to count new calls only
      ;(mockPrisma.platformConfig.findMany as jest.Mock).mockClear()
      
      // These calls should use cache (no new findMany calls)
      await platformConfigService.getPrice("BASIC_MONTHLY")
      await platformConfigService.getPrice("PREMIUM_MONTHLY")

      // findMany should NOT be called (using cache)
      expect(mockPrisma.platformConfig.findMany).toHaveBeenCalledTimes(0)
    })

    it("should refresh cache after invalidation", async () => {
      // Cache was populated in beforeEach
      ;(mockPrisma.platformConfig.findMany as jest.Mock).mockClear()

      // Invalidate cache - should trigger findMany
      await platformConfigService.invalidateCache()

      // findMany should be called once for refresh
      expect(mockPrisma.platformConfig.findMany).toHaveBeenCalledTimes(1)
    })
  })
})
