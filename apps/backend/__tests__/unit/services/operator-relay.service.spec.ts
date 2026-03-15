/**
 * Unit tests for OperatorRelayService
 *
 * WHAT: Tests the WhatsApp relay tunnel between customers and the human operator.
 *
 * ARCHITECTURE:
 *  - Operator sends messages via WhatsApp → relayed to active customer
 *  - Customer sends messages while chatbot disabled → relayed to operator
 *  - Sequential queue: one operator serves one customer at a time
 *  - "END" from operator → re-enables chatbot, sends dashboard link OR "all done"
 *  - Web app "done" → same, but triggered via HTTP endpoint
 *
 * POST-DASHBOARD BEHAVIOUR (after plan change):
 *  - When queue is empty after END → operator gets "✅ All done! Queue empty." message
 *  - When queue has remaining customers → operator gets a dashboard URL to choose next
 *  - FIFO auto-notify is REMOVED — operator actively selects from dashboard
 */

import { PrismaClient } from "@echatbot/database"
import { OperatorRelayService } from "../../../src/application/services/operator-relay.service"

// ============================================================================
// MOCK SECURE TOKEN SERVICE
// (operator-relay.service.ts instantiates it at module level)
// ============================================================================

jest.mock("../../../src/application/services/secure-token.service", () => ({
  SecureTokenService: jest.fn().mockImplementation(() => ({
    createToken: jest.fn().mockResolvedValue("mock-dashboard-token-abc"),
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
    findUnique: jest.fn(), // needed by relayCustomerMessageToOperator (sales agent lookup)
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
// HELPERS
// ============================================================================

const WORKSPACE_ID = "ws-test-001"

const makeCustomer = (overrides: Partial<any> = {}): any => ({
  id: "cust-001",
  name: "Mario Rossi",
  phone: "+393491234567",
  originChannel: "whatsapp",
  operatorQueuePosition: 1,
  operatorQueueEnteredAt: new Date("2025-01-01T10:00:00Z"),
  ...overrides,
})

const makeSession = (overrides: Partial<any> = {}): any => ({
  id: "session-001",
  customerId: "cust-001",
  workspaceId: WORKSPACE_ID,
  status: "active",
  ...overrides,
})

// ============================================================================
// TESTS
// ============================================================================

describe("OperatorRelayService", () => {
  let service: OperatorRelayService

  beforeEach(() => {
    // RULE: resetAllMocks (not clearAllMocks) — ensures spy .mockImplementation()
    // and .mockResolvedValueOnce() chains do not leak between tests.
    jest.resetAllMocks()
    service = new OperatorRelayService(mockPrisma as unknown as PrismaClient)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // assignQueuePosition
  // ──────────────────────────────────────────────────────────────────────────

  describe("assignQueuePosition", () => {
    it("should assign position 1 when queue is empty", async () => {
      // SCENARIO: First customer requests support — nobody else in queue
      // RULE: First position = 1; customer is served immediately
      mockPrisma.customers.aggregate.mockResolvedValue({
        _max: { operatorQueuePosition: null },
      })
      mockPrisma.customers.update.mockResolvedValue({})

      const result = await service.assignQueuePosition(WORKSPACE_ID, "cust-001")

      expect(result.position).toBe(1)
      expect(mockPrisma.customers.update).toHaveBeenCalledWith({
        where: { id: "cust-001" },
        data: expect.objectContaining({
          operatorQueuePosition: 1,
          operatorQueueEnteredAt: expect.any(Date),
        }),
      })
    })

    it("should assign position 2 when one customer is already in queue", async () => {
      // SCENARIO: Second customer requests support while first is being served
      // RULE: Position = max existing + 1; customer must wait
      mockPrisma.customers.aggregate.mockResolvedValue({
        _max: { operatorQueuePosition: 1 },
      })
      mockPrisma.customers.update.mockResolvedValue({})

      const result = await service.assignQueuePosition(WORKSPACE_ID, "cust-002")

      expect(result.position).toBe(2)
      expect(mockPrisma.customers.update).toHaveBeenCalledWith({
        where: { id: "cust-002" },
        data: expect.objectContaining({ operatorQueuePosition: 2 }),
      })
    })

    it("should assign positions incrementally for a 3-person queue", async () => {
      // SCENARIO: Three customers join the queue sequentially
      // RULE: Each gets max+1 position
      mockPrisma.customers.aggregate.mockResolvedValue({
        _max: { operatorQueuePosition: 4 },
      })
      mockPrisma.customers.update.mockResolvedValue({})

      const result = await service.assignQueuePosition(WORKSPACE_ID, "cust-005")
      expect(result.position).toBe(5)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // getActiveCustomer
  // ──────────────────────────────────────────────────────────────────────────

  describe("getActiveCustomer", () => {
    it("should return the customer with the lowest queue position", async () => {
      // SCENARIO: Multiple customers in queue
      // RULE: Active customer = lowest operatorQueuePosition (position 1)
      const customer = makeCustomer({ operatorQueuePosition: 1 })
      mockPrisma.customers.findFirst.mockResolvedValue(customer)

      const result = await service.getActiveCustomer(WORKSPACE_ID)

      expect(result).toEqual(customer)
      expect(mockPrisma.customers.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId: WORKSPACE_ID,
            activeChatbot: false,
            operatorQueuePosition: { not: null },
          }),
          orderBy: { operatorQueuePosition: "asc" },
        })
      )
    })

    it("should return null when queue is empty", async () => {
      // SCENARIO: No customers waiting for operator
      // RULE: Returns null (no active customer)
      mockPrisma.customers.findFirst.mockResolvedValue(null)

      const result = await service.getActiveCustomer(WORKSPACE_ID)
      expect(result).toBeNull()
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // handleOperatorMessage
  // ──────────────────────────────────────────────────────────────────────────

  describe("handleOperatorMessage", () => {
    it("should call processEndCommand when operator sends 'END'", async () => {
      // SCENARIO: Operator finishes a session by typing "END"
      // RULE: "END" (case-insensitive) triggers processEndCommand
      const processEndSpy = jest
        .spyOn(service, "processEndCommand")
        .mockResolvedValue(undefined)

      await service.handleOperatorMessage(WORKSPACE_ID, "END")

      expect(processEndSpy).toHaveBeenCalledWith(WORKSPACE_ID)
    })

    it("should call processEndCommand for lowercase 'end'", async () => {
      // SCENARIO: Operator types lowercase "end"
      // RULE: Command is case-insensitive
      const processEndSpy = jest
        .spyOn(service, "processEndCommand")
        .mockResolvedValue(undefined)

      await service.handleOperatorMessage(WORKSPACE_ID, "end")
      expect(processEndSpy).toHaveBeenCalledWith(WORKSPACE_ID)
    })

    it("should relay message to active customer when not END", async () => {
      // SCENARIO: Operator writes a regular reply message
      // RULE: Message is relayed to the currently active customer
      const activeCustomer = makeCustomer()
      mockPrisma.customers.findFirst.mockResolvedValue(activeCustomer)

      const relayToCustomerSpy = jest
        .spyOn(service, "relayToCustomer")
        .mockResolvedValue(undefined)

      await service.handleOperatorMessage(WORKSPACE_ID, "Ciao, come posso aiutarti?")

      expect(relayToCustomerSpy).toHaveBeenCalledWith(
        activeCustomer,
        WORKSPACE_ID,
        "Ciao, come posso aiutarti?"
      )
    })

    it("should do nothing silently when operator messages but queue is empty", async () => {
      // SCENARIO: Operator sends a message but there's no one in queue
      // RULE: No crash — warning logged, nothing relayed
      mockPrisma.customers.findFirst.mockResolvedValue(null)

      const relayToCustomerSpy = jest
        .spyOn(service, "relayToCustomer")
        .mockResolvedValue(undefined)

      // Should not throw
      await expect(
        service.handleOperatorMessage(WORKSPACE_ID, "Are you there?")
      ).resolves.not.toThrow()

      expect(relayToCustomerSpy).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // processEndCommand
  // ──────────────────────────────────────────────────────────────────────────

  describe("processEndCommand", () => {
    it("should re-enable chatbot and clear queue fields for active customer", async () => {
      // SCENARIO: Operator sends END while serving customer A (queue becomes empty)
      // RULE: customer A gets activeChatbot=true, all queue fields cleared
      const activeCustomer = makeCustomer()
      const session = makeSession()
      mockPrisma.customers.findFirst.mockResolvedValueOnce(activeCustomer) // getActiveCustomer

      // Queue is empty after release
      mockPrisma.customers.findMany.mockResolvedValue([])
      mockPrisma.customers.update.mockResolvedValue({})
      mockPrisma.whatsAppQueue.create.mockResolvedValue({})
      // sendMessageToOperator → workspace.findUnique (no operator number configured = silent skip)
      mockPrisma.workspace.findUnique.mockResolvedValue({ operatorWhatsappNumber: null })
      // relayToCustomer (farewell to customer) now always calls chatSession.findFirst
      mockPrisma.chatSession.findFirst.mockResolvedValue(session)
      mockPrisma.conversationMessage.create.mockResolvedValue({ id: "conv-msg-farewell" })

      await service.processEndCommand(WORKSPACE_ID)

      // ASSERT: chatbot re-enabled + all operator fields cleared
      expect(mockPrisma.customers.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: activeCustomer.id },
          data: expect.objectContaining({
            activeChatbot: true,
            operatorRequestedAt: null,
            operatorQueuePosition: null,
            operatorQueueEnteredAt: null,
            originChannel: null,
          }),
        })
      )
    })

    it("should send confirmation message to customer on END", async () => {
      // SCENARIO: Operator sends END
      // RULE: Customer receives a farewell message so they know chatbot is re-enabled
      const activeCustomer = makeCustomer()
      const session = makeSession()
      mockPrisma.customers.findFirst.mockResolvedValueOnce(activeCustomer)

      mockPrisma.customers.findMany.mockResolvedValue([])
      mockPrisma.customers.update.mockResolvedValue({})
      mockPrisma.whatsAppQueue.create.mockResolvedValue({})
      mockPrisma.workspace.findUnique.mockResolvedValue({ operatorWhatsappNumber: null })
      // relayToCustomer (farewell to customer) now always calls chatSession.findFirst
      mockPrisma.chatSession.findFirst.mockResolvedValue(session)
      mockPrisma.conversationMessage.create.mockResolvedValue({ id: "conv-msg-farewell" })

      await service.processEndCommand(WORKSPACE_ID)

      // ASSERT: farewell message enqueued to customer's phone
      expect(mockPrisma.whatsAppQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            phoneNumber: activeCustomer.phone,
            workspaceId: WORKSPACE_ID,
            customerId: activeCustomer.id,
          }),
        })
      )
    })

    it("should send 'all done' message to operator when queue is empty after END", async () => {
      // SCENARIO: Operator sends END and no more customers are waiting
      // RULE: Operator gets "All done! Queue empty." message (new dashboard behaviour)
      // IMPORTANT: replaces old FIFO auto-notify — operator must use dashboard to pick next
      const activeCustomer = makeCustomer()
      const workspace = { operatorWhatsappNumber: "+39111222333" }
      const session = makeSession()

      mockPrisma.customers.findFirst.mockResolvedValueOnce(activeCustomer)
      // Queue is empty after release
      mockPrisma.customers.findMany.mockResolvedValue([])
      mockPrisma.customers.update.mockResolvedValue({})
      mockPrisma.whatsAppQueue.create.mockResolvedValue({})
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace)
      // relayToCustomer (farewell to customer) now always calls chatSession.findFirst
      mockPrisma.chatSession.findFirst.mockResolvedValue(session)
      mockPrisma.conversationMessage.create.mockResolvedValue({ id: "conv-msg-farewell" })

      await service.processEndCommand(WORKSPACE_ID)

      // ASSERT: "all done" message sent to operator
      const calls = mockPrisma.whatsAppQueue.create.mock.calls
      const operatorMsg = calls.find(
        (c) => c[0].data.phoneNumber === workspace.operatorWhatsappNumber
      )
      expect(operatorMsg).toBeDefined()
      expect(operatorMsg?.[0].data.messageContent).toContain("All done")
      expect(operatorMsg?.[0].data.messageContent).toContain("Queue empty")
    })

    it("should send dashboard link to operator when queue still has customers after END", async () => {
      // SCENARIO: Customer A served, Customer B still waiting
      // RULE: After END, operator gets a dashboard URL to CHOOSE the next customer
      //       (old FIFO auto-notify replaced by dashboard-based selection)
      const customerA = makeCustomer({ name: "Mario", id: "cust-A" })
      const customerB = makeCustomer({
        name: "Luigi",
        id: "cust-B",
        phone: "+391234567890",
        operatorQueuePosition: 2,
      })

      const workspace = { operatorWhatsappNumber: "+39111222333" }
      const session = makeSession()

      mockPrisma.customers.findFirst
        .mockResolvedValueOnce(customerA) // initial getActiveCustomer
        .mockResolvedValueOnce(customerB) // nextActive check

      // getQueuedCustomers (remaining.length check) + reorderQueue both call findMany
      mockPrisma.customers.findMany.mockResolvedValue([customerB])
      mockPrisma.customers.update.mockResolvedValue({})
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace)
      mockPrisma.whatsAppQueue.create.mockResolvedValue({})
      // relayToCustomer (farewell to customer) now always calls chatSession.findFirst
      mockPrisma.chatSession.findFirst.mockResolvedValue(session)
      mockPrisma.conversationMessage.create.mockResolvedValue({ id: "conv-msg-farewell" })

      await service.processEndCommand(WORKSPACE_ID)

      // ASSERT: dashboard link message sent to operator's number
      const waCreateCalls = mockPrisma.whatsAppQueue.create.mock.calls
      const operatorNotification = waCreateCalls.find(
        (call) => call[0].data.phoneNumber === workspace.operatorWhatsappNumber
      )
      expect(operatorNotification).toBeDefined()
      // ASSERT: message contains the dashboard URL (SecureTokenService generates the token — tested separately)
      expect(operatorNotification?.[0].data.messageContent).toContain("operator-dashboard")
      // ASSERT: message indicates how many customers are waiting
      expect(operatorNotification?.[0].data.messageContent).toContain("1 customer")
    })

    it("should do nothing when queue is empty on END", async () => {
      // SCENARIO: Operator sends END but no customer is being served
      // RULE: Silent early return — no errors, no updates
      mockPrisma.customers.findFirst.mockResolvedValue(null)

      await expect(service.processEndCommand(WORKSPACE_ID)).resolves.not.toThrow()

      expect(mockPrisma.customers.update).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // relayToCustomer
  // ──────────────────────────────────────────────────────────────────────────

  describe("relayToCustomer", () => {
    it("should save ConversationMessage AND enqueue WhatsApp message for whatsapp channel customer", async () => {
      // SCENARIO: Operator replies to a customer who came via WhatsApp
      // RULE: ConversationMessage ALWAYS saved (so admin ChatPage shows operator reply in history)
      //       THEN WhatsAppQueue entry created with conversationMessageId to track delivery status
      // RULE: agentType="OPERATOR" ensures blue badge (not green chatbot) in admin view
      const customer = makeCustomer({ originChannel: "whatsapp", phone: "+393491234567" })
      const session = makeSession()
      const savedConvMsg = { id: "conv-msg-001" }
      mockPrisma.chatSession.findFirst.mockResolvedValue(session)
      mockPrisma.conversationMessage.create.mockResolvedValue(savedConvMsg)
      mockPrisma.whatsAppQueue.create.mockResolvedValue({})

      await service.relayToCustomer(customer, WORKSPACE_ID, "Hello from operator")

      // ASSERT: ConversationMessage created with OPERATOR marker for admin view
      expect(mockPrisma.conversationMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: session.id,
          customerId: customer.id,
          workspaceId: WORKSPACE_ID,
          role: "assistant",
          content: "Hello from operator",
          agentType: "OPERATOR",
        }),
        select: { id: true },
      })

      // ASSERT: WhatsApp queue entry created with conversationMessageId for delivery tracking
      expect(mockPrisma.whatsAppQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: WORKSPACE_ID,
          customerId: customer.id,
          phoneNumber: customer.phone,
          messageContent: "Hello from operator",
          channel: "whatsapp",
          skipSecurityCheck: true,
          conversationMessageId: savedConvMsg.id,
        }),
      })
    })

    it("should save ConversationMessage with OPERATOR marker for widget channel customer", async () => {
      // SCENARIO: Operator replies to a customer who came via the chat widget
      // RULE: Message saved to ConversationMessage with agentType=OPERATOR
      //       so admin ChatPage shows blue badge (not green chatbot)
      // RULE: No WhatsAppQueue — widget polls ConversationMessage directly
      const customer = makeCustomer({ originChannel: "widget", phone: null })
      const session = makeSession()
      mockPrisma.chatSession.findFirst.mockResolvedValue(session)
      mockPrisma.conversationMessage.create.mockResolvedValue({ id: "conv-msg-002" })

      await service.relayToCustomer(customer, WORKSPACE_ID, "Hello from operator")

      expect(mockPrisma.conversationMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: session.id,
          customerId: customer.id,
          workspaceId: WORKSPACE_ID,
          role: "assistant",
          content: "Hello from operator",
          agentType: "OPERATOR",
        }),
        select: { id: true },
      })
      expect(mockPrisma.whatsAppQueue.create).not.toHaveBeenCalled()
    })

    it("should fall back to widget routing when originChannel is null", async () => {
      // SCENARIO: Customer has no originChannel set (legacy or missing data)
      // RULE: Defaults to widget routing — saves ConversationMessage only
      const customer = makeCustomer({ originChannel: null, phone: null })
      const session = makeSession()
      mockPrisma.chatSession.findFirst.mockResolvedValue(session)
      mockPrisma.conversationMessage.create.mockResolvedValue({ id: "conv-msg-003" })

      await service.relayToCustomer(customer, WORKSPACE_ID, "Message")

      expect(mockPrisma.conversationMessage.create).toHaveBeenCalled()
      expect(mockPrisma.whatsAppQueue.create).not.toHaveBeenCalled()
    })

    it("should do nothing when no active session exists for customer", async () => {
      // SCENARIO: Customer has no active session (edge case: session expired or not started)
      // RULE: Warning logged, early return — no message created, no crash
      const customer = makeCustomer({ originChannel: "widget", phone: null })
      mockPrisma.chatSession.findFirst.mockResolvedValue(null)

      await expect(
        service.relayToCustomer(customer, WORKSPACE_ID, "Hello")
      ).resolves.not.toThrow()

      expect(mockPrisma.conversationMessage.create).not.toHaveBeenCalled()
      expect(mockPrisma.whatsAppQueue.create).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // relayCustomerMessageToOperator
  // ──────────────────────────────────────────────────────────────────────────

  describe("relayCustomerMessageToOperator", () => {
    it("should forward customer message to operator WhatsApp number", async () => {
      // SCENARIO: Customer with chatbot disabled sends a new message
      // RULE: Message is forwarded to operator's WhatsApp number (not LLM)
      // RULE: When no sales agent is assigned, fallback to workspace.operatorWhatsappNumber
      const workspace = { operatorWhatsappNumber: "+39111222333" }
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace)
      mockPrisma.customers.findUnique.mockResolvedValue({ salesId: null, sales: null })
      mockPrisma.whatsAppQueue.create.mockResolvedValue({})

      const customer = { id: "cust-001", name: "Mario", phone: "+393491234567" }

      await service.relayCustomerMessageToOperator(WORKSPACE_ID, customer, "Voglio un rimborso")

      expect(mockPrisma.whatsAppQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: WORKSPACE_ID,
          customerId: customer.id,
          phoneNumber: workspace.operatorWhatsappNumber,
          skipSecurityCheck: true,
        }),
      })
      // ASSERT: message content includes customer name and their text
      const call = mockPrisma.whatsAppQueue.create.mock.calls[0][0]
      expect(call.data.messageContent).toContain("Mario")
      expect(call.data.messageContent).toContain("Voglio un rimborso")
    })

    it("should do nothing when operatorWhatsappNumber is not configured", async () => {
      // SCENARIO: Workspace has no operator WhatsApp number AND no sales agent assigned
      // RULE: Silent skip — no message created, no crash
      mockPrisma.workspace.findUnique.mockResolvedValue({
        operatorWhatsappNumber: null,
      })
      mockPrisma.customers.findUnique.mockResolvedValue({ salesId: null, sales: null })

      const customer = { id: "cust-001", name: "Mario", phone: "+393491234567" }

      await expect(
        service.relayCustomerMessageToOperator(WORKSPACE_ID, customer, "Hello")
      ).resolves.not.toThrow()

      expect(mockPrisma.whatsAppQueue.create).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // releaseCustomerAndProcessNext
  // ──────────────────────────────────────────────────────────────────────────

  describe("releaseCustomerAndProcessNext", () => {
    it("should release customer, send farewell, and send dashboard link when queue has remaining", async () => {
      // SCENARIO: Web app operator clicks "Done" for customer A; customer B is waiting
      // RULE: A gets chatbot re-enabled; operator gets dashboard link to choose next
      //       (new behaviour: operator picks from dashboard instead of auto-FIFO)
      const customerA = makeCustomer({ id: "cust-A", name: "Mario" })
      const customerB = makeCustomer({
        id: "cust-B",
        name: "Luigi",
        phone: "+391111111111",
        operatorQueuePosition: 2,
      })
      const workspace = { operatorWhatsappNumber: "+39999888777" }
      const session = makeSession()

      // findFirst for loading customerA details
      mockPrisma.customers.findFirst.mockResolvedValueOnce(customerA)

      // reorderQueue + getQueuedCustomers both call findMany
      mockPrisma.customers.findMany.mockResolvedValue([customerB])
      mockPrisma.customers.update.mockResolvedValue({})
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace)
      mockPrisma.whatsAppQueue.create.mockResolvedValue({})
      // relayToCustomer (farewell to customerA) now always calls chatSession.findFirst
      mockPrisma.chatSession.findFirst.mockResolvedValue(session)
      mockPrisma.conversationMessage.create.mockResolvedValue({ id: "conv-msg-farewell" })

      await service.releaseCustomerAndProcessNext(WORKSPACE_ID, "cust-A")

      // ASSERT: chatbot re-enabled for customer A
      expect(mockPrisma.customers.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "cust-A" },
          data: expect.objectContaining({ activeChatbot: true, operatorQueuePosition: null }),
        })
      )

      // ASSERT: farewell message queued for customer A (whatsapp channel)
      const farewell = mockPrisma.whatsAppQueue.create.mock.calls.find(
        (c) => c[0].data.phoneNumber === customerA.phone
      )
      expect(farewell).toBeDefined()

      // ASSERT: operator gets dashboard link (not old FIFO customer name notification)
      const operatorMsg = mockPrisma.whatsAppQueue.create.mock.calls.find(
        (c) => c[0].data.phoneNumber === workspace.operatorWhatsappNumber
      )
      expect(operatorMsg).toBeDefined()
      // ASSERT: message references operator-dashboard (dashboard-based selection, not FIFO auto-notify)
      expect(operatorMsg?.[0].data.messageContent).toContain("operator-dashboard")
    })

    it("should send 'all done' to operator when queue is empty after release", async () => {
      // SCENARIO: Only one customer in queue; after done the queue is empty
      // RULE: Operator gets "All done! Queue empty." message (dashboard not needed)
      const customerA = makeCustomer()
      const workspace = { operatorWhatsappNumber: "+39999888777" }
      const session = makeSession()

      mockPrisma.customers.findFirst.mockResolvedValueOnce(customerA)

      // Queue is empty after release
      mockPrisma.customers.findMany.mockResolvedValue([])
      mockPrisma.customers.update.mockResolvedValue({})
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace)
      mockPrisma.whatsAppQueue.create.mockResolvedValue({})
      // relayToCustomer (farewell to customerA) now always calls chatSession.findFirst
      mockPrisma.chatSession.findFirst.mockResolvedValue(session)
      mockPrisma.conversationMessage.create.mockResolvedValue({ id: "conv-msg-farewell" })

      await service.releaseCustomerAndProcessNext(WORKSPACE_ID, customerA.id)

      // ASSERT: "all done" message sent to operator
      const calls = mockPrisma.whatsAppQueue.create.mock.calls
      const operatorNotif = calls.find(
        (c) => c[0].data.phoneNumber === workspace.operatorWhatsappNumber
      )
      expect(operatorNotif).toBeDefined()
      expect(operatorNotif?.[0].data.messageContent).toContain("All done")
    })

    it("should handle gracefully when customer is not found", async () => {
      // SCENARIO: done endpoint called with invalid/already-cleared customerId
      // RULE: No crash — warning logged, early return
      mockPrisma.customers.findFirst.mockResolvedValue(null)

      await expect(
        service.releaseCustomerAndProcessNext(WORKSPACE_ID, "non-existent-id")
      ).resolves.not.toThrow()

      expect(mockPrisma.customers.update).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Queue reordering (via processEndCommand)
  // ──────────────────────────────────────────────────────────────────────────

  describe("queue reordering after END", () => {
    it("should renumber remaining customers 1, 2, 3 after active customer exits", async () => {
      // SCENARIO: Queue has [A(pos=1), B(pos=2), C(pos=3)]. A gets END.
      // RULE: After A exits, B becomes pos=1, C becomes pos=2
      const customerA = makeCustomer({ id: "cust-A", operatorQueuePosition: 1 })
      const customerB = makeCustomer({ id: "cust-B", operatorQueuePosition: 2 })
      const customerC = makeCustomer({ id: "cust-C", operatorQueuePosition: 3 })
      const workspace = { operatorWhatsappNumber: "+39111222333" }
      const session = makeSession()

      mockPrisma.customers.findFirst.mockResolvedValueOnce(customerA) // getActiveCustomer

      // Both getQueuedCustomers and reorderQueue call findMany
      mockPrisma.customers.findMany.mockResolvedValue([customerB, customerC])
      mockPrisma.customers.update.mockResolvedValue({})
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace)
      mockPrisma.whatsAppQueue.create.mockResolvedValue({})
      // relayToCustomer (farewell to customerA) now always calls chatSession.findFirst
      mockPrisma.chatSession.findFirst.mockResolvedValue(session)
      mockPrisma.conversationMessage.create.mockResolvedValue({ id: "conv-msg-farewell" })

      await service.processEndCommand(WORKSPACE_ID)

      // ASSERT: B assigned position 1
      expect(mockPrisma.customers.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "cust-B" },
          data: { operatorQueuePosition: 1 },
        })
      )
      // ASSERT: C assigned position 2
      expect(mockPrisma.customers.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "cust-C" },
          data: { operatorQueuePosition: 2 },
        })
      )
    })
  })
})
