/**
 * Test Suite: ContactOperator WhatsApp Notifications
 * Tests Andrea's requirements:
 * 1. Priority logic: customer.salesId → agent.phone, else → workspace.operatorWhatsappNumber
 * 2. Message template: "Hello, customer {{nameUser}} is requesting your support. -eChatbot.ai"
 * 3. Billing: WhatsApp messages scale from workspace credit balance
 */

const mockEmailService = {
  sendOperatorNotificationEmail: jest.fn().mockResolvedValue(true),
}

const mockSummaryAgent = {
  generateSummary: jest.fn().mockResolvedValue({
    success: true,
    summary: "Customer requesting support for expired product.",
  }),
}

const mockSafetyAgent = {
  process: jest.fn().mockResolvedValue({
    translatedText: "Customer requesting support for expired product.",
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
  whatsAppQueue: {
    create: jest.fn(),
  },
  $disconnect: jest.fn(),
}

jest.mock("@echatbot/database", () => ({
  prisma: mockPrisma,
}))

import { contactOperator, ContactOperatorRequest } from "../../../src/domain/calling-functions/contactOperator"
import logger from "../../../src/utils/logger"

describe("ContactOperator WhatsApp Notifications", () => {
  const workspaceId = "ws-test-123"
  const customerId = "cust-test-123"
  const phoneNumber = "+393331234567"
  const sessionId = "session-123"

  const mockSalesAgent = {
    id: "sales-123",
    firstName: "Giovanni",
    lastName: "Bianchi",
    email: "giovanni.bianchi@bellitalia.com",
    phone: "+393339876543", // 🎯 WhatsApp number
  }

  const mockCustomerWithAgent = {
    id: customerId,
    name: "Mario Rossi",
    email: "mario@example.com",
    phone: phoneNumber,
    workspaceId,
    salesId: mockSalesAgent.id,
    sales: mockSalesAgent,
    activeChatbot: true,
  }

  const mockCustomerWithoutAgent = {
    id: customerId,
    name: "Mario Rossi",
    email: "mario@example.com",
    phone: phoneNumber,
    workspaceId,
    salesId: null,
    sales: null,
    activeChatbot: true,
  }

  const mockWorkspaceWhatsApp = {
    id: workspaceId,
    name: "BellItalia Foods",
    operatorContactMethod: "whatsapp",
    operatorWhatsappNumber: "+393331111111", // Generic operator
    hasHumanSupport: true,
    whatsappSettings: {
      adminEmail: "admin@bellitalia.com",
    },
  }

  const mockWorkspaceEmail = {
    id: workspaceId,
    name: "BellItalia Foods",
    operatorContactMethod: "email",
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
      content: "I received expired product!",
      createdAt: new Date(),
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()

    mockPrisma.customers.update.mockResolvedValue(mockCustomerWithAgent)
    mockPrisma.chatSession.findFirst.mockResolvedValue({
      id: sessionId,
      customerId,
      status: "active",
    })
    mockPrisma.conversationMessage.findMany.mockResolvedValue(mockMessages)
    mockPrisma.whatsAppQueue.create.mockResolvedValue({ id: "queue-123" })
    mockSummaryAgent.generateSummary.mockResolvedValue({
      success: true,
      summary: "Customer requesting support for expired product.",
    })
    mockSafetyAgent.process.mockResolvedValue({
      translatedText: "Customer requesting support for expired product.",
      safe: true,
    })
  })

  describe("Priority Logic - Customer with assigned agent", () => {
    it("should send WhatsApp to agent's phone when customer has salesId", async () => {
      mockPrisma.customers.findFirst.mockResolvedValue(mockCustomerWithAgent)
      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspaceWhatsApp)

      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
        reason: "Expired product",
      }

      await contactOperator(request)

      // ✅ RULE: Customer has salesId → send to agent
      expect(mockPrisma.whatsAppQueue.create).toHaveBeenCalledTimes(1)
      expect(mockPrisma.whatsAppQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceId,
            customerId,
            phoneNumber: mockSalesAgent.phone, // 🎯 Agent's phone
            messageContent: `Hello, customer ${mockCustomerWithAgent.name} is requesting your support. -eChatbot.ai`,
            status: "pending",
            channel: "whatsapp",
          }),
        })
      )
    })
  })

  describe("Priority Logic - Customer without assigned agent", () => {
    it("should send WhatsApp to generic operator when customer has NO salesId", async () => {
      mockPrisma.customers.findFirst.mockResolvedValue(mockCustomerWithoutAgent)
      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspaceWhatsApp)

      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
        reason: "Need help",
      }

      await contactOperator(request)

      // ✅ RULE: Customer has NO salesId → send to workspace operator
      expect(mockPrisma.whatsAppQueue.create).toHaveBeenCalledTimes(1)
      expect(mockPrisma.whatsAppQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            phoneNumber: mockWorkspaceWhatsApp.operatorWhatsappNumber, // 🎯 Generic operator
            messageContent: `Hello, customer ${mockCustomerWithoutAgent.name} is requesting your support. -eChatbot.ai`,
          }),
        })
      )
    })
  })

  describe("Contact Method - Email vs WhatsApp", () => {
    it("should NOT send WhatsApp when operatorContactMethod=email", async () => {
      mockPrisma.customers.findFirst.mockResolvedValue(mockCustomerWithAgent)
      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspaceEmail)

      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await contactOperator(request)

      // ✅ Email method → NO WhatsApp queue
      expect(mockPrisma.whatsAppQueue.create).not.toHaveBeenCalled()
      expect(mockEmailService.sendOperatorNotificationEmail).toHaveBeenCalled()
    })

    it("should send WhatsApp when operatorContactMethod=whatsapp", async () => {
      mockPrisma.customers.findFirst.mockResolvedValue(mockCustomerWithAgent)
      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspaceWhatsApp)

      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await contactOperator(request)

      // ✅ WhatsApp method → Queue WhatsApp message
      expect(mockPrisma.whatsAppQueue.create).toHaveBeenCalled()
    })
  })

  describe("Message Template", () => {
    it("should use English template with eChatbot signature", async () => {
      mockPrisma.customers.findFirst.mockResolvedValue(mockCustomerWithAgent)
      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspaceWhatsApp)

      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await contactOperator(request)

      const callArgs = (mockPrisma.whatsAppQueue.create as jest.Mock).mock.calls[0][0]
      const messageContent = callArgs.data.messageContent

      // ✅ TEMPLATE: "Hello, customer {{nameUser}} is requesting your support. -eChatbot.ai"
      expect(messageContent).toContain("Hello, customer")
      expect(messageContent).toContain(mockCustomerWithAgent.name)
      expect(messageContent).toContain("is requesting your support")
      expect(messageContent).toContain("-eChatbot.ai")
    })
  })

  describe("Billing - Messages scale from workspace credits", () => {
    it("should create WhatsApp queue entry (billing handled by scheduler)", async () => {
      mockPrisma.customers.findFirst.mockResolvedValue(mockCustomerWithAgent)
      mockPrisma.workspace.findUnique.mockResolvedValue(mockWorkspaceWhatsApp)

      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await contactOperator(request)

      // ✅ BILLING: Message queued with workspaceId and customerId (scheduler handles billing)
      expect(mockPrisma.whatsAppQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceId, // For billing
            customerId, // System customer
            status: "pending", // Scheduler will process
          }),
        })
      )
    })
  })

  describe("Edge Cases", () => {
    it("should warn when WhatsApp method selected but no operator number configured", async () => {
      const workspaceNoOperator = {
        ...mockWorkspaceWhatsApp,
        operatorWhatsappNumber: null,
      }
      const customerNoAgent = {
        ...mockCustomerWithoutAgent,
      }

      mockPrisma.customers.findFirst.mockResolvedValue(customerNoAgent)
      mockPrisma.workspace.findUnique.mockResolvedValue(workspaceNoOperator)

      const request: ContactOperatorRequest = {
        phoneNumber,
        workspaceId,
        customerId,
      }

      await contactOperator(request)

      // ✅ NO WhatsApp number → should NOT create queue entry
      expect(mockPrisma.whatsAppQueue.create).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("WhatsApp method selected but no operator number configured")
      )
    })
  })
})
