/**
 * Unit Test: Widget Enable/Disable Toggle
 * 
 * CRITICAL: Verify that enableWidget field in workspace settings controls widget visibility
 * 
 * Tests:
 * 1. Widget should be DISABLED when enableWidget = false
 * 2. Widget should be ENABLED when enableWidget = true
 * 3. getStatus endpoint should return "disabled" when enableWidget = false
 * 4. sendMessage endpoint should return 403 error when enableWidget = false
 */

import { Request, Response } from "express"
import { prisma } from "@echatbot/database"
import { WidgetChatController } from "../../src/interfaces/http/controllers/widget-chat.controller"

jest.mock("@echatbot/database", () => ({
  prisma: {
    workspace: {
      findUnique: jest.fn(),
    },
    customers: {
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}))

describe("Widget Enable/Disable Toggle", () => {
  let controller: WidgetChatController
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let jsonMock: jest.Mock
  let statusMock: jest.Mock

  beforeEach(() => {
    controller = new WidgetChatController()
    jsonMock = jest.fn()
    statusMock = jest.fn(() => ({ json: jsonMock }))

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    }

    jest.clearAllMocks()
  })

  describe("getStatus endpoint", () => {
    it("should return 'disabled' status when enableWidget = false", async () => {
      mockRequest = {
        params: { workspaceId: "workspace-123" },
        query: { language: "it" },
      }

      // Mock workspace with enableWidget = false
      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: "workspace-123",
        deletedAt: null,
        channelStatus: true,
        ownerId: "owner-123",
        debugMode: false,
        wipMessage: null,
        widgetLanguage: "it",
        enableWidget: false, // 🚫 Widget DISABLED
      })

      // Mock owner as ACTIVE (so widget disabled is the only reason)
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        status: "ACTIVE",
      })

      await controller.getStatus(
        mockRequest as Request,
        mockResponse as Response
      )

      // ✅ Should return status "disabled"
      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        status: "disabled",
        channelStatus: false,
        debugMode: false,
        message: "Widget is disabled",
      })
    })

    it("should return 'active' status when enableWidget = true", async () => {
      mockRequest = {
        params: { workspaceId: "workspace-123" },
        query: { language: "it" },
      }

      // Mock workspace with enableWidget = true
      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: "workspace-123",
        deletedAt: null,
        channelStatus: true,
        ownerId: "owner-123",
        debugMode: false,
        wipMessage: null,
        widgetLanguage: "it",
        enableWidget: true, // ✅ Widget ENABLED
      })

      // Mock owner as ACTIVE
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        status: "ACTIVE",
      })

      await controller.getStatus(
        mockRequest as Request,
        mockResponse as Response
      )

      // ✅ Should return status "active"
      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        status: "active",
        channelStatus: true,
        debugMode: false,
        language: "it",
      })
    })

    it("should prioritize enableWidget check over debugMode check", async () => {
      mockRequest = {
        params: { workspaceId: "workspace-123" },
        query: { language: "it" },
      }

      // Mock workspace with BOTH enableWidget=false AND debugMode=true
      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: "workspace-123",
        deletedAt: null,
        channelStatus: true,
        ownerId: "owner-123",
        debugMode: true, // Debug mode ON
        wipMessage: { it: "Sito in manutenzione" },
        widgetLanguage: "it",
        enableWidget: false, // 🚫 Widget DISABLED (should take priority)
      })

      // Mock owner as ACTIVE
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        status: "ACTIVE",
      })

      await controller.getStatus(
        mockRequest as Request,
        mockResponse as Response
      )

      // ✅ Should return "disabled" (NOT "wip")
      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        status: "disabled",
        channelStatus: false,
        debugMode: true,
        message: "Widget is disabled",
      })
    })
  })

  describe("sendMessage endpoint", () => {
    it("should return 403 error when enableWidget = false", async () => {
      const validVisitorId = `visitor_${Date.now()}_abc123`

      mockRequest = {
        params: { workspaceId: "workspace-123" },
        body: {
          visitorId: validVisitorId,
          message: "Hello!",
          language: "it",
        },
        headers: {},
      }

      // Mock workspace with enableWidget = false
      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: "workspace-123",
        deletedAt: null,
        channelStatus: true,
        ownerId: "owner-123",
        language: "it",
        debugMode: false,
        wipMessage: null,
        enableWidget: false, // 🚫 Widget DISABLED
      })

      await controller.sendMessage(
        mockRequest as Request,
        mockResponse as Response
      )

      // ✅ Should return 403 Forbidden
      expect(statusMock).toHaveBeenCalledWith(403)
      expect(jsonMock).toHaveBeenCalledWith({
        error: "WIDGET_DISABLED",
        message: "Widget chat is disabled for this workspace",
      })
    })

    it("should NOT block message when enableWidget = true", async () => {
      const validVisitorId = `visitor_${Date.now()}_abc123`

      mockRequest = {
        params: { workspaceId: "workspace-123" },
        body: {
          visitorId: validVisitorId,
          message: "Hello!",
          language: "it",
        },
        headers: {},
      }

      // Mock workspace with enableWidget = true
      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: "workspace-123",
        deletedAt: null,
        channelStatus: true,
        ownerId: "owner-123",
        language: "it",
        debugMode: false,
        wipMessage: null,
        enableWidget: true, // ✅ Widget ENABLED
      })

      // Mock owner as ACTIVE
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        status: "ACTIVE",
      })

      await controller.sendMessage(
        mockRequest as Request,
        mockResponse as Response
      )

      // ✅ Should NOT return 403 (will proceed to security checks, may fail later)
      expect(statusMock).not.toHaveBeenCalledWith(403)
    })
  })

  describe("Edge cases", () => {
    it("should treat missing enableWidget field as false (default)", async () => {
      mockRequest = {
        params: { workspaceId: "workspace-123" },
        query: { language: "it" },
      }

      // Mock workspace WITHOUT enableWidget field (old database schema)
      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: "workspace-123",
        deletedAt: null,
        channelStatus: true,
        ownerId: "owner-123",
        debugMode: false,
        wipMessage: null,
        widgetLanguage: "it",
        // enableWidget: undefined (missing from DB)
      })

      // Mock owner as ACTIVE
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        status: "ACTIVE",
      })

      await controller.getStatus(
        mockRequest as Request,
        mockResponse as Response
      )

      // ✅ Should return "disabled" when enableWidget is missing/undefined
      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        status: "disabled",
        channelStatus: false,
        debugMode: false,
        message: "Widget is disabled",
      })
    })

    it("should work correctly when enableWidget = null", async () => {
      mockRequest = {
        params: { workspaceId: "workspace-123" },
        query: { language: "it" },
      }

      // Mock workspace with enableWidget = null
      ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
        id: "workspace-123",
        deletedAt: null,
        channelStatus: true,
        ownerId: "owner-123",
        debugMode: false,
        wipMessage: null,
        widgetLanguage: "it",
        enableWidget: null,
      })

      // Mock owner as ACTIVE
      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        status: "ACTIVE",
      })

      await controller.getStatus(
        mockRequest as Request,
        mockResponse as Response
      )

      // ✅ Should treat null as disabled
      expect(statusMock).toHaveBeenCalledWith(200)
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        status: "disabled",
        channelStatus: false,
        debugMode: false,
        message: "Widget is disabled",
      })
    })
  })
})
