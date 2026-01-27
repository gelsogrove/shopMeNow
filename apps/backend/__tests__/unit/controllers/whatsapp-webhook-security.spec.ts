import { WhatsAppWebhookController } from "../../../src/interfaces/http/controllers/whatsapp-webhook.controller"

const enqueueMock = jest.fn()
const routeMessageMock = jest.fn()
const verifySignatureMock = jest.fn().mockReturnValue(true)

let prismaMock: any

jest.mock("../../../src/lib/prisma", () => {
  prismaMock = {
    whatsappSettings: {
      findUnique: jest.fn(),
    },
    whatsappWebhookEvent: {
      create: jest.fn(),
    },
    customers: {
      findFirst: jest.fn(),
    },
  }

  return { prisma: prismaMock }
})

jest.mock("../../../src/services/whatsapp-queue.service", () => ({
  WhatsAppQueueService: jest.fn().mockImplementation(() => ({
    enqueue: enqueueMock,
  })),
}))

jest.mock("../../../src/application/chat-engine", () => ({
  getChatEngine: jest.fn(() => ({
    routeMessage: routeMessageMock,
  })),
}))

jest.mock("../../../src/utils/whatsapp-signature", () => ({
  verifyWhatsAppSignature: verifySignatureMock,
}))

jest.mock("../../../src/middlewares/rateLimiter", () => ({
  whatsappMessageRateLimiter: {
    isAllowed: jest.fn(),
    getTimeToReset: jest.fn(),
  },
  whatsappWorkspaceRateLimiter: {
    isAllowed: jest.fn(),
    getTimeToReset: jest.fn(),
  },
}))

jest.mock("../../../src/services/platform-config.service", () => ({
  platformConfigService: {
    getLimit: jest.fn(),
  },
}))

const {
  whatsappMessageRateLimiter,
  whatsappWorkspaceRateLimiter,
} = jest.requireMock("../../../src/middlewares/rateLimiter")
const { platformConfigService } = jest.requireMock("../../../src/services/platform-config.service")

const buildWebhookReq = (overrides: Partial<any> = {}) => ({
  body: {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: "391234567890",
                  id: "wamid-123",
                  timestamp: "1700000000",
                  text: { body: "ciao" },
                },
              ],
              metadata: { display_phone_number: "+34654728753" },
              contacts: [{ profile: { name: "Mario" } }],
            },
          },
        ],
      },
    ],
  },
  params: { webhookId: "wh_test" },
  headers: {},
  query: {},
  rawBody: "{}",
  header: jest.fn().mockReturnValue("sha256=test"),
  ...overrides,
})

const buildRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
})

describe("WhatsApp Webhook - Security & Rate Limits", () => {
  beforeEach(() => {
    jest.clearAllMocks()

    prismaMock.whatsappSettings.findUnique.mockResolvedValue({
      workspaceId: "ws-1",
      phoneNumber: "+34654728753",
      appSecret: "secret",
      workspace: {
        id: "ws-1",
        name: "Workspace",
        channelStatus: true,
        deletedAt: null,
        ownerId: "owner-1",
        owner: { status: "ACTIVE" },
      },
    })

    prismaMock.customers.findFirst.mockResolvedValue({
      id: "cust-1",
      phone: "+391234567890",
      name: "Mario",
      email: "mario@example.com",
      language: "it",
      workspaceId: "ws-1",
      isActive: true,
      isBlacklisted: false,
      activeChatbot: true,
      discount: 0,
      workspace: {
        id: "ws-1",
        name: "Workspace",
        welcomeMessage: "Ciao!",
      },
    })

    platformConfigService.getLimit.mockImplementation((key: string) => {
      const values: Record<string, number> = {
        WHATSAPP_RATE_LIMIT_CUSTOMER_PER_MIN: 60,
        WHATSAPP_RATE_LIMIT_CUSTOMER_BURST: 30,
        WHATSAPP_RATE_LIMIT_WORKSPACE_PER_MIN: 1200,
        WHATSAPP_RATE_LIMIT_WORKSPACE_BURST: 600,
      }
      return Promise.resolve(values[key])
    })
  })

  it("returns 200 when customer rate limit is exceeded (avoid Meta retries)", async () => {
    // Problem: Meta retries on 429 -> duplicate processing and double billing.
    // Expected: respond 200 and skip processing when rate-limited.
    whatsappMessageRateLimiter.isAllowed.mockReturnValue(false)
    whatsappMessageRateLimiter.getTimeToReset.mockReturnValue(10_000)
    whatsappWorkspaceRateLimiter.isAllowed.mockReturnValue(true)

    const controller = new WhatsAppWebhookController()
    const req = buildWebhookReq()
    const res = buildRes()

    await controller.receiveMessage(req as any, res as any)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rate_limited",
        code: "RATE_LIMIT_EXCEEDED",
      })
    )
    expect(routeMessageMock).not.toHaveBeenCalled()
    expect(enqueueMock).not.toHaveBeenCalled()
  })

  it("returns 200 when workspace rate limit is exceeded (avoid Meta retries)", async () => {
    whatsappMessageRateLimiter.isAllowed.mockReturnValue(true)
    whatsappWorkspaceRateLimiter.isAllowed.mockReturnValue(false)
    whatsappWorkspaceRateLimiter.getTimeToReset.mockReturnValue(5_000)

    const controller = new WhatsAppWebhookController()
    const req = buildWebhookReq()
    const res = buildRes()

    await controller.receiveMessage(req as any, res as any)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "rate_limited",
        code: "WORKSPACE_RATE_LIMIT_EXCEEDED",
      })
    )
    expect(routeMessageMock).not.toHaveBeenCalled()
    expect(enqueueMock).not.toHaveBeenCalled()
  })

  it("ignores duplicate webhook message IDs (Meta retries)", async () => {
    // Problem: Meta can retry the same messageId -> without dedupe we'd reprocess.
    prismaMock.whatsappWebhookEvent.create.mockRejectedValue({ code: "P2002" })

    const controller = new WhatsAppWebhookController()
    const req = buildWebhookReq()
    const res = buildRes()

    await controller.receiveMessage(req as any, res as any)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "duplicate",
        messageId: "wamid-123",
      })
    )
    expect(prismaMock.customers.findFirst).not.toHaveBeenCalled()
    expect(routeMessageMock).not.toHaveBeenCalled()
    expect(enqueueMock).not.toHaveBeenCalled()
  })
})
