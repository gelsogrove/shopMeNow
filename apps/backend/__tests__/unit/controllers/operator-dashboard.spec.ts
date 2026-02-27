/**
 * Unit tests for OperatorDashboardController
 *
 * WHAT: Tests the operator dashboard endpoints (GET /queue, POST /assign).
 *
 * AUTH MODEL: operator_dashboard token (workspace-level, 48h, no customerId)
 *
 * SCENARIOS:
 *  - GET /queue with valid token → returns enriched queue with AI summaries
 *  - GET /queue with invalid token → 401
 *  - GET /queue with empty queue → empty array
 *  - POST /assign with valid token + customer in queue → returns support_chat token
 *  - POST /assign with customer not in queue → 400
 *  - POST /assign with invalid token → 401
 */

import { Request, Response } from "express"
import { OperatorDashboardController } from "../../../src/interfaces/http/controllers/operator-dashboard.controller"

// ============================================================================
// MOCKS
// ============================================================================

// NOTE: `let` instead of `const` — jest.mock factories are hoisted above variable
// declarations. Using wrapper arrow functions avoids "Cannot access before initialization".
let mockValidateToken: jest.Mock
jest.mock("../../../src/application/services/secure-token.service", () => ({
  SecureTokenService: jest.fn().mockImplementation(() => ({
    validateToken: (...args: any[]) => mockValidateToken(...args),
  })),
}))

let mockGetWaitingCustomers: jest.Mock
let mockGenerateAISummary: jest.Mock
let mockAssignCustomer: jest.Mock
jest.mock("../../../src/application/services/operator-queue.service", () => ({
  OperatorQueueService: jest.fn().mockImplementation(() => ({
    getWaitingCustomers: (...args: any[]) => mockGetWaitingCustomers(...args),
    generateAISummary: (...args: any[]) => mockGenerateAISummary(...args),
    assignCustomer: (...args: any[]) => mockAssignCustomer(...args),
  })),
}))

// Mock @echatbot/database (prisma)
jest.mock("@echatbot/database", () => ({
  prisma: {},
  PrismaClient: jest.fn(),
}))

// ============================================================================
// HELPERS
// ============================================================================

const WORKSPACE_ID = "ws-123"
const VALID_TOKEN = "valid-operator-dashboard-token"
const CUSTOMER_ID = "cust-456"

