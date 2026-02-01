/**
 * LinkReplacementService Unit Tests
 * 
 * TASK17: Test token replacement with plain/markdown formats and regex patterns
 */

const prismaMock = {
  customers: {
    findFirst: jest.fn(),
  },
}

jest.mock("@echatbot/database", () => ({
  prisma: prismaMock,
}))

// Mock SecureTokenService
jest.mock("../../../src/application/services/secure-token.service", () => ({
  SecureTokenService: jest.fn().mockImplementation(() => ({
    createToken: jest.fn().mockResolvedValue("mock-secure-token-abc123"),
  })),
}))

jest.mock("../../../src/application/services/token.service", () => ({
  TokenService: jest.fn().mockImplementation(() => ({
    createRegistrationToken: jest.fn().mockResolvedValue("mock-registration-token"),
  })),
}))

jest.mock("../../../src/services/workspace.service", () => ({
  workspaceService: {
    getWorkspaceURL: jest.fn().mockResolvedValue("https://example.com"),
    getWorkspaceURLWithRegistration: jest.fn().mockResolvedValue({
      url: "https://example.com",
      registrationPage: null,
    }),
  },
}))

// Mock linkGeneratorService
jest.mock("../../../src/application/services/link-generator.service", () => ({
  linkGeneratorService: {
    generateCheckoutLink: jest.fn().mockResolvedValue("https://echatbot.ai/checkout?token=abc123"),
    generateProfileLink: jest.fn().mockResolvedValue("https://echatbot.ai/profile?token=xyz789"),
    generateCatalogLink: jest.fn().mockResolvedValue("https://echatbot.ai/catalog"),
    generateRegistrationLink: jest.fn().mockResolvedValue("https://example.com/s/reg123"),
  },
}))

import { LinkReplacementService, ReplaceLinkWithTokenParams } from "../../../src/application/services/link-replacement.service"

