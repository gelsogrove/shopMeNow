/**
 * FR-13: Repeat Order with Confirmation Flow - Integration Test
 * 
 * Tests the complete flow:
 * 1. {{LAST_ORDER}} variable replacement with real order data
 * 2. AddProduct CF generates checkout link with ?step=2
 * 3. Cart is created with correct items
 * 
 * NOTE: WhatsApp integration is NOT tested (feature pending)
 * This test validates backend logic only
 */

import { PrismaClient } from "@prisma/client"
import { PromptProcessorService } from "../../src/services/prompt-processor.service"
import { CallingFunctionsService } from "../../src/services/calling-functions.service"
import { LinkGeneratorService } from "../../src/application/services/link-generator.service"

const prisma = new PrismaClient()

describe("FR-13: Repeat Order Flow Integration", () => {
  let workspaceId: string
  let customerId: string
  let deliveredOrderId: string
  let productId1: string
  let productId2: string

  beforeAll(async () => {
    // Use existing workspace from seed
    const workspace = await prisma.workspace.findFirst()
    if (!workspace) {
      throw new Error("No workspace found - run seed first")
    }
    workspaceId = workspace.id

    // Create test customer
    const customer = await prisma.customers.create({
      data: {
        workspaceId,
        name: "Test Customer FR-13",
        email: "test-fr13@example.com",
        phone: "+393331234567",
        language: "it",
        isActive: true,
      },
    })
    customerId = customer.id

    // Create test products
    const product1 = await prisma.products.create({
      data: {
        workspaceId,
        productCode: "TEST-PROD-001",
        name: "Test Product 1",
        slug: "test-product-1-fr13",
        description: "Test product for FR-13",
        price: 10.5,
        stock: 100,
        isActive: true,
      },
    })
    productId1 = product1.id

    const product2 = await prisma.products.create({
      data: {
        workspaceId,
        productCode: "TEST-PROD-002",
        name: "Test Product 2",
        slug: "test-product-2-fr13",
        description: "Another test product",
        price: 25.0,
        stock: 50,
        isActive: true,
      },
    })
    productId2 = product2.id

    // Create delivered order (for {{LAST_ORDER}} variable)
    const order = await prisma.orders.create({
      data: {
        workspaceId,
        customerId,
        orderCode: "TEST-ORD-FR13-001",
        status: "DELIVERED",
        totalAmount: 71.0,
        createdAt: new Date("2025-10-10"),
        items: {
          create: [
            {
              productId: productId1,
              quantity: 4,
              unitPrice: 10.5,
              totalPrice: 42.0,
            },
            {
              productId: productId2,
              quantity: 1,
              unitPrice: 25.0,
              totalPrice: 25.0,
            },
          ],
        },
      },
      include: {
        items: true,
      },
    })
    deliveredOrderId = order.id
  })

  afterAll(async () => {
    // Cleanup: Delete test data
    await prisma.orderItems.deleteMany({ where: { order: { workspaceId } } })
    await prisma.orders.deleteMany({ where: { workspaceId } })
    await prisma.cartItems.deleteMany({ where: { cart: { workspaceId } } })
    await prisma.carts.deleteMany({ where: { workspaceId } })
    await prisma.products.deleteMany({
      where: { productCode: { startsWith: "TEST-PROD-" } },
    })
    await prisma.customers.deleteMany({
      where: { email: "test-fr13@example.com" },
    })
    await prisma.$disconnect()
  })

  describe("T014: {{LAST_ORDER}} Variable Replacement", () => {
    it("should replace {{LAST_ORDER}} with formatted order summary", async () => {
      const promptProcessor = new PromptProcessorService()

      // Call the private method via reflection (test-only access)
      const getLastOrderVariable = (promptProcessor as any).getLastOrderVariable.bind(
        promptProcessor
      )

      const result = await getLastOrderVariable(customerId, workspaceId)

      // Verify order summary format
      expect(result).toContain("TEST-ORD-FR13-001")
      expect(result).toContain("Test Product 1")
      expect(result).toContain("Test Product 2")
      expect(result).toContain("71") // Total amount

      // Verify quantities
      expect(result).toContain("x4") // Product 1 quantity
      expect(result).toContain("x1") // Product 2 quantity

      // Verify prices
      expect(result).toContain("10.50") // Product 1 unit price
      expect(result).toContain("25.00") // Product 2 unit price
    })

    it("should return fallback message when no delivered orders exist", async () => {
      const promptProcessor = new PromptProcessorService()

      // Create new customer without orders
      const newCustomer = await prisma.customers.create({
        data: {
          workspaceId,
          name: "New Customer FR-13",
          email: "new-customer-fr13@example.com",
          phone: "+393339999999",
          language: "it",
          isActive: true,
        },
      })

      const getLastOrderVariable = (promptProcessor as any).getLastOrderVariable.bind(
        promptProcessor
      )

      const result = await getLastOrderVariable(newCustomer.id, workspaceId)

      expect(result).toContain("Nessun ordine precedente disponibile.")

      // Cleanup
      await prisma.customers.delete({ where: { id: newCustomer.id } })
    })
  })

  describe("T015: AddProduct with step=2 parameter", () => {
    it("should generate checkout link with ?step=2 parameter", async () => {
      const callingFunctions = new CallingFunctionsService()

      const result = await callingFunctions.addProductToCart({
        customerId,
        workspaceId,
        productCode: "TEST-PROD-001",
        quantity: 2,
      })

      // Verify success
      expect(result.success).toBe(true)
      expect(result.cartUrl).toBeDefined()

      // Verify short URL was created
      expect(result.cartUrl).toMatch(/\/s\/\w+/)

      // Verify original URL in database contains step=2
      const shortLink = await prisma.shortUrls.findFirst({
        where: {
          workspaceId,
          shortCode: result.cartUrl.split("/s/")[1],
        },
      })

      expect(shortLink).toBeDefined()
      expect(shortLink!.originalUrl).toContain("step=2")

      // Verify cart was created
      const cart = await prisma.carts.findFirst({
        where: { customerId, workspaceId },
        include: { items: true },
      })

      expect(cart).toBeDefined()
      expect(cart!.items.length).toBeGreaterThan(0)

      // Find our test product in cart
      const testItem = cart!.items.find((item) => item.productId === productId1)
      expect(testItem).toBeDefined()
      expect(testItem!.quantity).toBe(2)
    })
  })

  describe("T016: LinkGeneratorService step parameter validation", () => {
    it("should accept step=1 parameter", async () => {
      const linkGenerator = new LinkGeneratorService()

      const token = "test-token-123"

      const result = await linkGenerator.generateCheckoutLink(
        token,
        workspaceId,
        1
      )

      // Verify short URL format
      expect(result).toMatch(/\/s\/\w+/)

      // Verify original URL contains step=1
      const shortLink = await prisma.shortUrls.findFirst({
        where: {
          shortCode: result.split("/s/")[1],
        },
      })

      expect(shortLink).toBeDefined()
      expect(shortLink!.originalUrl).toContain("step=1")
    })

    it("should accept step=2 parameter", async () => {
      const linkGenerator = new LinkGeneratorService()

      const token = "test-token-456"

      const result = await linkGenerator.generateCheckoutLink(
        token,
        workspaceId,
        2
      )

      // Verify short URL format
      expect(result).toMatch(/\/s\/\w+/)

      // Verify original URL contains step=2
      const shortLink = await prisma.shortUrls.findFirst({
        where: {
          shortCode: result.split("/s/")[1],
        },
      })

      expect(shortLink).toBeDefined()
      expect(shortLink!.originalUrl).toContain("step=2")
    })

    it("should reject invalid step parameter (step=3)", async () => {
      const linkGenerator = new LinkGeneratorService()

      const token = "test-token-789"

      await expect(
        linkGenerator.generateCheckoutLink(token, workspaceId, 3)
      ).rejects.toThrow("Invalid step parameter: must be 1 or 2")
    })

    it("should work without step parameter (backward compatibility)", async () => {
      const linkGenerator = new LinkGeneratorService()

      const token = "test-token-000"

      const result = await linkGenerator.generateCheckoutLink(
        token,
        workspaceId
      )

      // Verify short URL format
      expect(result).toMatch(/\/s\/\w+/)

      // Verify original URL does NOT contain step parameter
      const shortLink = await prisma.shortUrls.findFirst({
        where: {
          shortCode: result.split("/s/")[1],
        },
      })

      expect(shortLink).toBeDefined()
      expect(shortLink!.originalUrl).not.toContain("step=")
    })
  })

  describe("T017: End-to-End Flow Simulation", () => {
    it("should complete full repeat order flow (without WhatsApp)", async () => {
      // STEP 1: Verify {{LAST_ORDER}} variable works
      const promptProcessor = new PromptProcessorService()
      const getLastOrderVariable = (promptProcessor as any).getLastOrderVariable.bind(
        promptProcessor
      )

      const lastOrderSummary = await getLastOrderVariable(
        customerId,
        workspaceId
      )

      expect(lastOrderSummary).toContain("TEST-ORD-FR13-001")

      // STEP 2: Simulate agent calling AddProduct (after confirmation)
      const callingFunctions = new CallingFunctionsService()

      const result = await callingFunctions.addProductToCart({
        customerId,
        workspaceId,
        productCode: "TEST-PROD-001",
        quantity: 4,
      })

      expect(result.success).toBe(true)
      expect(result.cartUrl).toBeDefined()

      // Verify short URL format
      expect(result.cartUrl).toMatch(/\/s\/\w+/)

      // Verify original URL contains step=2
      const shortLink = await prisma.shortUrls.findFirst({
        where: {
          shortCode: result.cartUrl.split("/s/")[1],
        },
      })

      expect(shortLink).toBeDefined()
      expect(shortLink!.originalUrl).toContain("step=2")

      // STEP 3: Verify cart contents
      const cart = await prisma.carts.findFirst({
        where: { customerId, workspaceId },
        include: { items: { include: { product: true } } },
      })

      expect(cart).toBeDefined()
      expect(cart!.items.length).toBeGreaterThan(0)

      // Find our test product in cart
      const testItem = cart!.items.find((item) => item.productId === productId1)
      expect(testItem).toBeDefined()
      expect(testItem!.product!.name).toBe("Test Product 1")

      // STEP 4: Verify frontend would receive correct step parameter
      // When user clicks short URL, frontend gets redirected to original URL with step=2
      expect(shortLink!.originalUrl).toMatch(/[?&]step=2/)
    })
  })
})
