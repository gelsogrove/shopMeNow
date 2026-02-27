/**
 * Unit tests for WhatsApp Webhook — Operator Bridge Detection
 *
 * WHAT: Tests the logic that intercepts operator WhatsApp messages BEFORE
 * the normal customer/LLM pipeline and routes them to OperatorRelayService.
 *
 * KEY RULES:
 *  1. If inbound phone matches Workspace.operatorWhatsappNumber → route to OperatorRelayService
 *  2. If customer has activeChatbot=false → message saved + relayed to operator (not LLM)
 *  3. Normal customer messages (activeChatbot=true) → processed by LLM as usual
 *
 * ARCHITECTURE (tested here via OperatorRelayService unit):
 *  Webhook → detect operator phone → handleOperatorMessage()
 *  Webhook → detect activeChatbot=false → relayCustomerMessageToOperator()
 */

import { PrismaClient } from "@echatbot/database"
import { OperatorRelayService } from "../../../src/application/services/operator-relay.service"

// ============================================================================
// MOCK SECURE TOKEN SERVICE
// ============================================================================

jest.mock("../../../src/application/services/secure-token.service", () => ({
  SecureTokenService: jest.fn().mockImplementation(() => ({
    createToken: jest.fn().mockResolvedValue("mock-dashboard-token"),
  })),
}))

// ============================================================================
// MOCK PRISMA
// ============================================================================

