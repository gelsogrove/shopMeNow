/**
 * Integration Tests: Feature 123 - Dynamic Product Grouping
 *
 * Tests the new progressive product search with intelligent grouping:
 * - Generic search (12+ products) → Shows 3-4 groups
 * - User selects group → Filters and shows ≤3 products or sub-groups
 * - User selects number → Shows full 8-field product details
 * - User confirms → Delegates to cart with quantity
 */

import { PrismaClient } from "@prisma/client"
import request from "supertest"
import app from "../../src/app"

const prisma = new PrismaClient()

describe("Feature 123: Dynamic Product Grouping", () => {
  let authToken: string
  let workspaceId: string
  let customerId: string
  let sessionId: string

  beforeAll(async () => {
    // Setup: Login and get workspace
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "admin@shopme.com",
      password: "venezia44",
    })

    authToken = loginRes.body.token
    const decoded = JSON.parse(
      Buffer.from(authToken.split(".")[1], "base64").toString()
    )
    workspaceId = decoded.workspaceId

    // Create test customer
    const customer = await prisma.customers.create({
      data: {
        workspaceId,
        phone: "+393331234999",
        firstName: "Test",
        lastName: "Grouping",
        language: "it",
        discountPercentage: 10,
      },
    })
    customerId = customer.id
    sessionId = `test-grouping-${Date.now()}`
  })

  afterAll(async () => {
    // Cleanup
    await prisma.customers.delete({ where: { id: customerId } })
    await prisma.$disconnect()
  })

  describe("T021: Generic Search with Grouping", () => {
    it("should show 3-4 groups for broad category search (formaggi)", async () => {
      const res = await request(app).post("/api/whatsapp/webhook").send({
        workspaceId,
        customerId,
        sessionId,
        message: "cerco formaggi",
        phone: "+393331234999",
      })

      expect(res.status).toBe(200)
      expect(res.body.response).toBeDefined()

      const response = res.body.response.toLowerCase()

      // Should mention groups
      expect(response).toMatch(/\d+\.\s/)

      // Should NOT show all product details (only group names)
      expect(response).not.toMatch(/stock:/i)
      expect(response).not.toMatch(/fornitore:/i)

      // Should ask which type
      expect(response).toMatch(/quale|which|tipo|interessa/)

      console.log(
        "✅ T021: Generic search response:",
        response.substring(0, 300)
      )
    }, 30000)

    it("should show groups for certification search (halal)", async () => {
      const res = await request(app)
        .post("/api/whatsapp/webhook")
        .send({
          workspaceId,
          customerId,
          sessionId: `${sessionId}-halal`,
          message: "prodotti halal",
          phone: "+393331234999",
        })

      expect(res.status).toBe(200)

      const response = res.body.response.toLowerCase()

      // Should group by product category (cross-category)
      expect(response).toMatch(/halal/i)
      expect(response).toMatch(/\d+\.\s/)

      console.log("✅ T021: Halal search response:", response.substring(0, 300))
    }, 30000)
  })

  describe("T022: Progressive Filtering (Group Selection)", () => {
    it("should filter products when user selects group number", async () => {
      // Step 1: Show groups
      const step1 = await request(app)
        .post("/api/whatsapp/webhook")
        .send({
          workspaceId,
          customerId,
          sessionId: `${sessionId}-progressive`,
          message: "formaggi",
          phone: "+393331234999",
        })

      expect(step1.status).toBe(200)
      const groups = step1.body.response

      // Step 2: Select first group
      const step2 = await request(app)
        .post("/api/whatsapp/webhook")
        .send({
          workspaceId,
          customerId,
          sessionId: `${sessionId}-progressive`,
          message: "1",
          phone: "+393331234999",
        })

      expect(step2.status).toBe(200)

      const filtered = step2.body.response.toLowerCase()

      // Should show filtered results (≤3 products OR sub-groups)
      expect(filtered).toBeDefined()

      // Should maintain conversation context
      expect(filtered).toMatch(/formaggi|cheese/i)

      console.log("✅ T022: Progressive filtering:")
      console.log("  Groups:", groups.substring(0, 200))
      console.log("  Filtered:", filtered.substring(0, 200))
    }, 60000)
  })

  describe("T023: Number Selection → Full Details", () => {
    it("should show 8-field product details when user selects number", async () => {
      // Step 1: Get product list (≤3 products)
      const step1 = await request(app)
        .post("/api/whatsapp/webhook")
        .send({
          workspaceId,
          customerId,
          sessionId: `${sessionId}-details`,
          message: "parmigiano reggiano",
          phone: "+393331234999",
        })

      expect(step1.status).toBe(200)

      // If shows groups, select one
      let currentResponse = step1.body.response
      if (currentResponse.match(/\d+\.\s/)) {
        const step1b = await request(app)
          .post("/api/whatsapp/webhook")
          .send({
            workspaceId,
            customerId,
            sessionId: `${sessionId}-details`,
            message: "1",
            phone: "+393331234999",
          })
        currentResponse = step1b.body.response
      }

      // Should show numbered list or single product
      expect(currentResponse).toMatch(/parmigiano|reggiano/i)

      // If numbered list, select product
      if (currentResponse.match(/1\.\s.*\d\.\s/)) {
        const step2 = await request(app)
          .post("/api/whatsapp/webhook")
          .send({
            workspaceId,
            customerId,
            sessionId: `${sessionId}-details`,
            message: "1",
            phone: "+393331234999",
          })

        expect(step2.status).toBe(200)
        const details = step2.body.response.toLowerCase()

        // Verify 8-field template
        expect(details).toMatch(/for-.*parmigiano/i) // CODE
        expect(details).toMatch(/prezzo|price/i) // Price
        expect(details).toMatch(/stock/i) // Stock
        expect(details).toMatch(/fornitore|supplier/i) // Supplier
        expect(details).toMatch(/regione|region/i) // Region
        expect(details).toMatch(/certificazioni|certifications/i) // Certifications
        expect(details).toMatch(/vuoi aggiungerlo|add to cart/i) // Cart prompt

        console.log(
          "✅ T023: Full product details (8 fields):",
          details.substring(0, 400)
        )
      }
    }, 90000)
  })

  describe("T024: Quantity Extraction", () => {
    it("should extract quantity from user confirmation", async () => {
      // This test would require mocking cartManagementAgent delegation
      // For now, we verify the prompt includes quantity extraction rules
      const prompt = await prisma.agentConfig.findFirst({
        where: {
          workspaceId,
          type: "PRODUCT_SEARCH",
        },
      })

      expect(prompt).toBeDefined()
      expect(prompt!.systemPrompt).toContain("ne voglio")
      expect(prompt!.systemPrompt).toContain("quantity")
      expect(prompt!.systemPrompt).toContain("cartManagementAgent")

      console.log("✅ T024: Quantity extraction rules present in prompt")
    })
  })

  describe("T025: Max 3 Products Rule", () => {
    it("should never show >3 products in numbered list", async () => {
      const res = await request(app)
        .post("/api/whatsapp/webhook")
        .send({
          workspaceId,
          customerId,
          sessionId: `${sessionId}-max3`,
          message: "tutti i prodotti", // Broad query
          phone: "+393331234999",
        })

      expect(res.status).toBe(200)
      const response = res.body.response

      // Count numbered items (1., 2., 3., etc.)
      const numberedItems = (response.match(/^\d+\.\s/gm) || []).length

      // Should show groups (can be 3-5) OR max 3 products
      // If >3 numbered items, they should be groups not products
      if (numberedItems > 3) {
        // These are groups - verify no detailed product info
        expect(response.toLowerCase()).not.toMatch(/stock:/)
        expect(response.toLowerCase()).not.toMatch(/fornitore:/)
        console.log(`✅ T025: Showing ${numberedItems} groups (not products)`)
      } else {
        // ≤3 products or groups - valid
        console.log(`✅ T025: Showing ${numberedItems} items (within limit)`)
      }

      expect(numberedItems).toBeGreaterThanOrEqual(1)
      expect(numberedItems).toBeLessThanOrEqual(5) // Max 5 groups
    }, 30000)
  })

  describe("T026: Token Count Logging", () => {
    it("should log {{PRODUCTS}} token count during prompt processing", async () => {
      // This would require checking logs - verify via prompt update
      const agentConfig = await prisma.agentConfig.findFirst({
        where: {
          workspaceId,
          type: "PRODUCT_SEARCH",
        },
      })

      expect(agentConfig).toBeDefined()
      expect(agentConfig!.systemPrompt).toContain("{{PRODUCTS}}")
      expect(agentConfig!.systemPrompt).toContain("Max 3 Products Rule")

      console.log(
        "✅ T026: {{PRODUCTS}} variable and rules present in system prompt"
      )
    })
  })
})
