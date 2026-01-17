import { Request, Response, NextFunction } from "express"
import { MemberController } from "../../../src/interfaces/http/controllers/member.controller"
import { WorkspaceMemberService } from "../../../src/application/services/workspace-member.service"

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}))

describe("MemberController", () => {
  let controller: MemberController
  let mockService: jest.Mocked<WorkspaceMemberService>
  let mockReq: Partial<Request>
  let mockRes: Partial<Response>
  let mockNext: NextFunction

  beforeEach(() => {
    mockService = {
      getMembers: jest.fn(),
      removeMember: jest.fn(),
      getUserRole: jest.fn(),
      isSuperAdmin: jest.fn(),
      isOwner: jest.fn(),
    } as any

    controller = new MemberController(mockService)

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    mockNext = jest.fn()
  })

  // ============================================================================
  // getMembers
  // ============================================================================

  describe("getMembers", () => {
    beforeEach(() => {
      mockReq = {
        params: { workspaceId: "ws-123" },
        workspaceId: "ws-123",
      } as any
    })

    it("should return members successfully", async () => {
      const mockMembers = [
        { id: "user-1", email: "owner@test.com", role: "SUPER_ADMIN" },
        { id: "user-2", email: "admin@test.com", role: "ADMIN" },
      ]
      mockService.getMembers.mockResolvedValue(mockMembers as any)

      await controller.getMembers(mockReq as Request, mockRes as Response, mockNext)

      expect(mockService.getMembers).toHaveBeenCalledWith("ws-123")
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        members: mockMembers,
      })
    })

    it("should use workspaceId from request object if available", async () => {
      ;(mockReq as any).workspaceId = "ws-from-middleware"
      mockReq.params = { workspaceId: "ws-from-params" }
      mockService.getMembers.mockResolvedValue([])

      await controller.getMembers(mockReq as Request, mockRes as Response, mockNext)

      expect(mockService.getMembers).toHaveBeenCalledWith("ws-from-middleware")
    })

    it("should call next on error", async () => {
      const error = new Error("Database error")
      mockService.getMembers.mockRejectedValue(error)

      await controller.getMembers(mockReq as Request, mockRes as Response, mockNext)

      expect(mockNext).toHaveBeenCalledWith(error)
    })
  })

  // ============================================================================
  // removeMember
  // ============================================================================

  describe("removeMember", () => {
    beforeEach(() => {
      mockReq = {
        params: { workspaceId: "ws-123", userId: "user-to-remove" },
        workspaceId: "ws-123",
        user: { id: "super-admin-id" },
      } as any
    })

    it("should remove member successfully", async () => {
      mockService.removeMember.mockResolvedValue({
        success: true,
        workspacesRemoved: 3,
      })

      await controller.removeMember(mockReq as Request, mockRes as Response, mockNext)

      expect(mockService.removeMember).toHaveBeenCalledWith(
        "ws-123",
        "user-to-remove",
        "super-admin-id"
      )
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: "Member removed from 3 workspace(s)",
        workspacesRemoved: 3,
      })
    })

    it("should return 400 if userId is missing", async () => {
      mockReq.params = { workspaceId: "ws-123" }

      await controller.removeMember(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Bad Request",
        message: "User ID is required",
      })
    })

    it("should return 400 if trying to remove self", async () => {
      mockService.removeMember.mockResolvedValue({
        success: false,
        error: "Cannot remove yourself from the workspace",
      })

      await controller.removeMember(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Bad Request",
        message: "Cannot remove yourself from the workspace",
      })
    })

    it("should return 400 if member not found", async () => {
      mockService.removeMember.mockResolvedValue({
        success: false,
        error: "Member not found in workspace",
      })

      await controller.removeMember(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Bad Request",
        message: "Member not found in workspace",
      })
    })

    it("should call next on error", async () => {
      const error = new Error("Database error")
      mockService.removeMember.mockRejectedValue(error)

      await controller.removeMember(mockReq as Request, mockRes as Response, mockNext)

      expect(mockNext).toHaveBeenCalledWith(error)
    })
  })

  // ============================================================================
  // getMyRole
  // ============================================================================

  describe("getMyRole", () => {
    beforeEach(() => {
      mockReq = {
        params: { workspaceId: "ws-123" },
        workspaceId: "ws-123",
        user: { id: "user-123" },
      } as any
    })

    it("should return role for SUPER_ADMIN", async () => {
      mockService.getUserRole.mockResolvedValue("SUPER_ADMIN")
      mockService.isSuperAdmin.mockResolvedValue(true)
      mockService.isOwner.mockResolvedValue(false)

      await controller.getMyRole(mockReq as Request, mockRes as Response, mockNext)

      expect(mockService.getUserRole).toHaveBeenCalledWith("ws-123", "user-123")
      expect(mockService.isSuperAdmin).toHaveBeenCalledWith("ws-123", "user-123")
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        role: "SUPER_ADMIN",
        isSuperAdmin: true,
        isOwner: false,
      })
    })

    it("should return role for ADMIN", async () => {
      mockService.getUserRole.mockResolvedValue("ADMIN")
      mockService.isSuperAdmin.mockResolvedValue(false)
      mockService.isOwner.mockResolvedValue(false)

      await controller.getMyRole(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        role: "ADMIN",
        isSuperAdmin: false,
        isOwner: false,
      })
    })

    it("should return 401 if user is not authenticated", async () => {
      ;(mockReq as any).user = undefined

      await controller.getMyRole(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(401)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Unauthorized",
        message: "Authentication required",
      })
    })

    it("should return null role if user is not a member", async () => {
      mockService.getUserRole.mockResolvedValue(null)
      mockService.isSuperAdmin.mockResolvedValue(false)
      mockService.isOwner.mockResolvedValue(false)

      await controller.getMyRole(mockReq as Request, mockRes as Response, mockNext)

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        role: null,
        isSuperAdmin: false,
        isOwner: false,
      })
    })

    it("should call next on error", async () => {
      const error = new Error("Database error")
      mockService.getUserRole.mockRejectedValue(error)

      await controller.getMyRole(mockReq as Request, mockRes as Response, mockNext)

      expect(mockNext).toHaveBeenCalledWith(error)
    })
  })
})
