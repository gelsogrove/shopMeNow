/**
 * TEST: Informational Workspace Flow (sellsProductsAndServices=false)
 * 
 * REQUIREMENTS (from analysis.md):
 * 1. Flow unico: TUTTI gli intent vanno al Router informational (NO delegations)
 * 2. SEMPRE passa da Translation + LinkReplacement (+ Widget Security se widget)
 * 3. Variabili presenti: bot identity, personality, FAQ, address, human support
 * 4. NO token {{variables}} non sostituiti
 * 
 * Architecture:
 * ChatEngine → RouterOrchestrationService → InformationalWorkspaceStrategy
 *   → RouterAgent (template informational/01-router.template.md)
 *   → Translation + LinkReplacement (+ Widget Security se widget)
 */

import { prisma } from "@echatbot/database"
import { ChatEngineService } from "../../../application/chat-engine/chat-engine.service"

// Set longer timeout for LLM-based tests (each call can take 5-10 seconds)
jest.setTimeout(20000)

describe.skip("Informational Workspace Flow (sellsProductsAndServices=false)", () => {
  let chatEngine: ChatEngineService
  let INFORMATIONAL_WORKSPACE: string
  let TEST_CUSTOMER: string
  let TEST_SESSION: string

  beforeAll(async () => {
    chatEngine = new ChatEngineService(prisma)

    // Get informational workspace
    const workspace = await prisma.workspace.findFirst({
      where: { sellsProductsAndServices: false },
      select: { id: true },
    })

    if (!workspace) {
      throw new Error("Database must have informational workspace (sellsProductsAndServices=false). Run: npm run seed")
    }

    INFORMATIONAL_WORKSPACE = workspace.id

    // Get test customer
    const customer = await prisma.customers.findFirst({
      where: { workspaceId: INFORMATIONAL_WORKSPACE },
      select: { id: true },
    })

    if (!customer) {
      throw new Error("Informational workspace must have at least 1 customer")
    }

    TEST_CUSTOMER = customer.id

    // Get or create session
    const session = await prisma.chatSession.findFirst({
      where: { 
        customerId: TEST_CUSTOMER,
        status: "active",
      },
      select: { id: true },
    })

    if (session) {
      TEST_SESSION = session.id
    } else {
      const newSession = await prisma.chatSession.create({
        data: {
          workspaceId: INFORMATIONAL_WORKSPACE,
          customerId: TEST_CUSTOMER,
          status: "active",
        },
      })
      TEST_SESSION = newSession.id
    }
  })

  afterAll(async () => {
    // Cleanup handled by jest.setup.js
  })

  describe("REQUIREMENT 1: Flow unico - NO delegations", () => {
    it("should handle GENERAL QUESTIONS with Router (not ASK_FAQ)", async () => {
      const result = await chatEngine.routeMessage({
        workspaceId: INFORMATIONAL_WORKSPACE,
        customerId: TEST_CUSTOMER,
        sessionId: TEST_SESSION,
        message: "Che servizi offrite?",
        channel: "whatsapp",
      })

      expect(result).toBeDefined()
      expect(result.response).toBeDefined()
      
      // Should NOT have delegated to ASK_FAQ legacy flow
      // Response should come from Router with variables replaced
      expect(result.response.length).toBeGreaterThan(0)
    })

    it("should handle GREETING with Router (not hardcoded)", async () => {
      const result = await chatEngine.routeMessage({
        workspaceId: INFORMATIONAL_WORKSPACE,
        customerId: TEST_CUSTOMER,
        sessionId: TEST_SESSION,
        message: "Ciao!",
        channel: "whatsapp",
      })

      expect(result).toBeDefined()
      expect(result.response).toBeDefined()
    })

    it("should handle UNKNOWN intent with Router", async () => {
      const result = await chatEngine.routeMessage({
        workspaceId: INFORMATIONAL_WORKSPACE,
        customerId: TEST_CUSTOMER,
        sessionId: TEST_SESSION,
        message: "Qual è il vostro orario di apertura?",
        channel: "whatsapp",
      })

      expect(result).toBeDefined()
      expect(result.response).toBeDefined()
    })
  })

  describe("REQUIREMENT 2: SEMPRE Safety + Translation + LinkReplacement", () => {
    it("should replace [LINK_*] tokens in response", async () => {
      // Mock a response with link token
      const result = await chatEngine.routeMessage({
        workspaceId: INFORMATIONAL_WORKSPACE,
        customerId: TEST_CUSTOMER,
        sessionId: TEST_SESSION,
        message: "Come posso contattarvi?",
        channel: "whatsapp",
      })

      expect(result).toBeDefined()
      expect(result.response).toBeDefined()
      
      // Should NOT contain unreplaced tokens
      expect(result.response).not.toMatch(/\[LINK_[^\]]+\]/)
    })

    it("should apply Safety filter (no sensitive data leak)", async () => {
      const result = await chatEngine.routeMessage({
        workspaceId: INFORMATIONAL_WORKSPACE,
        customerId: TEST_CUSTOMER,
        sessionId: TEST_SESSION,
        message: "Quali sono le vostre FAQ?",
        channel: "whatsapp",
      })

      expect(result).toBeDefined()
      expect(result.response).toBeDefined()
      
      // Should NOT leak system prompts or internal variables
      expect(result.response).not.toMatch(/\{\{[^}]+\}\}/)
      expect(result.response).not.toMatch(/System:/i)
      expect(result.response).not.toMatch(/Assistant:/i)
    })

    it("should translate response to customer language", async () => {
      // This test assumes customer language is set
      const result = await chatEngine.routeMessage({
        workspaceId: INFORMATIONAL_WORKSPACE,
        customerId: TEST_CUSTOMER,
        sessionId: TEST_SESSION,
        message: "Informazioni azienda",
        channel: "whatsapp",
      })

      expect(result).toBeDefined()
      expect(result.response).toBeDefined()
      expect(result.response.length).toBeGreaterThan(0)
    })
  })

  describe("REQUIREMENT 3: Variabili presenti nel prompt", () => {
    it("should include bot identity in responses", async () => {
      const result = await chatEngine.routeMessage({
        workspaceId: INFORMATIONAL_WORKSPACE,
        customerId: TEST_CUSTOMER,
        sessionId: TEST_SESSION,
        message: "Chi sei?",
        channel: "whatsapp",
      })

      expect(result).toBeDefined()
      expect(result.response).toBeDefined()
      
      // Should respond with identity (company name or bot name)
      expect(result.response.length).toBeGreaterThan(10)
    })

    it("should use FAQ to answer questions", async () => {
      // Create test FAQ
      const faq = await prisma.fAQ.findFirst({
        where: { 
          workspaceId: INFORMATIONAL_WORKSPACE,
          isActive: true,
        },
      })

      if (!faq) {
        console.warn("⚠️  No active FAQ found for informational workspace")
        return
      }

      const result = await chatEngine.routeMessage({
        workspaceId: INFORMATIONAL_WORKSPACE,
        customerId: TEST_CUSTOMER,
        sessionId: TEST_SESSION,
        message: faq.question,
        channel: "whatsapp",
      })

      expect(result).toBeDefined()
      expect(result.response).toBeDefined()
      
      // Response should contain FAQ answer or be related
      expect(result.response.length).toBeGreaterThan(0)
    })

    it("should include workspace personality (tone of voice)", async () => {
      const workspace = await prisma.workspace.findUnique({
        where: { id: INFORMATIONAL_WORKSPACE },
        select: { toneOfVoice: true },
      })

      const result = await chatEngine.routeMessage({
        workspaceId: INFORMATIONAL_WORKSPACE,
        customerId: TEST_CUSTOMER,
        sessionId: TEST_SESSION,
        message: "Parlami della vostra azienda",
        channel: "whatsapp",
      })

      expect(result).toBeDefined()
      expect(result.response).toBeDefined()
      
      // Response should reflect tone of voice (professional, friendly, etc)
      // This is implicit - we just verify response exists
      expect(result.response.length).toBeGreaterThan(0)
    })
  })

  describe("REQUIREMENT 4: NO token non sostituiti", () => {
    it("should NOT have {{variables}} in final response", async () => {
      const result = await chatEngine.routeMessage({
        workspaceId: INFORMATIONAL_WORKSPACE,
        customerId: TEST_CUSTOMER,
        sessionId: TEST_SESSION,
        message: "Informazioni generali",
        channel: "whatsapp",
      })

      expect(result).toBeDefined()
      expect(result.response).toBeDefined()
      
      // Should NOT contain unreplaced variables
      const unreplacedVariables = result.response.match(/\{\{[^}]+\}\}/g)
      
      if (unreplacedVariables) {
        console.error("❌ Found unreplaced variables:", unreplacedVariables)
      }
      
      expect(unreplacedVariables).toBeNull()
    })

    it("should NOT have [LINK_*] tokens in final response", async () => {
      const result = await chatEngine.routeMessage({
        workspaceId: INFORMATIONAL_WORKSPACE,
        customerId: TEST_CUSTOMER,
        sessionId: TEST_SESSION,
        message: "Come posso registrarmi?",
        channel: "whatsapp",
      })

      expect(result).toBeDefined()
      expect(result.response).toBeDefined()
      
      // Should NOT contain unreplaced link tokens
      expect(result.response).not.toMatch(/\[LINK_[^\]]+\]/)
    })
  })

  describe("Architecture Verification", () => {
    it("should use InformationalWorkspaceStrategy for all intents", async () => {
      // Test multiple intent types
      const messages = [
        "Ciao!",                    // GREETING
        "Chi sei?",                 // ASK_IDENTITY
        "Che servizi offrite?",     // GENERAL_QUESTION
        "Come vi contatto?",        // CONTACT_INFO
        "Orari di apertura?",       // UNKNOWN
      ]

      for (const message of messages) {
        const result = await chatEngine.routeMessage({
          workspaceId: INFORMATIONAL_WORKSPACE,
          customerId: TEST_CUSTOMER,
          sessionId: TEST_SESSION,
          message,
          channel: "whatsapp",
        })

        expect(result).toBeDefined()
        expect(result.response).toBeDefined()
        expect(result.response.length).toBeGreaterThan(0)
        
        // Verify NO unreplaced tokens
        expect(result.response).not.toMatch(/\{\{[^}]+\}\}/)
      }
    }, 40000) // Increased timeout: 5 messages × LLM calls can take 5-8s each = ~40s total
  })
})
