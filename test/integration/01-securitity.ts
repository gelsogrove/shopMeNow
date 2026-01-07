import { prisma, AgentType } from "@echatbot/database"
import axios from "axios"
import { WhatsAppQueueService } from "../../apps/backend/src/services/whatsapp-queue.service"

jest.mock("axios")

const mockedAxios = axios as jest.Mocked<typeof axios>

describe("Integration - SecurityAgent blocks external links", () => {
  const now = Date.now()
  const workspaceSlug = `security-test-${now}`
  let workspaceId: string
  let customerId: string
  let queueMessageId: string

  beforeAll(async () => {
    process.env.OPENROUTER_API_KEY = "test-key"

    const workspace = await prisma.workspace.create({
      data: {
        name: `Security Test ${now}`,
        slug: workspaceSlug,
        language: "ENG",
        allowedExternalLinks: ["allowed.com"],
      },
    })
    workspaceId = workspace.id

    const customer = await prisma.customers.create({
      data: {
        name: "Security Test Customer",
        email: `security-${now}@example.com`,
        phone: "+10000000000",
        workspaceId,
      },
    })
    customerId = customer.id

    await prisma.agentConfig.create({
      data: {
        workspaceId,
        name: "Security Agent",
        type: AgentType.SECURITY,
        systemPrompt:
          "Allowed domains: {{ALLOWED_EXTERNAL_LINKS}}. Block any other external links.",
        model: "openai/gpt-4o-mini",
        temperature: 0.1,
        maxTokens: 200,
        order: 98,
        isActive: true,
      },
    })

    const queueMessage = await prisma.whatsAppQueue.create({
      data: {
        workspaceId,
        customerId,
        phoneNumber: "+10000000000",
        messageContent: "Check this link: https://evil.com",
        status: "pending",
      },
    })
    queueMessageId = queueMessage.id
  })

  afterAll(async () => {
    await prisma.whatsAppQueue.deleteMany({ where: { id: queueMessageId } })
    await prisma.agentConfig.deleteMany({
      where: { workspaceId, type: AgentType.SECURITY },
    })
    await prisma.customers.deleteMany({ where: { id: customerId } })
    await prisma.workspace.deleteMany({ where: { id: workspaceId } })
    await prisma.$disconnect()
  })

  it("blocks message when SecurityAgent marks it unsafe", async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                safe: false,
                message: "Blocked",
                reason: "external_link_not_allowed",
              }),
            },
          },
        ],
        usage: { total_tokens: 10 },
      },
    })

    const service = new WhatsAppQueueService(prisma)
    const message = await prisma.whatsAppQueue.findUnique({
      where: { id: queueMessageId },
    })
    expect(message).not.toBeNull()

    const result = await service.validateAndSend(message!)
    expect(result.success).toBe(false)
    expect(result.error).toContain("Security check failed")

    const requestPayload = mockedAxios.post.mock.calls[0]?.[1]
    expect(requestPayload.messages[0].content).toContain("allowed.com")
  })
})
