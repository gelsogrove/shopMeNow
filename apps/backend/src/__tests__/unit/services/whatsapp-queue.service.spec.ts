import { PrismaClient } from "@echatbot/database"
import { WhatsAppQueueService } from "../../../services/whatsapp-queue.service"
import { WhatsAppProviderFactory } from "../../../services/whatsapp/whatsapp-provider.factory"

// Mock dependencies
jest.mock("@echatbot/database", () => ({
  PrismaClient: jest.fn(),
}))

jest.mock("../../../services/whatsapp/whatsapp-provider.factory")
jest.mock("../../../application/agents/SecurityAgent", () => ({
  SecurityAgent: jest.fn().mockImplementation(() => ({
    process: jest.fn().mockResolvedValue({ safe: true }),
  })),
}))
jest.mock("../../../application/services/subscription-billing.service", () => ({
  SubscriptionBillingService: jest.fn().mockImplementation(() => ({})),
}))
jest.mock("../../../utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}))

describe("WhatsAppQueueService", () => {
  let service: WhatsAppQueueService
  let mockPrisma: any
  let mockProvider: any
  let mockSecurityAgent: any

  beforeEach(() => {
    // Create mock Prisma client
    mockPrisma = {
      workspace: {
        findUnique: jest.fn(),
      },
      conversationMessage: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      whatsAppQueue: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    }

    // Mock SecurityAgent to return safe by default
    mockSecurityAgent = {
      process: jest.fn().mockResolvedValue({ safe: true }),
    }
    const SecurityAgentMock = require("../../../application/agents/SecurityAgent").SecurityAgent
    SecurityAgentMock.mockImplementation(() => mockSecurityAgent)

    // Create mock WhatsApp provider
    mockProvider = {
      sendTextMessage: jest.fn(),
      getProviderName: jest.fn().mockReturnValue("ultramsg"),
    }

    // Mock factory methods
    ;(WhatsAppProviderFactory.isConfigured as jest.Mock) = jest
      .fn()
      .mockReturnValue(true)
    ;(WhatsAppProviderFactory.getProviderDisplayName as jest.Mock) = jest
      .fn()
      .mockReturnValue("UltraMsg")
    ;(WhatsAppProviderFactory.create as jest.Mock) = jest
      .fn()
      .mockReturnValue(mockProvider)

    // Create service instance
    service = new WhatsAppQueueService(mockPrisma)
  })

  describe("validateAndSend", () => {
    it("should successfully send message via WhatsApp provider", async () => {
      // SCENARIO: Valid message needs to be sent via UltraMsg provider
      // RULE: Backend must call actual WhatsApp provider, not placeholder

      const mockMessage = {
        id: "msg_123",
        workspaceId: "ws_abc",
        customerId: "cust_xyz",
        phoneNumber: "+34654728753",
        messageContent: "Test message",
        conversationMessageId: "conv_456",
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        deliveredAt: null,
        channel: "whatsapp",
        visitorId: null,
      }

      const mockWorkspace = {
        id: "ws_abc",
        whatsappProvider: "ultramsg",
        ultraMsgInstanceId: "161048",
        ultraMsgToken: "test_token",
      }

      // Mock database responses
      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace)
      mockPrisma.conversationMessage.findUnique.mockResolvedValue({
        id: "conv_456",
        debugInfo: null,
      })
      mockPrisma.conversationMessage.update.mockResolvedValue({})

      // Mock provider success response
      mockProvider.sendTextMessage.mockResolvedValue({
        success: true,
        messageId: "wamid_123",
      })

      // Execute
      const result = await service.validateAndSend(mockMessage)

      // Verify SecurityAgent was called first
      expect(mockSecurityAgent.process).toHaveBeenCalledWith({
        workspaceId: "ws_abc",
        message: "Test message",
        customerId: "cust_xyz",
        customerName: "",
      })

      // Verify provider was called with correct parameters
      expect(WhatsAppProviderFactory.create).toHaveBeenCalledWith(mockWorkspace)
      expect(mockProvider.sendTextMessage).toHaveBeenCalledWith(
        "+34654728753",
        "Test message"
      )

      // Verify success result
      expect(result.success).toBe(true)
      expect(result.messageId).toBe("wamid_123")
      expect(result.error).toBeUndefined()
    })

    it("should return error if workspace not found", async () => {
      // SCENARIO: Message references non-existent workspace
      // RULE: Must return error, not throw exception

      const mockMessage = {
        id: "msg_123",
        workspaceId: "invalid_workspace",
        customerId: "cust_xyz",
        phoneNumber: "+34654728753",
        messageContent: "Test message",
        conversationMessageId: null,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        deliveredAt: null,
        channel: "whatsapp",
        visitorId: null,
      }

      // Mock workspace not found (SecurityAgent will still run first for validation)
      mockPrisma.workspace.findUnique.mockResolvedValue(null)

      // Execute
      const result = await service.validateAndSend(mockMessage)

      // Verify SecurityAgent was called (validation happens before workspace check)
      expect(mockSecurityAgent.process).toHaveBeenCalled()

      // Verify error result
      expect(result.success).toBe(false)
      expect(result.error).toBe("Workspace not found")
      expect(mockProvider.sendTextMessage).not.toHaveBeenCalled()
    })

    it("should return error if WhatsApp not configured", async () => {
      // SCENARIO: Workspace exists but WhatsApp provider not configured
      // RULE: Must return descriptive error with provider name

      const mockMessage = {
        id: "msg_123",
        workspaceId: "ws_abc",
        customerId: "cust_xyz",
        phoneNumber: "+34654728753",
        messageContent: "Test message",
        conversationMessageId: null,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        deliveredAt: null,
        channel: "whatsapp",
        visitorId: null,
      }

      const mockWorkspace = {
        id: "ws_abc",
        whatsappProvider: "ultramsg",
        // Missing ultraMsgInstanceId and ultraMsgToken
      }

      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace)
      ;(WhatsAppProviderFactory.isConfigured as jest.Mock).mockReturnValue(false)
      ;(WhatsAppProviderFactory.getProviderDisplayName as jest.Mock).mockReturnValue(
        "UltraMsg"
      )
      // Mock factory to throw error when WhatsApp not configured
      ;(WhatsAppProviderFactory.create as jest.Mock).mockImplementation(() => {
        throw new Error("UltraMsg provider selected but credentials not configured")
      })

      // Execute
      const result = await service.validateAndSend(mockMessage)

      // Verify SecurityAgent was called first
      expect(mockSecurityAgent.process).toHaveBeenCalled()

      // Verify error result
      expect(result.success).toBe(false)
      expect(result.error).toContain("credentials not configured")
      expect(mockProvider.sendTextMessage).not.toHaveBeenCalled()
    })

    it("should return error if provider send fails", async () => {
      // SCENARIO: Provider returns error (e.g., invalid phone number, API error)
      // RULE: Must propagate provider error, update timeline with failure

      const mockMessage = {
        id: "msg_123",
        workspaceId: "ws_abc",
        customerId: "cust_xyz",
        phoneNumber: "+34654728753",
        messageContent: "Test message",
        conversationMessageId: "conv_456",
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        deliveredAt: null,
        channel: "whatsapp",
        visitorId: null,
      }

      const mockWorkspace = {
        id: "ws_abc",
        whatsappProvider: "ultramsg",
        ultraMsgInstanceId: "161048",
        ultraMsgToken: "test_token",
      }

      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace)
      mockPrisma.conversationMessage.findUnique.mockResolvedValue({
        id: "conv_456",
        debugInfo: null,
      })
      mockPrisma.conversationMessage.update.mockResolvedValue({})

      // Mock provider error response
      mockProvider.sendTextMessage.mockResolvedValue({
        success: false,
        error: "Invalid phone number format",
      })

      // Execute
      const result = await service.validateAndSend(mockMessage)

      // Verify SecurityAgent was called first
      expect(mockSecurityAgent.process).toHaveBeenCalled()

      // Verify error result
      expect(result.success).toBe(false)
      expect(result.error).toBe("Invalid phone number format")

      // Verify timeline updated with failure
      expect(mockPrisma.conversationMessage.update).toHaveBeenCalled()
    })

    it("should block message if SecurityAgent marks it unsafe", async () => {
      // SCENARIO: SecurityAgent detects malicious content
      // RULE: Message must be blocked BEFORE calling WhatsApp provider

      const mockMessage = {
        id: "msg_123",
        workspaceId: "ws_abc",
        customerId: "cust_xyz",
        phoneNumber: "+34654728753",
        messageContent: "SELECT * FROM users WHERE id=1 OR 1=1",
        conversationMessageId: "conv_456",
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        deliveredAt: null,
        channel: "whatsapp",
        visitorId: null,
      }

      const mockWorkspace = {
        id: "ws_abc",
        whatsappProvider: "ultramsg",
        ultraMsgInstanceId: "161048",
        ultraMsgToken: "test_token",
      }

      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace)
      mockPrisma.conversationMessage.findUnique.mockResolvedValue({
        id: "conv_456",
        debugInfo: null,
      })
      mockPrisma.conversationMessage.update.mockResolvedValue({})

      // Mock SecurityAgent to block the message
      mockSecurityAgent.process.mockResolvedValue({
        safe: false,
        blockedReason: "SQL_INJECTION",
      })

      // Execute
      const result = await service.validateAndSend(mockMessage)

      // Verify SecurityAgent was called
      expect(mockSecurityAgent.process).toHaveBeenCalled()

      // Verify message was blocked
      expect(result.success).toBe(false)
      expect(result.error).toContain("SQL_INJECTION")

      // Verify provider was NOT called
      expect(mockProvider.sendTextMessage).not.toHaveBeenCalled()
    })
  })
})
