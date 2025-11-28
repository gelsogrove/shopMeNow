/**
 * Workspace Data Isolation Tests
 *
 * CRITICAL: Verifies that ALL data loading methods filter by workspaceId
 * to prevent cross-workspace data contamination.
 *
 * Bug Context: Sjopme workspace (empty) was showing Bell'Italia products
 * because {{PRODUCTS}} variable replacement wasn't workspace-isolated.
 */

import { PrismaClient } from "@prisma/client"

// Mock Prisma
const mockFindMany = jest.fn()
const mockFindFirst = jest.fn()
const mockFindUnique = jest.fn()

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    products: { findMany: mockFindMany },
    categories: { findMany: mockFindMany },
    services: { findMany: mockFindMany },
    offers: { findMany: mockFindMany },
    fAQ: { findMany: mockFindMany },
    customers: { findFirst: mockFindFirst, findUnique: mockFindUnique },
    agentConfig: { findFirst: mockFindFirst },
    $disconnect: jest.fn(),
  })),
}))

// Import after mocking
import { MessageRepository } from "../../src/repositories/message.repository"
import { AgentConfigRepository } from "../../src/repositories/agent-config.repository"

describe("Workspace Data Isolation", () => {
  let messageRepo: MessageRepository
  let agentConfigRepo: AgentConfigRepository
  const WORKSPACE_A = "workspace-a-id"
  const WORKSPACE_B = "workspace-b-id"

  beforeEach(() => {
    jest.clearAllMocks()
    messageRepo = new MessageRepository()
    agentConfigRepo = new AgentConfigRepository(new PrismaClient())

    // Default: return empty arrays
    mockFindMany.mockResolvedValue([])
    mockFindFirst.mockResolvedValue(null)
  })

  describe("MessageRepository - getActiveProducts", () => {
    it("should filter products by workspaceId", async () => {
      await messageRepo.getActiveProducts(WORKSPACE_A, 0)

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: WORKSPACE_A,
            isActive: true,
          }),
        })
      )
    })

    it("should NOT return products from different workspace", async () => {
      // Workspace A has products
      mockFindMany.mockImplementation((args: any) => {
        if (args.where.workspaceId === WORKSPACE_A) {
          return Promise.resolve([
            { id: "1", name: "Product A", price: 10, productCode: "A-001" },
          ])
        }
        return Promise.resolve([]) // Workspace B has no products
      })

      const resultA = await messageRepo.getActiveProducts(WORKSPACE_A, 0)
      const resultB = await messageRepo.getActiveProducts(WORKSPACE_B, 0)

      expect(resultA).toContain("Product A")
      expect(resultB).toBe("") // Empty for workspace B
    })

    it("should return empty message when workspace has no products", async () => {
      mockFindMany.mockResolvedValue([])

      const result = await messageRepo.getActiveProducts(WORKSPACE_A, 0)

      expect(result).toBe("")
    })
  })

  describe("MessageRepository - getActiveCategories", () => {
    it("should filter categories by workspaceId", async () => {
      await messageRepo.getActiveCategories(WORKSPACE_A)

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: WORKSPACE_A,
            isActive: true,
          }),
        })
      )
    })

    it("should return empty string when workspace has no categories", async () => {
      mockFindMany.mockResolvedValue([])

      const result = await messageRepo.getActiveCategories(WORKSPACE_A)

      expect(result).toBe("")
    })
  })

  describe("MessageRepository - getActiveServices", () => {
    it("should filter services by workspaceId", async () => {
      await messageRepo.getActiveServices(WORKSPACE_A)

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: WORKSPACE_A,
            isActive: true,
          }),
        })
      )
    })

    it("should return empty string when workspace has no services", async () => {
      mockFindMany.mockResolvedValue([])

      const result = await messageRepo.getActiveServices(WORKSPACE_A)

      expect(result).toBe("")
    })
  })

  describe("MessageRepository - getActiveOffers", () => {
    it("should filter offers by workspaceId", async () => {
      await messageRepo.getActiveOffers(WORKSPACE_A)

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: WORKSPACE_A,
            isActive: true,
          }),
        })
      )
    })

    it("should return empty string when workspace has no offers", async () => {
      mockFindMany.mockResolvedValue([])

      const result = await messageRepo.getActiveOffers(WORKSPACE_A)

      expect(result).toBe("")
    })
  })

  describe("MessageRepository - getActiveFaqs", () => {
    it("should filter FAQs by workspaceId", async () => {
      await messageRepo.getActiveFaqs(WORKSPACE_A)

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: WORKSPACE_A,
            isActive: true,
          }),
        })
      )
    })

    it("should return empty string when workspace has no FAQs", async () => {
      mockFindMany.mockResolvedValue([])

      const result = await messageRepo.getActiveFaqs(WORKSPACE_A)

      expect(result).toBe("")
    })
  })

  describe("AgentConfigRepository - findByType", () => {
    it("should filter agent config by workspaceId", async () => {
      await agentConfigRepo.findByType(WORKSPACE_A, "PRODUCT_SEARCH" as any)

      expect(mockFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: WORKSPACE_A,
            type: "PRODUCT_SEARCH",
            isActive: true,
          }),
        })
      )
    })

    it("should return null when agent not found in workspace", async () => {
      mockFindFirst.mockResolvedValue(null)

      const result = await agentConfigRepo.findByType(
        WORKSPACE_A,
        "PRODUCT_SEARCH" as any
      )

      expect(result).toBeNull()
    })
  })
})

