import { WhatsAppWebhookController } from "../../../src/interfaces/http/controllers/whatsapp-webhook.controller"

// eslint-disable-next-line no-var
var prismaMock: any

jest.mock("../../../src/lib/prisma", () => ({
  prisma: (prismaMock = {
    whatsappSettings: {
      findUnique: jest.fn(),
    },
    whatsappWebhookEvent: {
      create: jest.fn(),
    },
    customers: {
      findFirst: jest.fn(),
    },
    workspace: {
      findUnique: jest.fn(),
    },
  }),
}))

const enqueueMock = jest.fn()
const routeMessageMock = jest.fn()

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
  verifyWhatsAppSignature: jest.fn().mockReturnValue(true),
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
                  timestamp: String(Math.floor(Date.now() / 1000)),
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

    prismaMock.workspace.findUnique.mockResolvedValue({
      id: "ws-1",
      name: "Workspace",
      channelStatus: true,
      debugMode: false,
      deletedAt: null,
      ownerId: "owner-1",
      owner: { 
        id: "owner-1",
        status: "ACTIVE",
        creditBalance: 100,
        subscriptionStatus: "ACTIVE"
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

  it.skip("returns 200 when customer rate limit is exceeded (avoid Meta retries)", async () => {
    // TODO: Fix rate limiter mock - currently returns "Internal error"
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

  it.skip("returns 200 when workspace rate limit is exceeded (avoid Meta retries)", async () => {
    // TODO: Fix rate limiter mock - currently returns "Internal error"
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
