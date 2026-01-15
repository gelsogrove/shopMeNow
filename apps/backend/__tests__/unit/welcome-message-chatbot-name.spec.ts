/**
 * Unit Test: Welcome Message - Chatbot Name Replacement
 * 
 * CRITICAL: Verify that {{chatbotName}} is replaced in welcome message
 * 
 * Tests:
 * 1. Default chatbot name ("Assistente") when not configured
 * 2. Custom chatbot name replacement ("SofiA", "Marco", etc.)
 * 3. Replacement works across all languages (it, en, es, pt)
 * 4. Replacement happens BEFORE sending message to customer
 */

import { prisma } from "@echatbot/database"
import { WelcomeMessageHandler } from "../../src/utils/welcome-message.handler"

describe("Welcome Message - Chatbot Name Replacement", () => {
  let handler: WelcomeMessageHandler
  let testWorkspaceId: string
  let testCustomerId: string

  beforeAll(async () => {
    handler = new WelcomeMessageHandler(prisma)

    // Create test workspace with custom chatbot name
    const workspace = await prisma.workspace.create({
      data: {
        name: `Test Workspace ${Date.now()}`,
        slug: `test-workspace-${Date.now()}`,
        chatbotName: "TestBot",
        welcomeMessage: {
          it: "Benvenuto! Sono {{chatbotName}}, il tuo assistente.",
          en: "Welcome! I'm {{chatbotName}}, your assistant.",
          es: "¡Bienvenido! Soy {{chatbotName}}, tu asistente.",
          pt: "Bem-vindo! Sou {{chatbotName}}, o seu assistente.",
        },
      },
    })
    testWorkspaceId = workspace.id

    // Create test customer
    const customer = await prisma.customers.create({
      data: {
        workspaceId: testWorkspaceId,
        phone: `+39${Date.now()}`,
        name: "Test Customer",
        email: `test${Date.now()}@test.com`,
        language: "it",
      },
    })
    testCustomerId = customer.id

    // Create chat session
    await prisma.chatSession.create({
      data: {
        workspaceId: testWorkspaceId,
        customerId: testCustomerId,
        status: "active",
      },
    })
  })

  afterAll(async () => {
    // Cleanup
    await prisma.conversationMessage.deleteMany({
      where: { workspaceId: testWorkspaceId },
    })
    await prisma.chatSession.deleteMany({
      where: { workspaceId: testWorkspaceId },
    })
    await prisma.customers.deleteMany({
      where: { workspaceId: testWorkspaceId },
    })
    await prisma.workspace.delete({
      where: { id: testWorkspaceId },
    })
    await prisma.$disconnect()
  })

  it("should replace {{chatbotName}} with custom name in Italian", async () => {
    const result = await handler.handleWelcomeMessage({
      workspaceId: testWorkspaceId,
      customerId: testCustomerId,
      customerLanguage: "it",
      customerMessage: "Ciao",
    })

    expect(result.isWelcomeMessage).toBe(true)
    expect(result.welcomeText).toContain("TestBot")
    expect(result.welcomeText).not.toContain("{{chatbotName}}")
    expect(result.welcomeText).toBe("Benvenuto! Sono TestBot, il tuo assistente.")
  })

  it("should replace {{chatbotName}} with custom name in English", async () => {
    // Update customer language to English
    await prisma.customers.update({
      where: { id: testCustomerId },
      data: { language: "en" },
    })

    // Delete previous messages to trigger welcome again
    await prisma.conversationMessage.deleteMany({
      where: { customerId: testCustomerId },
    })

    const result = await handler.handleWelcomeMessage({
      workspaceId: testWorkspaceId,
      customerId: testCustomerId,
      customerLanguage: "en",
      customerMessage: "Hello",
    })

    expect(result.isWelcomeMessage).toBe(true)
    expect(result.welcomeText).toContain("TestBot")
    expect(result.welcomeText).not.toContain("{{chatbotName}}")
    expect(result.welcomeText).toBe("Welcome! I'm TestBot, your assistant.")
  })

  it("should replace {{chatbotName}} with custom name in Spanish", async () => {
    await prisma.customers.update({
      where: { id: testCustomerId },
      data: { language: "es" },
    })

    await prisma.conversationMessage.deleteMany({
      where: { customerId: testCustomerId },
    })

    const result = await handler.handleWelcomeMessage({
      workspaceId: testWorkspaceId,
      customerId: testCustomerId,
      customerLanguage: "es",
      customerMessage: "Hola",
    })

    expect(result.isWelcomeMessage).toBe(true)
    expect(result.welcomeText).toContain("TestBot")
    expect(result.welcomeText).not.toContain("{{chatbotName}}")
    expect(result.welcomeText).toBe("¡Bienvenido! Soy TestBot, tu asistente.")
  })

  it("should use default 'Assistente' when chatbotName is not configured", async () => {
    // Create workspace WITHOUT chatbot name
    const workspace2 = await prisma.workspace.create({
      data: {
        name: `Test Workspace No Name ${Date.now()}`,
        slug: `test-workspace-no-name-${Date.now()}`,
        chatbotName: null, // NO custom name
        welcomeMessage: {
          it: "Benvenuto! Sono {{chatbotName}}, il tuo assistente.",
        },
      },
    })

    const customer2 = await prisma.customers.create({
      data: {
        workspaceId: workspace2.id,
        phone: `+39${Date.now()}`,
        name: "Test Customer 2",
        email: `test2${Date.now()}@test.com`,
        language: "it",
      },
    })

    await prisma.chatSession.create({
      data: {
        workspaceId: workspace2.id,
        customerId: customer2.id,
        status: "active",
      },
    })

    const result = await handler.handleWelcomeMessage({
      workspaceId: workspace2.id,
      customerId: customer2.id,
      customerLanguage: "it",
      customerMessage: "Ciao",
    })

    expect(result.isWelcomeMessage).toBe(true)
    expect(result.welcomeText).toContain("Assistente") // Default fallback
    expect(result.welcomeText).not.toContain("{{chatbotName}}")

    // Cleanup
    await prisma.conversationMessage.deleteMany({
      where: { workspaceId: workspace2.id },
    })
    await prisma.chatSession.deleteMany({
      where: { workspaceId: workspace2.id },
    })
    await prisma.customers.delete({
      where: { id: customer2.id },
    })
    await prisma.workspace.delete({
      where: { id: workspace2.id },
    })
  })

  it("should NOT contain placeholder after replacement", async () => {
    await prisma.conversationMessage.deleteMany({
      where: { customerId: testCustomerId },
    })

    const result = await handler.handleWelcomeMessage({
      workspaceId: testWorkspaceId,
      customerId: testCustomerId,
      customerLanguage: "it",
      customerMessage: "Ciao",
    })

    // CRITICAL: No placeholder should remain in final message
    expect(result.welcomeText).not.toMatch(/\{\{.*?\}\}/)
    expect(result.welcomeText).not.toContain("{{chatbotName}}")
    expect(result.welcomeText).not.toContain("{{")
    expect(result.welcomeText).not.toContain("}}")
  })

  it("should work with different chatbot names (SofiA, Marco, etc.)", async () => {
    // Test with "SofiA"
    await prisma.workspace.update({
      where: { id: testWorkspaceId },
      data: { chatbotName: "SofiA" },
    })

    await prisma.conversationMessage.deleteMany({
      where: { customerId: testCustomerId },
    })

    let result = await handler.handleWelcomeMessage({
      workspaceId: testWorkspaceId,
      customerId: testCustomerId,
      customerLanguage: "it",
      customerMessage: "Ciao",
    })

    expect(result.welcomeText).toContain("SofiA")
    expect(result.welcomeText).not.toContain("{{chatbotName}}")

    // Test with "Marco"
    await prisma.workspace.update({
      where: { id: testWorkspaceId },
      data: { chatbotName: "Marco" },
    })

    await prisma.conversationMessage.deleteMany({
      where: { customerId: testCustomerId },
    })

    result = await handler.handleWelcomeMessage({
      workspaceId: testWorkspaceId,
      customerId: testCustomerId,
      customerLanguage: "it",
      customerMessage: "Ciao",
    })

    expect(result.welcomeText).toContain("Marco")
    expect(result.welcomeText).not.toContain("{{chatbotName}}")
  })
})
