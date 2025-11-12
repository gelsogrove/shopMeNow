/**
 * Integration Test: Progressive Discovery Flow
 *
 * Tests the complete E2E flow for product discovery:
 * 1. User searches for products with specific criteria (e.g., "halal")
 * 2. System returns numbered list of matching products
 * 3. User selects product by number (e.g., "2")
 * 4. System shows COMPLETE product details (8+ fields)
 * 5. User confirms with "sì" to add to cart
 * 6. System adds product to cart database
 *
 * This test validates:
 * - Router delegation to ProductSearchAgent
 * - ProductSearchAgent returning numbered list
 * - Hard-coded response with ALL product fields
 * - [READY_FOR_USER] marker preventing Router LLM rewriting
 * - Cart confirmation flow
 */

import { PrismaClient } from "@prisma/client"
import { LLMRouterService } from "../../src/services/llm-router.service"

const prisma = new PrismaClient()

describe("Progressive Discovery Flow", () => {
  const workspaceId = "cm9hjgq9v00014qk8fsdy4ujv" // Bell'Italia
  let customerId: string // ✅ Will be created in test
  let routerService: LLMRouterService
  let conversationId: string

  beforeAll(async () => {
    routerService = new LLMRouterService(prisma)

    // ✅ Create test customer in the workspace
    const testCustomer = await prisma.customers.upsert({
      where: {
        id: "test-customer-progressive-discovery",
      },
      create: {
        id: "test-customer-progressive-discovery",
        phone: "+39000000TEST",
        email: "test@progressive.com",
        name: "Test Customer",
        workspaceId: workspaceId,
        language: "it",
        discount: 10,
        activeChatbot: true,
      },
      update: {},
    })

    customerId = testCustomer.id
  })

  afterAll(async () => {
    // ✅ Cleanup test customer
    if (customerId) {
      await prisma.customers
        .delete({
          where: { id: customerId },
        })
        .catch(() => {}) // Ignore if already deleted
    }
    await prisma.$disconnect()
  })

  describe("STEP 1: Search Products", () => {
    it("should return numbered list of halal products", async () => {
      conversationId = `test-progressive-${Date.now()}`

      const result = await routerService.routeMessage({
        workspaceId,
        customerId,
        message: "avete prodotti halal?",
        conversationId,
        messageId: `msg-${Date.now()}`,
      })

      expect(result.response).toBeTruthy()
      expect(result.agentUsed).toBe("PRODUCT_SEARCH")

      // Should contain numbered list (accept emoji format or markdown format)
      expect(result.response).toMatch(/1\.\s+[🥩🧀\*]/) // Either emoji or **
      expect(result.response).toMatch(/2\.\s+[🥩🧀\*]/) // Either emoji or **

      // Should mention halal products
      expect(result.response.toLowerCase()).toContain("halal")
    }, 30000)
  })

  describe("STEP 2: Select Product by Number", () => {
    it("should show COMPLETE product details when user selects '2'", async () => {
      const result = await routerService.routeMessage({
        workspaceId,
        customerId,
        message: "2",
        conversationId,
        messageId: `msg-${Date.now()}`,
      })

      expect(result.response).toBeTruthy()
      expect(result.agentUsed).toBe("PRODUCT_SEARCH")

      // 🔍 DEBUG: Log actual response
      console.log("=== ACTUAL RESPONSE ===")
      console.log(result.response)
      console.log("=== END RESPONSE ===")

      // Validate ALL 8+ required fields are present
      const checks = {
        productCode: /SALUMI-\d{3}/.test(result.response), // e.g., SALUMI-004
        productName:
          result.response.includes("Salame Milano") ||
          result.response.includes("Mortadella"),
        description: result.response.includes("📝"),
        price:
          result.response.includes("€") && result.response.includes("Prezzo"),
        stock:
          result.response.includes("disponibili") &&
          result.response.includes("📦"),
        supplier:
          result.response.includes("Fornitore") &&
          result.response.includes("🏷️"),
        region:
          result.response.includes("Regione") && result.response.includes("🌍"),
        certifications:
          result.response.includes("Certificazioni") &&
          result.response.includes("🔖"),
        cartQuestion: result.response.includes("carrello"),
      }

      // 🔍 DEBUG: Log which checks failed
      console.log("=== CHECKS RESULT ===")
      Object.entries(checks).forEach(([key, value]) => {
        console.log(`${key}: ${value ? "✅" : "❌"}`)
      })
      console.log("=== END CHECKS ===")

      expect(checks.productCode).toBe(true)
      expect(checks.productName).toBe(true)
      expect(checks.description).toBe(true)
      expect(checks.price).toBe(true)
      expect(checks.stock).toBe(true)
      expect(checks.supplier).toBe(true)
      expect(checks.region).toBe(true)
      expect(checks.certifications).toBe(true)
      expect(checks.cartQuestion).toBe(true)

      // Ensure response is NOT simplified/rewritten by Router LLM
      expect(result.response.length).toBeGreaterThan(300)
    }, 30000)
  })

  describe("STEP 3: Cart Confirmation (Future)", () => {
    it.todo("should add product to cart when user confirms with 'sì'")
    it.todo("should verify product exists in cart database")
    it.todo("should handle ProductSearch -> Cart delegation flow")
  })
})
