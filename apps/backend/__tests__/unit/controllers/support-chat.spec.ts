/**
 * SupportChatController Unit Tests
 *
 * Tests for the operator handoff support-chat endpoints.
 * These endpoints are token-authenticated (no login required).
 */

import { Request, Response } from "express"
import { SupportChatController } from "../../../src/interfaces/http/controllers/support-chat.controller"
import { prisma } from "@echatbot/database"

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("@echatbot/database", () => ({
  prisma: {
    customers: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    chatSession: {
      findFirst: jest.fn(),
    },
    conversationMessage: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    whatsAppQueue: {
      create: jest.fn(),
    },
    secureToken: {
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
  PrismaClient: jest.fn(),
}))

// Mock SecureTokenService — functions are assigned later per test
let mockValidateToken: jest.Mock
let mockRevokeToken: jest.Mock

// Mock OperatorRelayService — the done endpoint now delegates to this service
// instead of calling prisma.customers.updateMany directly.
const mockReleaseCustomerAndProcessNext = jest.fn()
jest.mock(
  "../../../src/application/services/operator-relay.service",
  () => ({
    OperatorRelayService: jest.fn().mockImplementation(() => ({
      releaseCustomerAndProcessNext: mockReleaseCustomerAndProcessNext,
    })),
  })
)

jest.mock(
  "../../../src/application/services/secure-token.service",
  () => ({
    SecureTokenService: jest.fn().mockImplementation(() => ({
      get validateToken() { return mockValidateToken },
      get revokeToken() { return mockRevokeToken },
      createToken: jest.fn(),
    })),
  })
)

// ── Helpers ───────────────────────────────────────────────────────────────────

const buildReq = (opts: Partial<Request> = {}): Request =>
  ({
    query: {},
    body: {},
    params: {},
    ...opts,
  } as unknown as Request)

const buildRes = (): Response => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
  return res as unknown as Response
}

// ── Test Data ──────────────────────────────────────────────────────────────────

const VALID_TOKEN = "valid-token-abc123"
const WORKSPACE_ID = "ws-test-001"
const CUSTOMER_ID = "cust-test-001"
const SESSION_ID = "sess-test-001"

const tokenValidationData = {
  valid: true,
  data: {
    id: "token-id-1",
    type: "support_chat",
    workspaceId: WORKSPACE_ID,
    customerId: CUSTOMER_ID,
    userId: null,
    phoneNumber: "+39123456789",
    expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
    createdAt: new Date(),
  },
  payload: {
    customerId: CUSTOMER_ID,
    sessionId: SESSION_ID,
    channel: "widget",
  },
}

const mockCustomer = {
  id: CUSTOMER_ID,
  name: "Mario Rossi",
  phone: "+39123456789",
  email: "mario@example.com",
  language: "it",
  activeChatbot: false,
  originChannel: "widget",
  operatorRequestedAt: new Date(),
}

const mockWhatsAppCustomer = { ...mockCustomer, originChannel: "whatsapp" }

const mockSession = { id: SESSION_ID }

const mockMessages = [
  { id: "msg-1", role: "user", content: "Ciao ho un problema", createdAt: new Date("2025-01-01T10:00:00Z") },
  { id: "msg-2", role: "assistant", content: "Come posso aiutarti?", createdAt: new Date("2025-01-01T10:01:00Z") },
]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("SupportChatController", () => {
  let controller: SupportChatController

  beforeEach(() => {
    jest.clearAllMocks()
    // Initialize mocks here (after jest.clearAllMocks to clear previous calls)
    mockValidateToken = jest.fn()
    mockRevokeToken = jest.fn()
    // Reset relay service mock (module-level jest.fn — must be cleared per test)
    mockReleaseCustomerAndProcessNext.mockReset()
    controller = new SupportChatController()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // GET /session
  // ──────────────────────────────────────────────────────────────────────────

  describe("getSession", () => {
    it("should return 400 when token is missing", async () => {
      // SCENARIO: Operator access link without token
      // RULE: Token is mandatory — no token = bad request
      const req = buildReq({ query: {} })
      const res = buildRes()

      await controller.getSession(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ error: "token required" })
    })

    it("should return 401 when token is invalid", async () => {
      // SCENARIO: Expired or tampered token
      // RULE: Invalid token = unauthorized
      mockValidateToken.mockResolvedValue({ valid: false })
      const req = buildReq({ query: { token: "bad-token" } })
      const res = buildRes()

      await controller.getSession(req, res)

      expect(res.status).toHaveBeenCalledWith(401)
    })

    it("should return customer info + messages for valid token", async () => {
      // SCENARIO: Operator opens the support-chat link with valid token
      // RULE: Valid token → return customer info + session messages
      mockValidateToken.mockResolvedValue(tokenValidationData)
      ;(prisma.customers.findFirst as jest.Mock).mockResolvedValue(mockCustomer)
      ;(prisma.chatSession.findFirst as jest.Mock).mockResolvedValue(mockSession)
      ;(prisma.conversationMessage.findMany as jest.Mock).mockResolvedValue(mockMessages)

      const req = buildReq({ query: { token: VALID_TOKEN } })
      const res = buildRes()

      await controller.getSession(req, res)

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: expect.objectContaining({ name: "Mario Rossi" }),
          session: { id: SESSION_ID },
          messages: expect.arrayContaining([
            expect.objectContaining({ id: "msg-1", role: "user" }),
          ]),
          channel: "widget",
        })
      )
    })

    it("should return 404 when customer not found", async () => {
      // SCENARIO: Token valid but customer was deleted
      // RULE: Workspace isolation — customer must belong to token's workspace
      mockValidateToken.mockResolvedValue(tokenValidationData)
      ;(prisma.customers.findFirst as jest.Mock).mockResolvedValue(null)

      const req = buildReq({ query: { token: VALID_TOKEN } })
      const res = buildRes()

      await controller.getSession(req, res)

      expect(res.status).toHaveBeenCalledWith(404)
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // POST /reply
  // ──────────────────────────────────────────────────────────────────────────

  describe("reply", () => {
    it("should return 400 when message is empty", async () => {
      // SCENARIO: Operator submits empty form
      // RULE: Both token and message are required
      const req = buildReq({ body: { token: VALID_TOKEN, message: "" } })
      const res = buildRes()

      await controller.reply(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
    })

    it("should save to ConversationMessage when channel=widget", async () => {
      // SCENARIO: Customer contacted from widget — operator replies
      // RULE: Widget replies → ConversationMessage (widget polling picks it up)
      mockValidateToken.mockResolvedValue(tokenValidationData)
      ;(prisma.customers.findFirst as jest.Mock).mockResolvedValue(mockCustomer) // originChannel = widget
      ;(prisma.chatSession.findFirst as jest.Mock).mockResolvedValue(mockSession)
      ;(prisma.conversationMessage.create as jest.Mock).mockResolvedValue({ id: "new-msg-1" })

      const req = buildReq({ body: { token: VALID_TOKEN, message: "Ciao! Come posso aiutarti?" } })
      const res = buildRes()

      await controller.reply(req, res)

      // RULE: Widget path uses ConversationMessage, NOT WhatsAppQueue
      expect(prisma.conversationMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: SESSION_ID,
            role: "assistant",
            content: "Ciao! Come posso aiutarti?",
          }),
        })
      )
      expect(prisma.whatsAppQueue.create).not.toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith({ success: true, channel: "widget" })
    })

    it("should queue WhatsApp message when channel=whatsapp", async () => {
      // SCENARIO: Customer contacted from WhatsApp — operator replies
      // RULE: WhatsApp replies → WhatsAppQueue (not ConversationMessage)
      mockValidateToken.mockResolvedValue(tokenValidationData)
      ;(prisma.customers.findFirst as jest.Mock).mockResolvedValue(mockWhatsAppCustomer)
      ;(prisma.whatsAppQueue.create as jest.Mock).mockResolvedValue({ id: "queue-1" })

      const req = buildReq({ body: { token: VALID_TOKEN, message: "Risposta via WA" } })
      const res = buildRes()

      await controller.reply(req, res)

      // RULE: WhatsApp path uses WhatsAppQueue, NOT ConversationMessage
      expect(prisma.whatsAppQueue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceId: WORKSPACE_ID,
            customerId: CUSTOMER_ID,
            phoneNumber: "+39123456789",
            messageContent: "Risposta via WA",
            status: "pending",
            channel: "whatsapp",
          }),
        })
      )
      expect(prisma.conversationMessage.create).not.toHaveBeenCalled()
      expect(res.json).toHaveBeenCalledWith({ success: true, channel: "whatsapp" })
    })
  })

  // ──────────────────────────────────────────────────────────────────────────
  // POST /done
  // ──────────────────────────────────────────────────────────────────────────

  describe("done", () => {
    it("should return 400 when token is missing", async () => {
      // SCENARIO: Done endpoint called without token
      // RULE: Token is mandatory
      const req = buildReq({ body: {} })
      const res = buildRes()

      await controller.done(req, res)

      expect(res.status).toHaveBeenCalledWith(400)
    })

    it("should re-enable chatbot and revoke token", async () => {
      // SCENARIO: Operator finishes and clicks "Riattiva chatbot"
      // RULE: Must call OperatorRelayService.releaseCustomerAndProcessNext (re-enables chatbot,
      //        clears queue fields, notifies next customer) and revoke the token.
      // NOTE: The direct updateMany call was replaced by the relay service (queue-aware release).
      mockValidateToken.mockResolvedValue(tokenValidationData)
      mockReleaseCustomerAndProcessNext.mockResolvedValue(undefined)
      mockRevokeToken.mockResolvedValue(true)

      const req = buildReq({ body: { token: VALID_TOKEN } })
      const res = buildRes()

      await controller.done(req, res)

      // ASSERT: relay service called with correct workspace + customer IDs
      expect(mockReleaseCustomerAndProcessNext).toHaveBeenCalledWith(
        WORKSPACE_ID,
        CUSTOMER_ID
      )
      expect(mockRevokeToken).toHaveBeenCalledWith(VALID_TOKEN)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      )
    })

    it("should return 401 for invalid token in done endpoint", async () => {
      // SCENARIO: Token already revoked or expired
      // RULE: Cannot re-enable chatbot with invalid token (security)
      mockValidateToken.mockResolvedValue({ valid: false })

      const req = buildReq({ body: { token: "expired-token" } })
      const res = buildRes()

      await controller.done(req, res)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(prisma.customers.updateMany).not.toHaveBeenCalled()
    })
  })
})
