/**
 * SecureTokenService - Unit Tests
 *
 * Verifica che la scadenza dei token sia gestita correttamente
 * secondo la variabile TOKEN_EXPIRATION in .env
 */

import { SecureTokenService } from "../../application/services/secure-token.service"

// Mock Prisma
jest.mock("@prisma/client", () => {
  const mockPrisma = {
    secureToken: {
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  }
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  }
})

describe("SecureTokenService - Token Expiration", () => {
  let tokenService: SecureTokenService
  let mockPrisma: any

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Create service instance
    tokenService = new SecureTokenService()
    mockPrisma = (tokenService as any).prisma

    // Default mock responses
    mockPrisma.secureToken.findFirst.mockResolvedValue(null)
    mockPrisma.secureToken.deleteMany.mockResolvedValue({ count: 0 })
    mockPrisma.secureToken.update.mockImplementation((args: any) =>
      Promise.resolve({
        id: args.where.id,
        token: "updated-token",
        type: "checkout",
        workspaceId: "workspace-123",
        customerId: "customer-123",
        expiresAt: new Date(),
        createdAt: new Date(),
        payload: args.data.payload,
      })
    )
    mockPrisma.secureToken.create.mockImplementation((args: any) =>
      Promise.resolve({
        id: "test-token-id",
        token: args.data.token,
        type: args.data.type,
        workspaceId: args.data.workspaceId,
        customerId: args.data.customerId,
        expiresAt: args.data.expiresAt,
        createdAt: new Date(),
        payload: args.data.payload,
      })
    )
  })

  describe("Token Expiration Time", () => {
    it("should create token with 15 minutes expiration when TOKEN_EXPIRATION=15m", async () => {
      // Arrange
      process.env.TOKEN_EXPIRATION = "15m"
      const workspaceId = "workspace-123"
      const customerId = "customer-456"

      // Act
      const token = await tokenService.createToken(
        "checkout",
        workspaceId,
        {},
        undefined, // Let it use TOKEN_EXPIRATION from env
        undefined,
        undefined,
        undefined,
        customerId
      )

      // Assert
      expect(mockPrisma.secureToken.create).toHaveBeenCalled()

      const createCall = mockPrisma.secureToken.create.mock.calls[0][0]
      const expiresAt = createCall.data.expiresAt as Date
      const now = new Date()

      // Verifica che la scadenza sia tra 14 e 16 minuti (tolleranza per test execution time)
      const diffMs = expiresAt.getTime() - now.getTime()
      const diffMinutes = diffMs / (1000 * 60)

      expect(diffMinutes).toBeGreaterThan(14)
      expect(diffMinutes).toBeLessThan(16)
    })

    it("should create token with 1 hour expiration when TOKEN_EXPIRATION=1h", async () => {
      // Arrange
      process.env.TOKEN_EXPIRATION = "1h"
      const workspaceId = "workspace-123"
      const customerId = "customer-456"

      // Act
      await tokenService.createToken(
        "cart",
        workspaceId,
        {},
        undefined,
        undefined,
        undefined,
        undefined,
        customerId
      )

      // Assert
      const createCall = mockPrisma.secureToken.create.mock.calls[0][0]
      const expiresAt = createCall.data.expiresAt as Date
      const now = new Date()

      const diffMs = expiresAt.getTime() - now.getTime()
      const diffHours = diffMs / (1000 * 60 * 60)

      expect(diffHours).toBeGreaterThan(0.98) // ~59 minuti
      expect(diffHours).toBeLessThan(1.02) // ~61 minuti
    })

    it("should create token with 30 minutes expiration when TOKEN_EXPIRATION=30m", async () => {
      // Arrange
      process.env.TOKEN_EXPIRATION = "30m"
      const workspaceId = "workspace-123"
      const customerId = "customer-456"

      // Act
      await tokenService.createToken(
        "orders",
        workspaceId,
        {},
        undefined,
        undefined,
        undefined,
        undefined,
        customerId
      )

      // Assert
      const createCall = mockPrisma.secureToken.create.mock.calls[0][0]
      const expiresAt = createCall.data.expiresAt as Date
      const now = new Date()

      const diffMs = expiresAt.getTime() - now.getTime()
      const diffMinutes = diffMs / (1000 * 60)

      expect(diffMinutes).toBeGreaterThan(29)
      expect(diffMinutes).toBeLessThan(31)
    })

    it("should default to 1h when TOKEN_EXPIRATION is not set", async () => {
      // Arrange
      delete process.env.TOKEN_EXPIRATION
      const workspaceId = "workspace-123"
      const customerId = "customer-456"

      // Act
      await tokenService.createToken(
        "checkout",
        workspaceId,
        {},
        undefined,
        undefined,
        undefined,
        undefined,
        customerId
      )

      // Assert
      const createCall = mockPrisma.secureToken.create.mock.calls[0][0]
      const expiresAt = createCall.data.expiresAt as Date
      const now = new Date()

      const diffMs = expiresAt.getTime() - now.getTime()
      const diffHours = diffMs / (1000 * 60 * 60)

      expect(diffHours).toBeGreaterThan(0.98)
      expect(diffHours).toBeLessThan(1.02)
    })

    it("should allow custom expiration override", async () => {
      // Arrange
      process.env.TOKEN_EXPIRATION = "15m" // Default in env
      const workspaceId = "workspace-123"
      const customerId = "customer-456"

      // Act - Override with 2h
      await tokenService.createToken(
        "checkout",
        workspaceId,
        {},
        "2h", // Custom override
        undefined,
        undefined,
        undefined,
        customerId
      )

      // Assert
      const createCall = mockPrisma.secureToken.create.mock.calls[0][0]
      const expiresAt = createCall.data.expiresAt as Date
      const now = new Date()

      const diffMs = expiresAt.getTime() - now.getTime()
      const diffHours = diffMs / (1000 * 60 * 60)

      expect(diffHours).toBeGreaterThan(1.95)
      expect(diffHours).toBeLessThan(2.05)
    })
  })

  describe("Token Validation - Expiration Check", () => {
    it("should validate NON-EXPIRED token as valid", async () => {
      // Arrange
      const token = "valid-token-123"
      const workspaceId = "workspace-123"

      const futureDate = new Date()
      futureDate.setHours(futureDate.getHours() + 1) // 1 ora nel futuro

      mockPrisma.secureToken.findFirst.mockResolvedValue({
        id: "token-id",
        token,
        type: "checkout",
        workspaceId,
        customerId: "customer-123",
        expiresAt: futureDate,
        createdAt: new Date(),
      })

      // Act
      const result = await tokenService.validateToken(token, workspaceId)

      // Assert
      expect(result.valid).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.customerId).toBe("customer-123")
    })

    it("should validate EXPIRED token as invalid", async () => {
      // Arrange
      const token = "expired-token-456"
      const workspaceId = "workspace-123"

      // Mock: findFirst returns null because expiresAt < now in WHERE clause
      mockPrisma.secureToken.findFirst.mockResolvedValue(null)

      // Act
      const result = await tokenService.validateToken(token, workspaceId)

      // Assert
      expect(result.valid).toBe(false)
      expect(result.data).toBeUndefined()

      // Verify the query used correct filter
      expect(mockPrisma.secureToken.findFirst).toHaveBeenCalledWith({
        where: {
          token,
          expiresAt: { gt: expect.any(Date) },
          workspaceId,
        },
      })
    })

    it("should reject token that expired exactly 1 second ago", async () => {
      // Arrange
      const token = "just-expired-token"
      const workspaceId = "workspace-123"

      // Token expired 1 secondo fa
      const expiredDate = new Date()
      expiredDate.setSeconds(expiredDate.getSeconds() - 1)

      // Prisma query filters out expired tokens automatically
      mockPrisma.secureToken.findFirst.mockResolvedValue(null)

      // Act
      const result = await tokenService.validateToken(token, workspaceId)

      // Assert
      expect(result.valid).toBe(false)
    })

    it("should accept token that expires in 1 second (still valid)", async () => {
      // Arrange
      const token = "almost-expired-token"
      const workspaceId = "workspace-123"

      const almostExpiredDate = new Date()
      almostExpiredDate.setSeconds(almostExpiredDate.getSeconds() + 1)

      mockPrisma.secureToken.findFirst.mockResolvedValue({
        id: "token-id",
        token,
        type: "checkout",
        workspaceId,
        customerId: "customer-123",
        expiresAt: almostExpiredDate,
        createdAt: new Date(),
      })

      // Act
      const result = await tokenService.validateToken(token, workspaceId)

      // Assert
      expect(result.valid).toBe(true)
    })
  })

  describe("Token Reuse Logic - KISS Solution", () => {
    it("should REUSE existing non-expired token instead of creating new one", async () => {
      // Arrange
      process.env.TOKEN_EXPIRATION = "15m"
      const workspaceId = "workspace-123"
      const customerId = "customer-456"

      const existingToken = "existing-token-abc"
      const futureExpiry = new Date()
      futureExpiry.setMinutes(futureExpiry.getMinutes() + 10) // Scade tra 10 minuti

      // Mock: Token esistente NON scaduto
      // IMPORTANT: findFirst is called AFTER customerId check, so we need to mock it properly
      mockPrisma.secureToken.findFirst.mockResolvedValueOnce({
        id: "existing-token-id",
        token: existingToken,
        type: "checkout",
        workspaceId,
        customerId,
        expiresAt: futureExpiry,
        createdAt: new Date(),
        payload: null,
        phoneNumber: null,
        userId: null,
        ipAddress: null,
      })

      // Act
      const token = await tokenService.createToken(
        "checkout",
        workspaceId,
        {},
        undefined,
        undefined,
        undefined,
        undefined,
        customerId
      )

      // Assert
      expect(token).toBe(existingToken) // Riutilizza token esistente
      expect(mockPrisma.secureToken.create).not.toHaveBeenCalled() // NON crea nuovo token
      expect(mockPrisma.secureToken.findFirst).toHaveBeenCalledWith({
        where: {
          customerId,
          workspaceId,
          type: "checkout",
          expiresAt: { gt: expect.any(Date) },
        },
      })
    })

    it("should CREATE NEW token when existing token is expired", async () => {
      // Arrange
      process.env.TOKEN_EXPIRATION = "15m"
      const workspaceId = "workspace-123"
      const customerId = "customer-456"

      // Mock: Nessun token valido trovato (scaduto)
      mockPrisma.secureToken.findFirst.mockResolvedValue(null)

      // Act
      const token = await tokenService.createToken(
        "checkout",
        workspaceId,
        {},
        undefined,
        undefined,
        undefined,
        undefined,
        customerId
      )

      // Assert
      expect(mockPrisma.secureToken.create).toHaveBeenCalled()
      expect(mockPrisma.secureToken.deleteMany).toHaveBeenCalledWith({
        where: {
          customerId,
          workspaceId,
          type: "checkout",
        },
      })
    })
  })

  describe("Edge Cases", () => {
    it("should handle invalid TOKEN_EXPIRATION format gracefully", async () => {
      // Arrange
      process.env.TOKEN_EXPIRATION = "invalid-format"
      const workspaceId = "workspace-123"
      const customerId = "customer-456"

      // Act
      await tokenService.createToken(
        "checkout",
        workspaceId,
        {},
        undefined,
        undefined,
        undefined,
        undefined,
        customerId
      )

      // Assert - Should default to 1h
      const createCall = mockPrisma.secureToken.create.mock.calls[0][0]
      const expiresAt = createCall.data.expiresAt as Date
      const now = new Date()

      const diffMs = expiresAt.getTime() - now.getTime()
      const diffHours = diffMs / (1000 * 60 * 60)

      expect(diffHours).toBeGreaterThan(0.98)
      expect(diffHours).toBeLessThan(1.02)
    })

    it("should require customerId for non-registration tokens", async () => {
      // Arrange
      process.env.TOKEN_EXPIRATION = "15m"
      const workspaceId = "workspace-123"

      // Act & Assert
      await expect(
        tokenService.createToken(
          "checkout",
          workspaceId,
          {},
          undefined,
          undefined,
          undefined,
          undefined,
          undefined // NO customerId
        )
      ).rejects.toThrow("KISS TOKEN: customerId è obbligatorio")
    })

    it("should allow registration tokens without customerId", async () => {
      // Arrange
      process.env.TOKEN_EXPIRATION = "15m"
      const workspaceId = "workspace-123"
      const phoneNumber = "+393331234567"

      mockPrisma.secureToken.findFirst.mockResolvedValue(null)

      // Act
      await tokenService.createToken(
        "registration",
        workspaceId,
        {},
        undefined,
        undefined,
        phoneNumber,
        undefined,
        undefined // NO customerId (OK for registration)
      )

      // Assert
      expect(mockPrisma.secureToken.create).toHaveBeenCalled()
      const createCall = mockPrisma.secureToken.create.mock.calls[0][0]
      expect(createCall.data.phoneNumber).toBe(phoneNumber)
    })
  })

  describe("Real-World Scenarios", () => {
    it("should handle 15m token expiration correctly (production config)", async () => {
      // Arrange - Simulate production config
      process.env.TOKEN_EXPIRATION = "15m"
      const workspaceId = "workspace-prod"
      const customerId = "customer-prod"

      // Act
      await tokenService.createToken(
        "checkout",
        workspaceId,
        { cartItems: ["product-1", "product-2"] },
        undefined,
        undefined,
        undefined,
        undefined,
        customerId
      )

      // Assert
      const createCall = mockPrisma.secureToken.create.mock.calls[0][0]
      const expiresAt = createCall.data.expiresAt as Date
      const now = new Date()

      // Verifica esatta: 15 minuti = 900 secondi
      const diffMs = expiresAt.getTime() - now.getTime()
      const diffSeconds = diffMs / 1000

      expect(diffSeconds).toBeGreaterThan(890) // 14:50
      expect(diffSeconds).toBeLessThan(910) // 15:10

      // Log per debugging
      console.log(`Token scade tra ${Math.round(diffSeconds / 60)} minuti`)
    })
  })
})
