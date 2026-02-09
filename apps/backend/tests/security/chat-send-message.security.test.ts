import { Request, Response } from "express"
import { ChatController } from "../../src/interfaces/http/controllers/chat.controller"
import { prisma } from "@echatbot/database"

describe("ChatController - Security Tests", () => {
  let chatController: ChatController
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let statusMock: jest.Mock
  let jsonMock: jest.Mock

  beforeEach(() => {
    chatController = new ChatController()
    
    jsonMock = jest.fn()
    statusMock = jest.fn(() => ({ json: jsonMock }))
    
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    }
  })

  describe("sendMessage - IDOR Protection", () => {
    it("should block user from accessing workspace they don't belong to", async () => {
      const attackerUserId = "attacker-user-id"
      const victimWorkspaceId = "victim-workspace-id"
      const sessionId = "victim-session-id"

      mockRequest = {
        params: { sessionId },
        body: { content: "malicious message", sender: "user" },
        user: { userId: attackerUserId, id: attackerUserId },
        workspaceId: victimWorkspaceId,
      } as any

      jest.spyOn(prisma.userWorkspace, "findFirst").mockResolvedValue(null)

      await chatController.sendMessage(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(statusMock).toHaveBeenCalledWith(403)
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Access denied to this workspace",
      })
    })

    it("should allow user to send message to their own workspace", async () => {
      const userId = "authorized-user-id"
      const workspaceId = "user-workspace-id"
      const sessionId = "user-session-id"

      mockRequest = {
        params: { sessionId },
        body: { content: "legitimate message", sender: "user" },
        user: { userId, id: userId },
        workspaceId,
      } as any

      jest.spyOn(prisma.userWorkspace, "findFirst").mockResolvedValue({
        userId,
        workspaceId,
        role: "OWNER",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      jest.spyOn(prisma.chatSession, "findFirst").mockResolvedValue({
        id: sessionId,
        workspaceId,
        customerId: "customer-id",
        channel: "whatsapp",
        customer: {
          id: "customer-id",
          activeChatbot: false,
          language: "it",
          name: "Test Customer",
          phone: "+1234567890",
        },
      } as any)

      jest.spyOn(prisma.message, "create").mockResolvedValue({
        id: "message-id",
        content: "legitimate message",
        createdAt: new Date(),
      } as any)

      jest.spyOn(prisma.conversationMessage, "create").mockResolvedValue({} as any)
      jest.spyOn(prisma.conversationMessage, "updateMany").mockResolvedValue({ count: 1 } as any)
      jest.spyOn(prisma.workspace, "findUnique").mockResolvedValue({ debugMode: true } as any)
      jest.spyOn(prisma.customers, "findUnique").mockResolvedValue({ phone: "+1234567890" } as any)

      await chatController.sendMessage(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            content: "legitimate message",
          }),
        })
      )
    })
  })

  describe("sendMessage - Input Validation", () => {
    it("should reject request without sessionId", async () => {
      mockRequest = {
        params: {},
        body: { content: "test", sender: "user" },
        workspaceId: "workspace-id",
      } as any

      await chatController.sendMessage(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Session ID is required",
      })
    })

    it("should reject request without content", async () => {
      mockRequest = {
        params: { sessionId: "session-id" },
        body: { sender: "user" },
        workspaceId: "workspace-id",
      } as any

      await chatController.sendMessage(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Content and sender are required",
      })
    })

    it("should reject request without workspaceId", async () => {
      mockRequest = {
        params: { sessionId: "session-id" },
        body: { content: "test", sender: "user" },
      } as any

      await chatController.sendMessage(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Workspace ID is required",
      })
    })
  })

  describe("sendMessage - Session Validation", () => {
    it("should reject if chat session does not exist in workspace", async () => {
      const userId = "user-id"
      const workspaceId = "workspace-id"
      const sessionId = "non-existent-session"

      mockRequest = {
        params: { sessionId },
        body: { content: "test", sender: "user" },
        user: { userId, id: userId },
        workspaceId,
      } as any

      jest.spyOn(prisma.userWorkspace, "findFirst").mockResolvedValue({
        userId,
        workspaceId,
        role: "OWNER",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      jest.spyOn(prisma.chatSession, "findFirst").mockResolvedValue(null)

      await chatController.sendMessage(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(statusMock).toHaveBeenCalledWith(404)
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Chat session not found in this workspace",
      })
    })

    it("should reject if chatbot is active (manual mode required)", async () => {
      const userId = "user-id"
      const workspaceId = "workspace-id"
      const sessionId = "session-id"

      mockRequest = {
        params: { sessionId },
        body: { content: "test", sender: "user" },
        user: { userId, id: userId },
        workspaceId,
      } as any

      jest.spyOn(prisma.userWorkspace, "findFirst").mockResolvedValue({
        userId,
        workspaceId,
        role: "OWNER",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      jest.spyOn(prisma.chatSession, "findFirst").mockResolvedValue({
        id: sessionId,
        workspaceId,
        customerId: "customer-id",
        channel: "whatsapp",
        customer: {
          id: "customer-id",
          activeChatbot: true,
          language: "it",
          name: "Test Customer",
        },
      } as any)

      await chatController.sendMessage(
        mockRequest as Request,
        mockResponse as Response
      )

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Cannot send manual message: chatbot is active. Disable chatbot first.",
      })
    })
  })
})
