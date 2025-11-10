/**
 * INTEGRATION TEST: Progressive Discovery E2E Flow
 * 
 * Tests the COMPLETE user journey:
 * 1. Clear cart
 * 2. Search halal products → Get numbered list
 * 3. Select "2" → Get full product details
 * 4. Confirm "sì" → Add to cart
 * 5. Verify product in database
 * 6. Verify link generation
 * 
 * This test uses REAL Router, ProductSearch, and Cart agents (no mocks).
 * Requires backend server running on port 3001.
 */

import { PrismaClient } from "@prisma/client"
import { LLMRouterService } from "../../services/llm-router.service"

const prisma = new PrismaClient()

describe("Progressive Discovery E2E Flow", () => {
  let workspace: any
  let customer: any
  let cart: any
  let conversationId: string
  let router: LLMRouterService

  beforeAll(async () => {
    // Get workspace and customer
    workspace = await prisma.workspace.findFirst({
      where: { isActive: true },
    })

    if (!workspace) {
      throw new Error("No active workspace found")
    }

    customer = await prisma.customers.findFirst({
      where: { workspaceId: workspace.id, isActive: true },
    })

    if (!customer) {
      throw new Error("No active customer found")
    }

    // Get or create cart
    cart = await prisma.carts.findFirst({
      where: { customerId: customer.id },
    })

    if (!cart) {
      cart = await prisma.carts.create({
        data: {
          customerId: customer.id,
          workspaceId: workspace.id,
        },
      })
    }

    // Initialize Router
    router = new LLMRouterService(prisma)
    conversationId = `test-e2e-${Date.now()}`
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // STEP 0: Clear cart before each test
    await prisma.cartItems.deleteMany({
      where: { cartId: cart.id },
    })
  })

  it("should complete full progressive discovery flow: search → select → confirm → cart", async () => {
    // STEP 1: User searches "avete prodotti halal?"
    const message1 = await prisma.conversationMessage.create({
      data: {
        conversationId,
        workspaceId: workspace.id,
        customerId: customer.id,
        role: "user",
        content: "avete prodotti halal?",
      },
    })

    const response1 = await router.routeMessage({
      workspaceId: workspace.id,
      customerId: customer.id,
      conversationId,
      messageId: message1.id,
      message: "avete prodotti halal?",
      customerLanguage: "it",
      customerName: customer.name,
    })

    // Validate: Should show numbered list
    expect(response1.response).toMatch(/\d+[\.\)\*\s]+.+/m)
    expect(response1.agentUsed).toBe("PRODUCT_SEARCH")
    expect(response1.response).toContain("halal")

    // Wait for LLM processing
    await new Promise(resolve => setTimeout(resolve, 2000))

    // STEP 2: User selects "2"
    const message2 = await prisma.conversationMessage.create({
      data: {
        conversationId,
        workspaceId: workspace.id,
        customerId: customer.id,
        role: "user",
        content: "2",
      },
    })

    const response2 = await router.routeMessage({
      workspaceId: workspace.id,
      customerId: customer.id,
      conversationId,
      messageId: message2.id,
      message: "2",
      customerLanguage: "it",
      customerName: customer.name,
    })

    // Validate: Should show product details with code and price
    expect(response2.agentUsed).toBe("PRODUCT_SEARCH")
    expect(response2.response).toMatch(/[A-Z]+-[A-Z0-9]+-?\d+/) // Product code pattern
    expect(response2.response).toMatch(/€\d+/) // Price pattern
    expect(response2.response).toMatch(/carrello|cart/i) // Cart question

    // Wait for LLM processing
    await new Promise(resolve => setTimeout(resolve, 2000))

    // STEP 3: User confirms "sì"
    const message3 = await prisma.conversationMessage.create({
      data: {
        conversationId,
        workspaceId: workspace.id,
        customerId: customer.id,
        role: "user",
        content: "sì",
      },
    })

    const response3 = await router.routeMessage({
      workspaceId: workspace.id,
      customerId: customer.id,
      conversationId,
      messageId: message3.id,
      message: "sì",
      customerLanguage: "it",
      customerName: customer.name,
    })

    // Validate: Should confirm addition to cart
    expect(response3.response).toMatch(/aggiunt[oa]|added|carrello|cart/i)

    // STEP 4: Verify product is in database cart
    const cartItems = await prisma.cartItems.findMany({
      where: { cartId: cart.id },
      include: {
        product: true,
        service: true,
      },
    })

    expect(cartItems.length).toBeGreaterThan(0)
    
    const firstItem = cartItems[0]
    const productOrService = firstItem.product || firstItem.service
    
    expect(productOrService).toBeDefined()
    expect(productOrService?.name).toBeTruthy()
    expect(productOrService?.price).toBeGreaterThan(0)

    // STEP 5: Verify link generation (if cart response includes link)
    const hasLink = /https?:\/\/[^\s]+/.test(response3.response)
    
    // Link may or may not be in response depending on Cart agent behavior
    // But if present, should be valid format
    if (hasLink) {
      const links = response3.response.match(/https?:\/\/[^\s]+/g)
      expect(links).toBeTruthy()
      expect(links![0]).toContain("http")
    }

    // Log summary for debugging
    console.log("\n✅ PROGRESSIVE DISCOVERY E2E TEST SUMMARY:")
    console.log(`   Step 1: Listed ${response1.response.split("\n").filter(l => /^\d+/.test(l)).length} products`)
    console.log(`   Step 2: Showed details (${productOrService?.name})`)
    console.log(`   Step 3: Added to cart`)
    console.log(`   Cart Items: ${cartItems.length}`)
    console.log(`   Total: €${cartItems.reduce((sum, item) => {
      const prod = item.product || item.service
      return sum + (prod ? prod.price * item.quantity : 0)
    }, 0).toFixed(2)}`)
    console.log(`   Links: ${hasLink ? "Yes" : "No"}`)
  }, 60000) // 60 second timeout for LLM calls

  it("should handle invalid selection gracefully", async () => {
    // Search first
    const message1 = await prisma.conversationMessage.create({
      data: {
        conversationId: `test-invalid-${Date.now()}`,
        workspaceId: workspace.id,
        customerId: customer.id,
        role: "user",
        content: "avete prodotti halal?",
      },
    })

    await router.routeMessage({
      workspaceId: workspace.id,
      customerId: customer.id,
      conversationId: message1.conversationId,
      messageId: message1.id,
      message: "avete prodotti halal?",
      customerLanguage: "it",
      customerName: customer.name,
    })

    await new Promise(resolve => setTimeout(resolve, 2000))

    // Select invalid number
    const message2 = await prisma.conversationMessage.create({
      data: {
        conversationId: message1.conversationId,
        workspaceId: workspace.id,
        customerId: customer.id,
        role: "user",
        content: "999",
      },
    })

    const response2 = await router.routeMessage({
      workspaceId: workspace.id,
      customerId: customer.id,
      conversationId: message1.conversationId,
      messageId: message2.id,
      message: "999",
      customerLanguage: "it",
      customerName: customer.name,
    })

    // Should handle gracefully (not crash)
    expect(response2.response).toBeTruthy()
    expect(response2.response.length).toBeGreaterThan(0)
  }, 30000)
})
