/**
 * Test: WhatsApp Webhook - First Message Detection
 * 
 * Feature 174: Registration Optional
 * 
 * CRITICAL: Ensure that after welcome message is sent to new customer,
 * the second message is NOT treated as "first message" again.
 * 
 * Bug Fix: Webhook must save BOTH user message and assistant welcome message
 * so ChatEngine can correctly count previous messages.
 */

import { prisma } from "../../../src/lib/prisma"
import { WhatsAppWebhookController } from "../../../src/interfaces/http/controllers/whatsapp-webhook.controller"

describe("WhatsApp Webhook - First Message Detection", () => {
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
    // Cleanup: Delete test customer and messages
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

  it("should save user message when sending welcome to new customer", async () => {
    // Arrange
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

    // Act - Send first message
    await controller.receiveMessage(mockReq, mockRes)

    // Assert - Verify customer was created
    const customer = await prisma.customers.findFirst({
      where: { phone: customerPhone, workspaceId },
    })

    expect(customer).toBeTruthy()
    expect(customer?.isActive).toBe(false) // Feature 174: inactive until registration

    // Assert - Verify BOTH user message and welcome message were saved
    const messages = await prisma.conversationMessage.findMany({
      where: {
        customerId: customer!.id,
        workspaceId,
      },
      orderBy: { createdAt: "asc" },
    })

    expect(messages).toHaveLength(2)
    
    // First message should be USER message
    expect(messages[0].role).toBe("user")
    expect(messages[0].content).toBe("test primo messaggio")
    expect(messages[0].agentType).toBe("CUSTOMER")
    
    // Second message should be ASSISTANT welcome
    expect(messages[1].role).toBe("assistant")
    expect(messages[1].agentType).toBe("REGISTRATION_FLOW")
    expect(messages[1].content).toContain("SofIA") // Welcome message content

    // Assert - Verify welcome response was sent
    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "new_user_welcomed",
      })
    )
  }, 30000) // 30 second timeout for LLM calls

  it("should NOT send welcome again on second message", async () => {
    // Arrange - Customer already exists from previous test
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
                      text: { body: "chi sei?" },
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

    // Act - Send second message
    await controller.receiveMessage(mockReq, mockRes)

    // Assert - Verify customer still exists
    const customer = await prisma.customers.findFirst({
      where: { phone: customerPhone, workspaceId },
    })

    expect(customer).toBeTruthy()

    // Assert - Verify message count increased (should have 4 now: user1, welcome, user2, llm_response)
    const messages = await prisma.conversationMessage.findMany({
      where: {
        customerId: customer!.id,
        workspaceId,
      },
      orderBy: { createdAt: "asc" },
    })

    // Should have at least 3 messages (user1, welcome, user2)
    expect(messages.length).toBeGreaterThanOrEqual(3)

    // Count user messages (should be 2)
    const userMessages = messages.filter(m => m.role === "user")
    expect(userMessages).toHaveLength(2)
    expect(userMessages[0].content).toBe("test primo messaggio")
    expect(userMessages[1].content).toBe("chi sei?")

    // Count assistant messages (should be at least 2: welcome + LLM response)
    const assistantMessages = messages.filter(m => m.role === "assistant")
    expect(assistantMessages.length).toBeGreaterThanOrEqual(2)
    
    // First assistant message is welcome
    expect(assistantMessages[0].agentType).toBe("REGISTRATION_FLOW")
    
    // Second assistant message is LLM response (NOT welcome)
    expect(assistantMessages[1].agentType).not.toBe("REGISTRATION_FLOW")

    // Assert - Response should be success (not new_user_welcomed)
    expect(mockRes.status).toHaveBeenCalledWith(200)
    const jsonCall = mockRes.json.mock.calls[0][0]
    expect(jsonCall.status).not.toBe("new_user_welcomed")
    expect(jsonCall.success).toBe(true)
  }, 30000) // 30 second timeout for LLM calls
})