describe("PromptProcessorService - Empty Content Handling", () => {
  // Import dynamically to avoid module issues
  let PromptProcessorService: any

  beforeEach(async () => {
    jest.resetModules()
    // Mock dependencies
    jest.mock("../../src/repositories/message.repository", () => ({
      MessageRepository: jest.fn().mockImplementation(() => ({})),
    }))
    const module = await import(
      "../../src/services/prompt-processor.service"
    )
    PromptProcessorService = module.PromptProcessorService
  })

  it("should replace empty {{PRODUCTS}} with warning message", async () => {
    const processor = new PromptProcessorService()
    const promptWithProducts = "Available products: {{PRODUCTS}}"

    const result = await processor.preProcessPrompt(
      promptWithProducts,
      "workspace-id",
      {},
      {
        faqs: "",
        products: "", // Empty products
        categories: "",
        services: "",
        offers: "",
      }
    )

    expect(result).toContain("CATALOGO VUOTO")
    expect(result).toContain("Non ci sono prodotti")
  })

  it("should replace empty {{CATEGORIES}} with warning message", async () => {
    const processor = new PromptProcessorService()
    const promptWithCategories = "Categories: {{CATEGORIES}}"

    const result = await processor.preProcessPrompt(
      promptWithCategories,
      "workspace-id",
      {},
      {
        faqs: "",
        products: "",
        categories: "", // Empty categories
        services: "",
        offers: "",
      }
    )

    expect(result).toContain("Non abbiamo categorie")
  })

  it("should replace empty {{SERVICES}} with warning message", async () => {
    const processor = new PromptProcessorService()
    const promptWithServices = "Services: {{SERVICES}}"

    const result = await processor.preProcessPrompt(
      promptWithServices,
      "workspace-id",
      {},
      {
        faqs: "",
        products: "",
        categories: "",
        services: "", // Empty services
        offers: "",
      }
    )

    expect(result).toContain("Non abbiamo servizi")
  })

  it("should replace empty {{OFFERS}} with warning message", async () => {
    const processor = new PromptProcessorService()
    const promptWithOffers = "Offers: {{OFFERS}}"

    const result = await processor.preProcessPrompt(
      promptWithOffers,
      "workspace-id",
      {},
      {
        faqs: "",
        products: "",
        categories: "",
        services: "",
        offers: "", // Empty offers
      }
    )

    expect(result).toContain("Non abbiamo offerte")
  })

  it("should replace empty {{FAQ}} with warning message", async () => {
    const processor = new PromptProcessorService()
    const promptWithFaq = "FAQ: {{FAQ}}"

    const result = await processor.preProcessPrompt(
      promptWithFaq,
      "workspace-id",
      {},
      {
        faqs: "", // Empty FAQ
        products: "",
        categories: "",
        services: "",
        offers: "",
      }
    )

    expect(result).toContain("Non abbiamo FAQ")
  })

  it("should keep real content when data exists", async () => {
    const processor = new PromptProcessorService()
    const promptWithProducts = "Products: {{PRODUCTS}}"

    const result = await processor.preProcessPrompt(
      promptWithProducts,
      "workspace-id",
      {},
      {
        faqs: "",
        products: "Mozzarella €5.00\nParmigiano €10.00", // Real products
        categories: "",
        services: "",
        offers: "",
      }
    )

    expect(result).toContain("Mozzarella")
    expect(result).toContain("Parmigiano")
    expect(result).not.toContain("CATALOGO VUOTO")
  })
})
