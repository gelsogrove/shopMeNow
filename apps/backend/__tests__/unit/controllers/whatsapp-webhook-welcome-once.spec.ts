/**
 * Test: WhatsApp Webhook - Welcome Message Sent ONLY Once
 * 
 * CRITICAL BUG FIX: Ensure welcome message is sent ONLY when:
 * - Customer does NOT exist AND
 * - Message count = 0
 * 
 * If customer has ANY messages in history, do NOT send welcome again
 * even if customer lookup fails due to phone format issues.
 */

import { prisma } from "../../../src/lib/prisma"
import { WhatsAppWebhookController } from "../../../src/interfaces/http/controllers/whatsapp-webhook.controller"

describe("WhatsApp Webhook - Welcome Message ONLY Once", () => {
  let workspaceId: string
  let customerPhone: string

  beforeAll(async () => {
    // Get test workspace
    const workspace = await prisma.workspace.findFirst({
      where: { name: { contains: "BellItalia VIP" } },
    })
    
    if (!workspace) {
      throw new Error("Test workspace not found - run seed first")
    }
    
    workspaceId = workspace.id
    customerPhone = `+39${Date.now()}` // Unique phone for this test
  })

  afterAll(async () => {
    // Cleanup
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

    await prisma.$disconnect()
  })

  it("should send welcome ONLY on first message (message count = 0)", async () => {
    // Arrange
    const controller = new WhatsAppWebhookController()
    const mockReq = {
      body: {
        message: "ciao",
        phoneNumber: customerPhone,
        workspaceId: workspaceId,
      },
    } as any

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any

    // Act - First message
    await controller.receiveMessage(mockReq, mockRes)

    // Assert - Welcome sent
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "new_user_welcomed",
      })
    )

    // Verify messages saved
    const customer = await prisma.customers.findFirst({
      where: { phone: customerPhone, workspaceId },
    })

    expect(customer).toBeTruthy()

    const messages = await prisma.conversationMessage.findMany({
      where: { customerId: customer!.id, workspaceId },
    })

    expect(messages).toHaveLength(2) // user + welcome
    expect(messages[0].role).toBe("user")
    expect(messages[1].agentType).toBe("REGISTRATION_FLOW") // Welcome
  }, 30000)

  it("should NOT send welcome on second message (message count > 0)", async () => {
    // Arrange
    const controller = new WhatsAppWebhookController()
    const mockReq = {
      body: {
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: customerPhone,
                      text: { body: "che piani avete?" },
                    },
                  ],
                  workspaceId: workspaceId,
                  channelPhoneNumber: "",
                },
              },
            ],
          },
        ],
      },
    } as any

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any

    // Act - Second message
    await controller.receiveMessage(mockReq, mockRes)

    // Assert - NOT welcome
    const jsonCall = mockRes.json.mock.calls[0][0]
    expect(jsonCall.status).not.toBe("new_user_welcomed")
    expect(jsonCall.success).toBe(true)

    // Verify messages - should have normal LLM response
    const customer = await prisma.customers.findFirst({
      where: { phone: customerPhone, workspaceId },
    })

    const messages = await prisma.conversationMessage.findMany({
      where: { customerId: customer!.id, workspaceId },
      orderBy: { createdAt: "asc" },
    })

    // Should have at least 3 messages (user1, welcome, user2, llm_response)
    expect(messages.length).toBeGreaterThanOrEqual(3)

    // Count REGISTRATION_FLOW messages (should be ONLY 1 - the first welcome)
    const welcomeMessages = messages.filter(
      (m) => m.agentType === "REGISTRATION_FLOW"
    )
    expect(welcomeMessages).toHaveLength(1) // ONLY first welcome

    // Last message should be LLM response (NOT welcome)
    const lastMessage = messages[messages.length - 1]
    expect(lastMessage.role).toBe("assistant")
    expect(lastMessage.agentType).not.toBe("REGISTRATION_FLOW")
  }, 30000)

  it("should NOT send welcome if customer has messages (even if lookup fails)", async () => {
    /**
     * EDGE CASE: Customer exists but phone lookup fails due to format issue
     * System should check message count BEFORE sending welcome
     */
    
    // Arrange - Manually create customer with different phone format
    const phoneWithoutPlus = customerPhone.replace(/^\+/, "") // Remove +
    
    const manualCustomer = await prisma.customers.create({
      data: {
        phone: phoneWithoutPlus, // Different format
        workspaceId: workspaceId,
        name: "Manual Test Customer",
        email: `test${Date.now()}@test.com`,
        language: "it",
        isActive: false,
      },
    })

    // Create a previous message
    const session = await prisma.chatSession.create({
      data: {
        customerId: manualCustomer.id,
        workspaceId: workspaceId,
        status: "active",
      },
    })

    await prisma.conversationMessage.create({
      data: {
        workspaceId: workspaceId,
        customerId: manualCustomer.id,
        conversationId: session.id,
        role: "user",
        content: "previous message",
        agentType: "CUSTOMER",
        tokensUsed: 0,
        deliveryStatus: "delivered",
      },
    })

    // Act - Send message with DIFFERENT phone format (with +)
    const controller = new WhatsAppWebhookController()
    const mockReq = {
      body: {
        message: "nuovo messaggio",
        phoneNumber: customerPhone, // With +
        workspaceId: workspaceId,
      },
    } as any

    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any

    await controller.receiveMessage(mockReq, mockRes)

    // Assert - Should NOT send welcome (message count > 0)
    const jsonCall = mockRes.json.mock.calls[0][0]
    expect(jsonCall.status).not.toBe("new_user_welcomed")

    // Cleanup
    await prisma.conversationMessage.deleteMany({
      where: { customerId: manualCustomer.id },
    })
    await prisma.chatSession.deleteMany({
      where: { customerId: manualCustomer.id },
    })
    await prisma.customers.delete({
      where: { id: manualCustomer.id },
    })
  }, 30000)
})
