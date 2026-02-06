/**
 * Test Suite: ContactOperator Email Notifications
 */

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

jest.mock("@echatbot/database", () => ({
  prisma: mockPrisma,
}))

import { contactOperator, ContactOperatorRequest } from "../../../src/domain/calling-functions/contactOperator"
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
    name: "BellItalia Foods",
    operatorContactMethod: "email", // 🆕 Test email method
    operatorEmail: "support@bellitalia.com", // 🆕 Andrea's spec: Use operatorEmail directly
    operatorWhatsappNumber: null,
    hasHumanSupport: true,
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
    it("should send email to workspace.operatorEmail", async () => {
      // 🆕 Andrea's spec: Use workspace.operatorEmail directly (NOT agent/admin)
      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
        reason: "Prodotto scaduto",
      }

      await contactOperator(request)

      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledTimes(1)
      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "support@bellitalia.com", // 🎯 workspace.operatorEmail
        })
      )
    })
  })

  describe("Priority Logic - Email to operatorEmail (Andrea's spec)", () => {
    it("should send email to workspace.operatorEmail when configured", async () => {
      // SCENARIO: workspace.operatorEmail is configured
      // RULE: Email goes to operatorEmail (NOT agent or admin)
      
      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
        reason: "Expired product",
      }

      await contactOperator(request)

      // ✅ RULE: Use workspace.operatorEmail directly
      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledTimes(1)
      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "support@bellitalia.com", // 🎯 workspace.operatorEmail
          customerName: mockCustomer.name,
        })
      )
      
      // ❌ Should NOT query admin user (operatorEmail used directly)
      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled()
    })

    it("should fallback to adminEmail when operatorEmail is null", async () => {
      // SCENARIO: workspace.operatorEmail is null
      // RULE: Fallback to whatsappSettings.adminEmail
      
      const mockWorkspaceNoOperatorEmail = {
        ...mockWorkspace,
        operatorEmail: null,
      }

      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspaceNoOperatorEmail)

      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
        reason: "Need help",
      }

      await contactOperator(request)
      
      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledTimes(1)
      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "admin@bellitalia.com", // 🎯 Fallback to whatsappSettings.adminEmail
          customerName: mockCustomer.name,
        })
      )
    })

    it("should NOT send email when both operatorEmail and adminEmail are null", async () => {
      // SCENARIO: No email configured
      // EXPECTED: No email sent
      
      const mockWorkspaceNoEmails = {
        ...mockWorkspace,
        operatorEmail: null,
        whatsappSettings: {
          adminEmail: null,
        },
      }

      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspaceNoEmails)

      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await contactOperator(request)
      
      // ❌ No email sent (no target)
      expect(mockEmailService.sendOperatorNotificationEmail).not.toHaveBeenCalled()
    })
  })

  describe("WorkspaceId filter in ContactOperator", () => {
    it("should filter customer by phone AND workspaceId", async () => {
      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await contactOperator(request)

      expect(mockPrisma.customers.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            phone: phoneNumber,
            workspaceId,
          },
        })
      )
    })
  })
})
