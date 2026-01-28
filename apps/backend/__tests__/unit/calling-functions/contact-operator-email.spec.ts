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
    it("should send email to assigned sales agent", async () => {
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
          to: mockSalesAgent.email,
        })
      )
    })
  })

  describe("Priority Logic - Email to agent vs admin (Andrea's spec)", () => {
    it("should send email to agent when customer has salesId", async () => {
      // SCENARIO: Customer has assigned agent
      // RULE: Email should go to sales.email (Andrea: same logic as WhatsApp)
      
      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
        reason: "Expired product",
      }

      await contactOperator(request)

      // ✅ RULE: Customer has salesId → send to agent
      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledTimes(1)
      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockSalesAgent.email, // 🎯 Agent's email
          customerName: mockCustomer.name,
        })
      )
      
      // ❌ Should NOT query admin user (agent email used directly)
      expect(mockPrisma.user.findFirst).not.toHaveBeenCalled()
    })

    it("should send email to admin when customer has NO salesId", async () => {
      // SCENARIO: Customer has NO assigned agent
      // RULE: Email should go to admin email (Andrea: same as WhatsApp logic)
      
      const mockCustomerNoAgent = {
        ...mockCustomer,
        salesId: null,
        sales: null,
      }

      const mockAdminUser = {
        id: "admin-123",
        email: "admin@bellitalia.com",
        role: "ADMIN",
      }

      mockPrisma.customers.findFirst.mockResolvedValue(mockCustomerNoAgent)
      mockPrisma.user.findFirst.mockResolvedValue(mockAdminUser)

      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
        reason: "Need help",
      }

      await contactOperator(request)

      // ✅ RULE: Customer has NO salesId → query admin
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: "ADMIN",
            workspaces: {
              some: { workspaceId },
            },
          }),
        })
      )
      
      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledTimes(1)
      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockAdminUser.email, // 🎯 Admin's email
          customerName: mockCustomerNoAgent.name,
        })
      )
    })

    it("should warn when no agent or admin found", async () => {
      // SCENARIO: Customer has NO agent AND no admin user exists
      // EXPECTED: Log warning, no email sent
      
      const mockCustomerNoAgent = {
        ...mockCustomer,
        salesId: null,
        sales: null,
      }

      mockPrisma.customers.findFirst.mockResolvedValue(mockCustomerNoAgent)
      mockPrisma.user.findFirst.mockResolvedValue(null) // No admin

      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await contactOperator(request)

      // ✅ Should query admin
      expect(mockPrisma.user.findFirst).toHaveBeenCalled()
      
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
