/**
 * 🔑 PRODUCT CHARACTERISTICS - COMPLETE TEST SUITE
 * 
 * Purpose: Test key-value characteristic system for products
 * 
 * Features Tested:
 * 1. Repository: syncProductCharacteristics (create/update/delete)
 * 2. Service: updateProduct with characteristics parameter
 * 3. Repository: Product retrieval includes characteristics (findById/findAll)
 * 4. LLM Template: Format characteristics for prompt injection
 * 5. Edge Cases: Special characters, empty values, large datasets
 * 
 * Data Flow:
 * Frontend → FormData → Controller (parse JSON) → Service → Repository (sync) → Database
 * Database → Repository (include) → Service → Controller → Frontend
 * 
 * @author Andrea Gelso - eChatbot Platform
 */

import { prisma } from "../../src/lib/prisma"
import { ProductService } from "../../src/application/services/product.service"
import { ProductRepository } from "../../src/repositories/product.repository"
import { SmartPromptBuilder } from "../../src/services/smart-prompt-builder.service"
import logger from "../../src/utils/logger"

// Suppress logs during tests
jest.spyOn(logger, "info").mockImplementation()
jest.spyOn(logger, "error").mockImplementation()
jest.spyOn(logger, "warn").mockImplementation()

describe("🔑 PRODUCT CHARACTERISTICS - Complete Test Suite", () => {
  let productService: ProductService
  let productRepository: ProductRepository

  let testWorkspaceId: string
  let testUserId: string
  let testProductId: string

  beforeAll(async () => {
    productRepository = new ProductRepository()
    productService = new ProductService(productRepository)

    // Create test user WITHOUT password (passwordHash nullable for OAuth)
    const testUser = await prisma.user.create({
      data: {
        email: `characteristics-test-${Date.now()}@test.com`,
        firstName: "Characteristics",
        lastName: "Test",
        creditBalance: 100.00,
        planType: "PREMIUM",
      },
    })
    testUserId = testUser.id

    // Create test workspace
    const testWorkspace = await prisma.workspace.create({
      data: {
        name: "Test Workspace Characteristics",
        slug: `test-workspace-${Date.now()}`,
        ownerId: testUserId,
      },
    })
    testWorkspaceId = testWorkspace.id
  })

  afterAll(async () => {
    // Cleanup in reverse order
    await prisma.productCharacteristic.deleteMany({
      where: { product: { workspaceId: testWorkspaceId } },
    })
    await prisma.products.deleteMany({
      where: { workspaceId: testWorkspaceId },
    })
    await prisma.workspace.deleteMany({
      where: { id: testWorkspaceId },
    })
    await prisma.user.deleteMany({
      where: { id: testUserId },
    })

    await prisma.$disconnect()
  })

  afterEach(async () => {
    // Clean products after each test
    if (testProductId) {
      await prisma.productCharacteristic.deleteMany({
        where: { productId: testProductId },
      })
      await prisma.products.deleteMany({
        where: { id: testProductId },
      })
      testProductId = null as any
    }
  })

  describe("Category 1: Repository - syncProductCharacteristics()", () => {
    it("should create new characteristics for product", async () => {
      // SCENARIO: New product receives characteristics for the first time
      // WHY: Verify create operation works correctly

      // Create test product
      const product = await prisma.products.create({
        data: {
          name: "Test Product Real Estate",
          slug: `test-product-${Date.now()}`,
          sku: "TEST-001",
          description: "Appartamento",
          price: 250000.00,
          stock: 1,
          workspaceId: testWorkspaceId,
        },
      })
      testProductId = product.id

      // Sync characteristics
      const characteristics = [
        { name: "superficie", value: "42mq" },
        { name: "locali", value: "3" },
        { name: "piano", value: "2" },
      ]
      await productRepository.syncProductCharacteristics(
        testProductId,
        characteristics
      )

      // Verify characteristics were created
      const savedChars = await prisma.productCharacteristic.findMany({
        where: { productId: testProductId },
        orderBy: { name: "asc" },
      })

      expect(savedChars).toHaveLength(3)
      expect(savedChars[0]).toMatchObject({
        productId: testProductId,
        name: "locali",
        value: "3",
      })
      expect(savedChars[1]).toMatchObject({
        productId: testProductId,
        name: "piano",
        value: "2",
      })
      expect(savedChars[2]).toMatchObject({
        productId: testProductId,
        name: "superficie",
        value: "42mq",
      })
    })

    it("should replace existing characteristics (delete old + create new)", async () => {
      // SCENARIO: Product already has characteristics, user updates them
      // WHY: Verify sync operation replaces all characteristics

      // Create test product with initial characteristics
      const product = await prisma.products.create({
        data: {
          name: "Test Product Fashion",
          slug: `test-product-${Date.now()}`,
          sku: "TEST-002",
          description: "Giacca",
          price: 89.99,
          stock: 10,
          workspaceId: testWorkspaceId,
          characteristics: {
            create: [
              { name: "taglia", value: "M" },
              { name: "colore", value: "blu" },
            ],
          },
        },
      })
      testProductId = product.id

      // Update with new characteristics
      const newCharacteristics = [
        { name: "taglia", value: "L" }, // Changed
        { name: "colore", value: "rosso" }, // Changed
        { name: "materiale", value: "cotone" }, // New
      ]
      await productRepository.syncProductCharacteristics(
        testProductId,
        newCharacteristics
      )

      // Verify old characteristics were deleted and new ones created
      const savedChars = await prisma.productCharacteristic.findMany({
        where: { productId: testProductId },
        orderBy: { name: "asc" },
      })

      expect(savedChars).toHaveLength(3)
      expect(savedChars[0].name).toBe("colore")
      expect(savedChars[0].value).toBe("rosso") // Updated value
      expect(savedChars[1].name).toBe("materiale")
      expect(savedChars[1].value).toBe("cotone") // New characteristic
      expect(savedChars[2].name).toBe("taglia")
      expect(savedChars[2].value).toBe("L") // Updated value
    })

    it("should clear all characteristics when empty array provided", async () => {
      // SCENARIO: User removes all characteristics from product
      // WHY: Verify delete operation works correctly

      // Create test product with characteristics
      const product = await prisma.products.create({
        data: {
          name: "Test Product Food",
          slug: `test-product-${Date.now()}`,
          sku: "TEST-003",
          description: "Vino",
          price: 15.50,
          stock: 50,
          workspaceId: testWorkspaceId,
          characteristics: {
            create: [
              { name: "annata", value: "2018" },
              { name: "gradazione", value: "13%" },
            ],
          },
        },
      })
      testProductId = product.id

      // Clear characteristics
      await productRepository.syncProductCharacteristics(testProductId, [])

      // Verify all characteristics were deleted
      const savedChars = await prisma.productCharacteristic.findMany({
        where: { productId: testProductId },
      })

      expect(savedChars).toHaveLength(0)
    })
  })

  describe("Category 2: Service - updateProduct() with characteristics", () => {
    it("should update product and sync characteristics", async () => {
      // SCENARIO: User edits product and changes characteristics
      // WHY: Verify service layer correctly orchestrates characteristic sync

      // Create test product
      const product = await prisma.products.create({
        data: {
          name: "Test Product Electronics",
          slug: `test-product-${Date.now()}`,
          sku: "TEST-004",
          description: "Smartphone",
          price: 599.00,
          stock: 20,
          workspaceId: testWorkspaceId,
        },
      })
      testProductId = product.id

      // Update product with characteristics
      const characteristics = [
        { name: "memoria", value: "128GB" },
        { name: "colore", value: "nero" },
        { name: "schermo", value: "6.5 pollici" },
      ]
      const updatedProduct = await productService.updateProduct(
        testProductId,
        { name: "Smartphone Premium", price: 649.0 },
        testWorkspaceId,
        undefined, // certificationIds
        undefined, // typeIds
        undefined, // categoryIds
        characteristics
      )

      // Verify product was updated
      expect(updatedProduct).not.toBeNull()
      expect(updatedProduct!.name).toBe("Smartphone Premium")

      // Verify characteristics were synced
      const savedChars = await prisma.productCharacteristic.findMany({
        where: { productId: testProductId },
        orderBy: { name: "asc" },
      })

      expect(savedChars).toHaveLength(3)
      expect(savedChars[0].name).toBe("colore")
      expect(savedChars[1].name).toBe("memoria")
      expect(savedChars[2].name).toBe("schermo")
    })
  })

  describe("Category 3: Repository - Product retrieval includes characteristics", () => {
    it("should return characteristics when fetching product by ID", async () => {
      // SCENARIO: Frontend opens product in edit form
      // WHY: Verify GET /products/:id returns characteristics for form population

      // Create test product with characteristics
      const product = await prisma.products.create({
        data: {
          name: "Test Product Automotive",
          slug: `test-product-${Date.now()}`,
          sku: "TEST-005",
          description: "Auto usata",
          price: 15000.00,
          stock: 1,
          workspaceId: testWorkspaceId,
          characteristics: {
            create: [
              { name: "chilometri", value: "85000" },
              { name: "anno", value: "2019" },
              { name: "carburante", value: "benzina" },
            ],
          },
        },
      })
      testProductId = product.id

      // Fetch product using repository
      const fetchedProduct = await productRepository.findById(
        testProductId,
        testWorkspaceId
      )

      // Verify product includes characteristics
      expect(fetchedProduct).not.toBeNull()
      expect((fetchedProduct as any).characteristics).toBeDefined()
      expect((fetchedProduct as any).characteristics).toHaveLength(3)

      const chars = (fetchedProduct as any).characteristics
      // DB returns characteristics in alphabetical order by name
      const charsByName = chars.reduce((acc: any, c: any) => ({ ...acc, [c.name]: c }), {})
      
      expect(charsByName.anno).toMatchObject({
        productId: testProductId,
        name: "anno",
        value: "2019",
      })
      expect(charsByName.carburante).toMatchObject({
        productId: testProductId,
        name: "carburante",
        value: "benzina",
      })
      expect(charsByName.chilometri).toMatchObject({
        productId: testProductId,
        name: "chilometri",
        value: "85000",
      })
    })

    it("should return characteristics when fetching all products", async () => {
      // SCENARIO: Frontend loads products table
      // WHY: Verify GET /products returns characteristics for all products

      // Create test products with characteristics
      const product1 = await prisma.products.create({
        data: {
          name: "Product 1",
          slug: `product-1-${Date.now()}`,
          sku: "TEST-006",
          description: "Test",
          price: 10.00,
          stock: 1,
          workspaceId: testWorkspaceId,
          characteristics: {
            create: [{ name: "color", value: "red" }],
          },
        },
      })

      const product2 = await prisma.products.create({
        data: {
          name: "Product 2",
          slug: `product-2-${Date.now()}`,
          sku: "TEST-007",
          description: "Test",
          price: 20.00,
          stock: 2,
          workspaceId: testWorkspaceId,
          characteristics: {
            create: [{ name: "size", value: "large" }],
          },
        },
      })

      // Fetch all products
      const result = await productRepository.findAll(testWorkspaceId)

      // Verify products include characteristics
      expect(result.products.length).toBeGreaterThanOrEqual(2)

      const prod1 = result.products.find((p) => p.id === product1.id)
      const prod2 = result.products.find((p) => p.id === product2.id)

      expect(prod1).toBeDefined()
      expect((prod1 as any).characteristics).toHaveLength(1)
      expect((prod1 as any).characteristics[0].name).toBe("color")

      expect(prod2).toBeDefined()
      expect((prod2 as any).characteristics).toHaveLength(1)
      expect((prod2 as any).characteristics[0].name).toBe("size")

      // Cleanup
      await prisma.productCharacteristic.deleteMany({
        where: { productId: { in: [product1.id, product2.id] } },
      })
      await prisma.products.deleteMany({
        where: { id: { in: [product1.id, product2.id] } },
      })
    })
  })

  describe("Category 4: LLM Template - Format characteristics for prompts", () => {
    it("should format characteristics as compact list with value samples", async () => {
      // SCENARIO: LLM needs to know available product characteristics
      // WHY: Verify template builder formats characteristics correctly for token optimization

      // Create multiple products with overlapping characteristics
      const products = await Promise.all([
        prisma.products.create({
          data: {
            name: "Appartamento Centro",
            slug: `appartamento-centro-${Date.now()}`,
            sku: "REAL-001",
            description: "Bilocale",
            price: 180000.00,
            stock: 1,
            workspaceId: testWorkspaceId,
            characteristics: {
              create: [
                { name: "superficie", value: "45mq" },
                { name: "locali", value: "2" },
                { name: "piano", value: "3" },
              ],
            },
          },
        }),
        prisma.products.create({
          data: {
            name: "Appartamento Periferia",
            slug: `appartamento-periferia-${Date.now()}`,
            sku: "REAL-002",
            description: "Trilocale",
            price: 120000.00,
            stock: 1,
            workspaceId: testWorkspaceId,
            characteristics: {
              create: [
                { name: "superficie", value: "65mq" },
                { name: "locali", value: "3" },
                { name: "piano", value: "1" },
              ],
            },
          },
        }),
        prisma.products.create({
          data: {
            name: "Villa",
            slug: `villa-${Date.now()}`,
            sku: "REAL-003",
            description: "Villa indipendente",
            price: 450000.00,
            stock: 1,
            workspaceId: testWorkspaceId,
            characteristics: {
              create: [
                { name: "superficie", value: "200mq" },
                { name: "locali", value: "6" },
                { name: "giardino", value: "300mq" },
              ],
            },
          },
        }),
      ])

      // Format characteristics for LLM template
      const formatted = await SmartPromptBuilder.buildProductCharacteristics(
        testWorkspaceId,
        "real_estate"
      )

      // Verify format
      expect(formatted).toContain("🔍 superficie:")
      expect(formatted).toContain("🔍 locali:")
      expect(formatted).toContain("🔍 piano:")
      expect(formatted).toContain("🔍 giardino:")

      // Verify compact format (not full JSON)
      expect(formatted).not.toContain("{")
      expect(formatted).not.toContain("}")
      expect(formatted).not.toContain("[")
      
      // Verify contains actual values from created products
      const hasSuperficie = formatted.includes("45mq") || formatted.includes("65mq") || formatted.includes("200mq")
      const hasLocali = formatted.includes("2") || formatted.includes("3") || formatted.includes("6")
      expect(hasSuperficie).toBe(true)
      expect(hasLocali).toBe(true)

      // Expected format example:
      // 🔍 superficie: 45mq, 65mq, 200mq
      // 🔍 locali: 2, 3, 6
      // 🔍 piano: 1, 3
      // 🔍 giardino: 300mq

      // Cleanup
      await prisma.productCharacteristic.deleteMany({
        where: { productId: { in: products.map((p) => p.id) } },
      })
      await prisma.products.deleteMany({
        where: { id: { in: products.map((p) => p.id) } },
      })
    })

    it("should limit value samples to 5 per characteristic with +N notation", async () => {
      // SCENARIO: Characteristic has many different values (e.g., 20 colors)
      // WHY: Verify template builder limits samples to avoid token bloat

      // Create products with many color variations
      const colors = [
        "rosso",
        "blu",
        "verde",
        "giallo",
        "nero",
        "bianco",
        "grigio",
        "marrone",
      ]
      const products = await Promise.all(
        colors.map((color, i) =>
          prisma.products.create({
            data: {
              name: `T-Shirt ${color}`,
              slug: `tshirt-${color}-${Date.now()}-${i}`,
              sku: `FASHION-${i + 1}`,
              description: "T-Shirt cotone",
              price: 19.99,
              stock: 10,
              workspaceId: testWorkspaceId,
              characteristics: {
                create: [{ name: "colore", value: color }],
              },
            },
          })
        )
      )

      // Format characteristics for LLM template
      const formatted = await SmartPromptBuilder.buildProductCharacteristics(
        testWorkspaceId,
        "fashion"
      )

      // Verify characteristic is listed
      expect(formatted).toContain("🔍 colore:")
      
      // Verify shows limited samples with +N notation if more than 5 values
      if (colors.length > 5) {
        expect(formatted).toMatch(/\(\+\d+ altri\)/)
      }

      // Cleanup
      await prisma.productCharacteristic.deleteMany({
        where: { productId: { in: products.map((p) => p.id) } },
      })
      await prisma.products.deleteMany({
        where: { id: { in: products.map((p) => p.id) } },
      })
    })
  })

  describe("Category 5: Edge Cases & Validation", () => {
    it("should handle characteristics with special characters", async () => {
      // SCENARIO: User enters characteristic with special chars (emoji, accents, etc.)
      // WHY: Verify system handles UTF-8 characters correctly

      const product = await prisma.products.create({
        data: {
          name: "Test Special Chars",
          slug: `test-special-${Date.now()}`,
          sku: "TEST-SPECIAL",
          description: "Test",
          price: 10.00,
          stock: 1,
          workspaceId: testWorkspaceId,
        },
      })
      testProductId = product.id

      const characteristics = [
        { name: "città", value: "Città di Castello" },
        { name: "qualità", value: "★★★★★" },
        { name: "prezzo/kg", value: "€12.50/kg" },
      ]
      await productRepository.syncProductCharacteristics(
        testProductId,
        characteristics
      )

      const savedChars = await prisma.productCharacteristic.findMany({
        where: { productId: testProductId },
        orderBy: { name: "asc" },
      })

      expect(savedChars).toHaveLength(3)
      expect(savedChars[0].value).toBe("Città di Castello")
      expect(savedChars[1].value).toBe("€12.50/kg")
      expect(savedChars[2].value).toBe("★★★★★")
    })

    it("should handle empty name or value gracefully", async () => {
      // SCENARIO: Frontend validation fails, empty strings sent
      // WHY: Verify backend doesn't crash or create invalid data

      const product = await prisma.products.create({
        data: {
          name: "Test Empty Values",
          slug: `test-empty-${Date.now()}`,
          sku: "TEST-EMPTY",
          description: "Test",
          price: 10.00,
          stock: 1,
          workspaceId: testWorkspaceId,
        },
      })
      testProductId = product.id

      // Frontend should filter these out, but backend must handle gracefully
      const characteristics = [
        { name: "valid", value: "ok" },
        { name: "", value: "no name" }, // Invalid
        { name: "no value", value: "" }, // Invalid
      ]

      // System accepts all (frontend responsibility to filter)
      await productRepository.syncProductCharacteristics(
        testProductId,
        characteristics
      )

      const savedChars = await prisma.productCharacteristic.findMany({
        where: { productId: testProductId },
        orderBy: { name: "asc" },
      })

      // All saved (backend doesn't validate - frontend's job)
      expect(savedChars).toHaveLength(3)
    })
  })
})
