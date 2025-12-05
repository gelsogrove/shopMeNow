/**
 * Offers Date-Based Expiration Tests
 * 
 * Verifies that offers expire based on dates only (startDate/endDate),
 * NOT on the isActive flag.
 */

const mockFindMany = jest.fn()

const mockPrisma = {
  offers: { findMany: mockFindMany },
  $disconnect: jest.fn(),
}

jest.mock("@echatbot/database", () => ({
  prisma: mockPrisma,
}))

;(global as any).prisma = mockPrisma

import { OfferRepository } from "../../src/repositories/offer.repository"
import { MessageRepository } from "../../src/repositories/message.repository"

describe("Offers Date-Based Expiration", () => {
  const WORKSPACE_ID = "test-workspace-id"
  let offerRepo: OfferRepository
  let messageRepo: MessageRepository
  
  beforeEach(() => {
    jest.clearAllMocks()
    mockFindMany.mockResolvedValue([])
    offerRepo = new OfferRepository()
    messageRepo = new MessageRepository()
  })

  describe("OfferRepository.findActive", () => {
    it("should NOT filter by isActive flag", async () => {
      await offerRepo.findActive(WORKSPACE_ID)

      expect(mockFindMany).toHaveBeenCalled()
      
      const callArgs = mockFindMany.mock.calls[0][0]
      const whereClause = callArgs.where
      
      expect(whereClause).not.toHaveProperty("isActive")
    })

    it("should filter by date range", async () => {
      await offerRepo.findActive(WORKSPACE_ID)

      const callArgs = mockFindMany.mock.calls[0][0]
      const whereClause = callArgs.where

      expect(whereClause.workspaceId).toBe(WORKSPACE_ID)
      expect(whereClause.startDate).toHaveProperty("lte")
      expect(whereClause.endDate).toHaveProperty("gte")
    })

    it("should return offers within date range", async () => {
      const now = new Date()
      const validOffer = {
        id: "offer-1",
        name: "Test Offer",
        isActive: false,
        startDate: new Date(now.getTime() - 86400000),
        endDate: new Date(now.getTime() + 86400000),
        discountPercent: 10,
        categoryId: null,
        categories: [],
      }

      mockFindMany.mockResolvedValue([validOffer])

      const result = await offerRepo.findActive(WORKSPACE_ID)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("offer-1")
    })

    it("should filter by categoryId when provided", async () => {
      const categoryId = "category-123"
      
      await offerRepo.findActive(WORKSPACE_ID, categoryId)

      const callArgs = mockFindMany.mock.calls[0][0]
      const whereClause = callArgs.where

      expect(whereClause.OR).toBeDefined()
      expect(whereClause.OR).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ categoryId }),
        ])
      )
    })
  })

  describe("MessageRepository.getActiveOffers", () => {
    it("should NOT filter by isActive flag", async () => {
      await messageRepo.getActiveOffers(WORKSPACE_ID)

      expect(mockFindMany).toHaveBeenCalled()
      
      const callArgs = mockFindMany.mock.calls[0][0]
      const whereClause = callArgs.where
      
      expect(whereClause).not.toHaveProperty("isActive")
    })

    it("should filter by workspaceId and date range", async () => {
      await messageRepo.getActiveOffers(WORKSPACE_ID)

      const callArgs = mockFindMany.mock.calls[0][0]
      const whereClause = callArgs.where

      expect(whereClause.workspaceId).toBe(WORKSPACE_ID)
      expect(whereClause.startDate).toHaveProperty("lte")
      expect(whereClause.endDate).toHaveProperty("gte")
    })

    it("should return empty string when no offers found", async () => {
      mockFindMany.mockResolvedValue([])

      const result = await messageRepo.getActiveOffers(WORKSPACE_ID)

      expect(result).toBe("")
    })

    it("should format offers correctly when found", async () => {
      const now = new Date()
      const mockOffers = [
        {
          id: "offer-1",
          name: "Summer Sale",
          discountPercent: 20,
          startDate: new Date(now.getTime() - 86400000),
          endDate: new Date(now.getTime() + 86400000),
          category: { name: "Electronics" },
        },
      ]

      mockFindMany.mockResolvedValue(mockOffers)

      const result = await messageRepo.getActiveOffers(WORKSPACE_ID)

      expect(result).toContain("20%")
      expect(result).toContain("Electronics")
    })
  })

  describe("Date-based status determination", () => {
    it("should consider offer ACTIVE when startDate <= now <= endDate", () => {
      const now = new Date()
      const offer = {
        startDate: new Date(now.getTime() - 86400000),
        endDate: new Date(now.getTime() + 86400000),
      }

      const isActive = offer.startDate <= now && offer.endDate >= now
      expect(isActive).toBe(true)
    })

    it("should consider offer SCHEDULED when startDate > now", () => {
      const now = new Date()
      const offer = {
        startDate: new Date(now.getTime() + 86400000),
        endDate: new Date(now.getTime() + 172800000),
      }

      const isScheduled = offer.startDate > now
      expect(isScheduled).toBe(true)
    })

    it("should consider offer EXPIRED when endDate < now", () => {
      const now = new Date()
      const offer = {
        startDate: new Date(now.getTime() - 172800000),
        endDate: new Date(now.getTime() - 86400000),
      }

      const isExpired = offer.endDate < now
      expect(isExpired).toBe(true)
    })
  })
})