function makeValidTokenData() {
  return {
    valid: true,
    data: {
      type: "operator_dashboard",
      workspaceId: WORKSPACE_ID,
      customerId: null,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
    payload: { workspaceId: WORKSPACE_ID },
  }
}

function makeQueueEntry(overrides: Partial<any> = {}): any {
  return {
    customerId: CUSTOMER_ID,
    name: "Mario Rossi",
    phone: "+393491234567",
    channel: "whatsapp",
    position: 1,
    waitMinutes: 5,
    ...overrides,
  }
}

function makeRes() {
  const jsonMock = jest.fn()
  const statusMock = jest.fn(() => ({ json: jsonMock }))
  const res = { status: statusMock, json: jsonMock } as unknown as Response
  return { res, jsonMock, statusMock }
}

// ============================================================================
// TESTS
// ============================================================================

describe("OperatorDashboardController", () => {
  let controller: OperatorDashboardController

  beforeEach(() => {
    jest.resetAllMocks()

    // Initialize mocks AFTER resetAllMocks so they have fresh implementations
    mockValidateToken = jest.fn()
    mockGetWaitingCustomers = jest.fn()
    mockGenerateAISummary = jest.fn()
    mockAssignCustomer = jest.fn()

    // Re-setup OperatorQueueService mock implementation after resetAllMocks clears it.
    // OperatorQueueService is instantiated INSIDE each controller method (not module-level),
    // so the constructor mock must be re-established after each reset.
    const { OperatorQueueService } = jest.requireMock(
      "../../../src/application/services/operator-queue.service"
    )
    OperatorQueueService.mockImplementation(() => ({
      getWaitingCustomers: (...args: any[]) => mockGetWaitingCustomers(...args),
      generateAISummary: (...args: any[]) => mockGenerateAISummary(...args),
      assignCustomer: (...args: any[]) => mockAssignCustomer(...args),
    }))

    controller = new OperatorDashboardController()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // GET /queue
  // ──────────────────────────────────────────────────────────────────────────

  describe("getQueue", () => {
    it("should return 400 when token is missing", async () => {
      // SCENARIO: Request without token query parameter
      // RULE: 400 bad request — token is required
      const req = { query: {} } as unknown as Request
      const { res, statusMock, jsonMock } = makeRes()

      await controller.getQueue(req, res)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ error: "token required" }))
    })

    it("should return 401 when token is invalid", async () => {
      // SCENARIO: Token does not exist in DB or is expired
      // RULE: 401 unauthorized — invalid token
      mockValidateToken.mockResolvedValue({ valid: false })

      const req = { query: { token: "expired-token" } } as unknown as Request
      const { res, statusMock } = makeRes()

      await controller.getQueue(req, res)

      expect(statusMock).toHaveBeenCalledWith(401)
    })

    it("should return 401 when token is wrong type (not operator_dashboard)", async () => {
      // SCENARIO: Token is valid but is a support_chat token, not operator_dashboard
      // RULE: Token type must be exactly 'operator_dashboard'
      mockValidateToken.mockResolvedValue({
        valid: true,
        data: {
          type: "support_chat", // WRONG TYPE
          workspaceId: WORKSPACE_ID,
        },
      })

      const req = { query: { token: "support-chat-token" } } as unknown as Request
      const { res, statusMock } = makeRes()

      await controller.getQueue(req, res)

      expect(statusMock).toHaveBeenCalledWith(401)
    })

    it("should return empty array when queue is empty", async () => {
      // SCENARIO: Token is valid but no customers are waiting
      // RULE: Returns [] so frontend shows "All customers handled!" screen
      mockValidateToken.mockResolvedValue(makeValidTokenData())
      mockGetWaitingCustomers.mockResolvedValue([])

      const req = { query: { token: VALID_TOKEN } } as unknown as Request
      const { res, jsonMock } = makeRes()

      await controller.getQueue(req, res)

      expect(jsonMock).toHaveBeenCalledWith([])
      expect(mockGenerateAISummary).not.toHaveBeenCalled()
    })

    it("should return queue entries enriched with AI summaries", async () => {
      // SCENARIO: Two customers waiting in queue
      // RULE: Each entry gets an aiSummary generated on-demand
      mockValidateToken.mockResolvedValue(makeValidTokenData())

      const customerA = makeQueueEntry({ customerId: "cust-A", name: "Mario", position: 1 })
      const customerB = makeQueueEntry({ customerId: "cust-B", name: "Luigi", position: 2 })

      mockGetWaitingCustomers.mockResolvedValue([customerA, customerB])

      // AI summaries per customer
      mockGenerateAISummary
        .mockResolvedValueOnce("Wants a refund for order #123")
        .mockResolvedValueOnce("Asking about delivery status")

      const req = { query: { token: VALID_TOKEN } } as unknown as Request
      const { res, jsonMock } = makeRes()

      await controller.getQueue(req, res)

      const result = jsonMock.mock.calls[0][0]
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        customerId: "cust-A",
        name: "Mario",
        aiSummary: "Wants a refund for order #123",
      })
      expect(result[1]).toMatchObject({
        customerId: "cust-B",
        name: "Luigi",
        aiSummary: "Asking about delivery status",
      })
    })

    it("should call generateAISummary in parallel for all customers", async () => {
      // SCENARIO: 3 customers in queue
      // RULE: All summaries generated concurrently (Promise.all) for performance
      mockValidateToken.mockResolvedValue(makeValidTokenData())

      const customers = [
        makeQueueEntry({ customerId: "A" }),
        makeQueueEntry({ customerId: "B" }),
        makeQueueEntry({ customerId: "C" }),
      ]

      mockGetWaitingCustomers.mockResolvedValue(customers)
      mockGenerateAISummary.mockResolvedValue("Summary text")

      const req = { query: { token: VALID_TOKEN } } as unknown as Request
      const { res } = makeRes()

      await controller.getQueue(req, res)

      // ASSERT: generateAISummary called once per customer
      expect(mockGenerateAISummary).toHaveBeenCalledTimes(3)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // POST /assign
  // ──────────────────────────────────────────────────────────────────────────

  describe("assignCustomer", () => {
    it("should return 400 when token or customerId is missing", async () => {
      // SCENARIO: Incomplete request body
      // RULE: Both token and customerId are required
      const req = { body: { token: VALID_TOKEN } } as unknown as Request
      const { res, statusMock } = makeRes()

      await controller.assignCustomer(req, res)

      expect(statusMock).toHaveBeenCalledWith(400)
    })

    it("should return 401 when token is invalid", async () => {
      // SCENARIO: Expired or non-existent operator_dashboard token
      // RULE: 401 unauthorized
      mockValidateToken.mockResolvedValue({ valid: false })

      const req = { body: { token: "bad-token", customerId: CUSTOMER_ID } } as unknown as Request
      const { res, statusMock } = makeRes()

      await controller.assignCustomer(req, res)

      expect(statusMock).toHaveBeenCalledWith(401)
    })

    it("should return 401 when token is wrong type", async () => {
      // SCENARIO: Token exists but is not operator_dashboard type
      // RULE: Type check prevents cross-endpoint token misuse
      mockValidateToken.mockResolvedValue({
        valid: true,
        data: { type: "support_chat", workspaceId: WORKSPACE_ID },
      })

      const req = { body: { token: "support-chat-token", customerId: CUSTOMER_ID } } as unknown as Request
      const { res, statusMock } = makeRes()

      await controller.assignCustomer(req, res)

      expect(statusMock).toHaveBeenCalledWith(401)
    })

    it("should return 400 when customer is not in queue", async () => {
      // SCENARIO: Customer already handled or never in queue
      // RULE: Can't assign a customer who isn't waiting
      mockValidateToken.mockResolvedValue(makeValidTokenData())
      mockAssignCustomer.mockRejectedValue(new Error("CUSTOMER_NOT_IN_QUEUE"))

      const req = { body: { token: VALID_TOKEN, customerId: "ghost-customer" } } as unknown as Request
      const { res, statusMock, jsonMock } = makeRes()

      await controller.assignCustomer(req, res)

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Customer not found in queue" })
      )
    })

    it("should return support_chat token and chat URL on successful assignment", async () => {
      // SCENARIO: Valid token, customer is in queue
      // RULE: Returns support_chat token so operator can open direct chat link
      mockValidateToken.mockResolvedValue(makeValidTokenData())
      mockAssignCustomer.mockResolvedValue({
        token: "support-chat-token-xyz",
        chatUrl: "https://www.echatbot.ai/support-chat?token=support-chat-token-xyz",
      })

      const req = { body: { token: VALID_TOKEN, customerId: CUSTOMER_ID } } as unknown as Request
      const { res, jsonMock } = makeRes()

      await controller.assignCustomer(req, res)

      expect(jsonMock).toHaveBeenCalledWith({
        token: "support-chat-token-xyz",
        chatUrl: "https://www.echatbot.ai/support-chat?token=support-chat-token-xyz",
      })

      // ASSERT: assignCustomer called with correct workspace + customer
      expect(mockAssignCustomer).toHaveBeenCalledWith(WORKSPACE_ID, CUSTOMER_ID)
    })
  })
})
