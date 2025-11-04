/**
 * Unit Test: Link Replacement Service - Multiple Token Formats
 *
 * Tests that LinkReplacementService correctly handles all token formats:
 * - [LINK_TOKEN] (plain)
 * - (LINK_TOKEN) (bare)
 * - [text](LINK_TOKEN) (Markdown without square brackets)
 * - [text]([LINK_TOKEN]) (Markdown with square brackets)
 */

import { linkGeneratorService } from "../../application/services/link-generator.service"
import { LinkReplacementService } from "../../application/services/link-replacement.service"

// Mock dependencies
jest.mock("../../application/services/link-generator.service", () => ({
  linkGeneratorService: {
    generateOrdersLink: jest.fn(),
    generateCheckoutLink: jest.fn(),
    generateProfileLink: jest.fn(),
    generateShortLink: jest.fn(),
  },
}))

// Mock logger properly
jest.mock("../../utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

describe("LinkReplacementService - Token Format Support", () => {
  let service: LinkReplacementService
  const mockCustomerId = "customer-123"
  const mockWorkspaceId = "workspace-123"
  const mockOrdersLink = "http://localhost:3000/s/abc123"
  const mockCheckoutLink = "http://localhost:3000/s/xyz456"
  const mockProfileLink = "http://localhost:3000/s/def789"
  const mockCatalogLink = "http://localhost:3000/s/cat999"

  beforeEach(() => {
    jest.clearAllMocks()
    service = new LinkReplacementService()

    // Setup mocks
    ;(linkGeneratorService.generateOrdersLink as jest.Mock).mockResolvedValue(
      mockOrdersLink
    )
    ;(linkGeneratorService.generateCheckoutLink as jest.Mock).mockResolvedValue(
      mockCheckoutLink
    )
    ;(linkGeneratorService.generateProfileLink as jest.Mock).mockResolvedValue(
      mockProfileLink
    )
    ;(linkGeneratorService.generateShortLink as jest.Mock).mockResolvedValue(
      mockCatalogLink
    )
  })

  describe("LINK_ORDERS_WITH_TOKEN", () => {
    it("should replace plain [LINK_ORDERS_WITH_TOKEN]", async () => {
      const response = "Here are your orders: [LINK_ORDERS_WITH_TOKEN]"

      const result = await service.replaceTokens(
        { response },
        mockCustomerId,
        mockWorkspaceId
      )

      expect(result.success).toBe(true)
      expect(result.response).toContain(mockOrdersLink)
      expect(result.response).not.toContain("LINK_ORDERS_WITH_TOKEN")
    })

    it("should replace Markdown [here](LINK_ORDERS_WITH_TOKEN)", async () => {
      const response = "Click [here](LINK_ORDERS_WITH_TOKEN) to view"

      const result = await service.replaceTokens(
        { response },
        mockCustomerId,
        mockWorkspaceId
      )

      expect(result.success).toBe(true)
      expect(result.response).toContain(`[here](${mockOrdersLink})`)
      expect(result.response).not.toContain("LINK_ORDERS_WITH_TOKEN")
    })

    it("should handle Markdown with trailing period [here](LINK_ORDERS_WITH_TOKEN).", async () => {
      const response = "Click [here](LINK_ORDERS_WITH_TOKEN)."

      const result = await service.replaceTokens(
        { response },
        mockCustomerId,
        mockWorkspaceId
      )

      expect(result.success).toBe(true)
      expect(result.response).toBe(`Click [here](${mockOrdersLink}).`)
      expect(result.response).not.toContain("LINK_ORDERS_WITH_TOKEN")
      // Period should be AFTER the closing parenthesis, not inside URL
      expect(result.response).not.toMatch(/\)\.\)/)
    })

    it("should replace Markdown [here]([LINK_ORDERS_WITH_TOKEN])", async () => {
      const response = "Click [here]([LINK_ORDERS_WITH_TOKEN]) to view"

      const result = await service.replaceTokens(
        { response },
        mockCustomerId,
        mockWorkspaceId
      )

      expect(result.success).toBe(true)
      expect(result.response).toContain(`[here](${mockOrdersLink})`)
      expect(result.response).not.toContain("LINK_ORDERS_WITH_TOKEN")
    })

    it("should replace bare LINK_ORDERS_WITH_TOKEN", async () => {
      const response = "Your link: LINK_ORDERS_WITH_TOKEN is here"

      const result = await service.replaceTokens(
        { response },
        mockCustomerId,
        mockWorkspaceId
      )

      expect(result.success).toBe(true)
      expect(result.response).toContain(mockOrdersLink)
      expect(result.response).not.toContain("LINK_ORDERS_WITH_TOKEN")
    })

    it("should handle [LINK_ORDERS_WITH_TOKEN] with trailing punctuation", async () => {
      const response = "Check [LINK_ORDERS_WITH_TOKEN]. Done!"

      const result = await service.replaceTokens(
        { response },
        mockCustomerId,
        mockWorkspaceId
      )

      expect(result.success).toBe(true)
      expect(result.response).toContain(`${mockOrdersLink}.`)
      expect(result.response).not.toContain("LINK_ORDERS_WITH_TOKEN")
    })
  })

  describe("LINK_CHECKOUT_WITH_TOKEN", () => {
    it("should replace plain [LINK_CHECKOUT_WITH_TOKEN]", async () => {
      const response = "Your cart: [LINK_CHECKOUT_WITH_TOKEN]"

      const result = await service.replaceTokens(
        { response },
        mockCustomerId,
        mockWorkspaceId
      )

      expect(result.success).toBe(true)
      expect(result.response).toContain(mockCheckoutLink)
      expect(result.response).not.toContain("LINK_CHECKOUT_WITH_TOKEN")
    })

    it("should replace Markdown [click](LINK_CHECKOUT_WITH_TOKEN)", async () => {
      const response = "Checkout [click](LINK_CHECKOUT_WITH_TOKEN) now"

      const result = await service.replaceTokens(
        { response },
        mockCustomerId,
        mockWorkspaceId
      )

      expect(result.success).toBe(true)
      expect(result.response).toContain(`[click](${mockCheckoutLink})`)
      expect(result.response).not.toContain("LINK_CHECKOUT_WITH_TOKEN")
    })

    it("should replace Markdown [click]([LINK_CHECKOUT_WITH_TOKEN])", async () => {
      const response = "Checkout [click]([LINK_CHECKOUT_WITH_TOKEN]) now"

      const result = await service.replaceTokens(
        { response },
        mockCustomerId,
        mockWorkspaceId
      )

      expect(result.success).toBe(true)
      expect(result.response).toContain(`[click](${mockCheckoutLink})`)
      expect(result.response).not.toContain("LINK_CHECKOUT_WITH_TOKEN")
    })
  })

  describe("LINK_PROFILE_WITH_TOKEN", () => {
    it("should replace plain [LINK_PROFILE_WITH_TOKEN]", async () => {
      const response = "Your profile: [LINK_PROFILE_WITH_TOKEN]"

      const result = await service.replaceTokens(
        { response },
        mockCustomerId,
        mockWorkspaceId
      )

      expect(result.success).toBe(true)
      expect(result.response).toContain(mockProfileLink)
      expect(result.response).not.toContain("LINK_PROFILE_WITH_TOKEN")
    })

    it("should replace Markdown [profile](LINK_PROFILE_WITH_TOKEN)", async () => {
      const response = "View [profile](LINK_PROFILE_WITH_TOKEN) here"

      const result = await service.replaceTokens(
        { response },
        mockCustomerId,
        mockWorkspaceId
      )

      expect(result.success).toBe(true)
      expect(result.response).toContain(`[profile](${mockProfileLink})`)
      expect(result.response).not.toContain("LINK_PROFILE_WITH_TOKEN")
    })
  })

  describe("LINK_CATALOG", () => {
    it("should replace plain [LINK_CATALOG]", async () => {
      const response = "Catalog: [LINK_CATALOG]"

      const result = await service.replaceTokens(
        { response },
        mockCustomerId,
        mockWorkspaceId
      )

      expect(result.success).toBe(true)
      expect(result.response).toContain(mockCatalogLink)
      expect(result.response).not.toContain("LINK_CATALOG")
    })

    it("should replace Markdown [catalog](LINK_CATALOG)", async () => {
      const response = "Download [catalog](LINK_CATALOG) PDF"

      const result = await service.replaceTokens(
        { response },
        mockCustomerId,
        mockWorkspaceId
      )

      expect(result.success).toBe(true)
      expect(result.response).toContain(`[catalog](${mockCatalogLink})`)
      expect(result.response).not.toContain("LINK_CATALOG")
    })
  })

  describe("Multiple tokens in same response", () => {
    it("should replace multiple different token types", async () => {
      const response = `
        Orders: [here](LINK_ORDERS_WITH_TOKEN)
        Cart: [LINK_CHECKOUT_WITH_TOKEN]
        Profile: [view](LINK_PROFILE_WITH_TOKEN)
        Catalog: LINK_CATALOG
      `

      const result = await service.replaceTokens(
        { response },
        mockCustomerId,
        mockWorkspaceId
      )

      expect(result.success).toBe(true)
      expect(result.response).toContain(mockOrdersLink)
      expect(result.response).toContain(mockCheckoutLink)
      expect(result.response).toContain(mockProfileLink)
      expect(result.response).toContain(mockCatalogLink)
      expect(result.response).not.toContain("LINK_ORDERS_WITH_TOKEN")
      expect(result.response).not.toContain("LINK_CHECKOUT_WITH_TOKEN")
      expect(result.response).not.toContain("LINK_PROFILE_WITH_TOKEN")
      expect(result.response).not.toContain("LINK_CATALOG")
    })
  })

  describe("Real-world WhatsApp scenario", () => {
    it("should handle Router-style Markdown response", async () => {
      const response = `Here are your last 3 orders:

1. Order #ORD-048-2025-9
   Total: €45.50

2. Order #ORD-047-2025-9
   Total: €32.00

3. Order #ORD-046-2025-9
   Total: €18.50

👉 You can view all your order history [here](LINK_ORDERS_WITH_TOKEN).

⏰ The link is valid for 15 minutes.`

      const result = await service.replaceTokens(
        { response },
        mockCustomerId,
        mockWorkspaceId
      )

      expect(result.success).toBe(true)
      expect(result.response).toContain(`[here](${mockOrdersLink}).`)
      expect(result.response).not.toContain("LINK_ORDERS_WITH_TOKEN")
      expect(result.response).toContain("Order #ORD-048-2025-9")
      expect(result.response).toContain("⏰ The link is valid for 15 minutes")

      // Verify period is AFTER closing parenthesis, not part of URL
      expect(result.response).toMatch(/\[here\]\(http:\/\/[^\)]+\)\./)
      expect(result.response).not.toContain(`${mockOrdersLink}.)`)
    })

    it("should handle trailing period correctly - prevent 404", async () => {
      const response = "View [here](LINK_ORDERS_WITH_TOKEN)."

      const result = await service.replaceTokens(
        { response },
        mockCustomerId,
        mockWorkspaceId
      )

      expect(result.success).toBe(true)
      // Period should be AFTER the link, not part of it
      expect(result.response).toBe(`View [here](${mockOrdersLink}).`)
      // URL should NOT end with a period
      expect(mockOrdersLink).not.toMatch(/\.$/)
    })
  })
})
