import { Request, Response, NextFunction } from "express"
import { InvitationController } from "../../../src/interfaces/http/controllers/invitation.controller"
import { WorkspaceInvitationService } from "../../../src/application/services/workspace-invitation.service"

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

describe("InvitationController", () => {
  let controller: InvitationController
  let mockService: jest.Mocked<WorkspaceInvitationService>
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockNext: NextFunction

  beforeEach(() => {
    mockService = {
      createInvitation: jest.fn(),
      getPendingInvitations: jest.fn(),
      cancelInvitation: jest.fn(),
      resendInvitation: jest.fn(),
      validateToken: jest.fn(),
      acceptInvitation: jest.fn(),
    } as any

    controller = new InvitationController(mockService)

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    mockNext = jest.fn()
  })

  // ============================================================================
  // createInvitation
  // ============================================================================

  describe("createInvitation", () => {
    beforeEach(() => {
      mockReq = {
        params: { workspaceId: "ws-123" },
        body: { email: "test@example.com" },
        workspaceId: "ws-123",
        user: { id: "user-123" },
      } as any
    })

    it("should create invitation successfully", async () => {
      mockService.createInvitation.mockResolvedValue({
        success: true,
        invitation: { id: "inv-123", email: "test@example.com" },
      } as any)

      await controller.createInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockService.createInvitation).toHaveBeenCalledWith({
        workspaceId: "ws-123",
        email: "test@example.com",
        invitedById: "user-123",
      })
      expect(mockRes.status).toHaveBeenCalledWith(201)
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: "Invitation sent successfully",
        invitation: { id: "inv-123", email: "test@example.com" },
      })
    })

    it("should return 400 if email is missing", async () => {
      mockReq.body = {}

      await controller.createInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Bad Request",
        message: "Email is required",
      })
      expect(mockService.createInvitation).not.toHaveBeenCalled()
    })

    it("should return 400 if email format is invalid", async () => {
      mockReq.body = { email: "invalid-email" }

      await controller.createInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Bad Request",
        message: "Invalid email format",
      })
    })

    it("should return 401 if user is not authenticated", async () => {
      ;(mockReq as any).user = undefined

      await controller.createInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: "Authentication required",
      })
    })

    it("should return 400 if service returns error", async () => {
      mockService.createInvitation.mockResolvedValue({
        success: false,
        error: "Invite already pending for this email",
      })

      await controller.createInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Bad Request",
        message: "Invite already pending for this email",
      })
    })

    it("should return 403 when team member limit is reached", async () => {
      mockService.createInvitation.mockResolvedValue({
        success: false,
        error: "Team member limit reached for your plan. Upgrade to add more team members.",
        code: "TEAM_MEMBER_LIMIT_REACHED",
      })

      await controller.createInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Bad Request",
        message: "Team member limit reached for your plan. Upgrade to add more team members.",
        code: "TEAM_MEMBER_LIMIT_REACHED",
      })
    })

    it("should return 500 if email sending fails", async () => {
      mockService.createInvitation.mockRejectedValue(
        new Error("Failed to send invitation email")
      )

      await controller.createInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Email Error",
        message: "Failed to send invitation email. Please try again later.",
      })
    })

    it("should call next on unexpected error", async () => {
      const error = new Error("Unexpected error")
      mockService.createInvitation.mockRejectedValue(error)

      await controller.createInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockNext).toHaveBeenCalledWith(error)
    })
  })

  // ============================================================================
  // getPendingInvitations
  // ============================================================================

  describe("getPendingInvitations", () => {
    beforeEach(() => {
      mockReq = {
        params: { workspaceId: "ws-123" },
        workspaceId: "ws-123",
      } as any
    })

    it("should return pending invitations", async () => {
      const mockInvitations = [
        { id: "inv-1", email: "test1@example.com" },
        { id: "inv-2", email: "test2@example.com" },
      ]
      mockService.getPendingInvitations.mockResolvedValue(mockInvitations as any)

      await controller.getPendingInvitations(mockReq as Request, mockRes as Response, mockNext)

      expect(mockService.getPendingInvitations).toHaveBeenCalledWith("ws-123")
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        invitations: mockInvitations,
      })
    })

    it("should call next on error", async () => {
      const error = new Error("Database error")
      mockService.getPendingInvitations.mockRejectedValue(error)

      await controller.getPendingInvitations(mockReq as Request, mockRes as Response, mockNext)

      expect(mockNext).toHaveBeenCalledWith(error)
    })
  })

  // ============================================================================
  // cancelInvitation
  // ============================================================================

  describe("cancelInvitation", () => {
    beforeEach(() => {
      mockReq = {
        params: { workspaceId: "ws-123", invitationId: "inv-123" },
        workspaceId: "ws-123",
      } as any
    })

    it("should cancel invitation successfully", async () => {
      mockService.cancelInvitation.mockResolvedValue({ success: true })

      await controller.cancelInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockService.cancelInvitation).toHaveBeenCalledWith("inv-123", "ws-123")
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: "Invitation cancelled successfully",
      })
    })

    it("should return 400 if invitationId is missing", async () => {
      mockReq.params = { workspaceId: "ws-123" }

      await controller.cancelInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Bad Request",
        message: "Invitation ID is required",
      })
    })

    it("should return 400 if service returns error", async () => {
      mockService.cancelInvitation.mockResolvedValue({
        success: false,
        error: "Invitation not found",
      })

      await controller.cancelInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Bad Request",
        message: "Invitation not found",
      })
    })

    it("should call next on error", async () => {
      const error = new Error("Database error")
      mockService.cancelInvitation.mockRejectedValue(error)

      await controller.cancelInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockNext).toHaveBeenCalledWith(error)
    })
  })

  // ============================================================================
  // resendInvitation
  // ============================================================================

  describe("resendInvitation", () => {
    beforeEach(() => {
      mockReq = {
        params: { workspaceId: "ws-123", invitationId: "inv-123" },
        workspaceId: "ws-123",
        user: { id: "user-123" },
      } as any
    })

    it("should resend invitation successfully", async () => {
      mockService.resendInvitation.mockResolvedValue({ success: true })

      await controller.resendInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockService.resendInvitation).toHaveBeenCalledWith("inv-123", "ws-123", "user-123")
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: "Invitation resent successfully",
      })
    })

    it("should return 400 if invitationId is missing", async () => {
      mockReq.params = { workspaceId: "ws-123" }

      await controller.resendInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Bad Request",
        message: "Invitation ID is required",
      })
    })

    it("should return 400 if service returns error", async () => {
      mockService.resendInvitation.mockResolvedValue({
        success: false,
        error: "Cannot resend accepted invitation",
      })

      await controller.resendInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Bad Request",
        message: "Cannot resend accepted invitation",
      })
    })

    it("should call next on error", async () => {
      const error = new Error("Email service error")
      mockService.resendInvitation.mockRejectedValue(error)

      await controller.resendInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockNext).toHaveBeenCalledWith(error)
    })
  })

  // ============================================================================
  // validateToken
  // ============================================================================

  describe("validateToken", () => {
    beforeEach(() => {
      mockReq = {
        params: { token: "valid-token-123" },
      } as any
    })

    it("should validate token successfully", async () => {
      const mockInvitationInfo = {
        email: "test@example.com",
        workspaceName: "Test Workspace",
        invitedBy: { name: "Owner" },
      }
      mockService.validateToken.mockResolvedValue(mockInvitationInfo as any)

      await controller.validateToken(mockReq as Request, mockRes as Response, mockNext)

      expect(mockService.validateToken).toHaveBeenCalledWith("valid-token-123")
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        invitation: mockInvitationInfo,
      })
    })

    it("should return 400 if token is missing", async () => {
      mockReq.params = {}

      await controller.validateToken(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Bad Request",
        message: "Token is required",
      })
    })

    it("should return 404 if token is invalid", async () => {
      mockService.validateToken.mockResolvedValue(null)

      await controller.validateToken(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Not Found",
        message: "Invalid invitation token",
      })
    })

    it("should call next on error", async () => {
      const error = new Error("Database error")
      mockService.validateToken.mockRejectedValue(error)

      await controller.validateToken(mockReq as Request, mockRes as Response, mockNext)

      expect(mockNext).toHaveBeenCalledWith(error)
    })
  })

  // ============================================================================
  // acceptInvitation
  // ============================================================================

  describe("acceptInvitation", () => {
    beforeEach(() => {
      mockReq = {
        body: { token: "valid-token-123" },
      } as any
    })

    it("should accept invitation successfully", async () => {
      mockService.acceptInvitation.mockResolvedValue({
        success: true,
        workspaceId: "ws-123",
      })

      await controller.acceptInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockService.acceptInvitation).toHaveBeenCalledWith({ token: "valid-token-123" })
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: "Invitation accepted successfully",
        workspaceId: "ws-123",
      })
    })

    it("should return 400 if token is missing", async () => {
      mockReq.body = {}

      await controller.acceptInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Bad Request",
        message: "Token is required",
      })
    })

    it("should return 404 for invalid token", async () => {
      mockService.acceptInvitation.mockResolvedValue({
        success: false,
        error: "Invalid invitation token",
      })

      await controller.acceptInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(404)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invitation Error",
        message: "Invalid invitation token",
      })
    })

    it("should return 410 for expired invitation", async () => {
      mockService.acceptInvitation.mockResolvedValue({
        success: false,
        error: "Invitation has expired",
      })

      await controller.acceptInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(410)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invitation Error",
        message: "Invitation has expired",
      })
    })

    it("should return 400 for other errors", async () => {
      mockService.acceptInvitation.mockResolvedValue({
        success: false,
        error: "User not found",
      })

      await controller.acceptInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invitation Error",
        message: "User not found",
      })
    })

    it("should call next on error", async () => {
      const error = new Error("Database error")
      mockService.acceptInvitation.mockRejectedValue(error)

      await controller.acceptInvitation(mockReq as Request, mockRes as Response, mockNext)

      expect(mockNext).toHaveBeenCalledWith(error)
    })
  })
})
