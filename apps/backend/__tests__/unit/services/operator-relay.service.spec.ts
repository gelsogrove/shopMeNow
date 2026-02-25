/**
 * Unit tests for OperatorRelayService
 *
 * WHAT: Tests the WhatsApp relay tunnel between customers and the human operator.
 *
 * ARCHITECTURE:
 *  - Operator sends messages via WhatsApp → relayed to active customer
 *  - Customer sends messages while chatbot disabled → relayed to operator
 *  - Sequential queue: one operator serves one customer at a time
 *  - "END" from operator → re-enables chatbot, moves to next customer
 *  - Web app "done" → same, but triggered via HTTP endpoint
 */

import { PrismaClient } from "@echatbot/database"
import { OperatorRelayService } from "../../../src/application/services/operator-relay.service"

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
      // SCENARIO: Operator sends END while serving customer A
      // RULE: customer A gets activeChatbot=true, all queue fields cleared
      const activeCustomer = makeCustomer()
      mockPrisma.customers.findFirst
        .mockResolvedValueOnce(activeCustomer) // getActiveCustomer
        .mockResolvedValueOnce(null) // getActiveCustomer after reorder (empty queue)

      mockPrisma.customers.findMany.mockResolvedValue([]) // getQueuedCustomers for reorder
      mockPrisma.customers.update.mockResolvedValue({})
      mockPrisma.whatsAppQueue.create.mockResolvedValue({})

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
      mockPrisma.customers.findFirst
        .mockResolvedValueOnce(activeCustomer)
        .mockResolvedValueOnce(null)

      mockPrisma.customers.findMany.mockResolvedValue([])
      mockPrisma.customers.update.mockResolvedValue({})
      mockPrisma.whatsAppQueue.create.mockResolvedValue({})

      await service.processEndCommand(WORKSPACE_ID)

      // ASSERT: message enqueued to customer's phone
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

    it("should notify operator of next customer after END", async () => {
      // SCENARIO: Customer A served, Customer B waiting
      // RULE: After END, operator gets notification about Customer B
      const customerA = makeCustomer({ name: "Mario", id: "cust-A" })
      const customerB = makeCustomer({
        name: "Luigi",
        id: "cust-B",
        phone: "+391234567890",
        operatorQueuePosition: 2,
      })

      const workspace = { operatorWhatsappNumber: "+39111222333" }

      mockPrisma.customers.findFirst
        .mockResolvedValueOnce(customerA)   // getActiveCustomer first call
        .mockResolvedValueOnce(customerB)   // getActiveCustomer after reorder (next customer)

      // reorderQueue: findMany for remaining customers
      mockPrisma.customers.findMany.mockResolvedValue([customerB])
      mockPrisma.customers.update.mockResolvedValue({})
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace)
      mockPrisma.whatsAppQueue.create.mockResolvedValue({})

      await service.processEndCommand(WORKSPACE_ID)

      // ASSERT: at least one WhatsApp message sent to operator's number
      const waCreateCalls = mockPrisma.whatsAppQueue.create.mock.calls
      const operatorNotification = waCreateCalls.find(
        (call) => call[0].data.phoneNumber === workspace.operatorWhatsappNumber
      )
      expect(operatorNotification).toBeDefined()
      expect(operatorNotification?.[0].data.messageContent).toContain("Luigi")
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
    it("should enqueue WhatsApp message for whatsapp channel customer", async () => {
      // SCENARIO: Operator replies to a customer who came via WhatsApp
      // RULE: Message is queued in WhatsAppQueue (scheduler sends it)
      const customer = makeCustomer({ originChannel: "whatsapp", phone: "+393491234567" })
      mockPrisma.whatsAppQueue.create.mockResolvedValue({})

      await service.relayToCustomer(customer, WORKSPACE_ID, "Hello from operator")

      expect(mockPrisma.whatsAppQueue.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId: WORKSPACE_ID,
          customerId: customer.id,
          phoneNumber: customer.phone,
          messageContent: "Hello from operator",
          channel: "whatsapp",
          skipSecurityCheck: true,
        }),
      })
      expect(mockPrisma.conversationMessage.create).not.toHaveBeenCalled()
    })

    it("should save ConversationMessage for widget channel customer", async () => {
      // SCENARIO: Operator replies to a customer who came via the chat widget
      // RULE: Message saved to ConversationMessage (widget polls for new messages)
      const customer = makeCustomer({ originChannel: "widget", phone: null })
      const session = makeSession()
      mockPrisma.chatSession.findFirst.mockResolvedValue(session)
      mockPrisma.conversationMessage.create.mockResolvedValue({})

      await service.relayToCustomer(customer, WORKSPACE_ID, "Hello from operator")

      expect(mockPrisma.conversationMessage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: session.id,
          customerId: customer.id,
          workspaceId: WORKSPACE_ID,
          role: "assistant",
          content: "Hello from operator",
        }),
      })
      expect(mockPrisma.whatsAppQueue.create).not.toHaveBeenCalled()
    })

    it("should fall back to widget routing when originChannel is null", async () => {
      // SCENARIO: Customer has no originChannel set (legacy or missing data)
      // RULE: Defaults to widget routing
      const customer = makeCustomer({ originChannel: null, phone: null })
      const session = makeSession()
      mockPrisma.chatSession.findFirst.mockResolvedValue(session)
      mockPrisma.conversationMessage.create.mockResolvedValue({})

      await service.relayToCustomer(customer, WORKSPACE_ID, "Message")

      expect(mockPrisma.conversationMessage.create).toHaveBeenCalled()
    })

    it("should do nothing for widget customer without active session", async () => {
      // SCENARIO: Widget customer has no active session (edge case)
      // RULE: Warning logged, no crash, no message created
      const customer = makeCustomer({ originChannel: "widget", phone: null })
      mockPrisma.chatSession.findFirst.mockResolvedValue(null)

      await expect(
        service.relayToCustomer(customer, WORKSPACE_ID, "Hello")
      ).resolves.not.toThrow()

      expect(mockPrisma.conversationMessage.create).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // relayCustomerMessageToOperator
  // ──────────────────────────────────────────────────────────────────────────

  describe("relayCustomerMessageToOperator", () => {
    it("should forward customer message to operator WhatsApp number", async () => {
      // SCENARIO: Customer with chatbot disabled sends a new message
      // RULE: Message is forwarded to operator's WhatsApp number (not LLM)
      const workspace = { operatorWhatsappNumber: "+39111222333" }
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace)
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
      // SCENARIO: Workspace has no operator WhatsApp number (feature not configured)
      // RULE: Silent skip — no message created, no crash
      mockPrisma.workspace.findUnique.mockResolvedValue({
        operatorWhatsappNumber: null,
      })

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
    it("should release customer, send farewell, and notify operator of next", async () => {
      // SCENARIO: Web app operator clicks "Done" for customer A; customer B is waiting
      // RULE: A gets chatbot re-enabled; operator gets notification about B
      const customerA = makeCustomer({ id: "cust-A", name: "Mario" })
      const customerB = makeCustomer({
        id: "cust-B",
        name: "Luigi",
        phone: "+391111111111",
        operatorQueuePosition: 2,
      })
      const workspace = { operatorWhatsappNumber: "+39999888777" }

      // findFirst for loading customerA details
      mockPrisma.customers.findFirst
        .mockResolvedValueOnce(customerA)  // initial load
        .mockResolvedValueOnce(customerB)  // getActiveCustomer after reorder

      mockPrisma.customers.findMany.mockResolvedValue([customerB]) // reorderQueue
      mockPrisma.customers.update.mockResolvedValue({})
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace)
      mockPrisma.whatsAppQueue.create.mockResolvedValue({})

      await service.releaseCustomerAndProcessNext(WORKSPACE_ID, "cust-A")

      // ASSERT: chatbot re-enabled for customer A
      expect(mockPrisma.customers.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "cust-A" },
          data: expect.objectContaining({ activeChatbot: true, operatorQueuePosition: null }),
        })
      )

      // ASSERT: farewell message queued for customer A (whatsapp channel)
      const farawellCall = mockPrisma.whatsAppQueue.create.mock.calls.find(
        (c) => c[0].data.phoneNumber === customerA.phone
      )
      expect(farawellCall).toBeDefined()

      // ASSERT: operator notified about customer B
      const operatorNotif = mockPrisma.whatsAppQueue.create.mock.calls.find(
        (c) => c[0].data.phoneNumber === workspace.operatorWhatsappNumber
      )
      expect(operatorNotif).toBeDefined()
      expect(operatorNotif?.[0].data.messageContent).toContain("Luigi")
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

    it("should not notify operator when queue is empty after release", async () => {
      // SCENARIO: Only one customer in queue; after done the queue is empty
      // RULE: No "next customer" notification sent to operator
      const customerA = makeCustomer()
      const workspace = { operatorWhatsappNumber: "+39999888777" }

      mockPrisma.customers.findFirst
        .mockResolvedValueOnce(customerA) // initial load
        .mockResolvedValueOnce(null)       // getActiveCustomer after reorder (empty)

      mockPrisma.customers.findMany.mockResolvedValue([]) // reorderQueue
      mockPrisma.customers.update.mockResolvedValue({})
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace)
      mockPrisma.whatsAppQueue.create.mockResolvedValue({})

      await service.releaseCustomerAndProcessNext(WORKSPACE_ID, customerA.id)

      // ASSERT: only farewell to customer, no operator "next" notification
      const calls = mockPrisma.whatsAppQueue.create.mock.calls
      const operatorNotif = calls.find(
        (c) => c[0].data.phoneNumber === workspace.operatorWhatsappNumber
      )
      // Farewell goes to customer phone, not operator phone — so no operator notification here
      expect(operatorNotif).toBeUndefined()
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

      mockPrisma.customers.findFirst
        .mockResolvedValueOnce(customerA) // getActiveCustomer (for A)
        .mockResolvedValueOnce(customerB) // getActiveCustomer after reorder (B is now pos=1)

      // reorderQueue fetches remaining after A is cleared
      mockPrisma.customers.findMany.mockResolvedValue([customerB, customerC])
      mockPrisma.customers.update.mockResolvedValue({})
      mockPrisma.workspace.findUnique.mockResolvedValue(workspace)
      mockPrisma.whatsAppQueue.create.mockResolvedValue({})

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
