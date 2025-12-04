/**
 * Test Suite: ContactOperator Email Notifications
 *
 * Verifies that ContactOperator function:
 * 1. Sends email to sales agent with conversation summary
 * 2. Generates summary using SummaryAgentLLM
 * 3. Falls back to admin if no sales agent
 * 4. Disables chatbot for customer after escalation
 *
 * @requirement Feature 176: Email notification system
 * @requirement Feature 001: Email summary LLM
 */

// Mock dependencies BEFORE imports
const mockEmailService = {
  sendOperatorNotificationEmail: jest.fn().mockResolvedValue(true),
}

const mockSummaryAgent = {
  generateSummary: jest.fn().mockResolvedValue({
    success: true,
    summary: "Cliente ha richiesto assistenza per prodotto scaduto ricevuto.",
  }),
}

const mockSafetyAgent = {
  process: jest.fn().mockResolvedValue({
    translatedText: "Cliente ha richiesto assistenza per prodotto scaduto ricevuto.",
    safe: true,
  }),
}

jest.mock("../../../src/application/services/email.service", () => ({
  EmailService: jest.fn().mockImplementation(() => mockEmailService),
}))

jest.mock("../../../src/services/summary-agent-llm.service", () => ({
  SummaryAgentLLM: jest.fn().mockImplementation(() => mockSummaryAgent),
}))

jest.mock("../../../src/application/agents/SafetyTranslationAgent", () => ({
  SafetyTranslationAgent: jest.fn().mockImplementation(() => mockSafetyAgent),
}))

jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

// Mock PrismaClient
const mockPrisma = {
  customers: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  chatSession: {
    findFirst: jest.fn(),
  },
  conversationMessage: {
    findMany: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
  },
  $disconnect: jest.fn(),
}

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}))

// Import after mocks
import { ContactOperator, ContactOperatorRequest } from "../../../src/domain/calling-functions/ContactOperator"
import { EmailService } from "../../../src/application/services/email.service"
import logger from "../../../src/utils/logger"

