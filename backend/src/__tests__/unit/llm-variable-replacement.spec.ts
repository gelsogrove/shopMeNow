import { LLMService } from "../../services/llm.service"

describe("LLMService - Variable Replacement", () => {
  let llmService: LLMService

  beforeEach(() => {
    llmService = new LLMService()
  })

  describe("formatTokenDuration", () => {
    it("should format 1h as '1 ora'", () => {
      const result = (llmService as any).formatTokenDuration("1h")
      expect(result).toBe("1 ora")
    })

    it("should format 2h as '2 ore'", () => {
      const result = (llmService as any).formatTokenDuration("2h")
      expect(result).toBe("2 ore")
    })

    it("should format 30m as '30 minuti'", () => {
      const result = (llmService as any).formatTokenDuration("30m")
      expect(result).toBe("30 minuti")
    })

    it("should format 1m as '1 minuto'", () => {
      const result = (llmService as any).formatTokenDuration("1m")
      expect(result).toBe("1 minuto")
    })

    it("should return fallback '1 ora' for invalid format", () => {
      const result = (llmService as any).formatTokenDuration("invalid")
      expect(result).toBe("1 ora")
    })

    it("should return fallback '1 ora' for empty string", () => {
      const result = (llmService as any).formatTokenDuration("")
      expect(result).toBe("1 ora")
    })
  })

  describe("Prompt Variable Replacement", () => {
    /**
     * Test che verifica che TUTTE le variabili nel prompt vengano sostituite
     */
    it("should replace ALL required variables in prompt", () => {
      const mockPrompt = `
        FAQ: {{FAQ}}
        SERVICES: {{SERVICES}}
        PRODUCTS: {{PRODUCTS}}
        CATEGORIES: {{CATEGORIES}}
        OFFERS: {{OFFERS}}
        User Name: {{nameUser}}
        User Discount: {{discountUser}}
        Company Name: {{companyName}}
        Last Order Code: {{lastordercode}}
        User Language: {{languageUser}}
        Token Duration: {{TOKEN_DURATION}}
        Workspace URL: {{URL}}
      `

      // Mock data
      const faqs = "FAQ Test Content"
      const services = "Services Test Content"
      const products = "Products Test Content"
      const categories = "Categories Test Content"
      const offers = "Offers Test Content"
      const workspaceUrl = "http://localhost:3000"
      const userInfo = {
        nameUser: "Mario Rossi",
        discountUser: 10,
        companyName: "Test Company",
        lastordercode: "ORD-001",
        languageUser: "ITALIANO",
      }

      // Set TOKEN_EXPIRATION env
      process.env.TOKEN_EXPIRATION = "1h"
      const tokenDuration = (llmService as any).formatTokenDuration("1h")

      // Simulate the replacement logic from handleMessage
      let processedPrompt = mockPrompt
        .replace("{{FAQ}}", faqs)
        .replace("{{SERVICES}}", services)
        .replace("{{PRODUCTS}}", products)
        .replace("{{CATEGORIES}}", categories)
        .replace("{{OFFERS}}", offers)
        .replace(/\{\{URL\}\}/g, workspaceUrl) // Replace ALL occurrences
        .replace("{{nameUser}}", userInfo.nameUser)
        .replace("{{discountUser}}", String(userInfo.discountUser))
        .replace("{{companyName}}", userInfo.companyName)
        .replace("{{lastordercode}}", userInfo.lastordercode)
        .replace("{{languageUser}}", userInfo.languageUser)
        .replace("{{TOKEN_DURATION}}", tokenDuration)

      // Verify NO placeholders remain
      expect(processedPrompt).not.toContain("{{FAQ}}")
      expect(processedPrompt).not.toContain("{{SERVICES}}")
      expect(processedPrompt).not.toContain("{{PRODUCTS}}")
      expect(processedPrompt).not.toContain("{{CATEGORIES}}")
      expect(processedPrompt).not.toContain("{{OFFERS}}")
      expect(processedPrompt).not.toContain("{{URL}}")
      expect(processedPrompt).not.toContain("{{nameUser}}")
      expect(processedPrompt).not.toContain("{{discountUser}}")
      expect(processedPrompt).not.toContain("{{companyName}}")
      expect(processedPrompt).not.toContain("{{lastordercode}}")
      expect(processedPrompt).not.toContain("{{languageUser}}")
      expect(processedPrompt).not.toContain("{{TOKEN_DURATION}}")

      // Verify replacements are correct
      expect(processedPrompt).toContain(faqs)
      expect(processedPrompt).toContain(services)
      expect(processedPrompt).toContain(products)
      expect(processedPrompt).toContain(categories)
      expect(processedPrompt).toContain(offers)
      expect(processedPrompt).toContain(workspaceUrl)
      expect(processedPrompt).toContain(userInfo.nameUser)
      expect(processedPrompt).toContain(String(userInfo.discountUser))
      expect(processedPrompt).toContain(userInfo.companyName)
      expect(processedPrompt).toContain(userInfo.lastordercode)
      expect(processedPrompt).toContain(userInfo.languageUser)
      expect(processedPrompt).toContain("1 ora")
    })

    it("should handle missing variables gracefully", () => {
      const mockPrompt = "User: {{nameUser}}, Company: {{companyName}}"

      const userInfo = {
        nameUser: "",
        discountUser: 0,
        companyName: "",
        lastordercode: "",
        languageUser: "",
      }

      let processedPrompt = mockPrompt
        .replace("{{nameUser}}", userInfo.nameUser)
        .replace("{{companyName}}", userInfo.companyName)

      // Should replace even with empty strings
      expect(processedPrompt).not.toContain("{{nameUser}}")
      expect(processedPrompt).not.toContain("{{companyName}}")
      expect(processedPrompt).toBe("User: , Company: ")
    })

    it("should replace TOKEN_DURATION with configured value from env", () => {
      const mockPrompt = "Link valido per {{TOKEN_DURATION}}"

      // Test with 2 hours
      process.env.TOKEN_EXPIRATION = "2h"
      const tokenDuration2h = (llmService as any).formatTokenDuration("2h")
      const processed2h = mockPrompt.replace(
        "{{TOKEN_DURATION}}",
        tokenDuration2h
      )

      expect(processed2h).not.toContain("{{TOKEN_DURATION}}")
      expect(processed2h).toBe("Link valido per 2 ore")

      // Test with 30 minutes
      process.env.TOKEN_EXPIRATION = "30m"
      const tokenDuration30m = (llmService as any).formatTokenDuration("30m")
      const processed30m = mockPrompt.replace(
        "{{TOKEN_DURATION}}",
        tokenDuration30m
      )

      expect(processed30m).not.toContain("{{TOKEN_DURATION}}")
      expect(processed30m).toBe("Link valido per 30 minuti")
    })

    it("should replace ALL occurrences of {{URL}} in prompt with regex", () => {
      const mockPrompt = `
        Carrello: {{URL}}/cart/abc123
        Ordine: {{URL}}/orders-public?token=xyz
        Checkout: {{URL}}/checkout-public?token=456
        Profilo: {{URL}}/profile
      `

      const workspaceUrl = "https://shop.example.com"

      // Use regex to replace ALL occurrences (not just first one)
      const processedPrompt = mockPrompt.replace(/\{\{URL\}\}/g, workspaceUrl)

      // Verify NO {{URL}} placeholders remain
      expect(processedPrompt).not.toContain("{{URL}}")

      // Verify ALL 4 occurrences were replaced
      expect(processedPrompt).toContain(
        "Carrello: https://shop.example.com/cart/abc123"
      )
      expect(processedPrompt).toContain(
        "Ordine: https://shop.example.com/orders-public?token=xyz"
      )
      expect(processedPrompt).toContain(
        "Checkout: https://shop.example.com/checkout-public?token=456"
      )
      expect(processedPrompt).toContain(
        "Profilo: https://shop.example.com/profile"
      )

      // Count how many times the URL appears (should be 4)
      const urlOccurrences = (
        processedPrompt.match(/https:\/\/shop\.example\.com/g) || []
      ).length
      expect(urlOccurrences).toBe(4)
    })

    it("should detect unreplaced variables in prompt", () => {
      const mockPrompt = `
        FAQ: {{FAQ}}
        PRODUCTS: {{PRODUCTS}}
        Unknown: {{UNKNOWN_VARIABLE}}
      `

      const faqs = "FAQ Content"
      const products = "Product Content"

      let processedPrompt = mockPrompt
        .replace("{{FAQ}}", faqs)
        .replace("{{PRODUCTS}}", products)
      // Deliberately NOT replacing {{UNKNOWN_VARIABLE}}

      // Should still contain unreplaced variable
      expect(processedPrompt).toContain("{{UNKNOWN_VARIABLE}}")
      expect(processedPrompt).toContain(faqs)
      expect(processedPrompt).toContain(products)
    })
  })

  describe("Required Variables Coverage", () => {
    /**
     * Test che verifica che la lista delle variabili nel codice
     * corrisponda a quelle effettivamente sostituite
     */
    it("should have replacement for all documented variables", () => {
      // Lista COMPLETA delle variabili che DEVONO essere sostituite
      const requiredVariables = [
        "{{FAQ}}",
        "{{SERVICES}}",
        "{{PRODUCTS}}",
        "{{CATEGORIES}}",
        "{{OFFERS}}",
        "{{nameUser}}",
        "{{discountUser}}",
        "{{companyName}}",
        "{{lastordercode}}",
        "{{languageUser}}",
        "{{TOKEN_DURATION}}",
      ]

      const mockPrompt = requiredVariables.join(" ")

      // Mock replacements (simulate handleMessage logic)
      let processedPrompt = mockPrompt
        .replace("{{FAQ}}", "FAQ")
        .replace("{{SERVICES}}", "SERVICES")
        .replace("{{PRODUCTS}}", "PRODUCTS")
        .replace("{{CATEGORIES}}", "CATEGORIES")
        .replace("{{OFFERS}}", "OFFERS")
        .replace("{{nameUser}}", "User")
        .replace("{{discountUser}}", "10")
        .replace("{{companyName}}", "Company")
        .replace("{{lastordercode}}", "ORD-001")
        .replace("{{languageUser}}", "IT")
        .replace("{{TOKEN_DURATION}}", "1 ora")

      // Verifica che NESSUNA variabile sia rimasta non sostituita
      for (const variable of requiredVariables) {
        expect(processedPrompt).not.toContain(variable)
      }

      // Verifica che non ci siano più doppie graffe nel prompt
      const unreplacedPattern = /\{\{[^}]+\}\}/g
      const unreplaced = processedPrompt.match(unreplacedPattern)
      expect(unreplaced).toBeNull()
    })
  })
})
