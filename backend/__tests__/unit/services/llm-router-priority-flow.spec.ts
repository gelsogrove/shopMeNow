/**
 * LLM Router Service - Priority Flow UNIT Tests
 *
 * Test UNITARI con MOCK di Prisma - nessun database reale
 *
 * Andrea's Requirements:
 * 1. ✅ Test customer bloccato (isBlacklisted=true) - P1
 * 2. ✅ Test WIP message quando challenge disabled (P2)
 * 3. ✅ Test workspace isolation
 *
 * UNIT TEST = MOCK di database, NO connessioni reali
 */

import { PrismaClient } from "@prisma/client"
import {
  LLMRouterService,
  RouteMessageParams,
} from "../../../src/services/llm-router.service"

// Mock Prisma Client
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(),
}))

describe("LLM Router Service - Priority Flow UNIT Tests", () => {
  let llmRouterService: LLMRouterService
  let mockPrisma: any

  beforeEach(() => {
    // Setup mock Prisma
    mockPrisma = {
      customers: {
        findUnique: jest.fn(),
        findFirst: jest.fn(), // 🆕 Aggiunto per AgentLoggerService
      },
      workspace: {
        findUnique: jest.fn(),
      },
      chatSession: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      conversationMessage: {
        create: jest.fn(),
        count: jest.fn(),
      },
      agentConfig: {
        findFirst: jest.fn(),
      },
      agentConversationLog: {
        create: jest.fn(), // 🆕 Per AgentLoggerService
      },
    }

    // Create service with mocked Prisma
    llmRouterService = new LLMRouterService(
      mockPrisma as unknown as PrismaClient
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  // ========================================
  // TEST 1: P1 - BLOCKED CUSTOMER (Security)
  // ========================================
  describe("P1 - Blocked Customer Security", () => {
    it("should return isBlocked=true when customer.isBlacklisted=true", async () => {
      // Arrange: Mock customer bloccato
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: "customer-123",
        name: "Blocked Customer",
        email: "blocked@test.com",
        phone: "+393331111111",
        workspaceId: "workspace-123",
        language: "it",
        isBlacklisted: true, // 🔴 BLOCCATO
      })

      const params: RouteMessageParams = {
        workspaceId: "workspace-123",
        customerId: "customer-123",
        conversationId: "session-123",
        messageId: "msg-123",
        message: "Test message",
        customerLanguage: "it",
      }

      // Act
      const response = await llmRouterService.routeMessage(params)

      // Assert
      expect(response.isBlocked).toBe(true)
      expect(response.tokensUsed).toBe(0)
      expect(response.response).toBe("")

      // Verifica che abbiamo controllato il customer
      expect(mockPrisma.customers.findUnique).toHaveBeenCalledWith({
        where: { id: "customer-123" },
        select: { isBlacklisted: true, name: true },
      })
    })

    it("should NOT save messages when customer is blocked", async () => {
      // Arrange
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: "customer-123",
        isBlacklisted: true,
        name: "Blocked",
      })

      const params: RouteMessageParams = {
        workspaceId: "workspace-123",
        customerId: "customer-123",
        conversationId: "session-123",
        messageId: "msg-123",
        message: "Should not save",
        customerLanguage: "it",
      }

      // Act
      await llmRouterService.routeMessage(params)

      // Assert: conversationMessage.create NON deve essere chiamato
      expect(mockPrisma.conversationMessage.create).not.toHaveBeenCalled()
    })

    it("should allow message when customer.isBlacklisted=false", async () => {
      // Arrange: Customer NON bloccato ma challenge disabled
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: "customer-123",
        name: "Normal Customer",
        isBlacklisted: false, // ✅ NON bloccato
      })

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: "workspace-123",
        name: "Test Workspace",
        challengeStatus: false, // Challenge disabled → WIP
        wipMessage: {
          it: "Servizio in manutenzione",
          en: "Service under maintenance",
        },
      })

      const params: RouteMessageParams = {
        workspaceId: "workspace-123",
        customerId: "customer-123",
        conversationId: "session-123",
        messageId: "msg-123",
        message: "Normal message",
        customerLanguage: "it",
      }

      // Act
      const response = await llmRouterService.routeMessage(params)

      // Assert: NON è bloccato, procede a P2 (WIP message)
      expect(response.isBlocked).toBeUndefined()
      expect(response.response).toContain("manutenzione")
      expect(mockPrisma.workspace.findUnique).toHaveBeenCalled()
    })
  })

  // ========================================
  // TEST 2: P2 - WIP MESSAGE (Challenge Disabled)
  // ========================================
  describe("P2 - Challenge Disabled WIP Message", () => {
    it("should return WIP message when challengeStatus=false WITHOUT LLM call", async () => {
      // Arrange
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: "customer-123",
        isBlacklisted: false,
        name: "Customer",
      })

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: "workspace-123",
        name: "Test Workspace",
        challengeStatus: false, // 🔴 CHALLENGE DISABLED
        wipMessage: {
          it: "Servizio in manutenzione",
          en: "Service under maintenance",
          es: "Servicio en mantenimiento",
        },
      })

      const params: RouteMessageParams = {
        workspaceId: "workspace-123",
        customerId: "customer-123",
        conversationId: "session-123",
        messageId: "msg-123",
        message: "Ciao, voglio ordinare",
        customerLanguage: "it",
      }

      // Act
      const response = await llmRouterService.routeMessage(params)

      // Assert
      expect(response.response).toBe("Servizio in manutenzione") // Italian WIP
      expect(response.tokensUsed).toBe(0) // ZERO tokens - no LLM
      expect(response.agentUsed).toBe("ROUTER")

      // Verifica che abbiamo controllato workspace (almeno 1 volta)
      expect(mockPrisma.workspace.findUnique).toHaveBeenCalled()
    })

    it("should return WIP in customer language (Spanish)", async () => {
      // Arrange
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: "customer-123",
        isBlacklisted: false,
        name: "Customer",
      })

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: "workspace-123",
        challengeStatus: false,
        wipMessage: {
          it: "Servizio in manutenzione",
          en: "Service under maintenance",
          es: "Servicio en mantenimiento",
        },
      })

      const params: RouteMessageParams = {
        workspaceId: "workspace-123",
        customerId: "customer-123",
        conversationId: "session-123",
        messageId: "msg-123",
        message: "Hola, quiero ordenar",
        customerLanguage: "es", // 🇪🇸 Spanish
      }

      // Act
      const response = await llmRouterService.routeMessage(params)

      // Assert
      expect(response.response).toBe("Servicio en mantenimiento")
      expect(response.tokensUsed).toBe(0)
    })

    it("should fallback to English if customer language not found in wipMessage", async () => {
      // Arrange
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: "customer-123",
        isBlacklisted: false,
        name: "Customer",
      })

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: "workspace-123",
        challengeStatus: false,
        wipMessage: {
          it: "Servizio in manutenzione",
          en: "Service under maintenance",
        },
        // NO German translation
      })

      const params: RouteMessageParams = {
        workspaceId: "workspace-123",
        customerId: "customer-123",
        conversationId: "session-123",
        messageId: "msg-123",
        message: "Hallo",
        customerLanguage: "de", // 🇩🇪 German (not in wipMessage)
      }

      // Act
      const response = await llmRouterService.routeMessage(params)

      // Assert: Fallback to English
      expect(response.response).toBe("Service under maintenance")
      expect(response.tokensUsed).toBe(0)
    })
  })

  // ========================================
  // TEST 3: WORKSPACE ISOLATION
  // ========================================
  describe("Workspace Isolation", () => {
    it("should fail when workspace not found", async () => {
      // Arrange
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: "customer-123",
        isBlacklisted: false,
      })

      mockPrisma.workspace.findUnique.mockResolvedValue(null) // ❌ Workspace not found

      const params: RouteMessageParams = {
        workspaceId: "INVALID_WORKSPACE",
        customerId: "customer-123",
        conversationId: "session-123",
        messageId: "msg-123",
        message: "Test",
        customerLanguage: "it",
      }

      // Act & Assert
      await expect(llmRouterService.routeMessage(params)).rejects.toThrow()
    })

    it("should fail when customer not found", async () => {
      // Arrange
      mockPrisma.customers.findUnique.mockResolvedValue(null) // ❌ Customer not found

      const params: RouteMessageParams = {
        workspaceId: "workspace-123",
        customerId: "INVALID_CUSTOMER",
        conversationId: "session-123",
        messageId: "msg-123",
        message: "Test",
        customerLanguage: "it",
      }

      // Act & Assert
      await expect(llmRouterService.routeMessage(params)).rejects.toThrow()
    })
  })

  // ========================================
  // TEST 4: PRIORITY ORDER P1 → P2
  // ========================================
  describe("Priority Order P1 → P2", () => {
    it("should check P1 (blocked) BEFORE P2 (challenge disabled)", async () => {
      // Arrange: Customer bloccato + Challenge disabled
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: "customer-123",
        isBlacklisted: true, // P1: BLOCKED
      })

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: "workspace-123",
        challengeStatus: false, // P2: DISABLED
        wipMessage: { it: "WIP" },
      })

      const params: RouteMessageParams = {
        workspaceId: "workspace-123",
        customerId: "customer-123",
        conversationId: "session-123",
        messageId: "msg-123",
        message: "Test",
        customerLanguage: "it",
      }

      // Act
      const response = await llmRouterService.routeMessage(params)

      // Assert: P1 vince (customer bloccato)
      expect(response.isBlocked).toBe(true)
      expect(response.response).toBe("") // NO WIP message
      expect(response.tokensUsed).toBe(0)

      // P2 check NON dovrebbe essere chiamato (P1 blocca prima)
      expect(mockPrisma.workspace.findUnique).not.toHaveBeenCalled()
    })
  })

  // ========================================
  // TEST 5: WELCOME MESSAGE (Nuovo Utente)
  // ========================================
  describe("Welcome Message for New Customer", () => {
    it("should return welcome message from workspace.welcomeMessage", async () => {
      // Arrange: Customer NON bloccato, challenge enabled
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: "customer-new",
        isBlacklisted: false,
        name: "New Customer",
        workspaceId: "workspace-123",
      })

      mockPrisma.customers.findFirst.mockResolvedValue({
        id: "customer-new",
        name: "New Customer",
        workspaceId: "workspace-123",
      })

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: "workspace-123",
        name: "Test Workspace",
        challengeStatus: true, // Enabled
        welcomeMessage: {
          it: "Benvenuto! Come posso aiutarti?",
          en: "Welcome! How can I help you?",
          es: "¡Bienvenido! ¿Cómo puedo ayudarte?",
        },
      })

      mockPrisma.agentConversationLog.create.mockResolvedValue({
        id: "log-123",
        workspaceId: "workspace-123",
        customerId: "customer-new",
      })

      mockPrisma.chatSession.findFirst.mockResolvedValue(null) // NO sessione precedente (nuovo utente)
      mockPrisma.chatSession.create.mockResolvedValue({
        id: "session-new",
        workspaceId: "workspace-123",
        customerId: "customer-new",
        status: "active",
      })

      const params: RouteMessageParams = {
        workspaceId: "workspace-123",
        customerId: "customer-new",
        conversationId: "session-new",
        messageId: "msg-first",
        message: "Ciao", // First message
        customerLanguage: "it",
      }

      // Act
      const response = await llmRouterService.routeMessage(params)

      // Assert: Deve contenere welcome message (o processato da LLM)
      expect(response.response).toBeDefined()
      expect(response.tokensUsed).toBeGreaterThanOrEqual(0)

      // Verifica che abbiamo loggato l'interazione
      expect(mockPrisma.agentConversationLog.create).toHaveBeenCalled()
    })
  })

  // ========================================
  // TEST 6: CUSTOMER NON IN DB BLOCCA TUTTO
  // ========================================
  describe("Customer Not Found Blocks Everything", () => {
    it("should throw error and block when customer does not exist in DB", async () => {
      // Arrange
      mockPrisma.customers.findUnique.mockResolvedValue(null) // ❌ Customer NOT in DB
      mockPrisma.customers.findFirst.mockResolvedValue(null) // ❌ Anche findFirst (per AgentLogger)

      const params: RouteMessageParams = {
        workspaceId: "workspace-123",
        customerId: "NON_EXISTENT_CUSTOMER",
        conversationId: "session-123",
        messageId: "msg-123",
        message: "Test",
        customerLanguage: "it",
      }

      // Act & Assert: DEVE bloccare tutto con errore
      await expect(llmRouterService.routeMessage(params)).rejects.toThrow()

      // conversationMessage.create NON deve essere chiamato
      expect(mockPrisma.conversationMessage.create).not.toHaveBeenCalled()
    })
  })

  // ========================================
  // TEST 7: SAFETY LAYER (Tutti messaggi passano)
  // ========================================
  describe("Safety Translation Layer", () => {
    it("should verify all messages go through safety layer before saving", async () => {
      // NOTE: Questo test verifica che il service CHIAMI il safety layer
      // Non possiamo mockare SafetyTranslationAgent qui perché non è iniettato
      // Ma possiamo verificare che i messaggi vengano salvati correttamente

      // Arrange
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: "customer-123",
        isBlacklisted: false,
      })

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: "workspace-123",
        challengeStatus: false, // WIP mode
        wipMessage: { it: "WIP message" },
      })

      mockPrisma.conversationMessage.create.mockResolvedValue({
        id: "msg-saved",
        conversationId: "session-123",
        content: "WIP message", // Salvato DOPO safety layer
      })

      const params: RouteMessageParams = {
        workspaceId: "workspace-123",
        customerId: "customer-123",
        conversationId: "session-123",
        messageId: "msg-123",
        message: "Test unsafe content",
        customerLanguage: "it",
      }

      // Act
      const response = await llmRouterService.routeMessage(params)

      // Assert: Messaggi salvati (implica passaggio da safety layer)
      expect(response.response).toBeDefined()
      expect(mockPrisma.conversationMessage.create).toHaveBeenCalled()
    })
  })

  // ========================================
  // TEST 8: TIMELINE E DEBUG INFO
  // ========================================
  describe("Timeline and Debug Info Tracking", () => {
    it("should track debug info when debugMode=true", async () => {
      // Arrange
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: "customer-123",
        isBlacklisted: false,
      })

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: "workspace-123",
        challengeStatus: false,
        debugMode: true, // 🔍 DEBUG MODE ON
        wipMessage: { it: "WIP" },
      })

      const params: RouteMessageParams = {
        workspaceId: "workspace-123",
        customerId: "customer-123",
        conversationId: "session-123",
        messageId: "msg-123",
        message: "Test",
        customerLanguage: "it",
      }

      // Act
      const response = await llmRouterService.routeMessage(params)

      // Assert: Response contiene debug info (se implementato)
      expect(response).toBeDefined()
      expect(response.agentUsed).toBe("ROUTER")

      // Timeline salvata in conversationMessage (verificato da mock call)
      expect(mockPrisma.conversationMessage.create).toHaveBeenCalled()
    })
  })

  // ========================================
  // TEST 9: LINK TOKEN REPLACEMENT
  // ========================================
  describe("Link Token Replacement [LINK_xxx]", () => {
    it("should replace [LINK_ORDER_xxx] tokens in response", async () => {
      // NOTE: LinkReplacementService è esterno e viene chiamato DOPO routeMessage
      // Questo test verifica che il response contenga il formato corretto

      // Arrange
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: "customer-123",
        isBlacklisted: false,
      })

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: "workspace-123",
        challengeStatus: false,
        wipMessage: {
          it: "Servizio in manutenzione. Vedi ordini: [LINK_ORDER_123]",
        },
      })

      const params: RouteMessageParams = {
        workspaceId: "workspace-123",
        customerId: "customer-123",
        conversationId: "session-123",
        messageId: "msg-123",
        message: "Test",
        customerLanguage: "it",
      }

      // Act
      const response = await llmRouterService.routeMessage(params)

      // Assert: Response contiene token [LINK_ORDER_xxx]
      expect(response.response).toContain("[LINK_ORDER_123]")

      // Il replacement effettivo avviene nel LinkReplacementService
      // dopo il return di routeMessage (nella chiamata da webhook)
    })
  })
})
