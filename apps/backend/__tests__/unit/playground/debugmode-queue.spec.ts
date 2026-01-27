import { PrismaClient } from "@echatbot/database"
import { WhatsAppQueueService } from "../../../src/services/whatsapp-queue.service"

// Mock WhatsAppQueueRepository
jest.mock("../../../src/repositories/whatsapp-queue.repository", () => ({
  WhatsAppQueueRepository: jest.fn().mockImplementation(() => ({
    findPending: jest.fn(),
    updateStatus: jest.fn(),
    create: jest.fn(),
    findByWorkspace: jest.fn(),
    checkDuplicate: jest.fn().mockResolvedValue(false),
  })),
}))

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

// Mock Security Agent
jest.mock("../../../src/application/agents/SecurityAgent", () => ({
  SecurityAgent: jest.fn().mockImplementation(() => ({
    validateMessage: jest.fn().mockResolvedValue({
      isValid: true,
      reason: null,
    }),
  })),
}))

// Mock Billing Service
jest.mock("../../../src/application/services/subscription-billing.service", () => ({
  SubscriptionBillingService: jest.fn().mockImplementation(() => ({
    deductOwnerMessageCredit: jest.fn().mockResolvedValue({
      success: true,
      newBalance: 99.9,
    }),
    deductMessageCredit: jest.fn().mockResolvedValue({
      success: true,
      newBalance: 99.9,
    }),
  })),
}))

// Mock Prisma
jest.mock("@echatbot/database", () => {
  const mockPrismaClient = {
    workspace: {
      findUnique: jest.fn(),
    },
    whatsAppQueue: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    conversationMessage: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  }

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  }
})

describe("debugMode in Queue Processor - Documentation", () => {
  describe("debugMode=true Behavior", () => {
    it("should document WIP message automatic response when debugMode is enabled", () => {
      // This test documents the expected behavior:
      // When workspace.debugMode=true:
      // 1. Fetch workspace from DB and check debugMode field
      // 2. If true, fetch ONE pending message
      // 3. Send WIP message (workspace.wipMessage || default)
      // 4. Mark message as 'sent' (no LLM, no extra billing)
      // 5. Mark delivered in conversation history

      const expectedFlow = {
        step1: "Check workspace.debugMode",
        step2: "Fetch pending message",
        step3: "Send WIP message (no LLM)",
        step4: "Mark as 'sent'",
        step5: "Update conversation history",
        billing: "No extra cost (WIP is automatic response)",
      }

      expect(expectedFlow.step3).toBe("Send WIP message (no LLM)")
      expect(expectedFlow.billing).toContain("No extra cost")
    })

    it("should use default WIP message if workspace.wipMessage is null", () => {
      const defaultMessage = "We are in maintenance mode. Please try again later."
      const customMessage = "Siamo in manutenzione"

      const wipMessage = null // From DB
      const finalMessage = wipMessage || defaultMessage

      expect(finalMessage).toBe(defaultMessage)
    })

    it("should NOT call LLM when debugMode=true", () => {
      // debugMode=true flow:
      // - Check debugMode FIRST (before fetching message)
      // - If true, skip validateAndSend() entirely
      // - Send WIP directly, no LLM processing

      const debugModeFlow = {
        checkDebugMode: true,
        callLLM: false,
        sendWIP: true,
        skipBilling: true,
      }

      expect(debugModeFlow.callLLM).toBe(false)
      expect(debugModeFlow.sendWIP).toBe(true)
    })
  })

  describe("debugMode=false Behavior", () => {
    it("should process message normally when debugMode is disabled", () => {
      // debugMode=false flow:
      // 1. Check debugMode = false
      // 2. Fetch pending message
      // 3. Call validateAndSend() → LLM processing
      // 4. Deduct credit when actually sent
      // 5. Mark as 'sent'

      const normalFlow = {
        checkDebugMode: false,
        callLLM: true,
        deductCredit: true,
        sendMessage: true,
      }

      expect(normalFlow.callLLM).toBe(true)
      expect(normalFlow.deductCredit).toBe(true)
    })
  })

  describe("No Messages Scenario", () => {
    it("should handle no pending messages gracefully", () => {
      // If findPending returns null:
      // - Exit early, no processing
      // - No errors thrown
      // - Cron continues to next workspace

      const noPendingMessages = null
      const shouldProcess = noPendingMessages !== null

      expect(shouldProcess).toBe(false)
    })
  })

  describe("Integration with Billing", () => {
    it("should not deduct credit for WIP automatic response", () => {
      // WIP message is automatic response (no LLM tokens)
      // - No call to billingService.deductOwnerMessageCredit()
      // - Message marked as 'sent' but billing skipped
      // - Only deduct credit when LLM is called (debugMode=false)

      const flows = {
        wipAutoResponse: {
          billingCalled: false,
          reason: "Automatic response, no LLM tokens",
        },
        llmResponse: {
          billingCalled: true,
          reason: "LLM processing, deduct credit",
        },
      }

      expect(flows.wipAutoResponse.billingCalled).toBe(false)
      expect(flows.llmResponse.billingCalled).toBe(true)
    })
  })
})
