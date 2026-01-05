/**
 * Test Feature 174: Price Visibility Control
 * 
 * Verify that non-registered customers (isActive: false) do NOT see prices
 * when viewing product listings.
 */

import { prisma } from "@echatbot/database"
import { MessageRepository } from "../../../src/repositories/message.repository"

let messageRepo: MessageRepository
let workspaceId: string
let productId: string

describe("Feature 174: Price Visibility Control", () => {
  beforeAll(async () => {
    // Create test workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: "Test Workspace - Price Visibility",
        notificationEmail: "test-price-visibility@echatbot.ai",
        whatsappPhoneNumber: "+393334445556",
        apiKey: `test_${Date.now()}`,
        currency: "EUR",
        sellsProductsAndServices: true,
        slug: `test-workspace-price-visibility-${Date.now()}`,
      },
    })
    workspaceId = workspace.id

    // Create test category
    const category = await prisma.categories.create({
      data: {
        name: "Test Category",
        workspaceId,
        isActive: true,
        slug: `test-category-${Date.now()}`,
      },
    })

    // Create test product with price
    const product = await prisma.products.create({
      data: {
        name: "Mozzarella di Bufala",
        sku: "MOZ001",
        slug: `mozzarella-di-bufala-${Date.now()}`,
        price: 7.80,
        description: "Prodotto fresco di alta qualità",
        categoryId: category.id,
        workspaceId,
        isActive: true,
        stock: 10,
      },
    })
    productId = product.id

    messageRepo = new MessageRepository()
  })

  afterAll(async () => {
    // Cleanup
    await prisma.products.deleteMany({ where: { workspaceId } })
    await prisma.categories.deleteMany({ where: { workspaceId } })
    await prisma.workspace.delete({ where: { id: workspaceId } })
    await prisma.$disconnect()
  })

  describe("Registered customers (isActive: true)", () => {
    it("should see product prices", async () => {
      const productsString = await messageRepo.getActiveProducts(
        workspaceId,
        0, // no discount
        true // customerIsActive = true (registered)
      )

      expect(productsString).toContain("Mozzarella di Bufala")
      expect(productsString).toContain("€7.80") // Price visible
      expect(productsString).not.toContain("[Registrati per vedere i prezzi")
    })

    it("should see discounted prices", async () => {
      const productsString = await messageRepo.getActiveProducts(
        workspaceId,
        10, // 10% discount
        true // customerIsActive = true
      )

      expect(productsString).toContain("Mozzarella di Bufala")
      expect(productsString).toContain("€7.10") // Discounted price (rounded)
      expect(productsString).toContain("MOZ001") // SKU visible
    })
  })

  describe("Non-registered customers (isActive: false)", () => {
    it("should NOT see prices", async () => {
      const productsString = await messageRepo.getActiveProducts(
        workspaceId,
        0, // no discount
        false // customerIsActive = false (non-registered)
      )

      expect(productsString).toContain("Mozzarella di Bufala")
      expect(productsString).toContain("MOZ001") // SKU still visible
      expect(productsString).not.toContain("€") // NO price symbols at all
      // ✅ NEW FORMAT: Clean list without prices, no registration message needed
    })

    it("should show product info but hide prices", async () => {
      const productsString = await messageRepo.getActiveProducts(
        workspaceId,
        0,
        false // non-registered
      )

      // Should contain basic product info
      expect(productsString).toContain("Mozzarella di Bufala")
      expect(productsString).toContain("MOZ001") // SKU visible
      expect(productsString).toContain("TEST CATEGORY") // Category visible

      // Should NOT contain any price symbols
      expect(productsString).not.toContain("€")
      expect(productsString).not.toContain("7.80")
    })
  })

  describe("Default behavior (backward compatibility)", () => {
    it("should show prices when customerIsActive not provided (default true)", async () => {
      const productsString = await messageRepo.getActiveProducts(
        workspaceId,
        0, // no discount
        // customerIsActive not provided → defaults to true
      )

      expect(productsString).toContain("€7.80") // Price visible by default
    })
  })
})
