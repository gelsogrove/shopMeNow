/**
 * Unit tests — WhatsAppInboundPipeline (shared provider-agnostic guards).
 *
 * WHAT: the single pipeline that Meta/UltraMsg/Wasender all call. We test the
 * three decision methods in isolation so a logic regression surfaces here, not
 * only at runtime on a live provider:
 *   - checkSecurity()       → null (pass) | 429 blocked | 500 error | skip playground
 *   - checkBillingAccess()  → null (pass) | 200 channel-disabled | 402 trial | 402 credit | skip playground
 *   - processReply()        → 200 processed (chatEngine path) | 410 blocked
 * WHY: these guards close the Wasender "no billing / no security" gap. They must
 * behave EXACTLY like the canonical Meta controller they were extracted from.
 *
 * All external collaborators are mocked; we assert control flow + returned
 * PipelineResult shape, never real DB/LLM/provider calls.
 */

// ── Mocks (names prefixed `mock` so jest.mock factories may close over them) ──
const mockValidateMessage = jest.fn()
const mockCanProcess = jest.fn()
const mockIsTrialValid = jest.fn()
const mockGetCost = jest.fn()
const mockCheckCredit = jest.fn()
const mockRouteMessage = jest.fn()
const mockInvoke = jest.fn()
const mockSend = jest.fn()
const mockTyping = jest.fn()
const mockIngestMedia = jest.fn()

