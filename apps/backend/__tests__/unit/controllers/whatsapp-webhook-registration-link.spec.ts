/**
 * WhatsApp Webhook - Registration Link uses workspace.url
 */

import { prisma } from "../../../src/lib/prisma"
import { WhatsAppWebhookController } from "../../../src/interfaces/http/controllers/whatsapp-webhook.controller"

describe("WhatsApp Webhook - Registration Link Domain", () => {
  let workspaceId: string
  let customerPhone: string
  let originalUrl: string | null | undefined

  beforeAll(async () => {
    const workspace = await prisma.workspace.findFirst({
      where: { name: { contains: "BellItalia VIP" } },
    })

    if (!workspace) {
      throw new Error("Test workspace not found - run seed first")
    }

    workspaceId = workspace.id
    originalUrl = workspace.url
    customerPhone = `+39${Date.now()}`

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { url: "https://example.test" },
    })
  })

  afterAll(async () => {
    const customer = await prisma.customers.findFirst({
      where: { phone: customerPhone, workspaceId },
    })

    if (customer) {
      await prisma.conversationMessage.deleteMany({
        where: { customerId: customer.id },
      })
      await prisma.chatSession.deleteMany({
        where: { customerId: customer.id },
      })
      await prisma.customers.delete({
        where: { id: customer.id },
      })
    }

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { url: originalUrl || null },
    })

    await prisma.$disconnect()
  })

  it("should embed workspace.url in registration link", async () => {
    const controller = new WhatsAppWebhookController()
    const mockReq = {
      body: {
        message: "test primo messaggio",
        phoneNumber: customerPhone,
        workspaceId: workspaceId,
      },
    } as any

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any

    await controller.receiveMessage(mockReq, mockRes)

    const customer = await prisma.customers.findFirst({
      where: { phone: customerPhone, workspaceId },
    })

    expect(customer).toBeTruthy()

    const messages = await prisma.conversationMessage.findMany({
      where: { customerId: customer!.id, workspaceId },
      orderBy: { createdAt: "asc" },
    })

    expect(messages).toHaveLength(2)
    expect(messages[1].role).toBe("assistant")
    expect(messages[1].content).toContain("https://example.test/s/")
  }, 30000)
})
