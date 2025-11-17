/**
 * Unit Tests: Context Interpretation Pattern (Constitution v2.1.0 Principle XIV)
 *
 * Tests Router Agent's ability to contextualize short customer responses
 * by reading conversation history and building explicit messages for specialist agents.
 *
 * Pattern: Short response (≤5 chars) → Read history → Extract context → Build explicit message
 *
 * @see .specify/memory/constitution.md Principle XIV
 * @see specs/128-agent-responsibility-separation/spec-CLEAN.md FR-3
 */

import { PrismaClient } from "@prisma/client"
import { LLMRouterService } from "../../src/application/services/llm-router.service"

const prisma = new PrismaClient()

describe("Context Interpretation Pattern (Principle XIV)", () => {
  let workspaceId: string
  let customerId: string
  let conversationId: string
  let llmRouterService: LLMRouterService

  beforeAll(async () => {
    // Create test workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: "Test Context Interpretation",
        businessName: "Test Business",
        challengeStatus: true,
        debugMode: true, // Skip billing
      },
    })
    workspaceId = workspace.id

    // Create test customer
    const customer = await prisma.customers.create({
      data: {
        workspaceId,
        nameUser: "Mario Rossi",
        phone: "+39 333 1234567",
        email: "mario.rossi@test.com",
        languageUser: "it",
      },
    })
    customerId = customer.id

    // Create conversation session
    const session = await prisma.chatSession.create({
      data: {
        workspaceId,
        customerId,
        status: "active",
      },
    })
    conversationId = session.id

    llmRouterService = new LLMRouterService()
  })

  afterAll(async () => {
    // Cleanup
    await prisma.chatSession.deleteMany({ where: { workspaceId } })
    await prisma.customers.deleteMany({ where: { workspaceId } })
    await prisma.workspace.delete({ where: { id: workspaceId } })
    await prisma.$disconnect()
  })

  describe("CART_MANAGEMENT Contextualization", () => {
    it("should contextualize 'SI' as cart confirmation", async () => {
      // Arrange: Create conversation history
      const history = [
        {
          role: "assistant" as const,
          content:
            "Aggiungo Parmigiano Reggiano DOP (PARM-001) al carrello. Confermi?",
        },
        { role: "user" as const, content: "SI" },
      ]

      // Act: Route message (Router should contextualize)
      const result = await llmRouterService.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        message: "SI",
        conversationHistory: history,
        customerLanguage: "it",
        customerName: "Mario Rossi",
      })

      // Assert
      expect(result.agentUsed).toBe("CART_MANAGEMENT")
      expect(result.contextualizedMessage).toContain("conferma")
      expect(result.contextualizedMessage).toContain("PARM-001")
      expect(result.confidence).toBeGreaterThan(0.9)
    })

    it("should contextualize 'NO' as cart rejection", async () => {
      const history = [
        {
          role: "assistant" as const,
          content: "Aggiungo 2 unità di Prosciutto Crudo (PROS-002). Confermi?",
        },
        { role: "user" as const, content: "NO" },
      ]

      const result = await llmRouterService.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        message: "NO",
        conversationHistory: history,
        customerLanguage: "it",
        customerName: "Mario Rossi",
      })

      expect(result.agentUsed).toBe("CART_MANAGEMENT")
      expect(result.contextualizedMessage).toContain("rifiuta")
      expect(result.contextualizedMessage).toContain("PROS-002")
    })
  })

  describe("NOTIFICATIONS Contextualization", () => {
    it("should contextualize 'SI' as notification subscription confirmation", async () => {
      const history = [
        {
          role: "assistant" as const,
          content:
            "Vuoi attivare le notifiche push per ricevere offerte esclusive?",
        },
        { role: "user" as const, content: "SI" },
      ]

      const result = await llmRouterService.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        message: "SI",
        conversationHistory: history,
        customerLanguage: "it",
        customerName: "Mario Rossi",
      })

      expect(result.agentUsed).toBe("NOTIFICATIONS")
      expect(result.contextualizedMessage).toContain("conferma")
      expect(result.contextualizedMessage).toContain("notifiche push")
    })

    it("should contextualize 'NO' as notification rejection", async () => {
      const history = [
        {
          role: "assistant" as const,
          content: "Vuoi attivare le notifiche push?",
        },
        { role: "user" as const, content: "NO" },
      ]

      const result = await llmRouterService.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        message: "NO",
        conversationHistory: history,
        customerLanguage: "it",
        customerName: "Mario Rossi",
      })

      expect(result.agentUsed).toBe("NOTIFICATIONS")
      expect(result.contextualizedMessage).toContain("rifiuta")
      expect(result.contextualizedMessage).toContain("notifiche")
    })
  })

  describe("PRODUCT_SEARCH Contextualization", () => {
    it("should contextualize '1' as product selection", async () => {
      const history = [
        {
          role: "assistant" as const,
          content:
            "Ecco i risultati:\n1. Parmigiano Reggiano DOP (PARM-001) - €35.00\n2. Grana Padano DOP (GRAN-001) - €28.00\n\nQuale preferisci?",
        },
        { role: "user" as const, content: "1" },
      ]

      const result = await llmRouterService.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        message: "1",
        conversationHistory: history,
        customerLanguage: "it",
        customerName: "Mario Rossi",
      })

      expect(result.agentUsed).toBe("PRODUCT_SEARCH")
      expect(result.contextualizedMessage).toContain("Parmigiano Reggiano DOP")
      expect(result.contextualizedMessage).toContain("PARM-001")
    })

    it("should contextualize '2' as second product selection", async () => {
      const history = [
        {
          role: "assistant" as const,
          content:
            "1. Pasta Spaghetti (PAST-001) €2.50\n2. Pasta Penne (PAST-002) €2.30\n\nScegli:",
        },
        { role: "user" as const, content: "2" },
      ]

      const result = await llmRouterService.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        message: "2",
        conversationHistory: history,
        customerLanguage: "it",
        customerName: "Mario Rossi",
      })

      expect(result.agentUsed).toBe("PRODUCT_SEARCH")
      expect(result.contextualizedMessage).toContain("Pasta Penne")
      expect(result.contextualizedMessage).toContain("PAST-002")
    })
  })

  describe("ORDER_TRACKING Contextualization", () => {
    it("should contextualize '1' as order selection", async () => {
      const history = [
        {
          role: "assistant" as const,
          content:
            "Ecco i tuoi ordini:\n1. Ordine #ORD-12345 del 10/11/2024 - €45.00 (In transito)\n2. Ordine #ORD-12344 del 05/11/2024 - €32.00 (Consegnato)\n\nQuale vuoi tracciare?",
        },
        { role: "user" as const, content: "1" },
      ]

      const result = await llmRouterService.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        message: "1",
        conversationHistory: history,
        customerLanguage: "it",
        customerName: "Mario Rossi",
      })

      expect(result.agentUsed).toBe("ORDER_TRACKING")
      expect(result.contextualizedMessage).toContain("ORD-12345")
    })
  })

  describe("PROFILE_MANAGEMENT Contextualization", () => {
    it("should contextualize 'SI' as profile update confirmation", async () => {
      const history = [
        {
          role: "assistant" as const,
          content:
            "Vuoi modificare il tuo indirizzo email da mario.rossi@test.com?",
        },
        { role: "user" as const, content: "SI" },
      ]

      const result = await llmRouterService.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        message: "SI",
        conversationHistory: history,
        customerLanguage: "it",
        customerName: "Mario Rossi",
      })

      expect(result.agentUsed).toBe("PROFILE_MANAGEMENT")
      expect(result.contextualizedMessage).toContain("conferma")
      expect(result.contextualizedMessage).toContain("email")
    })
  })

  describe("Edge Cases", () => {
    it("should handle ambiguous short response (no clear context)", async () => {
      const history = [
        { role: "assistant" as const, content: "Ciao! Come posso aiutarti?" },
        { role: "user" as const, content: "SI" },
      ]

      const result = await llmRouterService.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        message: "SI",
        conversationHistory: history,
        customerLanguage: "it",
        customerName: "Mario Rossi",
      })

      // Should route to CUSTOMER_SUPPORT for clarification
      expect(result.agentUsed).toBe("CUSTOMER_SUPPORT")
      expect(result.confidence).toBeLessThan(0.8)
    })

    it("should NOT contextualize normal messages", async () => {
      const history = [
        {
          role: "assistant" as const,
          content: "Aggiungo Parmigiano al carrello?",
        },
      ]

      const normalMessage = "Voglio aggiungere il Parmigiano al carrello"

      const result = await llmRouterService.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        message: normalMessage,
        conversationHistory: history,
        customerLanguage: "it",
        customerName: "Mario Rossi",
      })

      // Should use original message (no contextualization needed)
      expect(result.contextualizedMessage).toBe(normalMessage)
    })

    it("should handle multiple questions in history (use last one)", async () => {
      const history = [
        {
          role: "assistant" as const,
          content: "Vuoi attivare le notifiche push?",
        },
        {
          role: "assistant" as const,
          content: "Oppure preferisci aggiungere prodotti al carrello?",
        },
        { role: "user" as const, content: "SI" },
      ]

      const result = await llmRouterService.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        message: "SI",
        conversationHistory: history,
        customerLanguage: "it",
        customerName: "Mario Rossi",
      })

      // Should use LAST question (cart)
      expect(result.agentUsed).toBe("CART_MANAGEMENT")
      expect(result.contextualizedMessage).toContain("carrello")
    })
  })

  describe("Performance & Accuracy", () => {
    it("should maintain >95% accuracy for cart confirmations", async () => {
      const testCases = [
        { response: "SI", expected: "CART_MANAGEMENT" },
        { response: "si", expected: "CART_MANAGEMENT" },
        { response: "Sì", expected: "CART_MANAGEMENT" },
        { response: "OK", expected: "CART_MANAGEMENT" },
        { response: "ok", expected: "CART_MANAGEMENT" },
      ]

      const history = [
        {
          role: "assistant" as const,
          content: "Aggiungo al carrello. Confermi?",
        },
      ]

      let correctCount = 0

      for (const testCase of testCases) {
        const result = await llmRouterService.routeMessage({
          workspaceId,
          customerId,
          conversationId,
          message: testCase.response,
          conversationHistory: [
            ...history,
            { role: "user" as const, content: testCase.response },
          ],
          customerLanguage: "it",
          customerName: "Mario Rossi",
        })

        if (result.agentUsed === testCase.expected) correctCount++
      }

      const accuracy = (correctCount / testCases.length) * 100
      expect(accuracy).toBeGreaterThanOrEqual(95)
    })

    it("should contextualize within <1 second", async () => {
      const history = [
        {
          role: "assistant" as const,
          content: "Aggiungo al carrello?",
        },
        { role: "user" as const, content: "SI" },
      ]

      const startTime = Date.now()

      await llmRouterService.routeMessage({
        workspaceId,
        customerId,
        conversationId,
        message: "SI",
        conversationHistory: history,
        customerLanguage: "it",
        customerName: "Mario Rossi",
      })

      const executionTime = Date.now() - startTime

      expect(executionTime).toBeLessThan(1000) // <1 second
    })
  })
})