const mockMsgCreate = jest.fn()
const mockMsgFindMany = jest.fn()
const mockMsgFindFirst = jest.fn()
const mockWsFindUnique = jest.fn()
const mockCustUpdate = jest.fn()

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    conversationMessage: {
      create: (...a: any[]) => mockMsgCreate(...a),
      findMany: (...a: any[]) => mockMsgFindMany(...a),
      findFirst: (...a: any[]) => mockMsgFindFirst(...a),
    },
    workspace: { findUnique: (...a: any[]) => mockWsFindUnique(...a) },
    customers: { update: (...a: any[]) => mockCustUpdate(...a) },
  },
}))
jest.mock("../../../utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))
jest.mock("../../../application/chat-engine", () => ({
  getChatEngine: () => ({ routeMessage: (...a: any[]) => mockRouteMessage(...a) }),
}))
jest.mock("../../../application/services/custom-client-chatbot.service", () => ({
  CustomClientChatbotService: jest.fn().mockImplementation(() => ({ invoke: mockInvoke })),
  applyCustomerPatches: jest.fn(),
  applyEscalationNotification: jest.fn(),
}))
jest.mock("../../../application/services/security-check.service", () => ({
  SecurityCheckService: { validateMessage: (...a: any[]) => mockValidateMessage(...a) },
}))
jest.mock("../../../application/services/workspace-access.service", () => ({
  WorkspaceAccessService: jest.fn().mockImplementation(() => ({ canProcessMessages: mockCanProcess })),
}))
jest.mock("../../../application/services/subscription-billing.service", () => ({
  SubscriptionBillingService: jest.fn().mockImplementation(() => ({
    isTrialValid: mockIsTrialValid,
    getOperationCost: mockGetCost,
    checkCredit: mockCheckCredit,
  })),
}))
jest.mock("../../../services/websocket.service", () => ({
  websocketService: { notifyNewMessage: jest.fn(), notifyChatUpdated: jest.fn() },
}))
jest.mock("../../../utils/custom-chatbot-reply", () => ({
  splitCustomChatbotReply: (r: string) => ({ customerReply: r }),
}))
jest.mock("../../../utils/welcome-video", () => ({
  buildWelcomeVideoSplit: jest.fn((r: string) => r),
  WELCOME_VIDEO_INTRO: {},
}))
jest.mock("../../../utils/language-detector", () => ({
  detectLanguageFromPhonePrefix: () => "it",
}))
jest.mock("../../../services/inbound-media-webhook.service", () => ({
  ingestInboundWebhookMedia: (...a: any[]) => mockIngestMedia(...a),
}))
jest.mock("../../../services/whatsapp-direct-send.service", () => ({
  WhatsAppDirectSendService: jest.fn().mockImplementation(() => ({
    send: (...a: any[]) => mockSend(...a),
    sendTypingIndicator: (...a: any[]) => mockTyping(...a),
  })),
}))

import { WhatsAppInboundPipeline } from "../../../services/whatsapp/whatsapp-inbound.pipeline"

const pipeline = new WhatsAppInboundPipeline()

const customer = {
  id: "cust-1",
  workspaceId: "ws-1",
  phone: "+393331234567",
  name: "Mario",
  language: "it",
  discount: 0,
  workspace: {
    id: "ws-1",
    slug: "acme",
    customChatbotId: null,
    welcomeMessage: "",
    wipMessage: "WIP",
    channelStatus: true,
    debugMode: false,
    defaultLanguage: "it",
    welcomeVideoUrl: null,
  },
}
const chatSession = { id: "sess-1" }

beforeEach(() => {
  jest.clearAllMocks()
  // sensible passing defaults
  mockValidateMessage.mockResolvedValue([{ passed: true }])
  mockCanProcess.mockResolvedValue({ canProcess: true, blockReason: null, message: null })
  mockIsTrialValid.mockResolvedValue({ isTrialPlan: false, isValid: true })
  mockGetCost.mockResolvedValue(0.005)
  mockCheckCredit.mockResolvedValue({ hasSufficientCredit: true, currentBalance: 10 })
  mockMsgCreate.mockResolvedValue({ id: "msg-x", createdAt: new Date(0) })
  mockMsgFindMany.mockResolvedValue([])
  mockMsgFindFirst.mockResolvedValue({ id: "asst-1" })
  mockInvoke.mockResolvedValue({ handled: false })
  mockRouteMessage.mockResolvedValue({
    response: "ciao",
    agentUsed: "router",
    tokensUsed: 7,
    isBlocked: false,
    debugInfo: {},
  })
})

describe("WhatsAppInboundPipeline.checkSecurity", () => {
  const base = {
    workspaceId: "ws-1",
    customerId: "cust-1",
    customerPhone: "+393331234567",
    conversationId: "sess-1",
    messageMarkdown: "hola",
  }

  it("returns null when message passes", async () => {
    const r = await pipeline.checkSecurity({ ...base, isPlayground: false })
    expect(r).toBeNull()
    expect(mockValidateMessage).toHaveBeenCalledTimes(1)
  })

  it("skips validation entirely in playground", async () => {
    const r = await pipeline.checkSecurity({ ...base, isPlayground: true })
    expect(r).toBeNull()
    expect(mockValidateMessage).not.toHaveBeenCalled()
  })

  it("returns 429 + saves blocked message when a step fails", async () => {
    mockValidateMessage.mockResolvedValue([
      { passed: false, step: "SPAM", reason: "too many", retryAfter: 30 },
    ])
    const r = await pipeline.checkSecurity({ ...base, isPlayground: false })
    expect(r).toMatchObject({ statusCode: 429, status: "security_blocked", code: "SPAM" })
    expect(mockMsgCreate).toHaveBeenCalledTimes(1) // blocked msg persisted for review
  })

  it("returns 500 when the security service throws", async () => {
    mockValidateMessage.mockRejectedValue(new Error("boom"))
    const r = await pipeline.checkSecurity({ ...base, isPlayground: false })
    expect(r).toMatchObject({ statusCode: 500, code: "SECURITY_CHECK_ERROR" })
  })
})

describe("WhatsAppInboundPipeline.checkBillingAccess", () => {
  const base = {
    customer,
    chatSession,
    messageMarkdown: "hola",
    whatsappMessageId: "wamid.1",
  }

  it("returns null when access ok + trial valid + credit ok", async () => {
    const r = await pipeline.checkBillingAccess({ ...base, isPlayground: false })
    expect(r).toBeNull()
  })

  it("returns 200 channel_disabled and saves the message silently", async () => {
    mockCanProcess.mockResolvedValue({ canProcess: false, blockReason: "CHANNEL_DISABLED", message: null })
    const r = await pipeline.checkBillingAccess({ ...base, isPlayground: false })
    expect(r).toMatchObject({ statusCode: 200, code: "CHANNEL_DISABLED" })
    expect(mockMsgCreate).toHaveBeenCalledTimes(1)
  })

  it("returns 402 TRIAL_EXPIRED for an expired trial (silent, no save)", async () => {
    mockIsTrialValid.mockResolvedValue({ isTrialPlan: true, isValid: false })
    const r = await pipeline.checkBillingAccess({ ...base, isPlayground: false })
    expect(r).toMatchObject({ statusCode: 402, code: "TRIAL_EXPIRED" })
    expect(mockMsgCreate).not.toHaveBeenCalled() // silent block — no history
  })

  it("returns 402 INSUFFICIENT_CREDIT when balance too low", async () => {
    mockCheckCredit.mockResolvedValue({ hasSufficientCredit: false, currentBalance: 0 })
    const r = await pipeline.checkBillingAccess({ ...base, isPlayground: false })
    expect(r).toMatchObject({ statusCode: 402, code: "INSUFFICIENT_CREDIT" })
  })

  it("skips trial/credit in playground", async () => {
    const r = await pipeline.checkBillingAccess({ ...base, isPlayground: true })
    expect(r).toBeNull()
    expect(mockIsTrialValid).not.toHaveBeenCalled()
    expect(mockCheckCredit).not.toHaveBeenCalled()
  })
})

describe("WhatsAppInboundPipeline.processReply (chatEngine path)", () => {
  const base = {
    customer,
    chatSession,
    messageMarkdown: "hola",
    whatsappMessageId: "wamid.1",
    inboundMedia: null,
    messageCount: 1,
    registrationPromptLevel: 0,
  }

  it("routes via chatEngine and direct-sends the reply (200 processed)", async () => {
    const r = await pipeline.processReply({ ...base, isPlayground: false })
    expect(r.statusCode).toBe(200)
    expect(r.status).toBe("processed")
    expect(r.body?.response).toBe("ciao")
    expect(mockRouteMessage).toHaveBeenCalledTimes(1)
    expect(mockSend).toHaveBeenCalledTimes(1) // reply delivered via provider
  })

  it("returns 410 and does NOT send when the customer is blocked", async () => {
    mockRouteMessage.mockResolvedValue({ response: "x", isBlocked: true })
    const r = await pipeline.processReply({ ...base, isPlayground: false })
    expect(r.statusCode).toBe(410)
    expect(r.status).toBe("blocked")
    expect(mockSend).not.toHaveBeenCalled()
  })

  it("skips the typing indicator in playground", async () => {
    await pipeline.processReply({ ...base, isPlayground: true })
    expect(mockTyping).not.toHaveBeenCalled()
  })
})
