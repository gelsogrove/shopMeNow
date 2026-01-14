/**
 * 🧪 WIDGET CHATBOT CONFIG TESTS
 *
 * Unit tests for Widget Chatbot configuration endpoints:
 * - GET /api/platform-config/widget-code (public)
 * - PUT /api/platform-config/widget-code (admin only)
 * - showWidgetChatbot flag in /api/platform-config/flags/check
 *
 * @author Andrea Gelso - eChatbot Platform
 */

import { Request, Response } from "express"
import { prisma } from "@echatbot/database"
import { platformConfigController } from "../../../src/interfaces/http/controllers/platform-config.controller"
import { platformConfigService } from "../../../src/services/platform-config.service"

jest.mock("../../../src/services/platform-config.service")
jest.mock("@echatbot/database", () => ({
  prisma: {
    workspace: {
      findUnique: jest.fn(),
    },
  },
}))

describe("Widget Chatbot Config Controller", () => {
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let jsonMock: jest.Mock
  let statusMock: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    jsonMock = jest.fn()
    statusMock = jest.fn().mockReturnValue({ json: jsonMock })
    mockRes = {
      status: statusMock,
      json: jsonMock,
    }
    mockReq = {}
  })

  describe("GET /api/platform-config/widget-code", () => {
    it("should return widget code when exists", async () => {
      const mockCode = `<script>window.eChatbotConfig = { workspaceId: "test123" };</script>`
      ;(platformConfigService.getWidgetChatbotCode as jest.Mock).mockResolvedValue(mockCode)
      ;(platformConfigService.getFlag as jest.Mock).mockResolvedValue(true)

      await platformConfigController.getWidgetCode(
        mockReq as Request,
        mockRes as Response
      )

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          code: mockCode,
          isValid: expect.any(Boolean),
          workspaceId: "test123",
          showWidgetChatbot: true,
          error: expect.anything(),
        },
      })
    })

    it("should return null when widget code does not exist", async () => {
      ;(platformConfigService.getWidgetChatbotCode as jest.Mock).mockResolvedValue(null)
      ;(platformConfigService.getFlag as jest.Mock).mockResolvedValue(undefined)

      await platformConfigController.getWidgetCode(
        mockReq as Request,
        mockRes as Response
      )

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          code: null,
          isValid: true,
          workspaceId: null,
          showWidgetChatbot: undefined,
          error: null,
        },
      })
    })

    it("should handle errors gracefully", async () => {
      ;(platformConfigService.getWidgetChatbotCode as jest.Mock).mockRejectedValue(
        new Error("Database error")
      )

      await platformConfigController.getWidgetCode(
        mockReq as Request,
        mockRes as Response
      )

      expect(statusMock).toHaveBeenCalledWith(500)
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Failed to fetch widget code",
      })
    })
  })

  describe("PUT /api/platform-config/widget-code", () => {
    it("should save widget code successfully", async () => {
      const mockCode = `<script>window.eChatbotConfig = { workspaceId: "echatbot-hq-support" };</script>`
      mockReq.body = { code: mockCode }
      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: "echatbot-hq-support",
        isActive: true,
        sellsProductsAndServices: false,
      })
      ;(platformConfigService.saveWidgetChatbotCode as jest.Mock).mockResolvedValue(undefined)

      await platformConfigController.saveWidgetCode(
        mockReq as Request,
        mockRes as Response
      )

      expect(platformConfigService.saveWidgetChatbotCode).toHaveBeenCalledWith(mockCode)
      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: "Widget code saved successfully",
      })
    })

    it("should return 400 when code is not provided", async () => {
      mockReq.body = {}

      await platformConfigController.saveWidgetCode(
        mockReq as Request,
        mockRes as Response
      )

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Widget code is required",
      })
    })

    it("should allow empty string to clear widget code", async () => {
      mockReq.body = { code: "" }
      ;(platformConfigService.saveWidgetChatbotCode as jest.Mock).mockResolvedValue(undefined)

      await platformConfigController.saveWidgetCode(
        mockReq as Request,
        mockRes as Response
      )

      expect(platformConfigService.saveWidgetChatbotCode).toHaveBeenCalledWith("")
      expect(statusMock).toHaveBeenCalledWith(200)
    })

    it("should reject widget code without workspaceId", async () => {
      mockReq.body = { code: "<script>window.eChatbotConfig = { };</script>" }

      await platformConfigController.saveWidgetCode(
        mockReq as Request,
        mockRes as Response
      )

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Widget code must include a workspaceId",
      })
    })

    it("should reject widget code when workspace is inactive or missing", async () => {
      const mockCode = `<script>window.eChatbotConfig = { workspaceId: "missing-workspace" };</script>`
      mockReq.body = { code: mockCode }
      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue(null)

      await platformConfigController.saveWidgetCode(
        mockReq as Request,
        mockRes as Response
      )

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Widget workspace not found or inactive",
      })
    })

    it("should reject widget code when workspace sells products", async () => {
      const mockCode = `<script>window.eChatbotConfig = { workspaceId: "bellitalia-vip-ecommerce" };</script>`
      mockReq.body = { code: mockCode }
      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: "bellitalia-vip-ecommerce",
        isActive: true,
        sellsProductsAndServices: true,
      })

      await platformConfigController.saveWidgetCode(
        mockReq as Request,
        mockRes as Response
      )

      expect(statusMock).toHaveBeenCalledWith(400)
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Widget must target an informational workspace",
      })
    })

    it("should handle save errors gracefully", async () => {
      mockReq.body = { code: `<script>window.eChatbotConfig = { workspaceId: "echatbot-hq-support" };</script>` }
      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: "echatbot-hq-support",
        isActive: true,
        sellsProductsAndServices: false,
      })
      ;(platformConfigService.saveWidgetChatbotCode as jest.Mock).mockRejectedValue(
        new Error("Database error")
      )

      await platformConfigController.saveWidgetCode(
        mockReq as Request,
        mockRes as Response
      )

      expect(statusMock).toHaveBeenCalledWith(500)
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: "Failed to save widget code",
      })
    })
  })

  describe("GET /api/platform-config/flags/check - showWidgetChatbot", () => {
    it("should include showWidgetChatbot in flags check response", async () => {
      ;(platformConfigService.canLogin as jest.Mock).mockResolvedValue(true)
      ;(platformConfigService.canRegister as jest.Mock).mockResolvedValue(true)
      ;(platformConfigService.isWorkingInProgress as jest.Mock).mockResolvedValue(false)
      ;(platformConfigService.getFlag as jest.Mock).mockImplementation((key: string) => {
        if (key === "registerFirst") return Promise.resolve(false)
        if (key === "cantryDemo") return Promise.resolve(true)
        if (key === "showWidgetChatbot") return Promise.resolve(true)
        return Promise.resolve(false)
      })

      await platformConfigController.checkFlags(
        mockReq as Request,
        mockRes as Response
      )

      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            showWidgetChatbot: true,
          }),
        })
      )
    })
  })
})
