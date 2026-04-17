/**
 * Workspace Data Isolation Tests
 *
 * CRITICAL: Verifies that ALL data loading methods filter by workspaceId
 * to prevent cross-workspace data contamination.
 *
 * Bug Context: Sjopme workspace (empty) was showing BellItalia products
 * because {{PRODUCTS}} variable replacement wasn't workspace-isolated.
 */

const mockFindMany = jest.fn()
const mockFindFirst = jest.fn()
const mockFindUnique = jest.fn()
const mockWorkspaceFindUnique = jest.fn()

const mockPrisma = {
  products: { findMany: mockFindMany },
  categories: { findMany: mockFindMany },
  services: { findMany: mockFindMany },
  offers: { findMany: mockFindMany },
  fAQ: { findMany: mockFindMany },
  customers: { findFirst: mockFindFirst, findUnique: mockFindUnique },
  agentConfig: { findFirst: mockFindFirst, findMany: mockFindMany },
  workspace: { findUnique: mockWorkspaceFindUnique },
  $disconnect: jest.fn(),
}

jest.mock("@echatbot/database", () => ({
  prisma: mockPrisma,
  PrismaClient: jest.fn(),
}))

;(global as any).prisma = mockPrisma

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
    agentConfigRepo = new AgentConfigRepository(mockPrisma as any)

    mockFindMany.mockResolvedValue([])
    mockFindFirst.mockResolvedValue(null)
    mockWorkspaceFindUnique.mockResolvedValue({ currency: "USD" })
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
      mockFindMany.mockImplementation((args: any) => {
        if (args.where.workspaceId === WORKSPACE_A) {
          return Promise.resolve([
            { id: "1", name: "Product A", price: 10, sku: "A-001" },
          ])
        }
        return Promise.resolve([])
      })

      const resultA = await messageRepo.getActiveProducts(WORKSPACE_A, 0)
      const resultB = await messageRepo.getActiveProducts(WORKSPACE_B, 0)

      expect(resultA).toContain("Product A")
      expect(resultB).toBe("")
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
  let PromptProcessorService: any

  beforeEach(async () => {
    jest.resetModules()
    jest.mock("../../src/repositories/message.repository", () => ({
      MessageRepository: jest.fn().mockImplementation(() => ({})),
    }))
    const module = await import(
      "../../src/services/prompt-processor.service"
    )
    PromptProcessorService = module.PromptProcessorService
  })

  it("should replace empty {{products}} with warning message", async () => {
    const processor = new PromptProcessorService()
    const promptWithProducts = "Available products: {{products}}"

    const result = await processor.preProcessPrompt(
      promptWithProducts,
      "workspace-id",
      {},
      {
        faqs: "",
        products: "",
        categories: "",
        services: "",
        offers: "",
      }
    )

    expect(result).toContain("CATALOGO VUOTO")
    expect(result).toContain("Non ci sono prodotti")
  })

  it("should replace empty {{categories}} with warning message", async () => {
    const processor = new PromptProcessorService()
    const promptWithCategories = "Categories: {{categories}}"

    const result = await processor.preProcessPrompt(
      promptWithCategories,
      "workspace-id",
      {},
      {
        faqs: "",
        products: "",
        categories: "",
        services: "",
        offers: "",
      }
    )

    expect(result).toContain("Non abbiamo categorie")
  })

  it("should replace empty {{services}} with warning message", async () => {
    const processor = new PromptProcessorService()
    const promptWithServices = "Services: {{services}}"

    const result = await processor.preProcessPrompt(
      promptWithServices,
      "workspace-id",
      {},
      {
        faqs: "",
        products: "",
        categories: "",
        services: "",
        offers: "",
      }
    )

    expect(result).toContain("Non abbiamo servizi")
  })

  it("should replace empty {{offers}} with warning message", async () => {
    const processor = new PromptProcessorService()
    const promptWithOffers = "Offers: {{offers}}"

    const result = await processor.preProcessPrompt(
      promptWithOffers,
      "workspace-id",
      {},
      {
        faqs: "",
        products: "",
        categories: "",
        services: "",
        offers: "",
      }
    )

    expect(result).toContain("Non abbiamo offerte")
  })

  it("should keep placeholder when FAQ is empty", async () => {
    const processor = new PromptProcessorService()
    const promptWithFaq = "FAQ: {{faq}}"

    const result = await processor.preProcessPrompt(
      promptWithFaq,
      "workspace-id",
      {},
      {
        faqs: "",
        products: "",
        categories: "",
        services: "",
        offers: "",
      }
    )

    // Changed behavior: empty placeholders remain as-is
    expect(result).toContain("{{faq}}")
  })

  it("should keep real content when data exists", async () => {
    const processor = new PromptProcessorService()
    const promptWithProducts = "Products: {{products}}"

    const result = await processor.preProcessPrompt(
      promptWithProducts,
      "workspace-id",
      {},
      {
        faqs: "",
        products: "Mozzarella €5.00\nParmigiano €10.00",
        categories: "",
        services: "",
        offers: "",
      }
    )

    expect(result).toContain("Mozzarella")
    expect(result).toContain("Parmigiano")
    expect(result).not.toContain("CATALOGO VUOTO")
  })

  it("should inject allowed external links list when configured", async () => {
    const processor = new PromptProcessorService()
    const prompt = "Security rules:\n{{ALLOWED_EXTERNAL_LINKS}}"

    const result = await processor.preProcessPrompt(
      prompt,
      "workspace-id",
      {},
      {
        faqs: "",
        products: "",
        categories: "",
        services: "",
        offers: "",
      },
      undefined,
      {
        allowedExternalLinks: ["example.com", "stripe.com"],
      }
    )

    expect(result).toContain("Domini autorizzati per link esterni:")
    expect(result).toContain("- example.com")
    expect(result).toContain("- stripe.com")
    expect(result).toContain("NON includere MAI link")
  })

  it("should block all external links when whitelist is empty", async () => {
    const processor = new PromptProcessorService()
    const prompt = "Security rules:\n{{ALLOWED_EXTERNAL_LINKS}}"

    const result = await processor.preProcessPrompt(
      prompt,
      "workspace-id",
      {},
      {
        faqs: "",
        products: "",
        categories: "",
        services: "",
        offers: "",
      },
      undefined,
      {
        allowedExternalLinks: [],
      }
    )

    expect(result).toContain("NON includere MAI link esterni")
  })
})
