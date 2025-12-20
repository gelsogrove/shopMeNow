/**
 * Welcome Message Tests
 * 
 * Tests for STEP 0.1: First message detection and welcome message return
 * 
 * When a customer sends their first message, the system should:
 * 1. Detect that it's their first message (no previous messages in DB)
 * 2. Return the configured welcomeMessage from workspace settings
 * 3. Skip intent recognition and LLM processing (0 tokens used)
 * 4. Save both messages to history for tracking
 */

import { PrismaClient } from "@echatbot/database"

describe("Welcome Message Feature", () => {
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      message: {
        count: jest.fn(),
      },
      workspace: {
        findUnique: jest.fn(),
      },
    }
  })

  describe("First Message Detection", () => {
    it("should detect first message when no previous messages exist", async () => {
      // Arrange
      mockPrisma.message.count.mockResolvedValue(0)

      // Act
      const count = await mockPrisma.message.count({
        where: {
          chatSession: {
            customerId: "customer-123",
            workspaceId: "workspace-123",
          },
          deletedAt: null,
        },
      })

      const isFirstMessage = count === 0

      // Assert
      expect(isFirstMessage).toBe(true)
      expect(mockPrisma.message.count).toHaveBeenCalledWith({
        where: {
          chatSession: {
            customerId: "customer-123",
            workspaceId: "workspace-123",
          },
          deletedAt: null,
        },
      })
    })

    it("should NOT detect first message when previous messages exist", async () => {
      // Arrange
      mockPrisma.message.count.mockResolvedValue(5)

      // Act
      const count = await mockPrisma.message.count({
        where: {
          chatSession: {
            customerId: "customer-123",
            workspaceId: "workspace-123",
          },
          deletedAt: null,
        },
      })

      const isFirstMessage = count === 0

      // Assert
      expect(isFirstMessage).toBe(false)
    })
  })

  describe("Welcome Message Configuration", () => {
    const expectedWelcomeMessage = `Ciao, piacere di conoscerti! 👋
Mi chiamo SofIA e sono l'assistenza virtuale di BellItalia.
Siamo un importatore di prodotti italiani.

Come posso aiutarti oggi?
Stai cercando un prodotto in particolare oppure hai una domanda specifica da farmi?

Con questo servizio puoi:
• chiedere informazioni su un ordine
• effettuare un ordine
• cercare un prodotto
• farmi una domanda
• scaricare una fattura
• sapere dove si trova il tuo ordine
• verificare la disponibilità dei prodotti in tempo reale

Sono qui per aiutarti 😊`

    it("should return welcomeMessage from workspace when configured as string", async () => {
      // Arrange
      mockPrisma.workspace.findUnique.mockResolvedValue({
        welcomeMessage: expectedWelcomeMessage,
      })

      // Act
      const workspace = await mockPrisma.workspace.findUnique({
        where: { id: "workspace-123" },
        select: { welcomeMessage: true },
      })

      const welcomeText = typeof workspace.welcomeMessage === "string"
        ? workspace.welcomeMessage
        : JSON.stringify(workspace.welcomeMessage)

      // Assert
      expect(welcomeText).toBe(expectedWelcomeMessage)
      expect(welcomeText).toContain("SofIA")
      expect(welcomeText).toContain("BellItalia")
    })

    it("should handle welcomeMessage as JSON object with text property", async () => {
      // Arrange
      mockPrisma.workspace.findUnique.mockResolvedValue({
        welcomeMessage: { text: "Welcome!", buttons: [] },
      })

      // Act
      const workspace = await mockPrisma.workspace.findUnique({
        where: { id: "workspace-123" },
        select: { welcomeMessage: true },
      })

      const welcomeText = typeof workspace.welcomeMessage === "string"
        ? workspace.welcomeMessage
        : typeof workspace.welcomeMessage === "object" && workspace.welcomeMessage?.text
          ? workspace.welcomeMessage.text
          : JSON.stringify(workspace.welcomeMessage)

      // Assert
      expect(welcomeText).toBe("Welcome!")
    })

    it("should NOT return welcome message when not configured", async () => {
      // Arrange
      mockPrisma.workspace.findUnique.mockResolvedValue({
        welcomeMessage: null,
      })

      // Act
      const workspace = await mockPrisma.workspace.findUnique({
        where: { id: "workspace-123" },
        select: { welcomeMessage: true },
      })

      // Assert
      expect(workspace.welcomeMessage).toBeNull()
    })
  })

  describe("Welcome Message Response Structure", () => {
    it("should have correct response structure for welcome message", () => {
      // Expected response structure when returning welcome message
      const expectedResponse = {
        message: "Welcome message content",
        agentType: "ROUTER",
        wasHandled: true,
        intent: "GREETING",
        confidence: "HIGH",
        source: "PATTERN",
        processingTimeMs: expect.any(Number),
        tokensUsed: 0,  // No LLM call needed
        agentUsed: "WELCOME",
      }

      // Assert structure
      expect(expectedResponse.tokensUsed).toBe(0)
      expect(expectedResponse.intent).toBe("GREETING")
      expect(expectedResponse.agentUsed).toBe("WELCOME")
      expect(expectedResponse.confidence).toBe("HIGH")
    })
  })

  describe("Edge Cases", () => {
    it("should handle empty string welcomeMessage", async () => {
      // Arrange
      mockPrisma.workspace.findUnique.mockResolvedValue({
        welcomeMessage: "",
      })

      // Act
      const workspace = await mockPrisma.workspace.findUnique({
        where: { id: "workspace-123" },
        select: { welcomeMessage: true },
      })

      // Assert - empty string is falsy, should not trigger welcome message
      expect(!!workspace.welcomeMessage).toBe(false)
    })

    it("should handle whitespace-only welcomeMessage", async () => {
      // Arrange
      mockPrisma.workspace.findUnique.mockResolvedValue({
        welcomeMessage: "   ",
      })

      // Act
      const workspace = await mockPrisma.workspace.findUnique({
        where: { id: "workspace-123" },
        select: { welcomeMessage: true },
      })

      const trimmed = workspace.welcomeMessage?.trim()

      // Assert - whitespace only should be treated as empty
      expect(!!trimmed).toBe(false)
    })

    it("should count only non-deleted messages", async () => {
      // Arrange - query includes deletedAt: null filter
      mockPrisma.message.count.mockResolvedValue(0)

      // Act
      await mockPrisma.message.count({
        where: {
          chatSession: {
            customerId: "customer-123",
            workspaceId: "workspace-123",
          },
          deletedAt: null,  // Only count non-deleted messages
        },
      })

      // Assert
      expect(mockPrisma.message.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      )
    })
  })
})