describe("ContactOperator Email Notifications", () => {
  const workspaceId = "ws-test-123"
  const customerId = "cust-test-123"
  const phoneNumber = "+393331234567"
  const sessionId = "session-123"

  const mockSalesAgent = {
    id: "sales-123",
    firstName: "Giovanni",
    lastName: "Bianchi",
    email: "giovanni.bianchi@bellitalia.com",
    phone: "+393339876543",
  }

  const mockCustomer = {
    id: customerId,
    name: "Mario Rossi",
    email: "mario@example.com",
    phone: phoneNumber,
    workspaceId,
    salesId: mockSalesAgent.id,
    sales: mockSalesAgent,
    activeChatbot: true,
  }

  const mockWorkspace = {
    id: workspaceId,
    name: "Bell'Italia Foods",
    whatsappSettings: {
      adminEmail: "admin@bellitalia.com",
    },
  }

  const mockMessages = [
    {
      id: "msg-1",
      role: "user",
      content: "Ho ricevuto merce scaduta!",
      createdAt: new Date(),
    },
    {
      id: "msg-2",
      role: "assistant",
      content: "Mi dispiace molto per l'inconveniente. Ci può dire quale prodotto?",
      createdAt: new Date(),
    },
    {
      id: "msg-3",
      role: "user",
      content: "Il parmigiano era scaduto da una settimana!",
      createdAt: new Date(),
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup default mocks
    mockPrisma.customers.findFirst.mockResolvedValue(mockCustomer)
    mockPrisma.customers.update.mockResolvedValue(mockCustomer)
    mockPrisma.chatSession.findFirst.mockResolvedValue({
      id: sessionId,
      customerId,
      status: "active",
    })
    mockPrisma.conversationMessage.findMany.mockResolvedValue(mockMessages)
    mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspace)
    mockEmailService.sendOperatorNotificationEmail.mockResolvedValue(true)
    mockSummaryAgent.generateSummary.mockResolvedValue({
      success: true,
      summary: "Cliente Mario Rossi ha richiesto assistenza per prodotto scaduto.",
    })
    mockSafetyAgent.process.mockResolvedValue({
      translatedText: "Cliente Mario Rossi ha richiesto assistenza per prodotto scaduto.",
      safe: true,
    })
  })

  describe("Email sent to sales agent", () => {
    it("should send email to assigned sales agent", async () => {
      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
        reason: "Prodotto scaduto",
      }

      await ContactOperator(request)

      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledTimes(1)
      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockSalesAgent.email,
        })
      )
    })

    it("should include customer name in email", async () => {
      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await ContactOperator(request)

      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          customerName: mockCustomer.name,
        })
      )
    })

    it("should include workspace name in email", async () => {
      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await ContactOperator(request)

      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceName: mockWorkspace.name,
        })
      )
    })

    it("should include escalation subject line", async () => {
      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await ContactOperator(request)

      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("Richiesta Operatore"),
        })
      )
    })
  })

  describe("Summary generation via SummaryAgentLLM", () => {
    it("should call SummaryAgentLLM to generate conversation summary", async () => {
      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await ContactOperator(request)

      expect(mockSummaryAgent.generateSummary).toHaveBeenCalledTimes(1)
    })

    it("should pass conversation history to SummaryAgentLLM", async () => {
      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await ContactOperator(request)

      expect(mockSummaryAgent.generateSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationHistory: expect.any(Array),
          customerName: mockCustomer.name,
        })
      )
    })

    it("should include generated summary in email chatSummary", async () => {
      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await ContactOperator(request)

      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          chatSummary: expect.stringContaining("Cliente"),
        })
      )
    })

    it("should fallback to raw messages if summary generation fails", async () => {
      mockSummaryAgent.generateSummary.mockResolvedValue({
        success: false,
        error: "LLM timeout",
      })

      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await ContactOperator(request)

      // Should still send email with raw messages
      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledTimes(1)
    })
  })

  describe("Fallback to admin when no sales agent", () => {
    const mockAdmin = {
      id: "admin-123",
      email: "admin@bellitalia.com",
    }

    beforeEach(() => {
      // Customer has no sales agent
      mockPrisma.customers.findFirst.mockResolvedValue({
        ...mockCustomer,
        salesId: null,
        sales: null,
      })
    })

    it("should send email to admin when customer has no sales agent", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockAdmin)

      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await ContactOperator(request)

      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockAdmin.email,
        })
      )
    })

    it("should log warning when no admin found", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null)

      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await ContactOperator(request)

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("No sales agent or admin user found"),
        workspaceId
      )
    })
  })

  describe("Chatbot disabled after escalation", () => {
    it("should set customer activeChatbot to false", async () => {
      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await ContactOperator(request)

      expect(mockPrisma.customers.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockCustomer.id },
          data: { activeChatbot: false },
        })
      )
    })

    it("should log chatbot disabled", async () => {
      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await ContactOperator(request)

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Chatbot disabled"),
        mockCustomer.id
      )
    })
  })

  describe("WorkspaceId filter in ContactOperator", () => {
    it("should filter customer by phone AND workspaceId", async () => {
      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await ContactOperator(request)

      expect(mockPrisma.customers.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            phone: phoneNumber,
            workspaceId, // 🔒 Workspace isolation
          },
        })
      )
    })

    it("should filter workspace by id", async () => {
      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await ContactOperator(request)

      expect(mockPrisma.workspace.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: workspaceId },
        })
      )
    })
  })

  describe("Return values", () => {
    it("should return success with escalation message", async () => {
      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      const result = await ContactOperator(request)

      expect(result.success).toBe(true)
      expect(result.message).toContain("disattiviamo il chatbot")
    })

    it("should return summaryAgentExecuted true when summary succeeds", async () => {
      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      const result = await ContactOperator(request)

      expect(result.summaryAgentExecuted).toBe(true)
    })

    it("should return summaryEmailSent true when email succeeds", async () => {
      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      const result = await ContactOperator(request)

      expect(result.summaryEmailSent).toBe(true)
    })

    it("should include generatedSummary in result for debugging", async () => {
      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      const result = await ContactOperator(request)

      expect(result.generatedSummary).toBeDefined()
    })
  })

  describe("Messages retrieval - last hour", () => {
    it("should retrieve messages from last hour only", async () => {
      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await ContactOperator(request)

      expect(mockPrisma.conversationMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            conversationId: sessionId,
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        })
      )
    })

    it("should handle no messages gracefully", async () => {
      mockPrisma.conversationMessage.findMany.mockResolvedValue([])

      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      const result = await ContactOperator(request)

      expect(result.success).toBe(true)
      // Should still work with no messages
    })
  })

  describe("Customer not found handling", () => {
    it("should return success with fallback message when customer not found", async () => {
      mockPrisma.customers.findFirst.mockResolvedValue(null)

      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      const result = await ContactOperator(request)

      expect(result.success).toBe(true)
      // Fallback message mentions agent contact
      expect(result.message).toContain("agente")
    })

    it("should log warning when customer not found", async () => {
      mockPrisma.customers.findFirst.mockResolvedValue(null)

      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await ContactOperator(request)

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Customer not found"),
        phoneNumber
      )
    })
  })
})
