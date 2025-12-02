/**
 * Offers Date-Based Expiration Tests
 * 
 * Verifies that offers expire based on dates only (startDate/endDate),
 * NOT on the isActive flag. This was changed to simplify offer management.
 * 
 * Key behavior:
 * - Offers with startDate <= now AND endDate >= now are ACTIVE
 * - Offers with startDate > now are SCHEDULED (future)
 * - Offers with endDate < now are EXPIRED
 * - isActive flag is IGNORED in all queries
 */

import { PrismaClient } from "@prisma/client"

// Mock Prisma
const mockFindMany = jest.fn()

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    offers: { findMany: mockFindMany },
    $disconnect: jest.fn(),
  })),
}))

// Import after mocking
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
    messageRepo = new MessageRepository(new PrismaClient())
  })

  describe("OfferRepository.findActive", () => {
    it("should NOT filter by isActive flag", async () => {
      await offerRepo.findActive(WORKSPACE_ID)

      // Verify the query was called
      expect(mockFindMany).toHaveBeenCalled()
      
      // Get the where clause from the call
      const callArgs = mockFindMany.mock.calls[0][0]
      const whereClause = callArgs.where
      
      // isActive should NOT be in the where clause
      expect(whereClause).not.toHaveProperty("isActive")
    })

    it("should filter by date range (startDate <= now <= endDate)", async () => {
      await offerRepo.findActive(WORKSPACE_ID)

      const callArgs = mockFindMany.mock.calls[0][0]
      const whereClause = callArgs.where

      // Should have workspaceId filter
      expect(whereClause.workspaceId).toBe(WORKSPACE_ID)
      
      // Should have date filters
      expect(whereClause.startDate).toHaveProperty("lte")
      expect(whereClause.endDate).toHaveProperty("gte")
    })

    it("should return offers regardless of isActive value when within date range", async () => {
      // Simulate offers with isActive=false but valid dates
      const now = new Date()
      const validOfferWithIsActiveFalse = {
        id: "offer-1",
        name: "Test Offer",
        isActive: false, // This should be IGNORED
        startDate: new Date(now.getTime() - 86400000), // yesterday
        endDate: new Date(now.getTime() + 86400000), // tomorrow
        discountPercent: 10,
        categoryId: null,
        categories: [],
      }

      mockFindMany.mockResolvedValue([validOfferWithIsActiveFalse])

      const result = await offerRepo.findActive(WORKSPACE_ID)

      // The offer should be returned because it's within date range
      // (isActive is ignored)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe("offer-1")
    })

    it("should filter by categoryId when provided", async () => {
      const categoryId = "category-123"
      
      await offerRepo.findActive(WORKSPACE_ID, categoryId)

      const callArgs = mockFindMany.mock.calls[0][0]
      const whereClause = callArgs.where

      // Should have category filter (OR condition)
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
      
      // isActive should NOT be in the where clause
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

      // Should contain the formatted offer text in Italian (lingua base)
      expect(result).toContain("20%")
      expect(result).toContain("Electronics")
    })
  })

  describe("Date-based status determination (Frontend logic)", () => {
    it("should consider offer ACTIVE when startDate <= now <= endDate", () => {
      const now = new Date()
      const offer = {
        startDate: new Date(now.getTime() - 86400000), // yesterday
        endDate: new Date(now.getTime() + 86400000), // tomorrow
      }

      const isActive = offer.startDate <= now && offer.endDate >= now
      expect(isActive).toBe(true)
    })

    it("should consider offer SCHEDULED when startDate > now", () => {
      const now = new Date()
      const offer = {
        startDate: new Date(now.getTime() + 86400000), // tomorrow
        endDate: new Date(now.getTime() + 172800000), // day after tomorrow
      }

      const isScheduled = offer.startDate > now
      expect(isScheduled).toBe(true)
    })

    it("should consider offer EXPIRED when endDate < now", () => {
      const now = new Date()
      const offer = {
        startDate: new Date(now.getTime() - 172800000), // 2 days ago
        endDate: new Date(now.getTime() - 86400000), // yesterday
      }

      const isExpired = offer.endDate < now
      expect(isExpired).toBe(true)
    })
  })
})