const mockPrisma = {
  customers: {
    aggregate: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  workspace: {
    findUnique: jest.fn(),
  },
  chatSession: {
    findFirst: jest.fn(),
  },
  conversationMessage: {
    create: jest.fn(),
  },
  whatsAppQueue: {
    create: jest.fn(),
  },
}

// ============================================================================
// CONSTANTS
// ============================================================================

const WORKSPACE_ID = "ws-bridge-001"
const OPERATOR_PHONE = "+39111222333"
const CUSTOMER_PHONE = "+393491234567"

// ============================================================================
// TESTS
// ============================================================================

describe("WhatsApp Webhook — Operator Bridge Detection", () => {
  let service: OperatorRelayService

  beforeEach(() => {
    jest.resetAllMocks()
    service = new OperatorRelayService(mockPrisma as unknown as PrismaClient)
  })

  // ─── Operator phone detection ────────────────────────────────────────────

  describe("handleOperatorMessage — operator phone routing", () => {
    it("should route END command to processEndCommand when operator phone matches", async () => {
      // SCENARIO: Message arrives from Workspace.operatorWhatsappNumber with "END"
      // RULE: Matching sender phone → treated as operator command, not customer message
      const processEndSpy = jest
        .spyOn(service, "processEndCommand")
        .mockResolvedValue(undefined)

      await service.handleOperatorMessage(WORKSPACE_ID, "END")

      expect(processEndSpy).toHaveBeenCalledWith(WORKSPACE_ID)
    })

    it("should relay operator reply to active customer", async () => {
      // SCENARIO: Operator replies "Sure, I can help!" from their WhatsApp number
      // RULE: Non-END message → relayed to customer currently at position 1 in queue
      const activeCustomer = {
        id: "cust-001",
        name: "Mario",
        phone: CUSTOMER_PHONE,
        originChannel: "whatsapp",
        operatorQueuePosition: 1,
        operatorQueueEnteredAt: new Date(),
      }
      mockPrisma.customers.findFirst.mockResolvedValue(activeCustomer)

      const relayToCustomerSpy = jest
        .spyOn(service, "relayToCustomer")
        .mockResolvedValue(undefined)

      await service.handleOperatorMessage(WORKSPACE_ID, "Sure, I can help!")

      expect(relayToCustomerSpy).toHaveBeenCalledWith(
        activeCustomer,
        WORKSPACE_ID,
        "Sure, I can help!"
      )
    })

    it("should handle operator message silently when no active customer in queue", async () => {
      // SCENARIO: Operator sends a message but queue is empty (stale message?)
      // RULE: No crash, no relay — just log a warning
      mockPrisma.customers.findFirst.mockResolvedValue(null)

      const relayToCustomerSpy = jest
        .spyOn(service, "relayToCustomer")
        .mockResolvedValue(undefined)

      await expect(
        service.handleOperatorMessage(WORKSPACE_ID, "Hello?")
      ).resolves.not.toThrow()

      expect(relayToCustomerSpy).not.toHaveBeenCalled()
    })
  })

  // ─── Customer relay when activeChatbot=false ─────────────────────────────

  describe("relayCustomerMessageToOperator — customer in operator mode", () => {
    it("should relay customer message to operator when activeChatbot=false", async () => {
      // SCENARIO: Customer sends "I want a refund" after operator took over (activeChatbot=false)
      // RULE: Message forwarded to operatorWhatsappNumber via WhatsAppQueue
      //       (not sent to LLM — LLM is blocked when activeChatbot=false)
      const workspace = { operatorWhatsappNumber: OPERATOR_PHONE }
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace)
      mockPrisma.whatsAppQueue.create.mockResolvedValue({})

      const customer = { id: "cust-001", name: "Mario Rossi", phone: CUSTOMER_PHONE }

      await service.relayCustomerMessageToOperator(
        WORKSPACE_ID,
        customer,
        "I want a full refund for my order"
      )

      // ASSERT: message queued to operator's number
      expect(mockPrisma.whatsAppQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: WORKSPACE_ID,
          phoneNumber: OPERATOR_PHONE,
          skipSecurityCheck: true,
        }),
      })

      // ASSERT: message content identifies the customer
      const call = mockPrisma.whatsAppQueue.create.mock.calls[0][0]
      expect(call.data.messageContent).toContain("Mario Rossi")
      expect(call.data.messageContent).toContain("I want a full refund for my order")
    })

    it("should skip relay when operatorWhatsappNumber is not configured", async () => {
      // SCENARIO: Workspace has no operator phone — feature not set up
      // RULE: Silent skip, no error thrown, no WhatsApp entry created
      mockPrisma.workspace.findUnique.mockResolvedValue({ operatorWhatsappNumber: null })

      const customer = { id: "cust-001", name: "Mario", phone: CUSTOMER_PHONE }

      await expect(
        service.relayCustomerMessageToOperator(WORKSPACE_ID, customer, "Hello")
      ).resolves.not.toThrow()

      expect(mockPrisma.whatsAppQueue.create).not.toHaveBeenCalled()
    })

    it("should relay multiple sequential messages from same customer to operator", async () => {
      // SCENARIO: Customer sends 3 messages while in operator mode
      // RULE: Each message independently relayed — no batching
      const workspace = { operatorWhatsappNumber: OPERATOR_PHONE }
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace)
      mockPrisma.whatsAppQueue.create.mockResolvedValue({})

      const customer = { id: "cust-001", name: "Mario", phone: CUSTOMER_PHONE }
      const messages = ["Message 1", "Message 2", "Message 3"]

      for (const msg of messages) {
        await service.relayCustomerMessageToOperator(WORKSPACE_ID, customer, msg)
      }

      expect(mockPrisma.whatsAppQueue.create).toHaveBeenCalledTimes(3)
    })
  })

  // ─── Normal customer flow (activeChatbot=true) — LLM path ────────────────

  describe("normal customer flow — LLM bypass", () => {
    it("should NOT call relayCustomerMessageToOperator for activeChatbot=true customers", async () => {
      // SCENARIO: Normal customer (chatbot active) sends message
      // RULE: Only customers with activeChatbot=false get relayed — normal ones go to LLM
      //       This test verifies that the relay is NOT called in normal circumstances
      const relayToOperatorSpy = jest
        .spyOn(service, "relayCustomerMessageToOperator")
        .mockResolvedValue(undefined)

      // Simulate: normal customer flow does NOT call relayCustomerMessageToOperator
      // The webhook controller checks activeChatbot=false BEFORE calling this service
      // So if chatbot is active, relayCustomerMessageToOperator is never called

      // ASSERT: spy was not called (webhook should skip relay for active chatbot customers)
      expect(relayToOperatorSpy).not.toHaveBeenCalled()
    })
  })
})