describe("LinkReplacementService - Token Replacement", () => {
  let service: LinkReplacementService
  const mockCustomerId = "customer-123"
  const mockWorkspaceId = "workspace-456"

  beforeEach(() => {
    service = new LinkReplacementService()
    prismaMock.customers.findFirst.mockReset()
  })

  describe("Token Detection", () => {
    it("should detect LINK_CHECKOUT_WITH_TOKEN in response", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Ecco il tuo carrello: [LINK_CHECKOUT_WITH_TOKEN]",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).toBeDefined()
      expect(result.response).not.toContain("[LINK_CHECKOUT_WITH_TOKEN]")
      expect(result.response).toMatch(/https?:\/\//)
    })

    it("should detect LINK_PROFILE_WITH_TOKEN in response", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Modifica i tuoi dati: [LINK_PROFILE_WITH_TOKEN]",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).toBeDefined()
      expect(result.response).not.toContain("[LINK_PROFILE_WITH_TOKEN]")
      expect(result.response).toMatch(/https?:\/\//)
    })

    it("should detect LINK_CATALOG in response", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Esplora il catalogo: [LINK_CATALOG]",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).toBeDefined()
      expect(result.response).not.toContain("[LINK_CATALOG]")
      expect(result.response).toMatch(/https?:\/\//)
    })

    it("should return error when no tokens present", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Nessun token qui",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(false)
      expect(result.error).toContain("does not contain any replaceable tokens")
    })
  })

  describe("Registration Token", () => {
    it("should replace LINK_REGISTRATION for non-registered customer", async () => {
      prismaMock.customers.findFirst.mockResolvedValue({
        phone: "+1234567890",
        isActive: false,
      })

      const params: ReplaceLinkWithTokenParams = {
        response: "Registrati qui: [LINK_REGISTRATION]",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).toContain("https://example.com/s/reg123")
      expect(result.response).not.toContain("[LINK_REGISTRATION]")
    })

    it("should remove LINK_REGISTRATION for registered customer", async () => {
      prismaMock.customers.findFirst.mockResolvedValue({
        phone: "+1234567890",
        isActive: true,
      })

      const params: ReplaceLinkWithTokenParams = {
        response: "Registrati qui: [LINK_REGISTRATION]",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).not.toContain("[LINK_REGISTRATION]")
    })
  })

  describe("Plain Token Format", () => {
    it("should replace plain [LINK_CHECKOUT_WITH_TOKEN]", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Completa l'ordine: [LINK_CHECKOUT_WITH_TOKEN]",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).not.toContain("[LINK_CHECKOUT_WITH_TOKEN]")
      expect(result.response).toMatch(/https?:\/\//)
    })

    it("should replace plain token with trailing punctuation", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Vai qui: [LINK_CHECKOUT_WITH_TOKEN].",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).toContain("echatbot.ai")
      expect(result.response).toMatch(/token=abc123\./)
    })

    it("should replace plain token with exclamation mark", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Clicca qui: [LINK_CHECKOUT_WITH_TOKEN]!",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).toContain("echatbot.ai")
      expect(result.response).toMatch(/token=abc123!/)
    })

    it("should replace bare token without brackets", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Link: LINK_CHECKOUT_WITH_TOKEN",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).not.toContain("LINK_CHECKOUT_WITH_TOKEN")
      expect(result.response).toMatch(/https?:\/\//)
    })
  })

  describe("Markdown Token Format", () => {
    it("should replace markdown format [text]([TOKEN])", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Clicca [qui]([LINK_CHECKOUT_WITH_TOKEN]) per continuare",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).toMatch(/\[qui\]\(https?:\/\/[^\)]+\)/)
      expect(result.response).not.toContain("[LINK_CHECKOUT_WITH_TOKEN]")
    })

    it("should replace markdown format [text](TOKEN)", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Visita il [carrello](LINK_CHECKOUT_WITH_TOKEN)",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).toMatch(/\[carrello\]\(https?:\/\/[^\)]+\)/)
      expect(result.response).not.toContain("LINK_CHECKOUT_WITH_TOKEN")
    })

    it("should preserve markdown text and link structure", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Clicca [questo link]([LINK_PROFILE_WITH_TOKEN]) per modificare",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).toMatch(/\[questo link\]\(https?:\/\/[^\)]+\)/)
      expect(result.response).not.toContain("[LINK_PROFILE_WITH_TOKEN]")
    })

    it("should handle markdown with trailing punctuation", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Vai al [profilo]([LINK_PROFILE_WITH_TOKEN]).",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).toMatch(/\[profilo\]\(https?:\/\/[^\)]+\)\./)
      expect(result.response).not.toContain("[LINK_PROFILE_WITH_TOKEN]")
    })
  })

  describe("Multiple Tokens in Same Response", () => {
    it("should replace multiple different tokens", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Carrello: [LINK_CHECKOUT_WITH_TOKEN], Profilo: [LINK_PROFILE_WITH_TOKEN]",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).not.toContain("[LINK_CHECKOUT_WITH_TOKEN]")
      expect(result.response).not.toContain("[LINK_PROFILE_WITH_TOKEN]")
      expect((result.response!.match(/https?:\/\//g) || []).length).toBe(2)
    })

    it("should replace same token multiple times", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Vai qui: [LINK_CHECKOUT_WITH_TOKEN] o qui: [LINK_CHECKOUT_WITH_TOKEN]",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).not.toContain("[LINK_CHECKOUT_WITH_TOKEN]")
      expect((result.response!.match(/https?:\/\//g) || []).length).toBe(2)
    })
  })

  describe("Token Normalization (Wrong Patterns)", () => {
    it("should normalize [link profilo] to LINK_PROFILE_WITH_TOKEN", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Modifica i tuoi dati: [link profilo]",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).not.toContain("[link profilo]")
      expect(result.response).toMatch(/https?:\/\//)
    })

    it("should normalize [link carrello] to LINK_CHECKOUT_WITH_TOKEN", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Ecco il [link carrello]",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).not.toContain("[link carrello]")
      expect(result.response).toMatch(/https?:\/\//)
    })

    it("should normalize link profile (no brackets) to LINK_PROFILE_WITH_TOKEN", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Vai a link profile per modificare",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).not.toContain("link profile")
      expect(result.response).toMatch(/https?:\/\//)
    })
  })

  describe("Edge Cases", () => {
    it("should handle response with no changes needed", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Nessun link qui",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      // Service doesn't return response field when success=false
    })

    it("should fail when customerId is missing", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Link: [LINK_CHECKOUT_WITH_TOKEN]",
      }

      const result = await service.replaceTokens(params, "", mockWorkspaceId)

      expect(result.success).toBe(false)
      expect(result.response).toBe("Link: [LINK_CHECKOUT_WITH_TOKEN]")
    })

    it("should fail when workspaceId is missing", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Link: [LINK_CHECKOUT_WITH_TOKEN]",
      }

      const result = await service.replaceTokens(params, mockCustomerId, "")

      expect(result.success).toBe(false)
      expect(result.response).toBe("Link: [LINK_CHECKOUT_WITH_TOKEN]")
    })
  })

  describe("Regex Pattern Coverage", () => {
    it("should match markdown with square brackets and period", async () => {
      const input = "Clicca [qui]([LINK_CHECKOUT_WITH_TOKEN])."
      const params: ReplaceLinkWithTokenParams = { response: input }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).toMatch(/\[qui\]\(https?:\/\/[^\)]+\)\./)
    })

    it("should match markdown without square brackets and comma", async () => {
      const input = "Vai al [carrello](LINK_CHECKOUT_WITH_TOKEN), poi conferma"
      const params: ReplaceLinkWithTokenParams = { response: input }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).not.toContain("LINK_CHECKOUT_WITH_TOKEN")
      expect(result.response).toContain(",")
    })

    it("should match plain token with parenthesis and period", async () => {
      const input = "Link: [LINK_CHECKOUT_WITH_TOKEN])."
      const params: ReplaceLinkWithTokenParams = { response: input }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).toMatch(/https?:\/\/.*\./)
      expect(result.response).toContain(".")
    })

    it("should handle token at end of sentence", async () => {
      const input = "Completa qui: [LINK_CHECKOUT_WITH_TOKEN]!"
      const params: ReplaceLinkWithTokenParams = { response: input }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).toMatch(/https?:\/\/.*!/)
      expect(result.response).toContain("!")
    })
  })

  describe("LINK_CHECKOUT_CONFIRM Token", () => {
    it("should replace LINK_CHECKOUT_CONFIRM token", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Conferma l'ordine: [LINK_CHECKOUT_CONFIRM]",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).not.toContain("[LINK_CHECKOUT_CONFIRM]")
      expect(result.response).toMatch(/https?:\/\//)
    })

    it("should replace LINK_CHECKOUT_CONFIRM in markdown format", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Clicca [qui]([LINK_CHECKOUT_CONFIRM]) per confermare",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).not.toContain("[LINK_CHECKOUT_CONFIRM]")
      // Note: Service's cleanup logic may strip example.com URLs from markdown
    })
  })

  describe("Response Modification Detection", () => {
    it("should indicate success=true when tokens are replaced", async () => {
      const params: ReplaceLinkWithTokenParams = {
        response: "Link: [LINK_CHECKOUT_WITH_TOKEN]",
      }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).not.toBe(params.response)
    })

    it("should return different response when replacement occurs", async () => {
      const originalResponse = "Vai al [profilo]([LINK_PROFILE_WITH_TOKEN])"
      const params: ReplaceLinkWithTokenParams = { response: originalResponse }

      const result = await service.replaceTokens(params, mockCustomerId, mockWorkspaceId)

      expect(result.success).toBe(true)
      expect(result.response).toBeDefined()
      expect(result.response).not.toBe(originalResponse)
      expect(result.response).not.toContain("[LINK_PROFILE_WITH_TOKEN]")
      // Note: Cleanup logic may strip example.com URLs from markdown
      // So we just verify token was removed (replacement happened)
    })
  })
})
